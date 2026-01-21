<template>
    <div class="card">
        <h1 class="text-3xl font-bold mb-4">消息中心</h1>

        <TabView>
            <!-- 公告标签页 -->
            <TabPanel header="系统公告">
                <div class="flex justify-content-between align-items-center mb-3">
                    <h3 class="m-0">最新公告</h3>
                    <Button v-if="isAdmin" label="发布公告" icon="pi pi-plus" @click="openAnnouncementDialog()" />
                </div>

                <div v-if="loadingAnnouncements" class="text-center p-5">
                    <ProgressSpinner />
                </div>
                <div v-else-if="announcements.length === 0" class="text-center p-5 surface-100 border-round">
                    <i class="pi pi-megaphone text-4xl text-400 mb-3"></i>
                    <p class="text-600">暂无系统公告</p>
                </div>
                <div v-else class="grid">
                    <div v-for="ann in announcements" :key="ann.id" class="col-12">
                        <div class="p-3 border-round surface-0 shadow-1 hover:shadow-2 transition-duration-200 border-left-3" 
                             :class="getSeverityBorder(ann.type)">
                            <div class="flex justify-content-between align-items-start">
                                <div class="flex align-items-center gap-2 mb-2">
                                    <Tag v-if="ann.is_pinned" value="置顶" severity="danger" />
                                    <span class="text-xl font-bold">{{ ann.title }}</span>
                                    <Tag :value="getTypeLabel(ann.type)" :severity="ann.type" />
                                </div>
                                <div v-if="isAdmin" class="flex gap-1">
                                    <Button icon="pi pi-pencil" text rounded size="small" @click="openAnnouncementDialog(ann)" />
                                    <Button icon="pi pi-trash" text rounded severity="danger" size="small" @click="deleteAnnouncement(ann.id)" />
                                </div>
                            </div>
                            <p class="text-700 m-0 white-space-pre-wrap">{{ ann.content }}</p>
                            <div class="mt-3 flex justify-content-between align-items-center">
                                <small class="text-500">发布者: {{ ann.creator_name }}</small>
                                <small class="text-500">{{ formatDate(ann.created_at) }}</small>
                            </div>
                        </div>
                    </div>
                </div>
            </TabPanel>

            <!-- 工单标签页 -->
            <TabPanel :header="isAdmin ? '用户工单' : '我的工单'">
                <div class="flex justify-content-between align-items-center mb-3">
                    <h3 class="m-0">{{ isAdmin ? '待处理工单' : '工单历史' }}</h3>
                    <Button v-if="!isAdmin" label="提交工单" icon="pi pi-plus" @click="showTicketDialog = true" />
                </div>

                <DataTable :value="tickets" :loading="loadingTickets" stripedRows responsiveLayout="stack" breakpoint="960px">
                    <Column field="title" header="标题"></Column>
                    <Column field="category" header="分类">
                        <template #body="slotProps">
                            <Chip :label="slotProps.data.category || '其它'" />
                        </template>
                    </Column>
                    <Column field="status" header="状态">
                        <template #body="slotProps">
                            <Tag :value="getStatusLabel(slotProps.data.status)" :severity="getStatusSeverity(slotProps.data.status)" />
                        </template>
                    </Column>
                    <Column header="时间">
                        <template #body="slotProps">
                            {{ formatDate(slotProps.data.created_at) }}
                        </template>
                    </Column>
                    <Column header="操作">
                        <template #body="slotProps">
                            <Button label="查看详情" text @click="viewTicket(slotProps.data)" />
                        </template>
                    </Column>
                </DataTable>
            </TabPanel>

            <!-- 提醒标签页 -->
            <TabPanel header="到期提醒">
                <div class="grid mt-2">
                    <!-- Maintenance Reminders -->
                    <div class="col-12 lg:col-6">
                        <div class="surface-ground p-4 border-round h-full">
                            <h3 class="mt-0 flex align-items-center gap-2">
                                <i class="pi pi-wrench text-orange-500"></i>
                                保养到期
                            </h3>
                            <div v-if="maintenanceReminders.length === 0" class="text-500">暂无保养提醒</div>
                            <div v-else class="flex flex-column gap-3">
                                <div v-for="rem in maintenanceReminders" :key="'mr-'+rem.id" class="surface-0 p-3 border-round shadow-1 border-left-3 border-orange-500">
                                    <div class="font-bold mb-1">{{ rem.plate_number }}</div>
                                    <div class="text-700">距离下次保养里程还剩: <span class="text-orange-600 font-bold">{{ rem.next_maintenance_mileage - rem.current_mileage }} km</span></div>
                                    <router-link :to="'/maintenance?vehicle_id=' + rem.vehicle_id">
                                        <Button label="去记录保养" text size="small" class="mt-2 p-0" />
                                    </router-link>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Parts Reminders -->
                    <div class="col-12 lg:col-6">
                        <div class="surface-ground p-4 border-round h-full">
                            <h3 class="mt-0 flex align-items-center gap-2">
                                <i class="pi pi-cog text-red-500"></i>
                                配件更换
                            </h3>
                            <div v-if="partsReminders.length === 0" class="text-500">暂无配件提醒</div>
                            <div v-else class="flex flex-column gap-3">
                                <div v-for="part in partsReminders" :key="'pr-'+part.id" class="surface-0 p-3 border-round shadow-1 border-left-3 border-red-500">
                                    <div class="font-bold mb-1">{{ part.plate_number }} - {{ part.name }}</div>
                                    <div class="text-700">建议更换里程: {{ part.installed_mileage + part.recommended_replacement_mileage }} km</div>
                                    <div class="text-500 small">当前里程: {{ part.current_mileage }} km</div>
                                    <router-link :to="'/parts?vehicle_id=' + part.vehicle_id">
                                        <Button label="查看配件详情" text size="small" class="mt-2 p-0" />
                                    </router-link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </TabPanel>
        </TabView>

        <!-- 公告弹窗 -->
        <Dialog v-model:visible="showAnnouncementDialog" :header="editingAnnouncement ? '编辑公告' : '发布新公告'" modal class="p-fluid w-full max-w-28rem">
            <div class="field mt-2">
                <label>标题</label>
                <InputText v-model="annForm.title" placeholder="公告标题" />
            </div>
            <div class="field">
                <label>内容</label>
                <Textarea v-model="annForm.content" rows="5" placeholder="详细内容..." />
            </div>
            <div class="field">
                <label>类型</label>
                <Dropdown v-model="annForm.type" :options="annTypes" optionLabel="label" optionValue="value" />
            </div>
            <div class="field-checkbox">
                <Checkbox v-model="annForm.is_pinned" :binary="true" inputId="is_pinned" />
                <label for="is_pinned">置顶此公告</label>
            </div>
            <template #footer>
                <Button label="取消" text @click="showAnnouncementDialog = false" />
                <Button label="确定发布" @click="saveAnnouncement" :loading="saving" />
            </template>
        </Dialog>

        <!-- 工单详情/回复弹窗 -->
        <Dialog v-model:visible="showTicketDetail" header="工单详情" modal class="w-full max-w-30rem">
            <div v-if="selectedTicket">
                <div class="mb-4">
                    <div class="flex justify-content-between align-items-center mb-2">
                        <Tag :value="getStatusLabel(selectedTicket.status)" :severity="getStatusSeverity(selectedTicket.status)" />
                        <small class="text-500">{{ formatDate(selectedTicket.created_at) }}</small>
                    </div>
                    <h2 class="m-0 text-xl font-bold">{{ selectedTicket.title }}</h2>
                    <p class="surface-100 p-3 border-round text-800 white-space-pre-wrap">{{ selectedTicket.content }}</p>
                </div>

                <div v-if="selectedTicket.admin_response" class="mb-4">
                    <div class="flex align-items-center gap-2 mb-2">
                        <i class="pi pi-user-edit text-primary"></i>
                        <span class="font-bold">管理员回复:</span>
                        <small class="text-500 ml-auto">{{ formatDate(selectedTicket.responded_at) }}</small>
                    </div>
                    <div class="surface-0 border-1 surface-border p-3 border-round border-left-3 border-primary italic">
                        {{ selectedTicket.admin_response }}
                    </div>
                </div>

                <div v-if="isAdmin && selectedTicket.status !== 'closed'">
                    <Divider />
                    <div class="field p-fluid">
                        <label class="font-bold mb-2 block">回复工单</label>
                        <Textarea v-model="responseForm.admin_response" rows="3" placeholder="输入您的回复..." />
                    </div>
                    <div class="field p-fluid">
                        <label class="mb-2 block">更改状态</label>
                        <Dropdown v-model="responseForm.status" :options="statusOptions" optionLabel="label" optionValue="value" />
                    </div>
                    <div class="flex justify-content-end gap-2 mt-3">
                        <Button label="提交回复" @click="submitTicketResponse" :loading="saving" />
                    </div>
                </div>
            </div>
        </Dialog>

        <!-- 新建工单弹窗 -->
        <Dialog v-model:visible="showTicketDialog" header="新建工单" modal class="p-fluid w-full max-w-28rem">
            <div class="field mt-2">
                <label>标题</label>
                <InputText v-model="ticketForm.title" placeholder="简单描述您的问题" />
            </div>
            <div class="field">
                <label>分类</label>
                <Dropdown v-model="ticketForm.category" :options="ticketCategories" placeholder="选择问题分类" />
            </div>
            <div class="field">
                <label>优先级</label>
                <Dropdown v-model="ticketForm.priority" :options="priorities" optionLabel="label" optionValue="value" />
            </div>
            <div class="field">
                <label>正文内容</label>
                <Textarea v-model="ticketForm.content" rows="5" placeholder="请详细描述您遇到的问题或建议..." />
            </div>
            <template #footer>
                <Button label="取消" text @click="showTicketDialog = false" />
                <Button label="提交" @click="submitTicket" :loading="saving" />
            </template>
        </Dialog>
    </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { messagesAPI } from '../api'
