/**
 * Vue Router 路由配置
 */

import { createRouter, createWebHistory } from 'vue-router'

// 懒加载页面组件
const Home = () => import('../views/Home.vue')
const Login = () => import('../views/Login.vue')
const VehicleList = () => import('../views/VehicleList.vue')
const EnergyLog = () => import('../views/EnergyLog.vue')
const Maintenance = () => import('../views/Maintenance.vue')
const Parts = () => import('../views/Parts.vue')
const Analytics = () => import('../views/Analytics.vue')
const Settings = () => import('../views/Settings.vue')

// 路由配置
const routes = [
    {
        path: '/',
        name: 'Home',
        component: Home,
        meta: { requiresAuth: true }
    },
    {
        path: '/login',
        name: 'Login',
        component: Login
    },
    {
        path: '/vehicles',
        name: 'VehicleList',
        component: VehicleList,
        meta: { requiresAuth: true }
    },
    {
        path: '/energy',
        name: 'EnergyLog',
        component: EnergyLog,
        meta: { requiresAuth: true }
    },
    {
        path: '/maintenance',
        name: 'Maintenance',
        component: Maintenance,
        meta: { requiresAuth: true }
    },
    {
        path: '/parts',
        name: 'Parts',
        component: Parts,
        meta: { requiresAuth: true }
    },
    {
        path: '/analytics',
        name: 'Analytics',
        component: Analytics,
        meta: { requiresAuth: true }
    },
    {
        path: '/settings',
        name: 'Settings',
        component: Settings,
        meta: { requiresAuth: true }
    }
]

// 创建路由实例
const router = createRouter({
    history: createWebHistory(),
    routes
})

// 路由守卫 - 检查登录状态
router.beforeEach((to, from, next) => {
    const userId = localStorage.getItem('userId')

    if (to.meta.requiresAuth && !userId) {
        // 需要登录但未登录，跳转到登录页
        next('/login')
    } else if (to.path === '/login' && userId) {
        // 已登录访问登录页，跳转到首页
        next('/')
    } else {
        next()
    }
})

// 路由错误处理 (处理动态加载模块失败的情况，通常是由于版本更新导致旧文件 404)
router.onError((error, to) => {
    if (error.message.includes('Failed to fetch dynamically imported module') ||
        error.message.includes('Importing a dangling component')) {
        console.warn('检测到组件加载失败，可能是由于版本更新，正在尝试强制刷新...');
        window.location.href = to.fullPath;
    }
});

export default router;
