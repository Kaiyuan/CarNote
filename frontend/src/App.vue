<!--
  App.vue - 应用根组件
-->

<template>
  <div id="app" class="layout-wrapper flex relative min-h-screen">

    <!-- Mobile Sidebar (Drawer) -->
    <Sidebar :visible="mobileMenuVisible" @update:visible="mobileMenuVisible = $event" class="mobile-drawer">
      <div class="flex flex-column h-full">
        <div class="flex align-items-center gap-3 mb-5">
          <div class="mobile-drawer-logo">
            <img v-if="siteStore.state.siteIcon" :src="siteStore.state.siteIcon" />
            <i v-else class="pi pi-car text-lg"></i>
          </div>
          <div>
            <div class="font-bold text-lg text-900">{{ siteStore.state.siteName }}</div>
            <small class="text-500">车辆记录管理系统</small>
          </div>
        </div>

        <div class="flex flex-column gap-1">
          <Button v-for="item in menuItems" :key="item.label" :label="item.label" :icon="item.icon"
            :class="['mobile-nav-button', { active: isRouteActive(item.path) }]" text
            @click="navigateFromMobile(item.path)" />
        </div>

        <div class="mt-auto pt-4">
          <Divider />
          <div class="mobile-preferences">
            <Button :label="isDark ? '深色' : '浅色'" :icon="isDark ? 'pi pi-moon' : 'pi pi-sun'"
              text class="mobile-nav-button" @click="cycleMode" />
            <Dropdown v-model="locale" :options="supportedLocales" optionLabel="label" optionValue="code"
              class="w-full" />
          </div>
          <Button label="设置" icon="pi pi-cog" text class="mobile-nav-button w-full" @click="navigateFromMobile('/settings')" />
          <Button label="退出登录" icon="pi pi-sign-out" text severity="danger" class="mobile-nav-button w-full"
            @click="logout" />
        </div>
      </div>
    </Sidebar>

    <!-- Desktop Sidebar -->
    <div class="hidden md:block">
      <AppSidebar v-if="currentUser" :menuItems="menuItems" :currentUser="currentUser" @logout="logout" />
    </div>

    <!-- Main Container -->
    <div class="layout-main-container flex-1 flex flex-column min-h-screen overflow-x-hidden">

      <!-- Topbar (Desktop) -->
      <AppTopbar v-if="currentUser" />

      <!-- Mobile Topbar -->
      <div v-if="currentUser" class="mobile-topbar md:hidden">
        <div class="flex align-items-center gap-2">
          <Button icon="pi pi-bars" text rounded @click="mobileMenuVisible = true" aria-label="打开菜单" />
          <span class="font-semibold text-900">{{ siteStore.state.siteName }}</span>
        </div>
        <div class="flex align-items-center gap-1">
          <Button icon="pi pi-bell" text rounded severity="secondary" @click="router.push('/messages')"
            aria-label="消息" />
          <button type="button" class="mobile-avatar" @click="router.push('/settings')">{{ userInitial }}</button>
        </div>
      </div>

      <!-- Content -->
      <main class="layout-content flex-1" :class="{ 'has-mobile-nav': currentUser }">
        <router-view />
      </main>

      <!-- Mobile bottom navigation -->
      <nav v-if="currentUser" class="mobile-bottom-nav md:hidden">
        <router-link v-for="item in mobileNavItems" :key="item.path" :to="item.path" class="mobile-bottom-item"
          :class="{ active: !item.primary && isRouteActive(item.path), primary: item.primary }" @click="onMobileNavClick($event, item)">
          <i :class="item.icon"></i>
          <span>{{ item.shortLabel }}</span>
        </router-link>
      </nav>

      <!-- Footer -->
      <footer class="layout-footer text-center">
        <div v-if="siteStore.state.footerCopyright" v-html="siteStore.state.footerCopyright"></div>
        <div v-else>
          &copy; {{ new Date().getFullYear() }} {{ siteStore.state.siteName }}. All rights reserved.
        </div>
        <div class="mt-2 flex align-items-center justify-content-center gap-2">
          <Tag :value="'v' + appVersion" severity="secondary" rounded />
        </div>
      </footer>
    </div>

    <!-- Hidden Analytics Injection Point -->
    <div v-html="siteStore.state.websiteAnalytics" style="display: none"></div>

    <Toast />
    <ConfirmDialog />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AppSidebar from './layout/AppSidebar.vue'
import AppTopbar from './layout/AppTopbar.vue'
import Sidebar from 'primevue/sidebar'
import ConfirmDialog from 'primevue/confirmdialog'
import { useSiteStore } from './utils/siteStore'
import { userAPI } from './api'
import { useI18n } from './i18n'
import { useTheme } from './utils/theme'

const router = useRouter()
const route = useRoute()
const currentUser = ref(null)
const mobileMenuVisible = ref(false)
const siteStore = useSiteStore()
const { locale, supportedLocales } = useI18n()
const { isDark, cycleMode } = useTheme()
const appVersion = ref(__APP_VERSION__ || '1.3.7')

