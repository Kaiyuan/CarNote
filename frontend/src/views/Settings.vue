<!--
  用户设置页面
-->

<template>
    <div class="grid justify-content-center">
        <div class="col-12 md:col-8 lg:col-6">
            <Card class="shadow-2">
                <template #title>
                    <div class="flex align-items-center">
                        <i class="pi pi-cog mr-2"></i>
                        用户设置
                    </div>
                </template>

                <template #content>
                    <div v-if="loading" class="text-center py-5">
                        <ProgressSpinner />
                    </div>

                    <div v-else class="p-fluid">
                        <h3 class="text-lg font-semibold mb-3">基本信息</h3>
                        <div class="field">
                            <label>用户名</label>
                            <InputText :modelValue="userInfo.username" disabled />
                        </div>

                        <div class="field">
                            <label>昵称</label>
                            <InputText v-model="settingsForm.profile.nickname" />
                        </div>

                        <div class="field">
                            <label>邮箱</label>
                            <InputText v-model="settingsForm.profile.email" />
                        </div>

                        <Divider />

                        <h3 class="text-lg font-semibold mb-3">偏好设置</h3>
                        <div class="formgrid grid">
                            <div class="field col-6">
                                <label>货币单位</label>
                                <InputText v-model="settingsForm.preferences.currency_symbol" placeholder="例如: ¥" />
                            </div>
                            <div class="field col-6">
                                <label>容量单位</label>
                                <Dropdown v-model="settingsForm.preferences.volume_unit"
                                    :options="[{ label: '升 (L)', value: 'L' }, { label: '加仑 (gal)', value: 'gal' }]"
                                    optionLabel="label" optionValue="value" />
                            </div>
                        </div>

                        <div class="field-checkbox mt-3">
                            <Checkbox v-model="settingsForm.preferences.reminder_enabled" :binary="true"
                                inputId="reminder" />
                            <label for="reminder" class="ml-2">启用保养提醒</label>
                        </div>

                        <div v-if="settingsForm.preferences.reminder_enabled" class="field mt-3">
                            <label>提前提醒天数</label>
                            <InputNumber v-model="settingsForm.preferences.reminder_days_before" :min="1" suffix=" 天" />
                        </div>

                        <Divider v-if="isAdmin" />

                        <div v-if="isAdmin">
                            <h3 class="text-lg font-semibold mb-3">系统设置 (管理员)</h3>
                            <div class="field-checkbox">
                                <Checkbox v-model="systemSettings.allow_registration" :binary="true"
                                    inputId="sys_reg" />
                                <label for="sys_reg" class="ml-2">允许新用户注册</label>
                            </div>
                        </div>

                        <Divider />

                        <h3 class="text-lg font-semibold mb-3">API 密钥管理</h3>
                        <div class="mb-3">
                            <p class="text-sm text-600 mb-2">使用 API Key 可以快速通过 API 提交数据。</p>
                            <Button label="生成新密钥" icon="pi pi-key" size="small" outlined
                                @click="showKeyDialog = true" />
                        </div>

                        <DataTable :value="apiKeys" size="small" stripedRows v-if="apiKeys.length > 0">
                            <Column field="key_name" header="名称"></Column>
                            <Column field="key_prefix" header="前缀">
                                <template #body="slotProps">
                                    <code>{{ slotProps.data.key_value.substring(0, 8) }}...</code>
                                </template>
                            </Column>
                            <Column field="created_at" header="创建时间">
                                <template #body="slotProps">
                                    {{ formatDate(slotProps.data.created_at) }}
                                </template>
                            </Column>
                            <Column header="操作">
                                <template #body="slotProps">
                                    <Button icon="pi pi-trash" text rounded severity="danger" size="small"
                                        @click="deleteApiKey(slotProps.data.id)" />
                                </template>
                            </Column>
                        </DataTable>

                        <Divider />

                        <h3 class="text-lg font-semibold mb-3">数据管理</h3>
                        <div class="mb-4">
                            <p class="text-sm text-600 mb-2">备份与恢复（JSON 格式）</p>
                            <div class="flex flex-wrap gap-2">
                                <Button label="导出全量数据" icon="pi pi-download" size="small" outlined
                                    @click="exportFullData" :loading="exporting" />
                                <Button label="导入全量数据" icon="pi pi-upload" size="small" outlined @click="triggerImport"
                                    :loading="validating" />
                                <input type="file" ref="importFile" style="display: none" accept=".json"
                                    @change="onFileChange" />
                            </div>
                        </div>

                        <div class="mb-3">
                            <p class="text-sm text-600 mb-2">分类数据导出（CSV 格式）</p>
                            <div class="flex flex-wrap gap-2">
                                <Button label="导出车辆" icon="pi pi-car" size="small" severity="secondary" text
                                    @click="exportVehicles" />
                                <Button label="导出能耗" icon="pi pi-bolt" size="small" severity="secondary" text
                                    @click="exportEnergy" />
                                <Button label="导出保养" icon="pi pi-wrench" size="small" severity="secondary" text
                                    @click="exportMaintenance" />
                            </div>
                        </div>

                    </div>
                </template>

                <template #footer>
                    <div class="flex justify-content-end gap-2">
                        <Button label="取消" text @click="router.back()" />
                        <Button label="保存设置" icon="pi pi-check" @click="saveSettings" :loading="saving" />
                    </div>
                </template>
            </Card>

            <!-- API Key 显示对话框 -->
            <Dialog v-model:visible="showKeyDialog" header="新的 API Key" :modal="true" :closable="false"
                :breakpoints="{ '960px': '75vw', '640px': '95vw' }" :style="{ width: '450px' }">
                <div class="field">
                    <label>密钥名称</label>
                    <InputText v-model="newKeyForm.key_name" class="w-full" placeholder="例如: 我的快捷指令" />
                </div>
                <div class="field">
                    <label>关联车辆</label>
                    <Dropdown v-model="newKeyForm.vehicle_id" :options="vehicles" optionLabel="plate_number"
                        optionValue="id" placeholder="选择默认车辆" class="w-full" />
                </div>

                <div v-if="generatedKey" class="surface-100 p-3 border-round mt-3">
                    <div class="text-green-600 font-bold mb-2">密钥已生成!</div>
                    <p class="text-sm text-600 mb-2">请立即复制保存，关闭后将无法再次查看。</p>
                    <div class="flex gap-2">
                        <InputText :value="generatedKey" readonly class="w-full font-mono" />
                        <Button icon="pi pi-copy" @click="copyKey" />
                    </div>
                </div>

                <template #footer>
                    <Button v-if="!generatedKey" label="生成" @click="generateKey" :loading="generatingKey" />
                    <Button v-else label="关闭" @click="closeKeyDialog" />
                </template>
            </Dialog>

            <!-- 导入预览对话框 -->
            <Dialog v-model:visible="showImportDialog" header="导入详情确认" :modal="true"
                :breakpoints="{ '960px': '75vw', '640px': '95vw' }" :style="{ width: '450px' }">
                <div v-if="importSummary" class="p-fluid">
                    <p class="mb-3">解析到以下数据记录，确定要执行导入吗？</p>
                    <ul class="list-none p-0 m-0">
                        <li class="flex justify-content-between mb-2 pb-2 border-bottom-1 surface-border">
                            <span>车辆信息</span>
                            <Tag value="success">{{ importSummary.vehicles }} 条</Tag>
                        </li>
                        <li class="flex justify-content-between mb-2 pb-2 border-bottom-1 surface-border">
                            <span>能耗记录</span>
                            <Tag value="info">{{ importSummary.energyLogs }} 条</Tag>
                        </li>
                        <li class="flex justify-content-between mb-2 pb-2 border-bottom-1 surface-border">
                            <span>保养记录</span>
                            <Tag value="warning">{{ importSummary.maintenanceRecords }} 条</Tag>
                        </li>
                        <li class="flex justify-content-between mb-2 pb-2">
                            <span>配件信息</span>
                            <Tag value="secondary">{{ importSummary.parts }} 条</Tag>
                        </li>
                    </ul>
                    <div class="mt-4 p-3 orange-50 surface-50 border-round">
                        <p class="text-sm text-700 m-0">
                            <i class="pi pi-exclamation-triangle mr-1"></i>
                            导入过程不可逆，旧数据将保留，冲突记录将根据标识自动合并或跳过。
                        </p>
                    </div>
                </div>
                <template #footer>
                    <Button label="取消" text @click="showImportDialog = false" />
                    <Button label="确认导入" icon="pi pi-check" @click="executeImport" :loading="importing" />
                </template>
            </Dialog>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { userAPI, vehicleAPI, systemAPI, exportAPI, importAPI } from '../api'
