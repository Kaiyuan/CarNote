<template>
    <div>
        <h1 class="text-3xl font-bold mb-4">系统管理</h1>

        <TabView v-model:activeIndex="activeTab">
            <!-- 用户管理 -->
            <TabPanel header="用户管理">
                <div class="mb-4 flex justify-content-between align-items-center">
                    <h2 class="m-0">注册用户</h2>
                    <Button icon="pi pi-refresh" rounded text @click="loadUsers" />
                </div>
                <DataTable :value="users" :loading="loading" stripedRows responsiveLayout="stack">
                    <Column field="id" header="ID" style="width: 50px"></Column>
                    <Column field="username" header="用户名"></Column>
                    <Column field="nickname" header="昵称"></Column>
                    <Column field="email" header="邮箱"></Column>
                    <Column field="role" header="角色">
                        <template #body="slotProps">
                            <Tag :value="slotProps.data.role"
                                :severity="slotProps.data.role === 'admin' ? 'danger' : 'success'" />
                        </template>
                    </Column>
                    <Column field="is_disabled" header="状态">
                        <template #body="slotProps">
                            <Tag :value="slotProps.data.is_disabled ? '禁用' : '正常'"
                                :severity="slotProps.data.is_disabled ? 'danger' : 'success'" />
                        </template>
                    </Column>
                    <Column header="操作">
                        <template #body="slotProps">
                            <div class="flex gap-2">
                                <Button icon="pi pi-pencil" rounded text @click="editUser(slotProps.data)" />
                                <Button icon="pi pi-key" rounded text severity="warning"
                                    @click="confirmResetPwd(slotProps.data)" />
                                <Button :icon="slotProps.data.is_disabled ? 'pi pi-check' : 'pi pi-ban'" rounded text
                                    :severity="slotProps.data.is_disabled ? 'success' : 'danger'"
                                    @click="toggleUserStatus(slotProps.data)" />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </TabPanel>

            <!-- 全局数据管理 -->
            <TabPanel header="全量数据管理">
                <div class="surface-100 p-3 border-round mb-4">
                    <div class="grid p-fluid">
                        <div class="col-12 md:col-6 lg:col-3">
                            <label class="mb-1 block">所属用户</label>
                            <Dropdown v-model="mgmtFilters.user_id" :options="users" optionLabel="username"
                                optionValue="id" showClear placeholder="全部用户" @change="onMgmtFilterChange" />
                        </div>
                        <div class="col-12 md:col-6 lg:col-3">
                            <label class="mb-1 block">指定车辆</label>
                            <Dropdown v-model="mgmtFilters.vehicle_id" :options="mgmtVehicles"
                                optionLabel="plate_number" optionValue="id" showClear placeholder="全部车辆"
                                @change="loadMgmtRecords" />
                        </div>
                    </div>
                </div>

                <TabView>
                    <TabPanel header="车辆列表">
                        <DataTable :value="mgmtData.vehicles" :loading="loading" stripedRows paginator :rows="10">
                            <Column field="owner_name" header="所属用户"></Column>
                            <Column field="plate_number" header="车牌号"></Column>
                            <Column field="brand" header="品牌"></Column>
                            <Column field="buy_date" header="购车日期">
                                <template #body="slotProps">{{ formatDate(slotProps.data.buy_date) }}</template>
                            </Column>
                            <Column header="操作">
                                <template #body="slotProps">
                                    <Button icon="pi pi-pencil" text rounded
                                        @click="editMgmtItem('vehicle', slotProps.data)" />
                                    <Button icon="pi pi-trash" text rounded severity="danger"
                                        @click="deleteMgmtItem('vehicle', slotProps.data.id)" />
                                </template>
                            </Column>
                        </DataTable>
                    </TabPanel>
                    <TabPanel header="能耗记录">
                        <DataTable :value="mgmtData.energy" :loading="loading" stripedRows paginator :rows="10">
                            <Column field="owner_name" header="用户"></Column>
                            <Column field="plate_number" header="车辆"></Column>
                            <Column field="log_date" header="日期">
                                <template #body="slotProps">{{ formatDate(slotProps.data.log_date) }}</template>
                            </Column>
                            <Column field="amount" header="数量"></Column>
                            <Column field="cost" header="花费"></Column>
                            <Column header="操作">
                                <template #body="slotProps">
                                    <Button icon="pi pi-pencil" text rounded
                                        @click="editMgmtItem('energy', slotProps.data)" />
                                    <Button icon="pi pi-trash" text rounded severity="danger"
                                        @click="deleteMgmtItem('energy', slotProps.data.id)" />
                                </template>
                            </Column>
                        </DataTable>
                    </TabPanel>
                    <TabPanel header="保养维修">
                        <DataTable :value="mgmtData.maintenance" :loading="loading" stripedRows paginator :rows="10">
                            <Column field="owner_name" header="用户"></Column>
                            <Column field="plate_number" header="车辆"></Column>
                            <Column field="maintenance_date" header="日期">
                                <template #body="slotProps">{{ formatDate(slotProps.data.maintenance_date) }}</template>
                            </Column>
                            <Column field="description" header="项目"></Column>
                            <Column header="操作">
                                <template #body="slotProps">
                                    <Button icon="pi pi-pencil" text rounded
                                        @click="editMgmtItem('maintenance', slotProps.data)" />
                                    <Button icon="pi pi-trash" text rounded severity="danger"
                                        @click="deleteMgmtItem('maintenance', slotProps.data.id)" />
                                </template>
                            </Column>
                        </DataTable>
                    </TabPanel>
                    <TabPanel header="配件管理">
                        <DataTable :value="mgmtData.parts" :loading="loading" stripedRows paginator :rows="10">
                            <Column field="owner_name" header="用户"></Column>
                            <Column field="plate_number" header="车辆"></Column>
                            <Column field="name" header="配件名"></Column>
                            <Column field="status" header="状态"></Column>
                            <Column header="操作">
                                <template #body="slotProps">
                                    <Button icon="pi pi-pencil" text rounded
                                        @click="editMgmtItem('part', slotProps.data)" />
                                    <Button icon="pi pi-trash" text rounded severity="danger"
                                        @click="deleteMgmtItem('part', slotProps.data.id)" />
                                </template>
                            </Column>
                        </DataTable>
                    </TabPanel>
                </TabView>
            </TabPanel>

            <!-- 登录日志 -->
            <TabPanel header="审计与日志">
                <DataTable :value="loginLogs" :loading="loading" stripedRows paginator :rows="20"
                    responsiveLayout="stack">
                    <Column field="attempt_time" header="时间">
                        <template #body="slotProps">
                            {{ formatDateTime(slotProps.data.attempt_time) }}
                        </template>
                    </Column>
                    <Column field="username" header="用户名"></Column>
                    <Column field="ip_address" header="IP 地址"></Column>
                    <Column field="success" header="结果">
                        <template #body="slotProps">
                            <Tag :value="slotProps.data.success ? '成功' : '失败'"
                                :severity="slotProps.data.success ? 'success' : 'danger'" />
                        </template>
                    </Column>
                </DataTable>
            </TabPanel>

            <!-- 站点管理 -->
            <TabPanel header="站点管理">
                <div class="mb-4 flex justify-content-between align-items-center">
                    <h2 class="m-0">共享站点/店面</h2>
                    <Button icon="pi pi-refresh" rounded text @click="loadAdminLocations" />
                </div>
                <DataTable :value="adminLocations" :loading="loading" stripedRows paginator :rows="10">
                    <Column field="name" header="名称" sortable></Column>
                    <Column field="type" header="类型">
                        <template #body="slotProps">
                            <Tag :value="slotProps.data.type" severity="info" />
                        </template>
                    </Column>
                    <Column field="latitude" header="纬度"></Column>
                    <Column field="longitude" header="经度"></Column>
                    <Column field="usage_count" header="使用次数" sortable></Column>
                    <Column header="操作">
                        <template #body="slotProps">
                            <div class="flex gap-2">
                                <Button icon="pi pi-pencil" rounded text @click="editLocation(slotProps.data)" />
                                <Button icon="pi pi-trash" rounded text severity="danger"
                                    @click="deleteLocation(slotProps.data.id)" />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </TabPanel>

            <!-- 系统设置 -->
            <TabPanel header="系统设置">
                <div class="grid">
                    <div class="col-12 md:col-6 lg:col-4">
                        <Card class="shadow-2">
                            <template #title>SMTP 邮箱设置</template>
                            <template #content>
                                <div class="field mb-3">
                                    <label>SMTP 服务器</label>
                                    <InputText v-model="smtpConfig.smtp_host" placeholder="smtp.example.com"
                                        class="w-full" />
                                </div>
                                <div class="field mb-3">
                                    <label>端口</label>
                                    <InputNumber v-model="smtpConfig.smtp_port" :useGrouping="false" placeholder="465"
                                        class="w-full" />
                                </div>
                                <div class="field-checkbox mb-3">
                                    <Checkbox v-model="smtpSecure" :binary="true" />
                                    <label class="ml-2">使用 SSL (Secure)</label>
                                </div>
                                <div class="field mb-3">
                                    <label>用户名</label>
                                    <InputText v-model="smtpConfig.smtp_user" class="w-full" />
                                </div>
                                <div class="field mb-3">
                                    <label>密码/授权码</label>
                                    <InputText v-model="smtpConfig.smtp_pass" type="password" class="w-full" />
                                </div>
                                <div class="field mb-3">
                                    <label>发件人 (From)</label>
                                    <InputText v-model="smtpConfig.smtp_from" placeholder="noreply@domain.com"
                                        class="w-full" />
                                </div>
                                <Button label="保存配置" @click="saveSmtp" class="w-full mt-2" :loading="saving" />
                            </template>
                        </Card>
                    </div>
                </div>
            </TabPanel>
        </TabView>

        <!-- 用户编辑对话框 -->
        <Dialog v-model:visible="userDialog" header="编辑用户" :modal="true" style="width: 400px">
            <div class="field mb-3">
                <label>昵称</label>
                <InputText v-model="userForm.nickname" class="w-full" />
            </div>
            <div class="field mb-3">
                <label>邮箱</label>
                <InputText v-model="userForm.email" class="w-full" />
            </div>
            <div class="field mb-3">
                <label>角色</label>
                <Dropdown v-model="userForm.role" :options="['admin', 'user']" class="w-full" />
            </div>
            <template #footer>
                <Button label="取消" text @click="userDialog = false" />
                <Button label="保存" @click="saveUser" />
            </template>
        </Dialog>

        <!-- 站点编辑对话框 -->
        <Dialog v-model:visible="locationDialog" header="编辑站点" :modal="true" style="width: 450px">
            <div class="field mb-3">
                <label>名称</label>
                <InputText v-model="locationForm.name" class="w-full" />
            </div>
            <div class="field mb-3">
                <label>类型</label>
                <Dropdown v-model="locationForm.type" :options="['energy', 'maintenance']" class="w-full" />
            </div>
            <div class="field mb-3">
                <label>纬度</label>
                <InputNumber v-model="locationForm.latitude" :minFractionDigits="2" :maxFractionDigits="7"
                    class="w-full" />
            </div>
            <div class="field mb-3">
                <label>经度</label>
                <InputNumber v-model="locationForm.longitude" :minFractionDigits="2" :maxFractionDigits="7"
                    class="w-full" />
            </div>
            <template #footer>
                <Button label="取消" text @click="locationDialog = false" />
                <Button label="保存" @click="saveLocation" />
            </template>
        </Dialog>

        <!-- 通用管理项编辑对话框 (车辆) -->
        <Dialog v-model:visible="mgmtDialogs.vehicle" header="编辑车辆" :modal="true" style="width: 450px">
            <div class="field mb-3"><label>牌号</label>
                <InputText v-model="mgmtForm.plate_number" class="w-full" />
            </div>
            <div class="field mb-3"><label>品牌</label>
                <InputText v-model="mgmtForm.brand" class="w-full" />
            </div>
            <div class="field mb-3"><label>型号</label>
                <InputText v-model="mgmtForm.model" class="w-full" />
            </div>
            <div class="field mb-3"><label>年份</label>
                <InputNumber v-model="mgmtForm.year" :useGrouping="false" class="w-full" />
            </div>
            <div class="field mb-3">
                <label>动力类型</label>
                <Dropdown v-model="mgmtForm.power_type" :options="['fuel', 'electric', 'hybrid']" class="w-full" />
            </div>
            <div class="field mb-3"><label>里程 (km)</label>
                <InputNumber v-model="mgmtForm.current_mileage" class="w-full" />
            </div>
            <div class="field mb-3"><label>说明</label><Textarea v-model="mgmtForm.description" rows="2" class="w-full" />
            </div>
            <template #footer>
                <Button label="取消" text @click="mgmtDialogs.vehicle = false" />
                <Button label="保存" @click="saveMgmtItem('vehicle')" />
            </template>
        </Dialog>

        <!-- 通用管理项编辑对话框 (能耗) -->
        <Dialog v-model:visible="mgmtDialogs.energy" header="编辑能耗记录" :modal="true" style="width: 450px">
            <div class="field mb-3"><label>日期</label>
                <Calendar v-model="mgmtForm.log_date" class="w-full" dateFormat="yy-mm-dd" showTime hourFormat="24" />
            </div>
            <div class="field mb-3"><label>里程 (km)</label>
                <InputNumber v-model="mgmtForm.mileage" class="w-full" />
            </div>
            <div class="field mb-3">
                <label>类型</label>
                <Dropdown v-model="mgmtForm.energy_type" :options="['fuel', 'electric']" class="w-full" />
            </div>
            <div class="field mb-3"><label>数量 (L/kWh)</label>
                <InputNumber v-model="mgmtForm.amount" class="w-full" :minFractionDigits="2" />
            </div>
            <div class="field mb-3"><label>单价 (元)</label>
                <InputNumber v-model="mgmtForm.unit_price" class="w-full" :minFractionDigits="2" />
            </div>
            <div class="field mb-3"><label>总计 (元)</label>
                <InputNumber v-model="mgmtForm.cost" class="w-full" :minFractionDigits="2" />
            </div>
            <div class="field mb-3"><label>位置</label>
                <InputText v-model="mgmtForm.location_name" class="w-full" />
            </div>
            <template #footer>
                <Button label="取消" text @click="mgmtDialogs.energy = false" />
                <Button label="保存" @click="saveMgmtItem('energy')" />
            </template>
        </Dialog>

        <!-- 通用管理项编辑对话框 (保养) -->
        <Dialog v-model:visible="mgmtDialogs.maintenance" header="编辑保养记录" :modal="true" style="width: 450px">
            <div class="field mb-3"><label>日期</label>
                <Calendar v-model="mgmtForm.maintenance_date" class="w-full" dateFormat="yy-mm-dd" />
            </div>
            <div class="field mb-3"><label>里程 (km)</label>
                <InputNumber v-model="mgmtForm.mileage" class="w-full" />
            </div>
            <div class="field mb-3"><label>描述</label>
                <InputText v-model="mgmtForm.description" class="w-full" />
            </div>
            <div class="field mb-3"><label>金额 (元)</label>
                <InputNumber v-model="mgmtForm.cost" class="w-full" :minFractionDigits="2" />
            </div>
            <template #footer>
                <Button label="取消" text @click="mgmtDialogs.maintenance = false" />
                <Button label="保存" @click="saveMgmtItem('maintenance')" />
            </template>
        </Dialog>

        <!-- 配件编辑对话框 -->
        <Dialog v-model:visible="mgmtDialogs.part" header="编辑配件信息" :modal="true" style="width: 450px">
            <div class="field mb-3"><label>配件名称</label>
                <InputText v-model="mgmtForm.name" class="w-full" />
            </div>
            <div class="field mb-3"><label>配件编号</label>
                <InputText v-model="mgmtForm.part_number" class="w-full" />
            </div>
            <div class="field mb-3"><label>状态</label>
                <Dropdown v-model="mgmtForm.status" :options="['normal', 'warning', 'critical']" class="w-full" />
            </div>
            <template #footer>
                <Button label="取消" text @click="mgmtDialogs.part = false" />
                <Button label="保存" @click="saveMgmtItem('part')" />
            </template>
        </Dialog>

        <!-- 密码重置显示对话框 -->
        <Dialog v-model:visible="showGeneratedPwd" header="密码已重置" :modal="true" style="width: 400px">
            <div class="text-center py-4">
                <p>该用户的新密码已生成：</p>
                <div class="text-2xl font-bold p-3 surface-200 border-round mb-4 select-all">
                    {{ generatedPwd }}
                </div>
                <p class="text-sm text-600">请告知用户此密码，用户登录后可自行修改。</p>
                <Button label="确定" @click="showGeneratedPwd = false" class="w-full mt-3" />
            </div>
        </Dialog>
    </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { adminAPI } from '../api'
