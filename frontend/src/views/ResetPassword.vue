<template>
    <div class="flex align-items-center justify-content-center min-h-screen">
        <Card style="width: 450px" class="shadow-4">
            <template #header>
                <div class="text-center pt-4">
                    <i class="pi pi-key" style="font-size: 3rem; color: var(--primary-color)"></i>
                    <h2 class="mt-2 mb-0">重置密码</h2>
                    <p class="text-600">设置您的新密码</p>
                </div>
            </template>

            <template #content>
                <div v-if="success" class="text-center py-4">
                    <i class="pi pi-check-circle text-green-500 text-6xl mb-3"></i>
                    <h3>重置成功</h3>
                    <p class="text-600 mb-4">您的密码已成功重置，现在可以重新登录了。</p>
                    <Button label="去登录" icon="pi pi-sign-in" class="w-full" @click="$router.push('/login')" />
                </div>

                <div v-else>
                    <div class="field">
                        <label for="new-password">新密码</label>
                        <InputText id="new-password" v-model="password" type="password" placeholder="请输入新密码"
                            class="w-full" />
                    </div>

                    <div class="field mt-3">
                        <label for="confirm-password">确认新密码</label>
                        <InputText id="confirm-password" v-model="confirmPassword" type="password" placeholder="再次输入新密码"
                            class="w-full" />
                    </div>

                    <Button label="重置密码" icon="pi pi-save" class="w-full mt-4" @click="handleReset"
                        :loading="loading" />
                </div>
            </template>
        </Card>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { userAPI } from '../api'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const token = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const success = ref(false)

onMounted(() => {
    token.value = route.query.token
    if (!token.value) {
        toast.add({ severity: 'error', summary: '无效请求', detail: '缺少重置令牌', life: 3000 })
        router.push('/login')
    }
})

const handleReset = async () => {
    if (!password.value || password.value.length < 6) {
        toast.add({ severity: 'warn', summary: '提示', detail: '密码长度至少6位', life: 3000 })
        return
    }

    if (password.value !== confirmPassword.value) {
        toast.add({ severity: 'warn', summary: '提示', detail: '两次输入的密码不一致', life: 3000 })
        return
    }

    loading.value = true
    try {
        const res = await userAPI.resetPassword({ token: token.value, password: password.value })
        if (res.success) {
            success.value = true
            toast.add({ severity: 'success', summary: '成功', detail: '密码已重置', life: 3000 })
        }
    } catch (error) {
        toast.add({ severity: 'error', summary: '错误', detail: error.message || '重置失败', life: 3000 })
    } finally {
        loading.value = false
    }
}
</script>

<style scoped>
.field label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
}
</style>
