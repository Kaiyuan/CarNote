<!--
  车险管理页面
-->

<template>
  <div>
    <PageHeader eyebrow="Insurance" title="车险管理"
      description="集中管理保单、保障期限与理赔记录，及时掌握续保时间。">
      <template #actions>
        <Button label="上传保单 (OCR)" icon="pi pi-upload" severity="secondary" @click="triggerFileUpload" :loading="uploading" />
        <input ref="fileInputRef" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" class="hidden" @change="handleFileUpload" />
        <Button label="新增保单" icon="pi pi-plus" @click="openAddDialog" />
      </template>
    </PageHeader>

    <!-- 筛选条件 -->
    <div class="cn-filter-bar">
      <div style="width: 16rem; max-width: 100%">
        <Dropdown v-model="filters.vehicle_id" :options="vehicles" optionLabel="plate_number" optionValue="id"
          showClear @change="loadInsurances" placeholder="筛选车辆" class="w-full" />
      </div>
    </div>

    <!-- 保单列表 -->
    <div v-if="loading" class="text-center py-5">
      <ProgressSpinner />
    </div>

    <div v-else-if="insurances.length === 0" class="text-center py-5 text-600">
      <i class="pi pi-file-edit mb-3" style="font-size: 3rem"></i>
      <p>暂无车险保单记录</p>
    </div>

    <div v-else class="grid">
      <div v-for="item in insurances" :key="item.id" class="col-12 md:col-6 lg:col-4">
        <Card class="h-full shadow-2 hover:shadow-4 cursor-pointer transition-duration-200" @click="goDetail(item.id)">
          <template #title>
            <div class="flex justify-content-between align-items-start">
              <div class="text-xl font-bold text-primary">{{ item.insurance_company || '保单' }}</div>
              <Tag :value="getExpiryStatus(item.end_date).label" :severity="getExpiryStatus(item.end_date).severity" />
            </div>
          </template>

          <template #subtitle>
            <div class="text-sm mt-1">
              <span class="font-semibold">{{ getVehiclePlate(item.vehicle_id) }}</span>
              <Tag class="ml-2" severity="info" :value="item.type || '商业险'" />
            </div>
          </template>

          <template #content>
            <div class="text-sm text-700">
              <div class="mb-2">
                <i class="pi pi-id-card mr-2 text-primary"></i>
                保单号: {{ item.policy_number || '未填写' }}
              </div>
              <div class="mb-2">
                <i class="pi pi-calendar mr-2 text-primary"></i>
                保障期限: {{ formatDate(item.start_date) }} ~ {{ formatDate(item.end_date) }}
              </div>
              <div class="mb-2">
                <i class="pi pi-money-bill mr-2 text-primary"></i>
                保费: ¥{{ formatNumber(item.premium) }}
              </div>
              <div class="mb-2">
                <i class="pi pi-exclamation-triangle mr-2 text-orange-500"></i>
                出险记录: {{ item.claim_count }} 次 (赔款: ¥{{ formatNumber(item.total_claim_amount) }})
              </div>
            </div>
          </template>

          <template #footer>
            <div class="flex justify-content-end gap-2" @click.stop>
              <Button icon="pi pi-eye" label="详情" severity="info" text size="small" @click="goDetail(item.id)" />
              <Button icon="pi pi-pencil" severity="secondary" text size="small" @click="openEditDialog(item)" />
              <Button icon="pi pi-trash" severity="danger" text size="small" @click="confirmDelete(item)" />
            </div>
          </template>
        </Card>
      </div>
    </div>

    <!-- 添加 / 编辑 Dialog -->
    <Dialog v-model:visible="dialogVisible" :header="isEdit ? '编辑保单' : '新增保单'" modal class="p-fluid" style="width: 90vw; max-width: 550px">
      <div class="grid">
        <div class="col-12">
          <label class="font-bold mb-2 block">关联车辆</label>
          <Dropdown v-model="form.vehicle_id" :options="vehicles" optionLabel="plate_number" optionValue="id" placeholder="选择关联车辆 (可选)" showClear />
        </div>

        <div class="col-12 md:col-6">
          <label class="font-bold mb-2 block">保险公司</label>
          <InputText v-model="form.insurance_company" placeholder="如: 平安保险、中国人保" />
        </div>

        <div class="col-12 md:col-6">
          <label class="font-bold mb-2 block">险种类型</label>
          <Dropdown v-model="form.type" :options="typeOptions" placeholder="选择险种类型" />
        </div>

        <div class="col-12">
          <label class="font-bold mb-2 block">保单号</label>
          <InputText v-model="form.policy_number" placeholder="请输入保单号" />
        </div>

        <div class="col-12 md:col-6">
          <label class="font-bold mb-2 block">生效日期 (起保)</label>
          <Calendar v-model="form.start_date" dateFormat="yy-mm-dd" showIcon placeholder="选择生效日期" />
        </div>

        <div class="col-12 md:col-6">
          <label class="font-bold mb-2 block">到期日期 (终保)</label>
          <Calendar v-model="form.end_date" dateFormat="yy-mm-dd" showIcon placeholder="选择到期日期" />
        </div>

        <div class="col-12 md:col-6">
          <label class="font-bold mb-2 block">保费金额 (元)</label>
          <InputNumber v-model="form.premium" mode="currency" currency="CNY" locale="zh-CN" placeholder="0.00" />
        </div>

        <div class="col-12 md:col-6" v-if="form.policy_image_url">
          <label class="font-bold mb-2 block">保单凭证</label>
          <a :href="form.policy_image_url" target="_blank" class="text-primary underline text-sm block mt-2">查看当前附件照片/PDF</a>
        </div>

        <div class="col-12">
          <label class="font-bold mb-2 block">备注信息</label>
          <Textarea v-model="form.notes" rows="3" placeholder="添加保单备注..." />
        </div>

        <div class="col-12" v-if="form.ocr_content">
          <Accordion>
            <AccordionTab header="OCR 识别原始文本">
              <pre class="bg-gray-100 p-2 text-xs border-round overflow-auto max-h-10rem">{{ form.ocr_content }}</pre>
            </AccordionTab>
          </Accordion>
        </div>
      </div>

      <template #footer>
        <Button label="取消" icon="pi pi-times" text @click="dialogVisible = false" />
        <Button label="保存" icon="pi pi-check" :loading="saving" @click="saveInsurance" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { insuranceAPI, vehicleAPI } from '../api'
