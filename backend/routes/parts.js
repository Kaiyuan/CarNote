/**
 * 配件管理路由
 * 处理配件库存和更换记录
 */

const express = require('express');
const router = express.Router();
const { query, get } = require('../config/database');
const { authenticateUser } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * 添加配件
 * POST /api/parts
 */
router.post('/', authenticateUser, asyncHandler(async (req, res) => {
    const {
        vehicle_id,
        name,
        part_number,
        installed_date,
        installed_mileage,
        recommended_replacement_mileage,
        recommended_replacement_months,
        photo_url,
        notes
    } = req.body;

    // 验证必填字段
    if (!vehicle_id || !name) {
        return res.status(400).json({
            success: false,
            message: '车辆ID和配件名称不能为空'
        });
    }

    // 验证车辆所有权
    const vehicle = await get(
        'SELECT * FROM vehicles WHERE id = ? AND user_id = ?',
        [vehicle_id, req.userId]
    );

    if (!vehicle) {
        return res.status(404).json({
            success: false,
            message: '车辆不存在'
        });
    }

    // 计算配件状态
    let status = 'normal';
    if (installed_date && recommended_replacement_months) {
        const installDate = new Date(installed_date);
        const monthsElapsed = (new Date() - installDate) / (1000 * 60 * 60 * 24 * 30);

        if (monthsElapsed >= recommended_replacement_months) {
            status = 'expired';
        } else if (monthsElapsed >= recommended_replacement_months * 0.8) {
            status = 'warning';
        }
    }

    if (installed_mileage && recommended_replacement_mileage && vehicle.current_mileage) {
        const mileageElapsed = vehicle.current_mileage - installed_mileage;

        if (mileageElapsed >= recommended_replacement_mileage) {
            status = 'expired';
        } else if (mileageElapsed >= recommended_replacement_mileage * 0.8) {
            status = 'warning';
        }
    }

    // 插入配件
    const result = await query(
        `INSERT INTO parts 
         (vehicle_id, name, part_number, installed_date, installed_mileage,
          recommended_replacement_mileage, recommended_replacement_months, status, photo_url, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [vehicle_id, name, part_number, installed_date, installed_mileage,
            recommended_replacement_mileage, recommended_replacement_months, status, photo_url, notes]
    );

    res.status(201).json({
        success: true,
        message: '配件添加成功',
        data: {
            id: result.lastID,
            status
        }
    });
}));

/**
 * 获取配件列表
 * GET /api/parts
 * 查询参数: vehicle_id, status
 */
router.get('/', authenticateUser, asyncHandler(async (req, res) => {
    const { vehicle_id, status } = req.query;

    let sql = `SELECT p.*, v.plate_number, v.brand, v.model, v.current_mileage 
               FROM parts p 
               JOIN vehicles v ON p.vehicle_id = v.id 
               WHERE v.user_id = ?`;
    const params = [req.userId];

    // 车辆过滤
    if (vehicle_id) {
        sql += ' AND p.vehicle_id = ?';
        params.push(vehicle_id);
    }

    // 状态过滤
    if (status) {
        sql += ' AND p.status = ?';
        params.push(status);
    }

    sql += ' ORDER BY p.status DESC, p.installed_date DESC';

    const parts = await query(sql, params);

    // 更新配件状态（动态计算）
    const updatedParts = parts.map(part => {
        let newStatus = 'normal';

        // 按时间判断
        if (part.installed_date && part.recommended_replacement_months) {
            const installDate = new Date(part.installed_date);
            const monthsElapsed = (new Date() - installDate) / (1000 * 60 * 60 * 24 * 30);

            if (monthsElapsed >= part.recommended_replacement_months) {
                newStatus = 'expired';
            } else if (monthsElapsed >= part.recommended_replacement_months * 0.8) {
                newStatus = 'warning';
            }
        }

        // 按里程判断
        if (part.installed_mileage && part.recommended_replacement_mileage && part.current_mileage) {
            const mileageElapsed = part.current_mileage - part.installed_mileage;

            if (mileageElapsed >= part.recommended_replacement_mileage) {
                newStatus = 'expired';
            } else if (mileageElapsed >= part.recommended_replacement_mileage * 0.8 && newStatus !== 'expired') {
                newStatus = 'warning';
            }
        }

        return {
            ...part,
            computed_status: newStatus
        };
    });

    res.json({
        success: true,
        data: updatedParts
    });
}));

/**
 * 获取单个配件详情
 * GET /api/parts/:id
 */
router.get('/:id', authenticateUser, asyncHandler(async (req, res) => {
    const part = await get(
        `SELECT p.*, v.plate_number, v.brand, v.model, v.current_mileage, v.user_id 
         FROM parts p 
         JOIN vehicles v ON p.vehicle_id = v.id 
         WHERE p.id = ?`,
        [req.params.id]
    );

    if (!part) {
        return res.status(404).json({
            success: false,
            message: '配件不存在'
        });
    }

    if (part.user_id !== req.userId) {
        return res.status(403).json({
            success: false,
            message: '无权访问此配件'
        });
    }

    res.json({
        success: true,
        data: part
    });
}));

/**
 * 更新配件信息
 * PUT /api/parts/:id
 */
router.put('/:id', authenticateUser, asyncHandler(async (req, res) => {
    const {
        name,
        part_number,
        installed_date,
        installed_mileage,
        recommended_replacement_mileage,
        recommended_replacement_months,
        status,
        photo_url,
        notes
    } = req.body;

    // 验证配件存在且属于该用户
    const part = await get(
        `SELECT p.*, v.user_id 
         FROM parts p 
         JOIN vehicles v ON p.vehicle_id = v.id 
         WHERE p.id = ?`,
        [req.params.id]
    );

    if (!part || part.user_id !== req.userId) {
        return res.status(404).json({
            success: false,
            message: '配件不存在'
        });
    }

    // 更新配件
    await query(
        `UPDATE parts 
         SET name = ?, part_number = ?, installed_date = ?, installed_mileage = ?,
             recommended_replacement_mileage = ?, recommended_replacement_months = ?,
             status = ?, photo_url = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name, part_number, installed_date, installed_mileage,
            recommended_replacement_mileage, recommended_replacement_months,
            status, photo_url, notes, req.params.id]
    );

    res.json({
        success: true,
        message: '配件信息更新成功'
    });
}));