import { convertToCSV, downloadFile, downloadBackupJSON } from '../utils/dataExport'
import { validateBackupFormat } from '../utils/dataImport'

const router = useRouter()
const toast = useToast()

const loading = ref(false)
const saving = ref(false)
const exporting = ref(false)
const validating = ref(false)
const importing = ref(false)
const importFile = ref(null)
const showImportDialog = ref(false)
const importSummary = ref(null)
const pendingData = ref(null)
const userInfo = ref({})
const settingsForm = ref({
    profile: {
        nickname: '',
        email: ''
    },
    preferences: {
        currency_symbol: '¥',
        volume_unit: 'L',
        reminder_enabled: true,
        reminder_days_before: 7
    }
})
const systemSettings = ref({
    allow_registration: true
})

const apiKeys = ref([])
const vehicles = ref([])

const isAdmin = computed(() => userInfo.value.role === 'admin')

// API Key 相关
const showKeyDialog = ref(false)
const generatingKey = ref(false)
const newKeyForm = ref({ key_name: '', vehicle_id: null })
const generatedKey = ref('')

// 加载数据
const loadData = async () => {
    loading.value = true
    try {
        const [profileRes, settingsRes, keysRes, vehiclesRes] = await Promise.all([
            userAPI.getProfile(),
            userAPI.getSettings(),
            userAPI.getApiKeys(),
            vehicleAPI.getList()
        ])

        if (profileRes.success) {
            userInfo.value = profileRes.data
            settingsForm.value.profile.nickname = profileRes.data.nickname || ''
            settingsForm.value.profile.email = profileRes.data.email || ''
        }

        // If admin, load system settings
        if (profileRes.data.role === 'admin') {
            const sysRes = await systemAPI.getConfig()
            if (sysRes.success) {
                systemSettings.value.allow_registration = sysRes.data.allowRegistration
            }
        }

        if (settingsRes.success && settingsRes.data) {
            // 合并设置
            settingsForm.value.preferences = {
                ...settingsForm.value.preferences,
                ...settingsRes.data
            }
        }

        if (keysRes.success) {
            apiKeys.value = keysRes.data
        }

        if (vehiclesRes.success) {
            vehicles.value = vehiclesRes.data
        }

    } catch (error) {
        toast.add({ severity: 'error', summary: '错误', detail: '加载设置失败', life: 3000 })
    } finally {
        loading.value = false
    }
}

