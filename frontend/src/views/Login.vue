<!--
  登录/注册页面
-->

<template>
  <div class="flex align-items-center justify-content-center min-h-screen">
    <Card style="width: 450px" class="shadow-4">
      <template #header>
        <div class="text-center pt-4">
          <div
            class="flex align-items-center justify-content-center border-circle bg-primary overflow-hidden mx-auto mb-3"
            style="width: 4rem; height: 4rem">
            <img v-if="siteStore.state.siteIcon" :src="siteStore.state.siteIcon"
              style="width: 100%; height: 100%; object-fit: cover;" />
            <i v-else class="pi pi-car text-3xl"></i>
          </div>
          <h2 class="mt-2 mb-0">{{ siteStore.state.siteName }}</h2>
          <p class="text-600">车辆记录管理系统</p>
        </div>
      </template>

      <template #content>
        <!-- 验证码输入（注册后或登录未验证时） -->
        <div v-if="showVerification">
          <div class="text-center mb-4">
            <i class="pi pi-envelope text-4xl text-primary"></i>
            <h3>验证您的邮箱</h3>
            <p class="text-600">验证码已发送至您的邮箱，请输入以完成验证</p>
          </div>

          <div class="field">
            <label>用户名</label>
            <InputText v-model="verifyForm.username" disabled class="w-full" />
          </div>

          <div class="field">
            <label>验证码</label>
            <InputText v-model="verifyForm.code" placeholder="请输入6位验证码" class="w-full text-center font-bold text-xl"
              maxlength="6" />
          </div>

          <div class="p-2 surface-100 border-round mb-3">
            <p class="text-xs text-600 m-0">注意：验证码由 <b>{{ siteStore.state.smtpFrom }}</b> 发送，请检查垃圾箱或将其设为白名单。</p>
          </div>

          <Button label="提交验证" icon="pi pi-check" class="w-full mt-2" @click="handleVerify" :loading="loading" />

          <div class="mt-4 pt-3 border-top-1 border-100">
            <template v-if="!showResendCaptcha">
              <p class="text-sm text-600 text-center mb-2">没收到验证邮件？</p>
              <Button :label="resendCooldown > 0 ? `重新发送 (${resendCooldown}s)` : '重新发送'" icon="pi pi-send" text
                class="w-full p-button-sm" @click="prepareResend" :disabled="resendCooldown > 0" />
            </template>
            <div v-else class="surface-100 p-3 border-round">
              <p class="text-xs font-bold mb-2">人机验证后重发</p>
              <div class="flex gap-2 align-items-center mb-2">
                <div class="p-2 surface-200 border-round font-bold flex align-items-center justify-content-center"
                  style="min-width: 80px; height: 38px; cursor: pointer;" @click="getResendCaptcha" title="点击刷新">
                  {{ resendCaptchaQuestion || '...' }}
                </div>
                <InputText v-model="resendCaptchaAnswer" placeholder="答案" class="flex-1 p-inputtext-sm" />
              </div>
              <div class="flex gap-2">
                <Button label="取消" text size="small" @click="showResendCaptcha = false" />
                <Button :label="resendCooldown > 0 ? `${resendCooldown}s` : '确认重发'" size="small" class="flex-1"
                  @click="handleResend" :loading="resending" :disabled="resendCooldown > 0" />
              </div>
            </div>
          </div>

          <div class="text-center mt-3">
            <Button label="返回" link @click="cancelVerify" class="p-0" />
          </div>
        </div>

        <!-- 注册表单 -->
        <div v-else-if="showRegister">
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
            <label for="email">邮箱 *</label>
            <InputText id="email" v-model="registerForm.email" placeholder="请输入邮箱" class="w-full" />
          </div>

          <!-- Registration CAPTCHA -->
          <div class="field">
            <label for="reg-captcha">验证码 *</label>
            <div class="flex gap-2 align-items-center">
              <div class="p-3 bg-blue-50 border-round font-bold text-xl text-primary"
                style="min-width: 120px; text-align: center;">
                {{ captchaQuestion }}
              </div>
              <InputText id="reg-captcha" v-model="captchaAnswer" placeholder="请输入答案" class="flex-1" />
            </div>
          </div>

          <div v-if="siteStore.state.emailVerificationEnabled" class="p-2 surface-100 border-round mb-3">
            <p class="text-xs text-600 m-0">注意：为确保收到验证码，请将 <b>{{ siteStore.state.smtpFrom }}</b> 添加到邮箱白名单。</p>
          </div>

          <Button label="注册" icon="pi pi-user-plus" class="w-full mt-3" @click="handleRegister" :loading="loading" />

          <div class="text-center mt-3">
            <span class="text-600">已有账号？</span>
            <Button label="登录" link @click="showRegister = false" class="p-0 ml-1" />
          </div>
        </div>

        <!-- 登录表单 -->
        <div v-else>
          <div class="field">
            <label for="username">用户名</label>
            <InputText id="username" v-model="loginForm.username" placeholder="请输入用户名" class="w-full" />
          </div>

          <div class="field">
            <label for="password">密码</label>
            <InputText id="password" v-model="loginForm.password" type="password" placeholder="请输入密码" class="w-full"
              @keyup.enter="handleLogin" />
          </div>

          <!-- CAPTCHA (显示在2次失败后) -->
          <div v-if="showCaptcha" class="field">
            <label for="captcha">验证码 *</label>
            <div class="flex gap-2 align-items-center">
              <div class="p-3 bg-blue-50 border-round font-bold text-xl text-primary"
                style="min-width: 120px; text-align: center;">
                {{ captchaQuestion }}
              </div>
              <InputText id="captcha" v-model="captchaAnswer" placeholder="请输入答案" class="flex-1"
                @keyup.enter="handleLogin" />
            </div>
            <small class="text-500">为了安全，请完成验证</small>
          </div>

          <div class="text-right mt-1">
            <Button label="忘记密码？" link @click="openForgotDialog" class="p-0 text-sm" />
          </div>

          <Button label="登录" icon="pi pi-sign-in" class="w-full mt-3" @click="handleLogin" :loading="loading" />

          <div class="text-center mt-3" v-if="allowRegistration || isFirstUser">
            <span class="text-600">还没有账号？</span>
            <Button label="注册" link @click="showRegister = true" class="p-0 ml-1" />
          </div>

          <div v-if="excessiveFailures" class="mt-3">
            <Button label="无法登录？重置密码" icon="pi pi-question-circle" severity="secondary" class="w-full p-button-sm"
              @click="openForgotDialog" />
          </div>
          <div v-if="isFirstUser" class="text-center mt-2">
            <Tag severity="info" value="首次运行：请注册管理员账号" />
          </div>

          <!-- Unverified User Warning Section -->
          <div v-if="showUnverifiedWarning" class="surface-100 p-3 border-round mt-4 border-left-3 border-warning">
            <div class="flex align-items-center mb-2">
              <i class="pi pi-info-circle text-warning mr-2"></i>
              <span class="font-bold">您的邮箱尚未验证</span>
            </div>
            <p class="text-sm text-600 mb-3">您的账号需要完成验证后才能登录。请检查注册邮箱或点击下方按钮重新获取验证码。</p>

            <div class="surface-0 p-3 border-round border-1 border-200">
              <p class="text-xs font-bold mb-2">人机验证并重新发送邮件</p>
              <div class="flex gap-2 align-items-center mb-2">
                <div
                  class="p-2 surface-200 border-round font-bold flex align-items-center justify-content-center text-sm"
                  style="min-width: 80px; height: 34px; cursor: pointer;" @click="getResendCaptcha" title="点击刷新">
                  {{ resendCaptchaQuestion || '...' }}
                </div>
                <InputText v-model="resendCaptchaAnswer" placeholder="答案" class="flex-1 p-inputtext-sm" />
              </div>
              <Button :label="resendCooldown > 0 ? `请稍候 (${resendCooldown}s)` : '重新发送验证邮件'" icon="pi pi-send"
                severity="warning" size="small" class="w-full" @click="handleResend" :loading="resending"
                :disabled="resendCooldown > 0" />
            </div>

            <div class="mt-3 flex gap-2">
              <Button label="我已有验证码" text size="small" icon="pi pi-key" class="flex-1"
                @click="showVerification = true; showUnverifiedWarning = false" />
              <Button label="关闭提示" text size="small" severity="secondary" @click="showUnverifiedWarning = false" />
            </div>
          </div>
        </div>
      </template>
    </Card>

    <!-- 忘记密码对话框 -->
    <Dialog :visible="showForgotDialog" @update:visible="showForgotDialog = $event" header="重置密码" :modal="true"
      style="width: 400px">

      <div v-if="forgotStep === 1">
        <div v-if="!siteStore.state.smtpReady" class="p-4 text-center">
          <i class="pi pi-exclamation-triangle text-4xl text-warning mb-3"></i>
          <p class="text-xl font-bold mb-2">系统未配置邮件服务</p>
          <p class="text-600">目前无法通过邮件找回密码，请联系管理员手动重置。</p>
        </div>
        <template v-else>
          <div class="field">
            <label for="forgot-email">注册邮箱</label>
            <InputText id="forgot-email" v-model="forgotEmail" placeholder="example@domain.com" class="w-full" />
          </div>

          <!-- Forgot Password Captcha -->
          <div class="field mt-3">
            <label>人机验证 *</label>
            <div class="flex gap-2 align-items-center">
              <div
                class="p-2 surface-200 border-round font-bold text-lg text-700 flex align-items-center justify-content-center"
                style="min-width: 100px; height: 42px; cursor: pointer;" @click="getForgotCaptcha" title="点击刷新">
                {{ forgotCaptchaQuestion || '加载中...' }}
              </div>
              <InputText v-model="forgotCaptchaAnswer" placeholder="结果" class="flex-1" />
            </div>
          </div>

          <div class="p-2 surface-100 border-round mt-3">
            <p class="text-xs text-600 m-0">注意：请将 <b>{{ siteStore.state.smtpFrom }}</b> 添加到邮箱白名单，以免重置邮件进入垃圾箱。</p>
          </div>

          <div class="text-center mt-3">
            <Button label="我已有重置验证码" link class="p-0 text-sm" @click="forgotStep = 2" />
          </div>
        </template>
      </div>

      <div v-else>
        <p class="text-600 mb-4">验证码已发送至 {{ forgotEmail }}</p>
        <div class="field">
          <label>验证码</label>
          <InputText v-model="resetForm.code" placeholder="6位验证码" class="w-full" />
        </div>
        <div class="field">
          <label>新密码</label>
          <InputText v-model="resetForm.newPassword" type="password" placeholder="请输入新密码" class="w-full" />
        </div>
      </div>

      <template #footer>
        <Button label="取消" text @click="showForgotDialog = false" />
        <Button v-if="forgotStep === 1 && siteStore.state.smtpReady"
          :label="forgotCooldown > 0 ? `限制中 (${forgotCooldown}s)` : '获取验证码'" @click="handleForgotPassword"
          :loading="loading" :disabled="forgotCooldown > 0" />
        <template v-else-if="forgotStep === 2">
          <Button label="上一步" text @click="forgotStep = 1" />
          <Button label="重置密码" @click="handleResetPassword" :loading="loading" />
        </template>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { userAPI, systemAPI } from '../api'
