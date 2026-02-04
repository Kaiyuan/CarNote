/**
 * API 请求工具类
 * 封装 axios 请求，统一处理认证和错误
 */

import axios from 'axios'
import logger from '../utils/logger'

// 创建 axios 实例
const api = axios.create({
    baseURL: '/api',
    timeout: 10000
})

// 请求拦截器 - 添加认证头
api.interceptors.request.use(
    config => {
        const userId = localStorage.getItem('userId')
        if (userId) {
            config.headers['X-User-Id'] = userId
        }
        return config
    },
    error => {
        return Promise.reject(error)
    }
)

// 响应拦截器 - 统一处理错误
api.interceptors.response.use(
    response => {
        logger.info(`API Success [${response.config.method.toUpperCase()}] ${response.config.url}`, response.data);
        return response.data
    },
    error => {
        logger.error(`API Error [${error.config?.method?.toUpperCase()}] ${error.config?.url}:`, error.response?.data || error.message);

        // 401 未授权，跳转到登录页 (排除本身在登录页或需要验证的情况)
        if (error.response?.status === 401) {
            const isLoginPage = window.location.pathname === '/login';
            const needVerify = error.response?.data?.needVerify;

            if (!isLoginPage && !needVerify) {
                localStorage.removeItem('userId')
                localStorage.removeItem('currentUser')
                window.location.href = '/login'
            }
        }

        return Promise.reject(error.response?.data || error.message)
    }
)

// 用户 API
export const userAPI = {
    // 注册
    register: (data) => api.post('/users/register', data),
    // 登录
    login: (data) => api.post('/users/login', data),
    // 验证邮箱
    verifyEmail: (data) => api.post('/users/verify-email', data),
    // 重新发送验证邮件
    resendVerificationEmail: (data) => api.post('/users/verify-email/resend', data),
    // 获取通用验证码
    getCaptcha: () => api.get('/users/captcha'),
    // 获取用户信息
    getProfile: () => api.get('/users/profile'),
    // 获取用户设置
    getSettings: () => api.get('/users/settings'),
    // 更新用户设置
    updateSettings: (data) => api.put('/users/settings', data),
    // 获取 API Keys
    getApiKeys: () => api.get('/users/api-keys'),
    // 创建 API Key
    createApiKey: (data) => api.post('/users/api-keys', data),
    // 忘记密码
    forgotPassword: (data) => api.post('/users/forgot-password', data),
    // 获取忘记密码验证码
    getForgotPasswordCaptcha: () => api.get('/users/forgot-password/captcha'),
    // 重置密码
    resetPassword: (data) => api.post('/users/reset-password', data),
    // 删除 API Key
    deleteApiKey: (id) => api.delete(`/users/api-keys/${id}`)
}

// System configuration
export const systemAPI = {
    getConfig: () => api.get('/system/config'),
    updateConfig: (data) => api.put('/system/config', data),
    uploadIcon: (formData) => api.post('/system/upload-icon', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })
}

// 车辆 API
export const vehicleAPI = {
    // 获取车辆列表
    getList: (params) => api.get('/vehicles', { params }),
    // 获取车辆详情
    getDetail: (id) => api.get(`/vehicles/${id}`),
    // 添加车辆
    create: (data) => api.post('/vehicles', data),
    // 更新车辆
    update: (id, data) => api.put(`/vehicles/${id}`, data),
    // 删除车辆
    delete: (id) => api.delete(`/vehicles/${id}`)
}

// 能耗记录 API
export const energyAPI = {
    // 获取记录列表
    getList: (params) => api.get('/energy', { params }),
    // 获取单条记录
    getDetail: (id) => api.get(`/energy/${id}`),
    // 添加记录
    create: (data) => api.post('/energy', data),
    // 更新记录
    update: (id, data) => api.put(`/energy/${id}`, data),
    // 删除记录
    delete: (id) => api.delete(`/energy/${id}`)
}

// 保养维修 API
export const maintenanceAPI = {
    // 获取记录列表
    getList: (params) => api.get('/maintenance', { params }),
    // 获取单条记录
    getDetail: (id) => api.get(`/maintenance/${id}`),
    // 添加记录
    create: (data) => api.post('/maintenance', data),
    // 更新记录
    update: (id, data) => api.put(`/maintenance/${id}`, data),
    // 删除记录
    delete: (id) => api.delete(`/maintenance/${id}`),
    // 获取提醒
    getReminders: (vehicleId) => api.get(`/maintenance/reminders/${vehicleId}`)
}