// 保存设置
const saveSettings = async () => {
    saving.value = true
    try {
        // 更新个人信息
        // 目前 userAPI 没有单独更新 profile 的接口，假设 updateSettings 可以处理或者需要扩展后端
        // 这里主要更新 preferences

        const promises = [userAPI.updateSettings(settingsForm.value.preferences)]

        if (isAdmin.value) {
            promises.push(systemAPI.updateConfig({
                allow_registration: systemSettings.value.allow_registration
            }))
        }

        const results = await Promise.all(promises)
        const allSuccess = results.every(r => r.success)

        if (allSuccess) {
            toast.add({ severity: 'success', summary: '成功', detail: '设置已保存', life: 3000 })
            // 更新本地存储的用户信息（如果昵称变了）
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
            currentUser.nickname = settingsForm.value.profile.nickname
            localStorage.setItem('currentUser', JSON.stringify(currentUser))
        }
    } catch (error) {
        toast.add({ severity: 'error', summary: '错误', detail: '保存失败', life: 3000 })
    } finally {
        saving.value = false
    }
}

// 生成 API Key
const generateKey = async () => {
    if (!newKeyForm.value.key_name) {
        toast.add({ severity: 'warn', summary: '提示', detail: '请输入密钥名称', life: 3000 })
        return
    }

    generatingKey.value = true
    try {
        const res = await userAPI.createApiKey(newKeyForm.value)
        if (res.success) {
            generatedKey.value = res.data.key_value
            // 刷新列表
            const keysRes = await userAPI.getApiKeys()
            if (keysRes.success) apiKeys.value = keysRes.data
        }
    } catch (error) {
        toast.add({ severity: 'error', summary: '错误', detail: error.message || ' 生成失败', life: 3000 })
    } finally {
        generatingKey.value = false
    }
}

