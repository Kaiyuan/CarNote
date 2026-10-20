<template>
    <header class="layout-topbar hidden md:flex">
        <div class="topbar-context">
            <span class="topbar-brand">CarNote</span>
            <i class="pi pi-angle-right topbar-separator"></i>
            <span class="topbar-page">{{ currentTitle }}</span>
        </div>

        <div class="topbar-actions">
            <!-- VIP 会员状态 (由 VIP 模块注入) -->
            <component :is="'VipMembershipBadge'" v-if="siteStore.state.hasVip" />

            <div class="topbar-search">
                <i class="pi pi-search"></i>
                <InputText v-model="searchText" placeholder="搜索车辆、记录..." />
                <span class="topbar-search-hint">⌘K</span>
            </div>

            <Button :icon="isDark ? 'pi pi-sun' : 'pi pi-moon'" text rounded class="topbar-icon-button"
                @click="cycleMode" :aria-label="t('主题')" v-tooltip.bottom="themeLabel" />

            <Dropdown v-model="locale" :options="supportedLocales" optionLabel="label" optionValue="code"
                class="topbar-locale" :aria-label="t('语言')" v-tooltip.bottom="t('语言')" />

            <div class="relative">
                <Button icon="pi pi-bell" text rounded class="topbar-icon-button" @click="toggleNotifications"
                    aria-label="通知" />

                <span v-if="notificationCount > 0" class="topbar-badge">{{ notificationCount > 9 ? '9+' :
                    notificationCount }}</span>

                <!-- Notification Panel -->
                <div v-if="showNotifications" class="notification-panel" @click.stop>
                    <div class="notification-header">
                        <div>
                            <h3>通知</h3>
                            <p>{{ t('{n} 条待处理消息', { n: notificationCount }) }}</p>
                        </div>
                        <Button icon="pi pi-times" text rounded size="small" @click="showNotifications = false" />
                    </div>

                    <div v-if="loading" class="text-center p-4">
                        <ProgressSpinner style="width: 36px; height: 36px" />
                    </div>

                    <div v-else-if="!notifications || (!notifications.maintenanceReminders?.length && !notifications.partsReminders?.length && !notifications.announcements?.length)"
                        class="notification-empty">
                        <i class="pi pi-inbox"></i>
                        <span>暂无新通知</span>
                    </div>

                    <div v-else class="notification-list">
                        <div v-if="notifications.announcements?.length > 0" class="notification-group">
                            <small class="notification-group-title">系统公告</small>
                            <div v-for="announcement in notifications.announcements" :key="'ann-' + announcement.id"
                                class="notification-item" @click="viewAnnouncement(announcement)">
                                <span class="notification-item-icon info"><i class="pi pi-megaphone"></i></span>
                                <div class="notification-item-body">
                                    <div class="notification-item-title">{{ announcement.title }}</div>
                                    <small>{{ formatDate(announcement.created_at) }}</small>
                                </div>
                            </div>
                        </div>

                        <div v-if="notifications.maintenanceReminders?.length > 0" class="notification-group">
                            <small class="notification-group-title">保养提醒</small>
                            <div v-for="reminder in notifications.maintenanceReminders" :key="'maint-' + reminder.id"
                                class="notification-item" @click="goToRemind('/maintenance', reminder.vehicle_id)">
                                <span class="notification-item-icon warning"><i class="pi pi-wrench"></i></span>
                                <div class="notification-item-body">
                                    <div class="notification-item-title">{{ t('{plate} 即将到达保养里程', { plate: reminder.plate_number }) }}</div>
                                    <small>{{ t('还剩 {n} 公里', { n: reminder.next_maintenance_mileage - reminder.current_mileage }) }}</small>
                                </div>
                            </div>
                        </div>

                        <div v-if="notifications.partsReminders?.length > 0" class="notification-group">
                            <small class="notification-group-title">配件提醒</small>
                            <div v-for="part in notifications.partsReminders" :key="'part-' + part.id"
                                class="notification-item" @click="goToRemind('/parts', part.vehicle_id)">
                                <span class="notification-item-icon danger"><i class="pi pi-cog"></i></span>
                                <div class="notification-item-body">
                                    <div class="notification-item-title">{{ part.plate_number }} - {{ part.name }}</div>
                                    <small>即将需要更换</small>
                                </div>
                            </div>
                        </div>

                        <div class="notification-footer">
                            <router-link to="/messages">
                                查看全部消息 <i class="pi pi-arrow-right"></i>
                            </router-link>
                        </div>
                    </div>
                </div>
            </div>

            <button type="button" class="topbar-avatar" v-tooltip.bottom="'账户设置'"
                @click="router.push('/settings')">
                {{ userInitial }}
            </button>
        </div>
    </header>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSiteStore } from '../utils/siteStore'
