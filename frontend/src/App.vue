<!--
  App.vue - 应用根组件 (New Dashboard Layout)
-->

<template>
  <div id="app" class="layout-wrapper surface-ground min-h-screen flex relative">

    <!-- Mobile Sidebar (Drawer) -->
    <Sidebar v-model:visible="mobileMenuVisible">
      <div class="flex flex-column align-items-center mb-5">
        <div class="flex align-items-center justify-content-center border-circle bg-primary mb-3"
          style="width: 3rem; height: 3rem">
          <i class="pi pi-car text-xl"></i>
        </div>
        <span class="font-bold text-xl">CarNote</span>
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
    <div class="layout-main-container flex-1 flex flex-column min-h-screen"
      :class="{ 'md:ml-7': currentUser, 'ml-0': !currentUser }">

      <!-- Topbar (Desktop) -->
      <AppTopbar v-if="currentUser" class="hidden md:flex" />

      <!-- Mobile Topbar (Visible on Mobile) -->
      <div v-if="currentUser" class="md:hidden flex align-items-center p-3 bg-white shadow-1 z-5">
        <Button icon="pi pi-bars" text rounded @click="mobileMenuVisible = true" class="mr-2" />
        <span class="font-bold text-xl text-900">CarNote</span>
        <!-- Optional: Add user avatar or spacer here -->
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
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AppSidebar from './layout/AppSidebar.vue'
import AppTopbar from './layout/AppTopbar.vue'
import Sidebar from 'primevue/sidebar'

const router = useRouter()
const route = useRoute()
const currentUser = ref(null)
const mobileMenuVisible = ref(false)

const menuItems = ref([
  { label: '首页', icon: 'pi pi-home', path: '/' },
  { label: '车辆管理', icon: 'pi pi-car', path: '/vehicles' },
  { label: '能耗记录', icon: 'pi pi-bolt', path: '/energy' },
  { label: '保养维修', icon: 'pi pi-wrench', path: '/maintenance' },
  { label: '配件管理', icon: 'pi pi-box', path: '/parts' },
])

onMounted(() => {
  checkUser()
})

// Watch route changes to update user state (e.g. after login/logout)
import { watch } from 'vue' // Ensure watch is imported
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

/* Margin-left utility for sidebar spacing */
.ml-7 {
  margin-left: 80px;
  /* Match sidebar width */
}

/* Card Styling Override for Dashboard Look */
.p-card {
  border-radius: 1rem !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03) !important;
  border: none !important;
}
</style>