const closeKeyDialog = () => {
    showKeyDialog.value = false
    generatedKey.value = ''
    newKeyForm.value = { key_name: '', vehicle_id: null }
}

const copyKey = async () => {
    try {
        await navigator.clipboard.writeText(generatedKey.value)
        toast.add({ severity: 'success', summary: '复制成功', life: 2000 })
    } catch (err) {
        toast.add({ severity: 'error', summary: '复制失败', detail: '请手动复制', life: 3000 })
    }
}

const deleteApiKey = async (id) => {
    // 暂时没有 delete API，跳过实现或添加后端支持
    // 根据 api/index.js，没有 deleteApiKey 方法
    toast.add({ severity: 'info', summary: '提示', detail: '暂不支持删除 API Key', life: 3000 })
}

const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString()
}

// 数据管理相关

// 1. 全量导出 (JSON)
const exportFullData = async () => {
    exporting.value = true
    try {
        const res = await exportAPI.all()
        if (res.success) {
            downloadBackupJSON(res.data)
            toast.add({ severity: 'success', summary: '成功', detail: '备份数据已导出', life: 3000 })
        }
    } catch (error) {
        toast.add({ severity: 'error', summary: '错误', detail: '导出失败', life: 3000 })
    } finally {
        exporting.value = false
    }
}

// 2. 分类导出 (CSV)
const exportVehicles = async () => {
    try {
        const res = await exportAPI.vehicles()
        if (res.success) {
            const columns = {
                plate_number: '车牌号', brand: '品牌', model: '型号', year: '年份',
                color: '颜色', current_mileage: '当前里程', power_type: '动力类型'
            }
            const csv = convertToCSV(res.data, columns)
            downloadFile(csv, `车辆列表_${new Date().toLocaleDateString()}.csv`)
        }
    } catch (e) { toast.add({ severity: 'error', summary: '导出失败' }) }
}

const exportEnergy = async () => {
    try {
        const res = await exportAPI.energy()
        if (res.success) {
            const columns = {
                log_date: '日期', plate_number: '车牌', mileage: '里程',
                energy_type: '类型', amount: '数量', cost: '费用', consumption_per_100km: '百公里能耗'
            }
            const csv = convertToCSV(res.data, columns)
            downloadFile(csv, `能耗记录_${new Date().toLocaleDateString()}.csv`)
        }
    } catch (e) { toast.add({ severity: 'error', summary: '导出失败' }) }
}

const exportMaintenance = async () => {
    try {
        const res = await exportAPI.maintenance()
        if (res.success) {
            const columns = {
                maintenance_date: '日期', plate_number: '车牌', mileage: '里程',
                type: '项目', description: '描述', cost: '金额', shop_name: '地点'
            }
            const csv = convertToCSV(res.data, columns)
            downloadFile(csv, `保养记录_${new Date().toLocaleDateString()}.csv`)
        }
    } catch (e) { toast.add({ severity: 'error', summary: '导出失败' }) }
}

// 3. 导入逻辑
const triggerImport = () => {
    importFile.value.click()
}

const onFileChange = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    validating.value = true
    try {
        const reader = new FileReader()
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result)
                if (!validateBackupFormat(data)) {
                    toast.add({ severity: 'error', summary: '格式错误', detail: '非有效的备份文件', life: 3000 })
                    return
                }

                const res = await importAPI.validate(data)
                if (res.success) {
                    importSummary.value = res.data.summary
                    pendingData.value = data
                    showImportDialog.value = true
                }
            } catch (err) {
                toast.add({ severity: 'error', summary: '解析失败', detail: '文件内容不是合法的 JSON' })
            } finally {
                validating.value = false
            }
        }
        reader.readAsText(file)
    } catch (error) {
        toast.add({ severity: 'error', summary: '读取失败' })
        validating.value = false
    } finally {
        event.target.value = ''
    }
}

const executeImport = async () => {
    importing.value = true
    try {
        const res = await importAPI.execute(pendingData.value)
        if (res.success) {
            toast.add({ severity: 'success', summary: '导入成功', detail: '数据已恢复', life: 3000 })
            showImportDialog.value = false
            loadData()
        }
    } catch (error) {
        toast.add({ severity: 'error', summary: '导入失败', detail: error.response?.data?.message || '服务器错误' })
    } finally {
        importing.value = false
    }
}

onMounted(() => {
    loadData()
})
</script>
