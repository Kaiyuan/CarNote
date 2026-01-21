/**
 * 通知消息路由
 * 处理公告和工单的管理
 */

const express = require('express');
const router = express.Router();
const { query, get } = require('../config/database');
const { authenticateUser } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * 获取所有公告（分页）
 * GET /api/messages/announcements
 */
router.get('/announcements', authenticateUser, asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const announcements = await query(
        `SELECT a.*, u.username as creator_name 
         FROM announcements a 
         JOIN users u ON a.created_by = u.id 
         ORDER BY a.is_pinned DESC, a.created_at DESC 
         LIMIT ? OFFSET ?`,
        [parseInt(limit), parseInt(offset)]
    );

    const total = await get('SELECT COUNT(*) as count FROM announcements');

    res.json({
        success: true,
        data: {
            announcements,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.count
            }
        }
    });
}));

/**
 * 创建公告（仅管理员）
 * POST /api/messages/announcements
 */
router.post('/announcements', authenticateUser, asyncHandler(async (req, res) => {
    const user = await get('SELECT role FROM users WHERE id = ?', [req.userId]);
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ success: false, message: '无权操作' });
    }

    const { title, content, type, is_pinned } = req.body;

    if (!title || !content) {
        return res.status(400).json({ success: false, message: '标题和内容不能为空' });
    }

    const result = await query(
        `INSERT INTO announcements (title, content, type, created_by, is_pinned) 
         VALUES (?, ?, ?, ?, ?)`,
        [title, content, type || 'info', req.userId, is_pinned ? 1 : 0]
    );

    res.status(201).json({
        success: true,
        message: '公告发布成功',
        data: { id: result.lastID }
    });
}));

/**
 * 更新公告（仅管理员）
 * PUT /api/messages/announcements/:id
 */
router.put('/announcements/:id', authenticateUser, asyncHandler(async (req, res) => {
    const user = await get('SELECT role FROM users WHERE id = ?', [req.userId]);
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ success: false, message: '无权操作' });
    }

    const { title, content, type, is_pinned } = req.body;

    await query(
        `UPDATE announcements 
         SET title = ?, content = ?, type = ?, is_pinned = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [title, content, type, is_pinned ? 1 : 0, req.params.id]
    );

    res.json({ success: true, message: '公告更新成功' });
}));

/**
 * 删除公告（仅管理员）
 * DELETE /api/messages/announcements/:id
 */
router.delete('/announcements/:id', authenticateUser, asyncHandler(async (req, res) => {
    const user = await get('SELECT role FROM users WHERE id = ?', [req.userId]);
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ success: false, message: '无权操作' });
    }

    await query('DELETE FROM announcements WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: '公告删除成功' });
}));

/**
 * 获取用户工单列表
 * GET /api/messages/tickets
 */
router.get('/tickets', authenticateUser, asyncHandler(async (req, res) => {
    const user = await get('SELECT role FROM users WHERE id = ?', [req.userId]);

    let tickets;
    if (user.role === 'admin') {
        // 管理员可以查看所有工单
        tickets = await query(
            `SELECT t.*, u.username, u.email 
             FROM tickets t 
             JOIN users u ON t.user_id = u.id 
             ORDER BY t.created_at DESC`
        );
    } else {
        // 普通用户只能查看自己的工单
        tickets = await query(
            `SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC`,
            [req.userId]
        );
    }

    res.json({ success: true, data: tickets });
}));

/**
 * 创建工单
 * POST /api/messages/tickets
 */
router.post('/tickets', authenticateUser, asyncHandler(async (req, res) => {
    const { title, content, category, priority } = req.body;

    if (!title || !content) {
        return res.status(400).json({ success: false, message: '标题和内容不能为空' });
    }

    const result = await query(
        `INSERT INTO tickets (user_id, title, content, category, priority) 
         VALUES (?, ?, ?, ?, ?)`,
        [req.userId, title, content, category, priority || 'normal']
    );

    res.status(201).json({
        success: true,
        message: '工单提交成功',
        data: { id: result.lastID }
    });
}));

/**
 * 管理员回复工单
 * PUT /api/messages/tickets/:id/respond
 */
router.put('/tickets/:id/respond', authenticateUser, asyncHandler(async (req, res) => {
    const user = await get('SELECT role FROM users WHERE id = ?', [req.userId]);
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ success: false, message: '无权操作' });
    }

    const { admin_response, status } = req.body;

    await query(
        `UPDATE tickets 
         SET admin_response = ?, status = ?, responded_by = ?, 
             responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [admin_response, status || 'in_progress', req.userId, req.params.id]
    );

    res.json({ success: true, message: '工单已回复' });
}));

/**
 * 获取保养提醒
 * GET /api/messages/maintenance-reminders
 */