// 配件 API
export const partsAPI = {
    // 获取配件列表
    getList: (params) => api.get('/parts', { params }),
    // 获取单个配件
    getDetail: (id) => api.get(`/parts/${id}`),
    // 添加配件
    create: (data) => api.post('/parts', data),
    // 更新配件
    update: (id, data) => api.put(`/parts/${id}`, data),
    // 删除配件
    delete: (id) => api.delete(`/parts/${id}`),
    // 获取更换记录
    getReplacements: (params) => api.get('/parts/replacements/list', { params }),
    // 添加更换记录
    createReplacement: (data) => api.post('/parts/replacements', data)
}

// 数据分析 API
export const analyticsAPI = {
    // 获取能耗趋势
    getConsumption: (vehicleId, params) => api.get(`/analytics/consumption/${vehicleId}`, { params }),
    // 获取费用统计
    getExpenses: (vehicleId, params) => api.get(`/analytics/expenses/${vehicleId}`, { params }),
    // 获取位置数据
    getLocations: (vehicleId) => api.get(`/analytics/locations/${vehicleId}`),
    // 获取总览
    getOverview: (vehicleId, params) => api.get(`/analytics/overview/${vehicleId}`, { params }),
    // 获取月度趋势
    getMonthlyTrend: (vehicleId, params) => api.get(`/analytics/monthly-trend/${vehicleId}`, { params })
}

// 导出记录 API
export const exportAPI = {
    all: () => api.get('/export/all'),
    vehicles: () => api.get('/export/vehicles'),
    energy: () => api.get('/export/energy'),
    maintenance: () => api.get('/export/maintenance')
}

// 导入记录 API
export const importAPI = {
    validate: (data) => api.post('/import/validate', { data }),
    execute: (data) => api.post('/import/execute', { data })
}

// 管理员 API
export const adminAPI = {
    getUsers: () => api.get('/admin/users'),
    createUser: (data) => api.post('/admin/users', data),
    updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
    adminResetPassword: (id) => api.post(`/admin/users/${id}/reset-password`),
    getSmtpConfig: () => api.get('/admin/settings/smtp'),
    updateSmtpConfig: (data) => api.put('/admin/settings/smtp', data),
    getLoginLogs: () => api.get('/admin/logs/login'),
    getAllVehicles: (params) => api.get('/admin/vehicles', { params }),
    updateVehicle: (id, data) => api.put(`/admin/vehicles/${id}`, data),
    deleteVehicle: (id) => api.delete(`/admin/vehicles/${id}`),
    getAllEnergy: (params) => api.get('/admin/energy', { params }),
    updateEnergy: (id, data) => api.put(`/admin/energy/${id}`, data),
    deleteEnergy: (id) => api.delete(`/admin/energy/${id}`),
    getAllMaintenance: (params) => api.get('/admin/maintenance', { params }),
    updateMaintenance: (id, data) => api.put(`/admin/maintenance/${id}`, data),
    deleteMaintenance: (id) => api.delete(`/admin/maintenance/${id}`),
    getAllParts: (params) => api.get('/admin/parts', { params }),
    updatePart: (id, data) => api.put(`/admin/parts/${id}`, data),
    deletePart: (id) => api.delete(`/admin/parts/${id}`),
    getLocations: () => api.get('/admin/locations'),
    updateLocation: (id, data) => api.put(`/admin/locations/${id}`, data),
    deleteLocation: (id) => api.delete(`/admin/locations/${id}`)
}

// Locations API
export const locationsAPI = {
    searchNearby: (params) => api.get('/locations/nearby', { params })
}

// Messages and Notifications API
export const messagesAPI = {
    getAnnouncements: (params) => api.get('/messages/announcements', { params }),
    createAnnouncement: (data) => api.post('/messages/announcements', data),
    updateAnnouncement: (id, data) => api.put(`/messages/announcements/${id}`, data),
    deleteAnnouncement: (id) => api.delete(`/messages/announcements/${id}`),
    getTickets: () => api.get('/messages/tickets'),
    createTicket: (data) => api.post('/messages/tickets', data),
    respondTicket: (id, data) => api.put(`/messages/tickets/${id}/respond`, data),
    getMaintenanceReminders: () => api.get('/messages/maintenance-reminders'),
    getPartsReminders: () => api.get('/messages/parts-reminders'),
    getNotifications: () => api.get('/messages/notifications')
}

export default api;
