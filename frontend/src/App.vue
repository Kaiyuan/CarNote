<!--
  App.vue - 应用根组件 (New Dashboard Layout)
-->

<template>
  <div id="app" class="layout-wrapper surface-ground min-h-screen flex relative">

    <!-- Mobile Sidebar (Drawer) -->
    <Sidebar v-model:visible="mobileMenuVisible">
      <div class="flex flex-column align-items-center mb-5">
        <div class="flex align-items-center justify-content-center border-circle bg-primary mb-3 overflow-hidden"
          style="width: 3rem; height: 3rem">
          <img v-if="siteStore.state.siteIcon" :src="siteStore.state.siteIcon"
            style="width: 100%; height: 100%; object-fit: cover;" />
          <i v-else class="pi pi-car text-xl"></i>
        </div>
        <span class="font-bold text-xl">{{ siteStore.state.siteName }}</span>
      </div>
      <div class="flex flex-column gap-2">
        <Button v-for="item in menuItems" :key="item.label" :label="item.label" :icon="item.icon"
          :text="route.path !== item.path" :severity="route.path === item.path ? 'primary' : 'secondary'"
          class="w-full text-left justify-content-start" @click="navigateFromMobile(item.path)" />
      </div>
      <div class="mt-auto pt-4 border-top-1 border-200">
        <Button label="设置" icon="pi pi-cog" text class="w-full text-left justify-content-start"
          @click="navigateFromMobile('/settings')" />
        <Button label="退出" icon="pi pi-sign-out" text severity="danger" class="w-full text-left justify-content-start"
          @click="logout" />
      </div>
    </Sidebar>

    <!-- Desktop Sidebar (Left) - Hidden on Mobile -->
    <div class="hidden md:block">
      <AppSidebar v-if="currentUser" :menuItems="menuItems" :currentUser="currentUser" @logout="logout" />
    </div>

    <!-- Main Container (Right) -->
    <div class="layout-main-container flex-1 flex flex-column min-h-screen overflow-x-hidden">

      <!-- Topbar (Desktop) -->
      <AppTopbar v-if="currentUser" />

      <!-- Mobile Topbar (Visible on Mobile) -->
      <div v-if="currentUser"
        class="md:hidden flex align-items-center justify-content-between px-3 py-2 bg-white shadow-1 z-5 sticky top-0">
        <div class="flex align-items-center">
          <Button icon="pi pi-bars" text rounded @click="mobileMenuVisible = true" class="mr-2" />
          <span class="font-bold text-xl text-900">{{ siteStore.state.siteName }}</span>
        </div>
        <div class="flex align-items-center">
          <Button icon="pi pi-bell" text rounded class="text-500" @click="router.push('/messages')" />
        </div>
      </div>

      <!-- Content -->
      <div class="layout-content flex-1 p-3 md:p-4">
        <router-view />
      </div>
    </div>

    <!-- Global Toast -->
    <Toast />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AppSidebar from './layout/AppSidebar.vue'
import AppTopbar from './layout/AppTopbar.vue'
import Sidebar from 'primevue/sidebar'
import { useSiteStore } from './utils/siteStore'

const router = useRouter()
const route = useRoute()
const currentUser = ref(null)
const mobileMenuVisible = ref(false)
const siteStore = useSiteStore()

const menuItems = computed(() => {
  const items = [
    { label: '首页', icon: 'pi pi-home', path: '/' },
    { label: '车辆管理', icon: 'pi pi-car', path: '/vehicles' },
    { label: '能耗记录', icon: 'pi pi-bolt', path: '/energy' },
    { label: '保养维修', icon: 'pi pi-wrench', path: '/maintenance' },
    { label: '配件管理', icon: 'pi pi-box', path: '/parts' },
    { label: '消息中心', icon: 'pi pi-megaphone', path: '/messages' },
  ]

  if (currentUser.value?.role === 'admin') {
    items.push({ label: '系统管理', icon: 'pi pi-shield', path: '/admin' })
    if (siteStore.state.hasVip) {
      items.push({ label: '会员管理', icon: 'pi pi-users', path: '/admin/membership' })
    }
  }

  return items
})

onMounted(() => {
  checkUser()
  siteStore.fetchConfig()
})

// Watch route changes to update user state (e.g. after login/logout)
watch(() => route.fullPath, () => {
  checkUser()
})

const checkUser = () => {
  const userStr = localStorage.getItem('currentUser')
  if (userStr) {
    currentUser.value = JSON.parse(userStr)
  } else {
    currentUser.value = null
  }
}

const logout = () => {
  localStorage.removeItem('currentUser')
  localStorage.removeItem('userId')
  currentUser.value = null
  router.push('/login')
}

const navigateFromMobile = (path) => {
  router.push(path)
  mobileMenuVisible.value = false
}
</script>

<style>
:root {
  --primary-color: #3B82F6;
  --surface-ground: #f8f9fa;
  --surface-card: #ffffff;
  --surface-border: #e5e7eb;
}

body {
  margin: 0;
  padding: 0;
  background-color: var(--surface-ground);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

/* Layout Container Fluidity */
.layout-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1rem;
  width: 100%;
}

.layout-main-container {
  transition: width 0.2s;
  min-width: 0;
  /* Prevent flex children from overflowing */
}

/* Base Responsive Fixes */
@media screen and (max-width: 768px) {
  /* Mobile adjustments if needed */
}

/* Card Styling Override for Dashboard Look */
.p-card {
  border-radius: 1rem !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03) !important;
  border: none !important;
}

/* Shared Utility for Tables in Small Screen */
@media screen and (max-width: 960px) {
  .responsive-table .p-datatable-thead {
    display: none !important;
  }
}
</style>
