<template>
    <div class="cn-page-header">
        <div class="cn-page-header-left">
            <div class="cn-eyebrow">
                <span>{{ eyebrow }}</span>
                <span v-if="live" class="cn-live-dot">{{ liveText }}</span>
            </div>
            <h1 class="cn-page-title">{{ title }}</h1>
            <p v-if="description" class="cn-page-subtitle">{{ description }}</p>
        </div>
        <div v-if="$slots.actions" class="cn-header-actions">
            <slot name="actions" />
        </div>
    </div>
</template>

<script setup>
defineProps({
    eyebrow: {
        type: String,
        default: 'CarNote'
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    live: {
        type: Boolean,
        default: false
    },
    liveText: {
        type: String,
        default: 'Live'
    }
})
</script>