import PageHeader from '../components/PageHeader.vue'
import { formatDate as fmtDate, parseLocalDate, toLocalDateString } from '../utils/date'

const router = useRouter()
const toast = useToast()
const confirm = useConfirm()

const loading = ref(false)
const saving = ref(false)
const uploading = ref(false)
const insurances = ref([])
const vehicles = ref([])
const fileInputRef = ref(null)

const filters = ref({ vehicle_id: null })
const dialogVisible = ref(false)
const isEdit = ref(false)

const typeOptions = ['商业险', '交强险', '商业+交强险', '驾意险', '三者险', '车损险']

const form = ref({
  id: null,
  vehicle_id: null,
  insurance_company: '',
  policy_number: '',
  type: '商业险',
  start_date: null,
  end_date: null,
  premium: 0,
  policy_image_url: '',
  ocr_content: '',
  notes: ''
})

onMounted(() => {
  loadVehicles()
  loadInsurances()
})

const loadVehicles = async () => {
  try {
    const res = await vehicleAPI.getList()
    if (res.success) {
      vehicles.value = res.data
    }
  } catch (err) {
    console.error('加载车辆失败:', err)
  }
}

const loadInsurances = async () => {
  loading.value = true
  try {
    const res = await insuranceAPI.getList({ vehicle_id: filters.value.vehicle_id })
    if (res.success) {
      insurances.value = res.data
    }
  } catch (err) {
    toast.add({ severity: 'error', summary: '错误', detail: '加载保险记录失败', life: 3000 })
  } finally {
    loading.value = false
  }
}

const getVehiclePlate = (vehicleId) => {
  if (!vehicleId) return '通用保单'
  const v = vehicles.value.find(item => item.id === vehicleId)
  return v ? `${v.plate_number} (${v.brand || ''} ${v.model || ''})` : '未知车辆'
}