import { useToast } from 'primevue/usetoast'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'

const toast = useToast()
const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
const isAdmin = computed(() => currentUser.role === 'admin')

// 数据状态
const announcements = ref([])
const tickets = ref([])
const maintenanceReminders = ref([])
const partsReminders = ref([])

const loadingAnnouncements = ref(false)
const loadingTickets = ref(false)
const saving = ref(false)

// 弹窗状态
const showAnnouncementDialog = ref(false)
const editingAnnouncement = ref(null)
const showTicketDialog = ref(false)
const showTicketDetail = ref(false)
const selectedTicket = ref(null)

// 表单
const annForm = ref({ title: '', content: '', type: 'info', is_pinned: false })
const ticketForm = ref({ title: '', content: '', category: '问题反馈', priority: 'normal' })
const responseForm = ref({ admin_response: '', status: 'in_progress' })

const annTypes = [
    { label: '普通公告', value: 'info' },
    { label: '重要通知', value: 'warning' },
    { label: '紧急更新', value: 'danger' },
    { label: '功能上线', value: 'success' }
]

const ticketCategories = ['功能建议', '系统报错', '数据疑问', '其它']
const priorities = [
    { label: '一般', value: 'normal' },
    { label: '紧急', value: 'high' }
]
const statusOptions = [
    { label: '处理中', value: 'in_progress' },
    { label: '已解决', value: 'closed' }
]

