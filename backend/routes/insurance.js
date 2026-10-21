const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { query, get } = require('../config/database');
const { finalizeUploadedFile, removeFileQuietly } = require('../utils/uploadSecurity');
const { authenticateUser } = require('../middleware/auth');
const { recognizePolicy } = require('../services/ocrService');

// 与系统设置上传目录保持一致 (server.js 中 UPLOAD_PATH 静态服务指向的目录)
function getBaseUploadDir() {
    const uploadPath = process.env.UPLOAD_PATH || './uploads';
    return path.isAbsolute(uploadPath) ? uploadPath : path.resolve(process.cwd(), uploadPath);
}

// 配置文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const now = new Date();
        const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        // 保存在系统上传目录 (UPLOAD_PATH) 下的 insurance 子目录，按时间 (YYYY-MM) 分类，
        // 这样重置镜像后仍能通过数据卷保留车险保单文件
        const uploadDir = path.join(getBaseUploadDir(), 'insurance', yearMonth);

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // 先使用无意义扩展名，校验真实文件内容后再改为安全扩展名
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        cb(null, `policy-${uniqueSuffix}.upload`);
    }
});

const ALLOWED_POLICY_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 限制 10MB
    fileFilter: (req, file, cb) => {
        if (ALLOWED_POLICY_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('只支持上传 JPG、PNG、WebP 图片或 PDF 文件'));
        }
    }
});

/**
 * 校验车辆是否存在且属于当前用户。
 * 未绑定车辆时返回 true；绑定了他人车辆或不存在时返回 false。
 */
async function isOwnedVehicle(userId, vehicleId) {
    if (vehicleId === undefined || vehicleId === null || vehicleId === '') return true;

    const vehicle = await get(
        'SELECT id FROM vehicles WHERE id = ? AND user_id = ?',
        [vehicleId, userId]
    );
    return Boolean(vehicle);
}

/**
 * 检查用户是否具备上传权限 (VIP 模块判定)
 */
async function checkUploadPermission(userId) {
    const vipDir = path.resolve(process.cwd(), 'vip');
    const hasVipModule = fs.existsSync(vipDir);

    if (!hasVipModule) {
        return { allowed: true };
    }

    try {
        const membership = await get('SELECT tier, expiry_date FROM memberships WHERE user_id = ?', [userId]);
        if (!membership) {
            return { allowed: false, message: '上传车险保单属于 VIP 功能，请先开通 VIP 会员' };
        }

        const now = new Date();
        const expiry = new Date(membership.expiry_date);
        if (expiry < now || membership.tier === 'ordinary') {
            return { allowed: false, message: '您的 VIP 会员已过期或权限不足，无法上传保单' };
        }

        return { allowed: true };
    } catch (err) {
        console.error('[Insurance] VIP 权限检查异常:', err);
        return { allowed: false, message: '上传权限校验失败，请稍后重试' };
    }
}

// 1. 获取保单列表
router.get('/', authenticateUser, async (req, res) => {
    try {
        const { vehicle_id } = req.query;
        let sql = `
            SELECT i.*, v.plate_number, v.brand, v.model
            FROM insurances i
            LEFT JOIN vehicles v ON i.vehicle_id = v.id
            WHERE i.user_id = ?
        `;
        const params = [req.userId];

        if (vehicle_id) {
            sql += ' AND i.vehicle_id = ?';
            params.push(vehicle_id);
        }

        sql += ' ORDER BY i.end_date DESC, i.id DESC';

        const insurances = await query(sql, params);

        // 附带每条保单的出险总次数和总赔款
        for (let item of insurances) {
            const claimsStat = await get(`
                SELECT COUNT(*) as claim_count, COALESCE(SUM(claim_amount), 0) as total_claim_amount
                FROM insurance_claims
                WHERE insurance_id = ?
            `, [item.id]);

            item.claim_count = claimsStat ? claimsStat.claim_count : 0;
            item.total_claim_amount = claimsStat ? claimsStat.total_claim_amount : 0;
        }

        res.json({ success: true, data: insurances });
    } catch (err) {
        console.error('[Insurance] 获取保险列表失败:', err);
        res.status(500).json({ success: false, message: '获取保险列表失败' });
    }
});

// 2. 获取单条保单详情 (含出险记录)
router.get('/:id', authenticateUser, async (req, res) => {
    try {
        const insurance = await get(`
            SELECT i.*, v.plate_number, v.brand, v.model
            FROM insurances i
            LEFT JOIN vehicles v ON i.vehicle_id = v.id
            WHERE i.id = ? AND i.user_id = ?
        `, [req.params.id, req.userId]);

        if (!insurance) {
            return res.status(404).json({ success: false, message: '保险记录不存在' });
        }

        const claims = await query(`
            SELECT * FROM insurance_claims
            WHERE insurance_id = ? AND user_id = ?
            ORDER BY claim_date DESC, id DESC
        `, [req.params.id, req.userId]);

        insurance.claims = claims;

        res.json({ success: true, data: insurance });
    } catch (err) {
        console.error('[Insurance] 获取保单详情失败:', err);
        res.status(500).json({ success: false, message: '获取保单详情失败' });
    }
});

