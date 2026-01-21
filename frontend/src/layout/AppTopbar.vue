<template>
    <div class="layout-topbar hidden md:flex justify-content-between align-items-center px-4 py-3 bg-transparent">
        <!-- Breadcrumb / Title area -->
        <div class="flex align-items-center">
            <h2 class="m-0 text-900 font-semibold hidden md:block">{{ siteStore.state.siteName }}</h2>
        </div>

        <!-- Actions -->
        <div class="flex align-items-center gap-3">
            <!-- Search Bar (Visual only for now) -->
            <span class="p-input-icon-left hidden md:block">
                <i class="pi pi-search text-500" />
                <InputText placeholder="Search" class="border-round-2xl surface-100 border-none w-15rem" />
            </span>

            <!-- Notifications Bell -->
            <div class="p-relative">
                <Button 
                    icon="pi pi-bell" 
                    text 
                    rounded 
                    class="text-500" 
                    @click="toggleNotifications"
                    :badge="notificationCount > 0 ? notificationCount.toString() : null"
                    badgeSeverity="danger"
                />
                
                <!-- Notification Panel -->
                <div v-if="showNotifications" 
                     class="notification-panel surface-0 shadow-4 border-round p-3"
                     @click.stop>
                    <div class="flex justify-content-between align-items-center mb-3">
                        <h3 class="m-0 text-lg font-semibold">通知</h3>
                        <Button icon="pi pi-times" text rounded size="small" @click="showNotifications = false" />
                    </div>

                    <div v-if="loading" class="text-center p-3">
                        <ProgressSpinner style="width: 40px; height: 40px" />
                    </div>

                    <div v-else-if="!notifications || (!notifications.maintenanceReminders?.length && !notifications.partsReminders?.length && !notifications.announcements?.length)" 
                         class="text-center text-500 p-4">
                        <i class="pi pi-inbox text-4xl mb-2"></i>
                        <p>暂无新通知</p>
                    </div>

                    <div v-else class="notification-list" style="max-height: 400px; overflow-y: auto">
                        <!-- Announcements -->
                        <div v-if="notifications.announcements?.length > 0" class="mb-3">
                            <small class="text-600 font-semibold">系统公告</small>
                            <div v-for="announcement in notifications.announcements" :key="'ann-' + announcement.id"
                                 class="notification-item p-2 border-round mt-2 cursor-pointer hover:surface-100"
                                 @click="viewAnnouncement(announcement)">
                                <div class="flex align-items-start gap-2">
                                    <i class="pi pi-megaphone text-blue-500 mt-1"></i>
                                    <div class="flex-1">
                                        <div class="font-semibold">{{ announcement.title }}</div>
                                        <small class="text-600">{{ formatDate(announcement.created_at) }}</small>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Maintenance Reminders -->
                        <div v-if="notifications.maintenanceReminders?.length > 0" class="mb-3">
                            <small class="text-600 font-semibold">保养提醒</small>
                            <div v-for="reminder in notifications.maintenanceReminders" :key="'maint-' + reminder.id"
                                 class="notification-item p-2 border-round mt-2 surface-50">
                                <div class="flex align-items-start gap-2">
                                    <i class="pi pi-wrench text-orange-500 mt-1"></i>
                                    <div class="flex-1">
                                        <div>{{ reminder.plate_number }} 即将到达保养里程</div>
                                        <small class="text-600">还剩 {{ reminder.next_maintenance_mileage - reminder.current_mileage }} 公里</small>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Parts Reminders -->
                        <div v-if="notifications.partsReminders?.length > 0" class="mb-3">
                            <small class="text-600 font-semibold">配件提醒</small>
                            <div v-for="part in notifications.partsReminders" :key="'part-' + part.id"
                                 class="notification-item p-2 border-round mt-2 surface-50">
                                <div class="flex align-items-start gap-2">
                                    <i class="pi pi-cog text-red-500 mt-1"></i>
                                    <div class="flex-1">
                                        <div>{{ part.plate_number }} - {{ part.name }}</div>
                                        <small class="text-600">即将需要更换</small>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- View All Link -->
                        <div class="text-center mt-3 pt-2 border-top-1 surface-border">
                            <router-link to="/messages" class="text-primary no-underline">
                                <small>查看全部消息</small>
                            </router-link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useSiteStore } from '../utils/siteStore'
import { messagesAPI } from '../api'
import { useToast } from 'primevue/usetoast'

const siteStore = useSiteStore()
const toast = useToast()

const showNotifications = ref(false)
const notifications = ref(null)
const loading = ref(false)

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
        console.error('Failed to load notifications:', error)
    } finally {
        loading.value = false
    }
}

const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now - date
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}天前`
    if (hours > 0) return `${hours}小时前`
    if (minutes > 0) return `${minutes}分钟前`
    return '刚刚'
}

const viewAnnouncement = (announcement) => {
    toast.add({
        severity: announcement.type || 'info',
        summary: announcement.title,
        detail: announcement.content,
        life: 5000
    })
}

// Close notifications panel when clicking outside
const handleClickOutside = (event) => {
    const panel = event.target.closest('.notification-panel')
    const button = event.target.closest('.p-button')
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
    height: 70px;
}

.notification-panel {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.5rem;
    width: 350px;
    max-width: 90vw;
    z-index: 1000;
}

.notification-item {
    transition: all 0.2s;
}

.notification-list::-webkit-scrollbar {
    width: 6px;
}

.notification-list::-webkit-scrollbar-track {
    background: transparent;
}

.notification-list::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
}

.notification-list::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
}
</style>