import { useSiteStore } from '../utils/siteStore'
import logger from '../utils/logger'

const siteStore = useSiteStore()
const router = useRouter()
const toast = useToast()

// 状态
const showRegister = ref(false)
const showVerification = ref(false)
const showForgotDialog = ref(false)
const forgotStep = ref(1)
const forgotEmail = ref('')
const resetForm = ref({ code: '', newPassword: '' })
const verifyForm = ref({ username: '', code: '' })
const loading = ref(false)
const allowRegistration = ref(true) // Default true until checked
const isFirstUser = ref(false)
const excessiveFailures = ref(false)
const showUnverifiedWarning = ref(false)
const forgotCaptchaQuestion = ref('')
const forgotCaptchaAnswer = ref('')
const forgotCaptchaKey = ref('')

const resendCaptchaKey = ref('')
const showResendCaptcha = ref(false)
const resending = ref(false)
const resendCaptchaQuestion = ref('')
const resendCaptchaAnswer = ref('')

const resendCooldown = ref(0)
const forgotCooldown = ref(0)
let resendTimer = null
let forgotTimer = null

const startResendCooldown = (seconds) => {
  resendCooldown.value = seconds
  if (resendTimer) clearInterval(resendTimer)
  resendTimer = setInterval(() => {
    resendCooldown.value--
    if (resendCooldown.value <= 0) {
      clearInterval(resendTimer)
      localStorage.removeItem('resend_next_time')
    }
  }, 1000)
}