router.get('/maintenance-reminders', authenticateUser, asyncHandler(async (req, res) => {
    // 获取用户的所有车辆
    const vehicles = await query('SELECT * FROM vehicles WHERE user_id = ?', [req.userId]);

    const reminders = [];

    for (const vehicle of vehicles) {
        // 获取该车辆最近的保养记录
        const lastMaintenance = await get(
            `SELECT * FROM maintenance_records 
             WHERE vehicle_id = ? AND next_maintenance_mileage IS NOT NULL 
             ORDER BY maintenance_date DESC LIMIT 1`,
            [vehicle.id]
        );

        if (lastMaintenance && lastMaintenance.next_maintenance_mileage) {
            const diff = lastMaintenance.next_maintenance_mileage - vehicle.current_mileage;

            // 如果距离下次保养小于阈值，添加提醒
            if (diff <= 1000 && diff >= 0) {
                reminders.push({
                    type: 'maintenance',
                    vehicle: vehicle.plate_number,
                    message: `${vehicle.plate_number} 即将到达保养里程，还剩 ${diff} 公里`,
                    urgency: diff < 500 ? 'high' : 'normal',
                    nextMileage: lastMaintenance.next_maintenance_mileage,
                    currentMileage: vehicle.current_mileage
                });
            }
        }
    }

    res.json({ success: true, data: reminders });
}));

/**
 * 获取配件更换提醒
 * GET /api/messages/parts-reminders
 */
router.get('/parts-reminders', authenticateUser, asyncHandler(async (req, res) => {
    // 获取用户所有车辆的配件
    const parts = await query(
        `SELECT p.*, v.plate_number, v.current_mileage 
         FROM parts p 
         JOIN vehicles v ON p.vehicle_id = v.id 
         WHERE v.user_id = ? AND p.recommended_replacement_mileage IS NOT NULL`,
        [req.userId]
    );

    const reminders = [];

    for (const part of parts) {
        if (part.installed_mileage && part.recommended_replacement_mileage) {
            const targetMileage = part.installed_mileage + part.recommended_replacement_mileage;
            const diff = targetMileage - part.current_mileage;

            if (diff <= 1000 && diff >= 0) {
                reminders.push({
                    type: 'part',
                    vehicle: part.plate_number,
                    partName: part.name,
                    message: `${part.plate_number} 的 ${part.name} 即将需要更换，还剩 ${diff} 公里`,
                    urgency: diff < 500 ? 'high' : 'normal',
                    targetMileage,
                    currentMileage: part.current_mileage
                });
            }
        }
    }

    res.json({ success: true, data: reminders });
}));

/**
 * 获取所有通知（合并提醒）
 * GET /api/messages/notifications
 */
router.get('/notifications', authenticateUser, asyncHandler(async (req, res) => {
    // 获取最新公告
    const announcements = await query(
        `SELECT a.*, u.username as creator_name 
         FROM announcements a 
         JOIN users u ON a.created_by = u.id 
         ORDER BY a.is_pinned DESC, a.created_at DESC 
         LIMIT 5`
    );

    // 获取保养提醒
    const maintenanceReminders = await query(
        `SELECT mr.*, v.plate_number, v.current_mileage 
         FROM maintenance_records mr 
         JOIN vehicles v ON mr.vehicle_id = v.id 
         WHERE v.user_id = ? AND mr.next_maintenance_mileage IS NOT NULL 
         AND mr.next_maintenance_mileage - v.current_mileage <= 1000 
         AND mr.next_maintenance_mileage - v.current_mileage >= 0 
         ORDER BY mr.next_maintenance_mileage - v.current_mileage ASC`,
        [req.userId]
    );

    // 获取配件提醒
    const partsReminders = await query(
        `SELECT p.*, v.plate_number, v.current_mileage 
         FROM parts p 
         JOIN vehicles v ON p.vehicle_id = v.id 
         WHERE v.user_id = ? AND p.recommended_replacement_mileage IS NOT NULL 
         AND (p.installed_mileage + p.recommended_replacement_mileage - v.current_mileage) <= 1000 
         AND (p.installed_mileage + p.recommended_replacement_mileage - v.current_mileage) >= 0`,
        [req.userId]
    );

    // 统计未读工单（普通用户）或待处理工单（管理员）
    const user = await get('SELECT role FROM users WHERE id = ?', [req.userId]);
    const ticketCount = user.role === 'admin'
        ? await get('SELECT COUNT(*) as count FROM tickets WHERE status != ?', ['closed'])
        : await get('SELECT COUNT(*) as count FROM tickets WHERE user_id = ? AND admin_response IS NULL', [req.userId]);

    res.json({
        success: true,
        data: {
            announcements,
            maintenanceReminders,
            partsReminders,
            ticketCount: ticketCount.count,
            hasNotifications: announcements.length > 0 || maintenanceReminders.length > 0 || partsReminders.length > 0 || ticketCount.count > 0
        }
    });
}));

module.exports = router;