import { useToast } from 'primevue/usetoast'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'

const toast = useToast()
const activeTab = ref(0)
const loading = ref(false)
const saving = ref(false)

const users = ref([])
const loginLogs = ref([])
const smtpConfig = ref({})
const mgmtData = ref({
    vehicles: [],
    energy: [],
    maintenance: [],
    parts: []
})
const mgmtVehicles = ref([])
const mgmtFilters = ref({
    user_id: null,
    vehicle_id: null
})
const mgmtDialogs = ref({
    vehicle: false,
    energy: false,
    maintenance: false,
    part: false
})
const mgmtForm = ref({})
const adminLocations = ref([])

// 站点表单
const locationDialog = ref(false)
const locationForm = ref({})

// 用户表单
const userDialog = ref(false)
const userForm = ref({})

// 密码重置
const showGeneratedPwd = ref(false)
const generatedPwd = ref('')

const smtpSecure = computed({
    get: () => smtpConfig.value.smtp_secure === 'true',
    set: (val) => smtpConfig.value.smtp_secure = val ? 'true' : 'false'
})

const loadUsers = async () => {
    loading.value = true
    try {
        const res = await adminAPI.getUsers()
        if (res.success) users.value = res.data
    } catch (e) {
        toast.add({ severity: 'error', summary: '加载失败', detail: '用户列表加载失败', life: 3000 })
    } finally {
        loading.value = false
    }
}