const startForgotCooldown = (seconds) => {
  forgotCooldown.value = seconds
  if (forgotTimer) clearInterval(forgotTimer)
  forgotTimer = setInterval(() => {
    forgotCooldown.value--
    if (forgotCooldown.value <= 0) {
      clearInterval(forgotTimer)
      localStorage.removeItem('forgot_next_time')
    }
  }, 1000)
}

// CAPTCHA 相关
const failedAttempts = ref(0)
const showCaptcha = ref(false)
const captchaQuestion = ref('')
const captchaAnswer = ref('')
const correctAnswer = ref(0)

// Watch for register toggle to generate captcha
watch(showRegister, (val) => {
  if (val) {
    generateCaptcha()
  } else {
    // Reset captcha on switching back to login if not needed
    if (failedAttempts.value < 2) {
      showCaptcha.value = false
      captchaAnswer.value = ''
    }
  }
})

// Check system config
onMounted(async () => {
  try {
    await siteStore.fetchConfig()
    allowRegistration.value = siteStore.state.allowRegistration
    isFirstUser.value = siteStore.state.isFirstUser

    if (isFirstUser.value) {
      showRegister.value = true
      toast.add({ severity: 'info', summary: '欢迎', detail: '系统初次运行，请注册管理员账号', life: 5000 })
    }

    // Cooldown restoration
    const resendNext = localStorage.getItem('resend_next_time')
    if (resendNext) {
      const remaining = Math.ceil((parseInt(resendNext) - Date.now()) / 1000)
      if (remaining > 0) startResendCooldown(remaining)
    }
    const forgotNext = localStorage.getItem('forgot_next_time')
    if (forgotNext) {
      const remaining = Math.ceil((parseInt(forgotNext) - Date.now()) / 1000)
      if (remaining > 0) startForgotCooldown(remaining)
    }
  } catch (e) {
    logger.error('Failed to fetch system config', e)
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
      excessiveFailures.value = false

      // 保存用户信息
      localStorage.setItem('userId', res.data.userId)
      localStorage.setItem('currentUser', JSON.stringify(res.data))

      toast.add({ severity: 'success', summary: '成功', detail: '登录成功', life: 3000 })
      router.push('/')
    }
  } catch (error) {
    // 登录失败，增加计数
    failedAttempts.value++

    if (error.showReset) {
      excessiveFailures.value = true
    }

    if (error.needVerify) {
      toast.add({ severity: 'warn', summary: '验证提醒', detail: error.message, life: 3000 })
      verifyForm.value.username = error.username || loginForm.value.username
      showUnverifiedWarning.value = true
      getResendCaptcha()
      return
    }

    if (failedAttempts.value >= 2) {
      showCaptcha.value = true
      generateCaptcha()
      toast.add({
        severity: 'warn',
        summary: '安全提示',
        detail: error.message || '连续登录失败次数过多，请完成验证码验证',
        life: 4000
      })
    } else {
      toast.add({ severity: 'error', summary: '错误', detail: error.message || '登录失败', life: 3000 })
    }
  } finally {
    loading.value = false
  }
}

