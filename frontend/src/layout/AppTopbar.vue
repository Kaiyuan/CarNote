<template>
    <div class="layout-topbar flex justify-content-between align-items-center px-4 py-3 bg-transparent">
        <!-- Breadcrumb / Title area -->
        <div class="flex align-items-center">
            <h2 class="m-0 text-900 font-semibold">{{ currentTitle }}</h2>
        </div>

        <!-- Actions -->
        <div class="flex align-items-center gap-3">
            <!-- Search Bar (Visual only for now) -->
            <span class="p-input-icon-left hidden md:block">
                <i class="pi pi-search text-500" />
                <InputText placeholder="Search" class="border-round-2xl surface-100 border-none w-15rem" />
            </span>

            <Button icon="pi pi-bell" text rounded class="text-500" />
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const routeTitles = {
    'Home': 'Overview',
    'VehicleList': 'Vehicle Fleet',
    'EnergyLog': 'Energy Consumption',
    'Maintenance': 'Maintenance & Service',
    'Parts': 'Part Inventory',
    'Analytics': 'Analytics Dashboard',
    'Settings': 'User Settings'
}

const currentTitle = computed(() => {
    return routeTitles[route.name] || 'CarNote'
})
</script>

<style scoped>
.layout-topbar {
    height: 70px;
}
</style>
