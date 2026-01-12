<template>
    <div
        class="layout-sidebar surface-card border-right-1 surface-border h-full flex flex-column align-items-center py-4 select-none">
        <!-- Logo -->
        <div class="mb-4 cursor-pointer" @click="router.push('/')">
            <div class="flex align-items-center justify-content-center border-circle bg-primary"
                style="width: 3rem; height: 3rem">
                <i class="pi pi-car text-xl"></i>
            </div>
        </div>

        <!-- Navigation -->
        <div class="flex flex-column gap-3 w-full">
            <template v-for="item in menuItems" :key="item.label">
                <div class="flex justify-content-center position-relative w-full">
                    <div class="nav-item border-round p-2 cursor-pointer transition-colors transition-duration-200 flex align-items-center justify-content-center"
                        :class="{ 'bg-primary-50 text-primary': isLocalActive(item.path), 'text-500 hover:surface-100 hover:text-700': !isLocalActive(item.path) }"
                        style="width: 3rem; height: 3rem" v-tooltip.right="item.label" @click="router.push(item.path)">
                        <i :class="item.icon" class="text-xl"></i>
                    </div>
                    <!-- Active Indicator Strip -->
                    <div v-if="isLocalActive(item.path)"
                        class="absolute left-0 top-0 bottom-0 bg-primary border-round-right" style="width: 4px;"></div>
                </div>
            </template>
        </div>

        <!-- Bottom Actions -->
        <div class="mt-auto flex flex-column gap-3 w-full">
            <div class="flex justify-content-center w-full">
                <div class="nav-item border-round p-2 cursor-pointer text-500 hover:surface-100 hover:text-700 flex align-items-center justify-content-center"
                    style="width: 3rem; height: 3rem" v-tooltip.right="'设置'" @click="router.push('/settings')">
                    <i class="pi pi-cog text-xl"></i>
                </div>
            </div>
            <div class="flex justify-content-center w-full mb-3">
                <Avatar v-if="currentUser" :label="userInitial" class="cursor-pointer bg-primary-reverse" shape="circle"
                    @click="$emit('logout')" />
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

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

const emit = defineEmits(['logout'])
const router = useRouter()
const route = useRoute()

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
    width: 80px;
    /* Slim sidebar */
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 999;
    background-color: var(--surface-card);
    display: flex;
    flex-direction: column;
}
</style>