const mobileNavItems = computed(() => [
  { label: '首页', shortLabel: '首页', icon: 'pi pi-home', path: '/' },
  { label: '能耗记录', shortLabel: '能耗', icon: 'pi pi-bolt', path: '/energy' },
  { label: '记一笔', shortLabel: '记录', icon: 'pi pi-plus', path: '/energy?action=add', primary: true },
  { label: '保养维修', shortLabel: '保养', icon: 'pi pi-wrench', path: '/maintenance' },
  { label: '车辆管理', shortLabel: '车辆', icon: 'pi pi-car', path: '/vehicles' }
])

const menuItems = computed(() => {
  const items = [
    { label: '首页', icon: 'pi pi-home', path: '/' },
    { label: '车辆管理', icon: 'pi pi-car', path: '/vehicles' },
    { label: '能耗记录', icon: 'pi pi-bolt', path: '/energy' },
    { label: '保养维修', icon: 'pi pi-wrench', path: '/maintenance' },
    { label: '配件管理', icon: 'pi pi-box', path: '/parts' },
    { label: '车险管理', icon: 'pi pi-file-edit', path: '/insurance' },
    { label: '消息中心', icon: 'pi pi-megaphone', path: '/messages' },
  ]

  if (siteStore.state.hasVip) {
    items.push({ label: '会员中心', icon: 'pi pi-users', path: '/membership' })
  }

  if (currentUser.value?.role === 'admin') {
    items.push({ label: '系统管理', icon: 'pi pi-shield', path: '/admin' })
  }

  return items
})

const userInitial = computed(() => {
  if (currentUser.value) {
    return (currentUser.value.nickname || currentUser.value.username || 'U').charAt(0).toUpperCase()
  }
  return 'U'
})

onMounted(() => {
  checkUser()
  siteStore.fetchConfig()
})

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

const isRouteActive = (path) => {
  if (path === '/' && route.path === '/') return true
  if (path !== '/' && route.path.startsWith(path)) return true
  return false
}

const logout = async () => {
  try {
    await userAPI.logout()
  } catch (e) {
    // 即使请求失败也清理本地登录状态
  }
  localStorage.removeItem('currentUser')
  localStorage.removeItem('userId')
  currentUser.value = null
  mobileMenuVisible.value = false
  router.push('/login')
}

const navigateFromMobile = (path) => {
  router.push(path)
  mobileMenuVisible.value = false
}

const onMobileNavClick = (event, item) => {
  if (!item.primary) return
  event.preventDefault()
  if (route.path === '/energy') {
    window.dispatchEvent(new CustomEvent('carnote:add-energy'))
  } else {
    router.push(item.path)
  }
}

watch(() => siteStore.state.websiteAnalytics, (newVal) => {
  if (!newVal) return

  const div = document.createElement('div')
  div.innerHTML = newVal

  const scripts = div.querySelectorAll('script')
  scripts.forEach(oldScript => {
    const newScript = document.createElement('script')

    Array.from(oldScript.attributes).forEach(attr => {
      newScript.setAttribute(attr.name, attr.value)
    })

    newScript.textContent = oldScript.textContent
    document.head.appendChild(newScript)
  })
}, { immediate: true })
</script>

<style>
.body {
    font-family: "Barlow Condensed", "Sarasa Term SC", "Helvetica Neue", Ubuntu, Helvetica, "Source Han Serif", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Wenquanyi Micro Hei", "WenQuanYi Zen Hei", "WenQuanYi Zen Hei", "Apple LiGothic Medium", "ST Heiti", "WenQuanYi Zen Hei Sharp", Inter, -apple-system, BlinkMacSystemFont, Arial, sans-serif;
}
.layout-content {
  max-width: 1560px;
  margin: 0 auto;
  width: 100%;
}

.mobile-topbar {
  position: sticky;
  top: 0;
  z-index: 800;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.75rem;
  background: rgba(245, 246, 248, 0.9);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--cn-border);
}

.mobile-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 1px solid var(--cn-border);
  background: var(--surface-100);
  color: var(--cn-text);
  font-size: 0.72rem;
  font-weight: 700;
}

.mobile-drawer-logo {
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 12px;
  background: var(--cn-primary);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex: 0 0 auto;
}

.mobile-drawer-logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-nav-button {
  width: 100%;
  justify-content: flex-start !important;
  color: var(--cn-muted) !important;
  border-radius: 10px !important;
  padding: 0.65rem 0.8rem !important;
  font-weight: 550 !important;
}

.mobile-nav-button :deep(.p-button-label) {
  flex: initial;
}

.mobile-nav-button.active {
  background: var(--surface-100) !important;
  color: var(--cn-text) !important;
}

.mobile-preferences {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.p-sidebar.mobile-drawer {
  width: 290px;
}

.p-sidebar.mobile-drawer .p-sidebar-content {
  padding: 1.25rem;
}

@media screen and (max-width: 960px) {
  .responsive-table .p-datatable-thead {
    display: none !important;
  }
}
</style>