const openForgotDialog = () => {
  showForgotDialog.value = true
  forgotStep.value = 1
  forgotEmail.value = ''
  resetForm.value = { code: '', newPassword: '' }
  getForgotCaptcha()
}

const getForgotCaptcha = async () => {
  try {
    const res = await userAPI.getForgotPasswordCaptcha()
    if (res.success) {
      forgotCaptchaQuestion.value = res.data.question
      forgotCaptchaKey.value = res.data.key
      forgotCaptchaAnswer.value = ''
    }
  } catch (e) {
    toast.add({ severity: 'error', summary: '获取验证码失败' })
  }
}

// 验证邮件
const handleVerify = async () => {
  if (!verifyForm.value.code) {
    toast.add({ severity: 'warn', summary: '请输入验证码' })
    return
  }
  loading.value = true
  try {
    const res = await userAPI.verifyEmail(verifyForm.value)
    if (res.success) {
      toast.add({ severity: 'success', summary: '验证成功', detail: '请使用账号密码登录', life: 3000 })
      showVerification.value = false
      showRegister.value = false
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: '验证失败', detail: error.message })
  } finally {
    loading.value = false
  }
}

const cancelVerify = () => {
  showVerification.value = false
  showRegister.value = false
  showResendCaptcha.value = false
}

const prepareResend = () => {
  showResendCaptcha.value = true
  getResendCaptcha()
}