const getExpiryStatus = (endDateStr) => {
  if (!endDateStr) return { label: '未设置期限', severity: 'info' }
  const now = new Date()
  const endDate = new Date(endDateStr)
  const diffDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { label: '已过期', severity: 'danger' }
  } else if (diffDays <= 30) {
    return { label: `即将在${diffDays}天内到期`, severity: 'warning' }
  } else {
    return { label: '保障中', severity: 'success' }
  }
}

const formatDate = fmtDate

const formatNumber = (num) => {
  return Number(num || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const goDetail = (id) => {
  router.push(`/insurance/${id}`)
}

const openAddDialog = () => {
  isEdit.value = false
  form.value = {
    id: null,
    vehicle_id: filters.value.vehicle_id || null,
    insurance_company: '',
    policy_number: '',
    type: '商业险',
    start_date: null,
    end_date: null,
    premium: 0,
    policy_image_url: '',
    ocr_content: '',
    notes: ''
  }
  dialogVisible.value = true
}

const openEditDialog = (item) => {
  isEdit.value = true
  form.value = {
    id: item.id,
    vehicle_id: item.vehicle_id,
    insurance_company: item.insurance_company || '',
    policy_number: item.policy_number || '',
    type: item.type || '商业险',
    start_date: item.start_date ? parseLocalDate(item.start_date) : null,
    end_date: item.end_date ? parseLocalDate(item.end_date) : null,
    premium: item.premium || 0,
    policy_image_url: item.policy_image_url || '',
    ocr_content: item.ocr_content || '',
    notes: item.notes || ''
  }
  dialogVisible.value = true
}

const triggerFileUpload = () => {
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
    fileInputRef.value.click()
  }
}

const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  const formData = new FormData()
  formData.append('file', file)

  uploading.value = true
  try {
    const res = await insuranceAPI.uploadPolicy(formData)
    if (res.success) {
      toast.add({ severity: 'success', summary: '成功', detail: '保单上传并 OCR 识别完成', life: 3000 })

      // 自动打开新增表单并填充 OCR 结果
      openAddDialog()
      form.value.policy_image_url = res.data.imageUrl
      form.value.ocr_content = res.data.ocrContent

      if (res.data.parsedData) {
        const pd = res.data.parsedData
        if (pd.policyNumber) form.value.policy_number = pd.policyNumber
        if (pd.insuranceCompany) form.value.insurance_company = pd.insuranceCompany
        if (pd.premium !== undefined && pd.premium !== null) form.value.premium = pd.premium
        if (pd.startDate) form.value.start_date = new Date(pd.startDate)
        if (pd.endDate) form.value.end_date = new Date(pd.endDate)
        if (pd.insuranceType && typeOptions.includes(pd.insuranceType)) form.value.type = pd.insuranceType
      }
    }
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: '上传失败',
      detail: err.message || '上传过程出错，请检查 VIP 权限或文件格式',
      life: 4000
    })
  } finally {
    uploading.value = false
  }
}

const saveInsurance = async () => {
  saving.value = true
  try {
    const payload = {
      ...form.value,
      start_date: form.value.start_date ? toLocalDateString(form.value.start_date) : null,
      end_date: form.value.end_date ? toLocalDateString(form.value.end_date) : null
    }

    if (isEdit.value) {
      await insuranceAPI.update(form.value.id, payload)
      toast.add({ severity: 'success', summary: '成功', detail: '保单更新成功', life: 3000 })
    } else {
      await insuranceAPI.create(payload)
      toast.add({ severity: 'success', summary: '成功', detail: '保单添加成功', life: 3000 })
    }

    dialogVisible.value = false
    loadInsurances()
  } catch (err) {
    toast.add({ severity: 'error', summary: '错误', detail: err.message || '保存失败', life: 3000 })
  } finally {
    saving.value = false
  }
}

const confirmDelete = (item) => {
  confirm.require({
    message: `确定要删除该笔车险保单 (${item.insurance_company || '保单'}) 吗？相关出险记录也会一并删除！`,
    header: '确认删除',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await insuranceAPI.delete(item.id)
        toast.add({ severity: 'success', summary: '成功', detail: '保单记录已删除', life: 3000 })
        loadInsurances()
      } catch (err) {
        toast.add({ severity: 'error', summary: '错误', detail: '删除失败', life: 3000 })
      }
    }
  })
}
</script>