const loadLogs = async () => {
    try {
        const res = await adminAPI.getLoginLogs()
        if (res.success) loginLogs.value = res.data
    } catch (e) { }
}

const loadSmtp = async () => {
    try {
        const res = await adminAPI.getSmtpConfig()
        if (res.success) smtpConfig.value = res.data
    } catch (e) { }
}

const loadMgmtRecords = async () => {
    loading.value = true
    try {
        const params = { ...mgmtFilters.value }
        const [vRes, eRes, mRes, pRes] = await Promise.all([
            adminAPI.getAllVehicles(params),
            adminAPI.getAllEnergy(params),
            adminAPI.getAllMaintenance(params),
            adminAPI.getAllParts(params)
        ])
        if (vRes.success) mgmtData.value.vehicles = vRes.data
        if (eRes.success) mgmtData.value.energy = eRes.data
        if (mRes.success) mgmtData.value.maintenance = mRes.data
        if (pRes.success) mgmtData.value.parts = pRes.data
    } catch (e) {
        toast.add({ severity: 'error', summary: '加载失败', detail: '数据加载失败' })
    } finally {
        loading.value = false
    }
}

const onMgmtFilterChange = async () => {
    mgmtFilters.value.vehicle_id = null
    if (mgmtFilters.value.user_id) {
        const res = await adminAPI.getAllVehicles({ user_id: mgmtFilters.value.user_id })
        if (res.success) mgmtVehicles.value = res.data
    } else {
        mgmtVehicles.value = []
    }
    loadMgmtRecords()
}