const getResendCaptcha = async () => {
  try {
    const res = await userAPI.getCaptcha()
    if (res.success) {
      resendCaptchaQuestion.value = res.data.question
      resendCaptchaKey.value = res.data.key
      resendCaptchaAnswer.value = ''
    }
  } catch (e) { }
}

const handleResend = async () => {
  if (!resendCaptchaAnswer.value) {
    toast.add({ severity: 'warn', summary: '请输入验证码结果' })
    return
  }
  resending.value = true
  try {
    const res = await userAPI.resendVerificationEmail({
      username: verifyForm.value.username,
      captchaAnswer: resendCaptchaAnswer.value,
      captchaKey: resendCaptchaKey.value
    })
    if (res.success) {
      toast.add({ severity: 'success', summary: '已发送', detail: '新的验证码已发送至您的邮箱' })
      showResendCaptcha.value = false
      const nextTime = Date.now() + 60000
      localStorage.setItem('resend_next_time', nextTime.toString())
      startResendCooldown(60)
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: '发送失败', detail: error.message })
    getResendCaptcha()
  } finally {
    resending.value = false
  }
}

// 忘记密码处理 - 发送验证码
const handleForgotPassword = async () => {
  if (!forgotEmail.value) {
    toast.add({ severity: 'warn', summary: '提示', detail: '请输入邮箱', life: 3000 })
    return
  }

  loading.value = true
  try {
    const res = await userAPI.forgotPassword({
      email: forgotEmail.value,
      captchaAnswer: forgotCaptchaAnswer.value,
      captchaKey: forgotCaptchaKey.value
    })
    if (res.success) {
      toast.add({ severity: 'success', summary: '已发送', detail: res.message, life: 3000 })
      forgotStep.value = 2
      const nextTime = Date.now() + 60000
      localStorage.setItem('forgot_next_time', nextTime.toString())
      startForgotCooldown(60)
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: '错误', detail: error.message || '发送失败', life: 3000 })
    getForgotCaptcha() // 刷新验证码
  } finally {
    loading.value = false
  }
}

// 重置密码 - 提交
const handleResetPassword = async () => {
  if (!resetForm.value.code || !resetForm.value.newPassword) {
    toast.add({ severity: 'warn', summary: '请填写所有字段' })
    return
  }
  loading.value = true
  try {
    const res = await userAPI.resetPassword({
      email: forgotEmail.value,
      code: resetForm.value.code,
      password: resetForm.value.newPassword
    })
    if (res.success) {
      toast.add({ severity: 'success', summary: '重置成功', detail: '请使用新密码登录', life: 3000 })
      showForgotDialog.value = false
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: '重置失败', detail: error.message })
  } finally {
    loading.value = false
  }
}

// 注册处理
const handleRegister = async () => {
  if (!registerForm.value.username || !registerForm.value.password || !registerForm.value.email) {
    toast.add({ severity: 'warn', summary: '提示', detail: '请输入完整的注册信息（含邮箱）', life: 3000 })
    return
  }

  // 简单邮箱验证
  if (!registerForm.value.email.includes('@')) {
    toast.add({ severity: 'warn', summary: '提示', detail: '邮箱格式不正确', life: 3000 })
    return
  }

  // 验证 CAPTCHA
  const userAnswer = parseInt(captchaAnswer.value)
  if (isNaN(userAnswer) || userAnswer !== correctAnswer.value) {
    toast.add({ severity: 'error', summary: '验证失败', detail: '验证码错误，请重新输入', life: 3000 })
    generateCaptcha()
    return
  }

  loading.value = true
  try {
    const res = await userAPI.register(registerForm.value)
    if (res.success) {
      if (res.data.isVerified) {
        toast.add({ severity: 'success', summary: '成功', detail: res.message || '注册成功，请登录', life: 3000 })
        showRegister.value = false
        loginForm.value.username = registerForm.value.username

        // Refresh config to update isFirstUser status
        const conf = await systemAPI.getConfig()
        if (conf.success) {
          isFirstUser.value = conf.data.isFirstUser
          allowRegistration.value = conf.data.allowRegistration
        }
      } else {
        toast.add({ severity: 'info', summary: '需验证邮箱', detail: res.message, life: 5000 })
        verifyForm.value.username = registerForm.value.username
        showRegister.value = false
        showVerification.value = true
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