// 加载函数
const loadData = async () => {
    loadingAnnouncements.value = true
    loadingTickets.value = true
    try {
        const [annRes, tickRes, maintRes, partRes] = await Promise.all([
            messagesAPI.getAnnouncements(),
            messagesAPI.getTickets(),
            messagesAPI.getMaintenanceReminders(),
            messagesAPI.getPartsReminders()
        ])
        
        if (annRes.success) announcements.value = annRes.data.announcements
        if (tickRes.success) tickets.value = tickRes.data
        if (maintRes.success) maintenanceReminders.value = maintRes.data
        if (partRes.success) partsReminders.value = partRes.data
    } catch (error) {
        toast.add({ severity: 'error', summary: '加载失败', detail: error.message })
    } finally {
        loadingAnnouncements.value = false
        loadingTickets.value = false
    }
}

// 公告操作
const openAnnouncementDialog = (ann = null) => {
    if (ann) {
        editingAnnouncement.value = ann
        annForm.value = { ...ann, is_pinned: !!ann.is_pinned }
    } else {
        editingAnnouncement.value = null
        annForm.value = { title: '', content: '', type: 'info', is_pinned: false }
    }
    showAnnouncementDialog.value = true
}

const saveAnnouncement = async () => {
    saving.value = true
    try {
        let res
        if (editingAnnouncement.value) {
            res = await messagesAPI.updateAnnouncement(editingAnnouncement.value.id, annForm.value)
        } else {
            res = await messagesAPI.createAnnouncement(annForm.value)
        }
        
        if (res.success) {
            toast.add({ severity: 'success', summary: '成功', detail: res.message })
            showAnnouncementDialog.value = false
            loadData()
        }
    } catch (error) {
        toast.add({ severity: 'error', summary: '保存失败', detail: error.message })
    } finally {
        saving.value = false
    }
}