const editMgmtItem = (type, item) => {
    mgmtForm.value = { ...item }
    if (mgmtForm.value.log_date) mgmtForm.value.log_date = new Date(mgmtForm.value.log_date)
    if (mgmtForm.value.maintenance_date) mgmtForm.value.maintenance_date = new Date(mgmtForm.value.maintenance_date)
    if (mgmtForm.value.buy_date) mgmtForm.value.buy_date = new Date(mgmtForm.value.buy_date)
    mgmtDialogs.value[type] = true
}

const saveMgmtItem = async (type) => {
    try {
        let res
        const id = mgmtForm.value.id
        if (type === 'vehicle') res = await adminAPI.updateVehicle(id, mgmtForm.value)
        else if (type === 'energy') res = await adminAPI.updateEnergy(id, mgmtForm.value)
        else if (type === 'maintenance') res = await adminAPI.updateMaintenance(id, mgmtForm.value)
        else if (type === 'part') res = await adminAPI.updatePart(id, mgmtForm.value)

        if (res.success) {
            toast.add({ severity: 'success', summary: '成功', detail: '操作已完成' })
            mgmtDialogs.value[type] = false
            loadMgmtRecords()
        }
    } catch (e) {
        toast.add({ severity: 'error', summary: '错误', detail: '保存失败' })
    }
}

