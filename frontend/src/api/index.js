/**
 * API 请求工具类
 * 封装 axios 请求，统一处理认证和错误
 */

import axios from 'axios'

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
        return response.data
    },
    error => {
        console.error('API 请求错误:', error)

        // 401 未授权，跳转到登录页
        if (error.response?.status === 401) {
            localStorage.removeItem('userId')
            localStorage.removeItem('currentUser')
            window.location.href = '/login'
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
    // 获取用户信息
    getProfile: () => api.get('/users/profile'),
    // 获取用户设置
    getSettings: () => api.get('/users/settings'),
    // 更新用户设置
    updateSettings: (data) => api.put('/users/settings', data),
    // 获取 API Keys
    getApiKeys: () => api.get('/users/api-keys'),
    // 创建 API Key
    createApiKey: (data) => api.post('/users/api-keys', data)
}

// System configuration
export const systemAPI = {
    getConfig: () => api.get('/system/config'),
    updateConfig: (data) => api.put('/system/config', data)
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
    getOverview: (vehicleId) => api.get(`/analytics/overview/${vehicleId}`),
    // 获取月度趋势
    getMonthlyTrend: (vehicleId, params) => api.get(`/analytics/monthly-trend/${vehicleId}`, { params })
}

export default api

// 数据备份 API
export const dataAPI = {
    exportData: () => api.get('/data/export'),
    importData: (data) => api.post('/data/import', data)
}