/**
 * 删除配件
 * DELETE /api/parts/:id
 */
router.delete('/:id', authenticateUser, asyncHandler(async (req, res) => {
    // 验证配件存在且属于该用户
    const part = await get(
        `SELECT p.*, v.user_id 
         FROM parts p 
         JOIN vehicles v ON p.vehicle_id = v.id 
         WHERE p.id = ?`,
        [req.params.id]
    );

    if (!part || part.user_id !== req.userId) {
        return res.status(404).json({
            success: false,
            message: '配件不存在'
        });
    }

    await query('DELETE FROM parts WHERE id = ?', [req.params.id]);

    res.json({
        success: true,
        message: '配件已删除'
    });
}));

/**
 * 记录配件更换
 * POST /api/parts/replacements
 */
router.post('/replacements', authenticateUser, asyncHandler(async (req, res) => {
    const {
        vehicle_id,
        part_id,
        replacement_date,
        mileage,
        old_part_name,
        new_part_name,
        part_number,
        cost,
        service_provider,
        notes
    } = req.body;

    // 验证必填字段
    if (!vehicle_id || !replacement_date || !mileage) {
        return res.status(400).json({
            success: false,
            message: '车辆ID、更换日期和里程不能为空'
        });
    }

    // 验证车辆所有权
    const vehicle = await get(
        'SELECT * FROM vehicles WHERE id = ? AND user_id = ?',
        [vehicle_id, req.userId]
    );

    if (!vehicle) {
        return res.status(404).json({
            success: false,
            message: '车辆不存在'
        });
    }

    // 插入更换记录
    const result = await query(
        `INSERT INTO part_replacements 
         (vehicle_id, part_id, replacement_date, mileage, old_part_name, new_part_name,
          part_number, cost, service_provider, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [vehicle_id, part_id, replacement_date, mileage, old_part_name, new_part_name,
            part_number, cost, service_provider, notes]
    );

    // 如果关联了配件ID，更新配件的安装信息
    if (part_id) {
        await query(
            `UPDATE parts 
             SET installed_date = ?, installed_mileage = ?, status = 'normal', 
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [replacement_date, mileage, part_id]
        );
    }

    res.status(201).json({
        success: true,
        message: '配件更换记录添加成功',
        data: {
            id: result.lastID
        }
    });
}));

/**
 * 获取配件更换记录
 * GET /api/parts/replacements
 * 查询参数: vehicle_id
 */
router.get('/replacements/list', authenticateUser, asyncHandler(async (req, res) => {
    const { vehicle_id } = req.query;

    let sql = `SELECT pr.*, v.plate_number, v.brand, v.model 
               FROM part_replacements pr 
               JOIN vehicles v ON pr.vehicle_id = v.id 
               WHERE v.user_id = ?`;
    const params = [req.userId];

    if (vehicle_id) {
        sql += ' AND pr.vehicle_id = ?';
        params.push(vehicle_id);
    }

    sql += ' ORDER BY pr.replacement_date DESC';

    const replacements = await query(sql, params);

    res.json({
        success: true,
        data: replacements
    });
}));

module.exports = router;