const deleteAnnouncement = async (id) => {
    if (!confirm('确认删除此公告吗？')) return
    try {
        const res = await messagesAPI.deleteAnnouncement(id)
        if (res.success) {
            toast.add({ severity: 'success', summary: '已删除', detail: res.message })
            loadData()
        }
    } catch (error) {
        toast.add({ severity: 'error', summary: '删除失败', detail: error.message })
    }
}

// 工单操作
const submitTicket = async () => {
    saving.value = true
    try {
        const res = await messagesAPI.createTicket(ticketForm.value)
        if (res.success) {
            toast.add({ severity: 'success', summary: '已提交', detail: '您的反馈已送达' })
            showTicketDialog.value = false
            ticketForm.value = { title: '', content: '', category: '问题反馈', priority: 'normal' }
            loadData()
        }
    } catch (error) {
        toast.add({ severity: 'error', summary: '提交失败', detail: error.message })
    } finally {
        saving.value = false
    }
}

const viewTicket = (ticket) => {
    selectedTicket.value = ticket
    responseForm.value = { 
        admin_response: ticket.admin_response || '', 
        status: ticket.status === 'open' ? 'in_progress' : ticket.status 
    }
    showTicketDetail.value = true
}

const submitTicketResponse = async () => {
    saving.value = true
    try {
        const res = await messagesAPI.respondTicket(selectedTicket.value.id, responseForm.value)
        if (res.success) {
            toast.add({ severity: 'success', summary: '已回复', detail: res.message })
            showTicketDetail.value = false
            loadData()
        }
    } catch (error) {
        toast.add({ severity: 'error', summary: '回复失败', detail: error.message })
    } finally {
        saving.value = false
    }
}

// 工具函数
const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const getSeverityBorder = (type) => {
    const map = { info: 'border-blue-500', warning: 'border-orange-500', danger: 'border-red-500', success: 'border-green-500' }
    return map[type] || 'border-300'
}

const getTypeLabel = (type) => {
    const map = { info: '公告', warning: '通知', danger: '紧急', success: '上线' }
    return map[type] || '其它'
}

const getStatusLabel = (status) => {
    const map = { open: '待处理', in_progress: '处理中', closed: '已关闭' }
    return map[status] || status
}

const getStatusSeverity = (status) => {
    const map = { open: 'warning', in_progress: 'info', closed: 'success' }
    return map[status] || 'secondary'
}

onMounted(loadData)
</script>

<style scoped>
.border-left-3 {
    border-left-width: 4px;
    border-left-style: solid;
}
</style>
