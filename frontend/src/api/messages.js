/**
 * 消息与通知 API
 */
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:53300/api'

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
})

//Request interceptor
api.interceptors.request.use(
    (config) => {
        const userId = localStorage.getItem('userId')
        if (userId) {
            config.headers['X-User-Id'] = userId
        }
        return config
    },
    (error) => Promise.reject(error)
)

// Response interceptor
api.interceptors.response.use(
    (response) => response.data,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('userId')
            window.location.href = '/login'
        }
        return Promise.reject(error)
    }
)

export default {
    // 公告相关
    getAnnouncements: (params) => api.get('/messages/announcements', { params }),
    createAnnouncement: (data) => api.post('/messages/announcements', data),
    updateAnnouncement: (id, data) => api.put(`/messages/announcements/${id}`, data),
    deleteAnnouncement: (id) => api.delete(`/messages/announcements/${id}`),

    // 工单相关
    getTickets: () => api.get('/messages/tickets'),
    createTicket: (data) => api.post('/messages/tickets', data),
    respondTicket: (id, data) => api.put(`/messages/tickets/${id}/respond`, data),

    // 提醒相关
    getMaintenanceReminders: () => api.get('/messages/maintenance-reminders'),
    getPartsReminders: () => api.get('/messages/parts-reminders'),
    getNotifications: () => api.get('/messages/notifications')
}