import { messagesAPI } from '../api'
import { useToast } from 'primevue/usetoast'
import logger from '../utils/logger'
import { useI18n, relativeTime } from '../i18n'
import { useTheme } from '../utils/theme'

const siteStore = useSiteStore()
const toast = useToast()
const { t, locale, supportedLocales } = useI18n()
const { isDark, cycleMode } = useTheme()
const router = useRouter()
const route = useRoute()

const showNotifications = ref(false)
const notifications = ref(null)
const loading = ref(false)
const searchText = ref('')

const themeLabel = computed(() => `${t('主题')}: ${isDark.value ? t('深色') : t('浅色')}`)

const pageTitles = {
    '/': '概览',
    '/vehicles': '车辆管理',
    '/energy': '能耗记录',
    '/maintenance': '保养维修',
    '/parts': '配件管理',
    '/insurance': '车险管理',
    '/analytics': '数据分析',
    '/messages': '消息中心',
    '/settings': '设置',
    '/admin': '系统管理',
    '/membership': '会员中心'
}

const currentTitle = computed(() => {
    const match = Object.keys(pageTitles)
        .filter(path => path !== '/')
        .sort((a, b) => b.length - a.length)
        .find(path => route.path.startsWith(path))
    return match ? pageTitles[match] : (pageTitles[route.path] || '概览')
})

const userInitial = computed(() => {
    try {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}')
        return (user.nickname || user.username || 'U').charAt(0).toUpperCase()
    } catch {
        return 'U'
    }
})

const notificationCount = computed(() => {
    if (!notifications.value) return 0
    const maintenanceCount = notifications.value.maintenanceReminders?.length || 0
    const partsCount = notifications.value.partsReminders?.length || 0
    const announcementCount = notifications.value.announcements?.length || 0
    return maintenanceCount + partsCount + announcementCount
})

const toggleNotifications = async () => {
    showNotifications.value = !showNotifications.value
    if (showNotifications.value && !notifications.value) {
        await loadNotifications()
    }
}

const loadNotifications = async () => {
    loading.value = true
    try {
        const res = await messagesAPI.getNotifications()
        if (res.success) {
            notifications.value = res.data
        }
    } catch (error) {
        logger.error('Failed to load notifications:', error)
    } finally {
        loading.value = false
    }
}

const formatDate = (dateStr) => relativeTime(dateStr)

const viewAnnouncement = (announcement) => {
    toast.add({
        severity: announcement.type || 'info',
        summary: announcement.title,
        detail: announcement.content,
        life: 5000
    })
}

const goToRemind = (path, vehicleId) => {
    showNotifications.value = false
    router.push({ path, query: { vehicle_id: vehicleId } })
}

const handleClickOutside = (event) => {
    const panel = event.target.closest('.notification-panel')
    const button = event.target.closest('.topbar-icon-button')
    if (!panel && !button && showNotifications.value) {
        showNotifications.value = false
    }
}