const deleteMgmtItem = async (type, id) => {
    if (!confirm('确定要删除此记录吗？')) return
    try {
        let res
        if (type === 'vehicle') res = await adminAPI.deleteVehicle(id)
        else if (type === 'energy') res = await adminAPI.deleteEnergy(id)
        else if (type === 'maintenance') res = await adminAPI.deleteMaintenance(id)
        else if (type === 'part') res = await adminAPI.deletePart(id)

        if (res.success) {
            toast.add({ severity: 'success', summary: '成功', detail: '已删除' })
            loadMgmtRecords()
        }
    } catch (e) {
        toast.add({ severity: 'error', summary: '错误', detail: '删除失败' })
    }
}

const loadAdminLocations = async () => {
    loading.value = true
    try {
        const res = await adminAPI.getLocations()
        if (res.success) adminLocations.value = res.data
    } catch (e) {
        toast.add({ severity: 'error', summary: '加载失败', detail: '站点列表加载失败' })
    } finally {
        loading.value = false
    }
}

const editUser = (user) => {
    userForm.value = { ...user }
    userDialog.value = true
}

const saveUser = async () => {
    try {
        const res = await adminAPI.updateUser(userForm.value.id, userForm.value)
        if (res.success) {
            toast.add({ severity: 'success', summary: '成功', detail: '用户信息已更新', life: 3000 })
            userDialog.value = false
            loadUsers()
        }
    } catch (e) {
        toast.add({ severity: 'error', summary: '错误', detail: e.message || '更新失败', life: 3000 })
    }
}

