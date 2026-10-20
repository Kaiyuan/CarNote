<template>
    <aside class="layout-sidebar">
        <!-- Logo -->
        <button class="sidebar-logo" type="button" @click="router.push('/')"
            v-tooltip.right="siteStore.state.siteName" aria-label="返回首页">
            <img v-if="siteStore.state.siteIcon" :src="siteStore.state.siteIcon" alt="logo" />
            <i v-else class="pi pi-car"></i>
        </button>

        <!-- Navigation -->
        <nav class="sidebar-nav">
            <button v-for="item in primaryItems" :key="item.label" type="button" class="sidebar-nav-item"
                :class="{ active: isLocalActive(item.path) }" v-tooltip.right="item.label"
                :aria-label="item.label" @click="router.push(item.path)">
                <i :class="item.icon"></i>
            </button>

            <div v-if="secondaryItems.length" class="sidebar-divider"></div>

            <button v-for="item in secondaryItems" :key="item.label" type="button" class="sidebar-nav-item"
                :class="{ active: isLocalActive(item.path) }" v-tooltip.right="item.label"
                :aria-label="item.label" @click="router.push(item.path)">
                <i :class="item.icon"></i>
            </button>
        </nav>

        <!-- Bottom Actions -->
        <div class="sidebar-bottom">
            <a href="https://github.com/Kaiyuan/CarNote" target="_blank" rel="noopener"
                class="sidebar-nav-item" v-tooltip.right="'GitHub'" aria-label="GitHub">
                <i class="pi pi-github"></i>
            </a>
            <button type="button" class="sidebar-nav-item" v-tooltip.right="'设置'" aria-label="设置"
                @click="router.push('/settings')">
                <i class="pi pi-cog"></i>
            </button>
            <button v-if="currentUser" type="button" class="sidebar-avatar" v-tooltip.right="'退出登录'"
                aria-label="退出登录" @click="$emit('logout')">
                {{ userInitial }}
            </button>
        </div>
    </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSiteStore } from '../utils/siteStore'

const siteStore = useSiteStore()

const props = defineProps({
    menuItems: {
        type: Array,
        default: () => []
    },
    currentUser: {
        type: Object,
        default: null
    }
})

defineEmits(['logout'])
const router = useRouter()
const route = useRoute()

const systemPaths = ['/messages', '/membership', '/admin']

const primaryItems = computed(() => props.menuItems.filter(item => !systemPaths.includes(item.path)))
const secondaryItems = computed(() => props.menuItems.filter(item => systemPaths.includes(item.path)))

const isLocalActive = (path) => {
    if (path === '/' && route.path === '/') return true
    if (path !== '/' && route.path.startsWith(path)) return true
    return false
}

const userInitial = computed(() => {
    if (props.currentUser && props.currentUser.username) {
        return props.currentUser.username.charAt(0).toUpperCase()
    }
    return 'U'
})
</script>

<style scoped>
.layout-sidebar {
    width: 84px;
    height: 100vh;
    position: sticky;
    top: 0;
    z-index: 999;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.25rem 0 1.1rem;
    background: var(--cn-card);
    border-right: 1px solid var(--cn-border);
}

.sidebar-logo {
    width: 2.9rem;
    height: 2.9rem;
    border-radius: 13px;
    border: 1px solid var(--cn-primary);
    background: var(--cn-primary);
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    cursor: pointer;
    margin-bottom: 2.1rem;
    padding: 0;
    transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.sidebar-logo:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 18px rgba(16, 24, 40, 0.16);
}

.sidebar-logo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.sidebar-logo i {
    font-size: 1.15rem;
}

.sidebar-nav {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.45rem;
    width: 100%;
}

.sidebar-nav-item {
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 11px;
    border: 0;
    background: transparent;
    color: var(--cn-muted);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    text-decoration: none;
    padding: 0;
    transition: background-color 0.15s ease, color 0.15s ease;
}

.sidebar-nav-item i {
    font-size: 1.02rem;
}

.sidebar-nav-item:hover {
    background: var(--surface-100);
    color: var(--cn-text);
}

.sidebar-nav-item.active {
    background: var(--cn-primary);
    color: #fff;
    box-shadow: 0 6px 14px rgba(16, 24, 40, 0.18);
}

.sidebar-divider {
    width: 1.75rem;
    height: 1px;
    background: var(--cn-border);
    margin: 0.55rem 0;
}

.sidebar-bottom {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.45rem;
}

.sidebar-avatar {
    width: 2.4rem;
    height: 2.4rem;
    margin-top: 0.35rem;
    border-radius: 50%;
    border: 1px solid var(--cn-border);
    background: var(--surface-100);
    color: var(--cn-text);
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease;
}

.sidebar-avatar:hover {
    background: var(--surface-200);
    border-color: var(--cn-border-strong);
}
</style>