// 3. 上传保单 (含 VIP 限制与 OCR 识别)
router.post('/upload', authenticateUser, async (req, res) => {
    const perm = await checkUploadPermission(req.userId);
    if (!perm.allowed) {
        return res.status(403).json({ success: false, message: perm.message });
    }

    upload.single('file')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: '请选择要上传的文件' });
        }

        const finalized = finalizeUploadedFile(req.file, ALLOWED_POLICY_TYPES);
        if (!finalized) {
            removeFileQuietly(req.file.path);
            return res.status(400).json({
                success: false,
                message: '文件内容与类型不匹配，只支持 JPG、PNG、WebP 图片或 PDF 文件'
            });
        }

        try {
            // 生成可访问的相对 URL (基于系统上传目录, 对应 /uploads 静态服务)
            const relativePath = path.relative(getBaseUploadDir(), req.file.path).replace(/\\/g, '/');
            const fileUrl = '/uploads/' + relativePath;

            // 记录附件 (用于后台附件管理)
            try {
                const { recordAttachment } = require('../services/attachmentService');
                await recordAttachment({
                    userId: req.userId,
                    originalName: req.file.originalname,
                    storedName: req.file.filename,
                    mimetype: req.file.mimetype,
                    size: req.file.size,
                    url: fileUrl,
                    projectType: 'insurance'
                });
            } catch (e) {
                console.error('[Insurance] 记录附件失败:', e.message);
            }

            // 执行 OCR 识别
            const ocrResult = await recognizePolicy(req.file.path);

            res.json({
                success: true,
                data: {
                    imageUrl: fileUrl,
                    ocrContent: ocrResult.rawText,
                    parsedData: ocrResult.parsedData
                }
            });
        } catch (error) {
            console.error('[Insurance] OCR 处理失败:', error);
            res.status(500).json({ success: false, message: '保单识别过程出错' });
        }
    });
});

// 4. 新增保险记录
router.post('/', authenticateUser, async (req, res) => {
    try {
        const {
            vehicle_id,
            policy_number,
            insurance_company,
            start_date,
            end_date,
            premium,
            type,
            policy_image_url,
            ocr_content,
            notes
        } = req.body;

        if (!(await isOwnedVehicle(req.userId, vehicle_id))) {
            return res.status(404).json({ success: false, message: '车辆不存在' });
        }

        const result = await query(`
            INSERT INTO insurances (
                user_id, vehicle_id, policy_number, insurance_company,
                start_date, end_date, premium, type,
                policy_image_url, ocr_content, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            req.userId,
            vehicle_id || null,
            policy_number || null,
            insurance_company || null,
            start_date || null,
            end_date || null,
            premium || 0,
            type || '商业险',
            policy_image_url || null,
            ocr_content || null,
            notes || null
        ]);

        res.json({
            success: true,
            data: { id: result.lastID },
            message: '保险记录创建成功'
        });
    } catch (err) {
        console.error('[Insurance] 创建保险记录失败:', err);
        res.status(500).json({ success: false, message: '创建保险记录失败' });
    }
});

// 5. 更新保险记录
router.put('/:id', authenticateUser, async (req, res) => {
    try {
        const insurance = await get('SELECT id FROM insurances WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
        if (!insurance) {
            return res.status(404).json({ success: false, message: '未找到相关保险记录' });
        }

        const {
            vehicle_id,
            policy_number,
            insurance_company,
            start_date,
            end_date,
            premium,
            type,
            policy_image_url,
            ocr_content,
            notes
        } = req.body;

        if (!(await isOwnedVehicle(req.userId, vehicle_id))) {
            return res.status(404).json({ success: false, message: '车辆不存在' });
        }

        await query(`
            UPDATE insurances SET
                vehicle_id = ?,
                policy_number = ?,
                insurance_company = ?,
                start_date = ?,
                end_date = ?,
                premium = ?,
                type = ?,
                policy_image_url = ?,
                ocr_content = ?,
                notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `, [
            vehicle_id || null,
            policy_number || null,
            insurance_company || null,
            start_date || null,
            end_date || null,
            premium || 0,
            type || '商业险',
            policy_image_url || null,
            ocr_content || null,
            notes || null,
            req.params.id,
            req.userId
        ]);

        res.json({ success: true, message: '更新保险记录成功' });
    } catch (err) {
        console.error('[Insurance] 更新保险记录失败:', err);
        res.status(500).json({ success: false, message: '更新保险记录失败' });
    }
});

// 6. 删除保险记录
router.delete('/:id', authenticateUser, async (req, res) => {
    try {
        const result = await query('DELETE FROM insurances WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: '保险记录不存在或无权删除' });
        }
        res.json({ success: true, message: '删除保险记录成功' });
    } catch (err) {
        console.error('[Insurance] 删除保险记录失败:', err);
        res.status(500).json({ success: false, message: '删除保险记录失败' });
    }
});

// 7. 新增出险记录
router.post('/:id/claims', authenticateUser, async (req, res) => {
    try {
        const insurance = await get('SELECT id FROM insurances WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
        if (!insurance) {
            return res.status(404).json({ success: false, message: '未找到对应保险记录' });
        }

        const { claim_date, description, claim_amount, status, notes } = req.body;

        const result = await query(`
            INSERT INTO insurance_claims (
                insurance_id, user_id, claim_date, description, claim_amount, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            req.params.id,
            req.userId,
            claim_date || new Date().toISOString().split('T')[0],
            description || '',
            claim_amount || 0,
            status || 'processing',
            notes || ''
        ]);

        res.json({ success: true, data: { id: result.lastID }, message: '添加出险记录成功' });
    } catch (err) {
        console.error('[Insurance] 添加出险记录失败:', err);
        res.status(500).json({ success: false, message: '添加出险记录失败' });
    }
});

// 8. 删除出险记录
router.delete('/claims/:claimId', authenticateUser, async (req, res) => {
    try {
        const result = await query('DELETE FROM insurance_claims WHERE id = ? AND user_id = ?', [req.params.claimId, req.userId]);
        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: '出险记录不存在或无权删除' });
        }
        res.json({ success: true, message: '删除出险记录成功' });
    } catch (err) {
        console.error('[Insurance] 删除出险记录失败:', err);
        res.status(500).json({ success: false, message: '删除出险记录失败' });
    }
});

module.exports = router;