onMounted(() => {
    loadNotifications()
    document.addEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.layout-topbar {
    position: sticky;
    top: 0;
    z-index: 900;
    height: 72px;
    flex-shrink: 0;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    padding: 0 clamp(1rem, 2.5vw, 2.25rem);
    background: rgba(245, 246, 248, 0.86);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--cn-border);
}

.topbar-context {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-width: 0;
    font-size: 0.82rem;
}

.topbar-brand {
    color: var(--cn-muted);
    font-weight: 600;
}

.topbar-separator {
    font-size: 0.62rem;
    color: var(--cn-subtle);
}

.topbar-page {
    color: var(--cn-text);
    font-weight: 650;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.topbar-actions {
    display: flex;
    align-items: center;
    gap: 0.65rem;
}

.topbar-search {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    height: 2.5rem;
    width: 280px;
    padding: 0 0.75rem;
    background: var(--cn-card);
    border: 1px solid var(--cn-border);
    border-radius: 10px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.topbar-search:focus-within {
    border-color: var(--cn-primary);
    box-shadow: var(--focus-ring);
}

.topbar-search > i {
    color: var(--cn-subtle);
    font-size: 0.85rem;
}

.topbar-search :deep(.p-inputtext) {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
    padding: 0;
    font-size: 0.82rem;
}

.topbar-search :deep(.p-inputtext:enabled:focus) {
    box-shadow: none;
    border: 0;
}

.topbar-search-hint {
    color: var(--cn-subtle);
    font-size: 0.68rem;
    border: 1px solid var(--cn-border);
    border-radius: 5px;
    padding: 0.05rem 0.3rem;
    white-space: nowrap;
}

.topbar-icon-button {
    width: 2.5rem !important;
    height: 2.5rem !important;
    color: var(--cn-muted) !important;
    background: var(--cn-card) !important;
    border: 1px solid var(--cn-border) !important;
    border-radius: 10px !important;
}

.topbar-icon-button:hover {
    color: var(--cn-text) !important;
    background: var(--surface-50) !important;
}

.topbar-badge {
    position: absolute;
    top: -5px;
    right: -5px;
    min-width: 1.1rem;
    height: 1.1rem;
    padding: 0 0.22rem;
    border-radius: 999px;
    background: var(--cn-danger);
    border: 2px solid var(--cn-bg);
    color: #fff;
    font-size: 0.6rem;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
}

.topbar-avatar {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    border: 1px solid var(--cn-border);
    background: var(--surface-100);
    color: var(--cn-text);
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease;
}

.topbar-avatar:hover {
    background: var(--surface-200);
    border-color: var(--cn-border-strong);
}

.notification-panel {
    position: absolute;
    top: calc(100% + 0.65rem);
    right: 0;
    width: 360px;
    max-width: calc(100vw - 2rem);
    background: var(--cn-card);
    border: 1px solid var(--cn-border);
    border-radius: 16px;
    box-shadow: var(--cn-shadow-md);
    z-index: 1000;
    overflow: hidden;
}

.notification-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.1rem 0.8rem;
    border-bottom: 1px solid var(--cn-border);
}

.notification-header h3 {
    margin: 0;
    font-size: 0.95rem;
}

.notification-header p {
    margin: 0.15rem 0 0;
    color: var(--cn-subtle);
    font-size: 0.72rem;
}

.notification-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2.5rem 1rem;
    color: var(--cn-subtle);
    font-size: 0.82rem;
}

.notification-empty i {
    font-size: 1.6rem;
}

.notification-list {
    max-height: 380px;
    overflow-y: auto;
    padding: 0.4rem;
}

.notification-group {
    padding: 0.35rem 0.35rem 0.15rem;
}

.notification-group-title {
    display: block;
    color: var(--cn-subtle);
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 0.35rem 0.45rem;
}

.notification-item {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    padding: 0.6rem 0.5rem;
    border-radius: 9px;
    cursor: pointer;
    transition: background-color 0.15s ease;
}

.notification-item:hover {
    background: var(--surface-50);
}

.notification-item-icon {
    width: 1.9rem;
    height: 1.9rem;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    font-size: 0.8rem;
}

.notification-item-icon.info {
    background: #eff8ff;
    color: #175cd3;
}

.notification-item-icon.warning {
    background: #fffaeb;
    color: #b54708;
}

.notification-item-icon.danger {
    background: #fef3f2;
    color: #b42318;
}

.notification-item-body {
    min-width: 0;
}

.notification-item-title {
    color: var(--cn-text);
    font-size: 0.8rem;
    font-weight: 500;
    line-height: 1.4;
}

.notification-item-body small {
    color: var(--cn-subtle);
    font-size: 0.7rem;
}

.notification-footer {
    padding: 0.7rem 0.75rem 0.55rem;
    border-top: 1px solid var(--cn-border);
    text-align: center;
}

.notification-footer a {
    color: var(--cn-text);
    font-size: 0.78rem;
    font-weight: 600;
    text-decoration: none;
}

.notification-footer a:hover {
    color: var(--cn-accent);
}

@media screen and (max-width: 1200px) {
    .topbar-search {
        width: 220px;
    }

    .topbar-locale {
        width: 7.5rem;
    }
}

.topbar-locale {
    width: 8.75rem;
}

.topbar-locale :deep(.p-dropdown-label) {
    padding: 0.55rem 0.65rem;
    font-size: 0.78rem;
}

.topbar-locale :deep(.p-dropdown-trigger) {
    width: 2rem;
}
</style>
