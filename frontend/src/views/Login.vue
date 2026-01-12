<!--
  登录/注册页面
-->

<template>
  <div class="flex align-items-center justify-content-center min-h-screen">
    <Card style="width: 450px" class="shadow-4">
      <template #header>
        <div class="text-center pt-4">
          <i class="pi pi-car" style="font-size: 3rem; color: var(--primary-color)"></i>
          <h2 class="mt-2 mb-0">CarNote 车记录</h2>
          <p class="text-600">车辆记录管理系统</p>
        </div>
      </template>

      <template #content>
        <!-- 登录表单 -->
        <div v-if="!showRegister">
          <div class="field">
            <label for="username">用户名</label>
            <InputText id="username" v-model="loginForm.username" placeholder="请输入用户名" class="w-full" />
          </div>

          <div class="field">
            <label for="password">密码</label>
            <InputText id="password" v-model="loginForm.password" type="password" placeholder="请输入密码" class="w-full" @keyup.enter="handleLogin" />
          </div>

          <!-- CAPTCHA (显示在2次失败后) -->
          <div v-if="showCaptcha" class="field">
            <label for="captcha">验证码 *</label>
            <div class="flex gap-2 align-items-center">
              <div class="p-3 bg-blue-50 border-round font-bold text-xl text-primary" style="min-width: 120px; text-align: center;">
                {{ captchaQuestion }}
              </div>
              <InputText id="captcha" v-model="captchaAnswer" placeholder="请输入答案" class="flex-1" @keyup.enter="handleLogin" />
            </div>
            <small class="text-500">为了安全，请完成验证</small>
          </div>

          <Button label="登录" icon="pi pi-sign-in" class="w-full mt-3" @click="handleLogin" :loading="loading" />

          <div class="text-center mt-3" v-if="allowRegistration || isFirstUser">
            <span class="text-600">还没有账号？</span>
            <Button label="注册" link @click="showRegister = true" class="p-0 ml-1" />
          </div>
          <div v-if="isFirstUser" class="text-center mt-2">
            <Tag severity="info" value="首次运行：请注册管理员账号" />
          </div>
        </div>

        <!-- 注册表单 -->
        <div v-else>
          <div class="field">
            <label for="reg-username">用户名</label>
            <InputText id="reg-username" v-model="registerForm.username" placeholder="请输入用户名" class="w-full" />
          </div>

          <div class="field">
            <label for="reg-password">密码</label>
            <InputText id="reg-password" v-model="registerForm.password" type="password" placeholder="请输入密码"
              class="w-full" />
          </div>

          <div class="field">
            <label for="nickname">昵称</label>
            <InputText id="nickname" v-model="registerForm.nickname" placeholder="请输入昵称（可选）" class="w-full" />
          </div>

          <div class="field">
            <label for="email">邮箱</label>
            <InputText id="email" v-model="registerForm.email" placeholder="请输入邮箱（可选）" class="w-full" />
          </div>

          <Button label="注册" icon="pi pi-user-plus" class="w-full mt-3" @click="handleRegister" :loading="loading" />

          <div class="text-center mt-3">
            <span class="text-600">已有账号？</span>
            <Button label="登录" link @click="showRegister = false" class="p-0 ml-1" />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { userAPI, systemAPI } from '../api'

const router = useRouter()
const toast = useToast()

// 状态
const showRegister = ref(false)
const loading = ref(false)
const allowRegistration = ref(true) // Default true until checked
const isFirstUser = ref(false)

// CAPTCHA 相关
const failedAttempts = ref(0)
const showCaptcha = ref(false)
const captchaQuestion = ref('')
const captchaAnswer = ref('')
const correctAnswer = ref(0)

// Check system config
onMounted(async () => {
  try {
    const res = await systemAPI.getConfig()
    if (res.success) {
      allowRegistration.value = res.data.allowRegistration
      isFirstUser.value = res.data.isFirstUser

      // If first user, default to register view maybe? Or just show message
      if (isFirstUser.value) {
        showRegister.value = true
        toast.add({ severity: 'info', summary: '欢迎', detail: '系统初次运行，请注册管理员账号', life: 5000 })
      }
    }
  } catch (e) {
    console.error('Failed to fetch system config', e)
  }
})

// 生成验证码
const generateCaptcha = () => {
  const num1 = Math.floor(Math.random() * 10) + 1
  const num2 = Math.floor(Math.random() * 10) + 1
  captchaQuestion.value = `${num1} + ${num2} = ?`
  correctAnswer.value = num1 + num2
  captchaAnswer.value = ''
}

// 表单数据
const loginForm = ref({
  username: '',
  password: ''
})

const registerForm = ref({
  username: '',
  password: '',
  nickname: '',
  email: ''
})

// 登录处理
const handleLogin = async () => {
  if (!loginForm.value.username || !loginForm.value.password) {
    toast.add({ severity: 'warn', summary: '提示', detail: '请输入用户名和密码', life: 3000 })
    return
  }

  // 验证 CAPTCHA
  if (showCaptcha.value) {
    const userAnswer = parseInt(captchaAnswer.value)
    if (isNaN(userAnswer) || userAnswer !== correctAnswer.value) {
      toast.add({ severity: 'error', summary: '验证失败', detail: '验证码错误，请重新输入', life: 3000 })
      generateCaptcha() // 重新生成
      return
    }
  }

  loading.value = true
  try {
    const res = await userAPI.login(loginForm.value)
    if (res.success) {
      // 登录成功，重置失败计数
      failedAttempts.value = 0
      showCaptcha.value = false
      
      // 保存用户信息
      localStorage.setItem('userId', res.data.userId)
      localStorage.setItem('currentUser', JSON.stringify(res.data))

      toast.add({ severity: 'success', summary: '成功', detail: '登录成功', life: 3000 })
      router.push('/')
    }
  } catch (error) {
    // 登录失败，增加计数
    failedAttempts.value++
    
    if (failedAttempts.value >= 2) {
      showCaptcha.value = true
      generateCaptcha()
      toast.add({ 
        severity: 'warn', 
        summary: '安全提示', 
        detail: '登录失败次数过多，请完成验证码验证', 
        life: 4000 
      })
    } else {
      toast.add({ severity: 'error', summary: '错误', detail: error.message || '登录失败', life: 3000 })
    }
  } finally {
    loading.value = false
  }
}

// 注册处理
const handleRegister = async () => {
  if (!registerForm.value.username || !registerForm.value.password) {
    toast.add({ severity: 'warn', summary: '提示', detail: '请输入用户名和密码', life: 3000 })
    return
  }

  loading.value = true
  try {
    const res = await userAPI.register(registerForm.value)
    if (res.success) {
      toast.add({ severity: 'success', summary: '成功', detail: res.message || '注册成功，请登录', life: 3000 })
      showRegister.value = false
      loginForm.value.username = registerForm.value.username

      // Refresh config to update isFirstUser status
      const conf = await systemAPI.getConfig()
      if (conf.success) {
        isFirstUser.value = conf.data.isFirstUser
        allowRegistration.value = conf.data.allowRegistration
      }
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: '错误', detail: error.message || '注册失败', life: 3000 })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.field {
  margin-bottom: 1.5rem;
}

.field label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
}
</style>