const toggleUserStatus = async (user) => {
    try {
        const newStatus = !user.is_disabled
        const res = await adminAPI.updateUser(user.id, { is_disabled: newStatus })
        if (res.success) {
            toast.add({ severity: 'success', summary: '成功', detail: `用户已${newStatus ? '禁用' : '启用'}`, life: 3000 })
            loadUsers()
        }
    } catch (e) {
        toast.add({ severity: 'error', summary: '错误', detail: e.message || '操作失败', life: 3000 })
    }
}

const confirmResetPwd = async (user) => {
    if (!confirm(`确定要重置用户 "${user.username}" 的密码吗？`)) return
    try {
        const res = await adminAPI.adminResetPassword(user.id)
        if (res.success) {
            generatedPwd.value = res.data.password
            showGeneratedPwd.value = true
        }
    } catch (e) {
        toast.add({ severity: 'error', summary: '错误', detail: '密码重置失败', life: 3000 })
    }
}

const saveSmtp = async () => {
    saving.value = true
    try {
        const res = await adminAPI.updateSmtpConfig(smtpConfig.value)
        if (res.success) {
            toast.add({ severity: 'success', summary: '成功', detail: 'SMTP 配置已保存', life: 3000 })
        }
    } catch (e) {
        toast.add({ severity: 'error', summary: '错误', detail: '保存失败', life: 3000 })
    } finally {
        saving.value = false
    }
}

const editLocation = (loc) => {
    locationForm.value = { ...loc }
    locationDialog.value = true
}

const saveLocation = async () => {
    try {
        const res = await adminAPI.updateLocation(locationForm.value.id, locationForm.value)
        if (res.success) {
            toast.add({ severity: 'success', summary: '成功', detail: '站点已更新' })
            locationDialog.value = false
            loadAdminLocations()
        }
    } catch (e) {
        toast.add({ severity: 'error', summary: '错误', detail: '保存失败' })
    }
}

const deleteLocation = async (id) => {
    if (!confirm('确定要删除此站点吗？')) return
    try {
        const res = await adminAPI.deleteLocation(id)
        if (res.success) {
            toast.add({ severity: 'success', summary: '成功', detail: '站点已删除' })
            loadAdminLocations()
        }
    } catch (e) {
        toast.add({ severity: 'error', summary: '错误', detail: '删除失败' })
    }
}

// Watch active tab to load data lazily
watch(activeTab, (idx) => {
    if (idx === 0) loadUsers()
    if (idx === 1) loadMgmtRecords()
    if (idx === 2) loadLogs()
    if (idx === 3) loadAdminLocations()
    if (idx === 4) loadSmtp()
})

const formatDate = (d) => d ? new Date(d).toLocaleDateString() : ''
const formatDateTime = (d) => d ? new Date(d).toLocaleString() : ''

onMounted(() => {
    loadUsers()
})
</script>

<style scoped>
label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
}
</style>
