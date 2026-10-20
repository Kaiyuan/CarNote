<!--
  车险保单详情与出险管理页面
-->

<template>
  <div>
    <PageHeader eyebrow="Insurance" title="保单详情"
      :description="insurance ? `${insurance.insurance_company || '保单'} · ${insurance.plate_number || '未指定车辆'}` : '查看保单信息与理赔记录'">
      <template #actions>
        <Button label="返回保单列表" icon="pi pi-arrow-left" severity="secondary" outlined
          @click="router.push('/insurance')" />
      </template>
    </PageHeader>

    <div v-if="loading" class="text-center py-5">
      <ProgressSpinner />
    </div>

    <div v-else-if="!insurance" class="text-center py-5 text-600">
      <i class="pi pi-exclamation-circle mb-3" style="font-size: 3rem"></i>
      <p>未找到相关保单信息</p>
    </div>

    <div v-else class="grid">
      <!-- 保单基本信息 -->
      <div class="col-12 lg:col-4">
        <Card class="shadow-2">
          <template #title>
            <div class="flex justify-content-between align-items-center">
              <span class="text-2xl font-bold text-primary">{{ insurance.insurance_company || '保单' }}</span>
              <Tag :value="insurance.type || '商业险'" severity="info" />
            </div>
          </template>

          <template #content>
            <div class="flex flex-column gap-3 text-700">
              <div>
                <div class="text-500 text-sm mb-1">关联车辆</div>
                <div class="font-bold text-lg text-900">{{ insurance.plate_number ? `${insurance.plate_number} (${insurance.brand || ''} ${insurance.model || ''})` : '未指定车辆' }}</div>
              </div>

              <div>
                <div class="text-500 text-sm mb-1">保单编号</div>
                <div class="font-semibold">{{ insurance.policy_number || '未填写' }}</div>
              </div>

              <div>
                <div class="text-500 text-sm mb-1">保障期限</div>
                <div>{{ formatDate(insurance.start_date) }} ~ {{ formatDate(insurance.end_date) }}</div>
              </div>

              <div>
                <div class="text-500 text-sm mb-1">保费金额</div>
                <div class="text-xl font-bold text-green-600">¥{{ formatNumber(insurance.premium) }}</div>
              </div>

              <div v-if="insurance.notes">
                <div class="text-500 text-sm mb-1">保单备注</div>
                <div class="text-sm bg-gray-50 p-2 border-round">{{ insurance.notes }}</div>
              </div>

              <div v-if="insurance.policy_image_url">
                <div class="text-500 text-sm mb-2">保单凭证 / 照片</div>

                <a v-if="isPdf(insurance.policy_image_url)" :href="insurance.policy_image_url" target="_blank"
                  class="flex align-items-center gap-3 p-3 border-round surface-100 hover:surface-200 transition-duration-200 no-underline cursor-pointer">
                  <i class="pi pi-file-pdf text-3xl text-red-500"></i>
                  <div class="flex-1">
                    <div class="font-bold text-900">保单凭证 (PDF)</div>
                    <div class="text-sm text-500">点击在新窗口打开查看</div>
                  </div>
                  <i class="pi pi-external-link text-500"></i>
                </a>

                <a v-else :href="insurance.policy_image_url" target="_blank">
                  <img :src="insurance.policy_image_url" alt="保单凭证" class="w-full border-round shadow-1 hover:shadow-3 transition-duration-200" style="max-height: 250px; object-fit: cover" />
                </a>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <!-- 出险/理赔记录与 OCR -->
      <div class="col-12 lg:col-8">
        <Card class="shadow-2 mb-4">
          <template #title>
            <div class="flex justify-content-between align-items-center">
              <span class="text-xl font-bold">出险 / 理赔记录</span>
              <Button label="添加出险记录" icon="pi pi-plus" size="small" @click="openAddClaimDialog" />
            </div>
          </template>

          <template #content>
            <div v-if="!insurance.claims || insurance.claims.length === 0" class="text-center py-4 text-500">
              <i class="pi pi-shield mb-2" style="font-size: 2rem"></i>
              <p>本保单期内暂无出险事故记录</p>
            </div>

            <DataTable v-else :value="insurance.claims" responsiveLayout="scroll" class="p-datatable-sm">
              <Column field="claim_date" header="出险日期">
                <template #body="slotProps">
                  {{ formatDate(slotProps.data.claim_date) }}
                </template>
              </Column>

              <Column field="description" header="事故描述" />

              <Column field="claim_amount" header="理赔金额">
                <template #body="slotProps">
                  <span class="font-bold text-orange-600">¥{{ formatNumber(slotProps.data.claim_amount) }}</span>
                </template>
              </Column>

              <Column field="status" header="处理状态">
                <template #body="slotProps">
                  <Tag :value="getStatusLabel(slotProps.data.status)" :severity="getStatusSeverity(slotProps.data.status)" />
                </template>
              </Column>

              <Column header="操作" style="width: 5rem">
                <template #body="slotProps">
                  <Button icon="pi pi-trash" severity="danger" text size="small" @click="confirmDeleteClaim(slotProps.data)" />
                </template>
              </Column>
            </DataTable>
          </template>
        </Card>

        <!-- OCR 文本信息 -->
        <Card v-if="insurance.ocr_content" class="shadow-2">
          <template #title>
            <span class="text-lg font-bold">OCR 识别原始记录</span>
          </template>
          <template #content>
            <pre class="bg-gray-100 p-3 border-round text-sm overflow-auto max-h-15rem text-700">{{ insurance.ocr_content }}</pre>
          </template>
        </Card>
      </div>
    </div>

    <!-- 添加出险 Dialog -->
    <Dialog v-model:visible="claimDialogVisible" header="记录出险事故" modal class="p-fluid" style="width: 90vw; max-width: 450px">
      <div class="grid">
        <div class="col-12">
          <label class="font-bold mb-2 block">出险日期</label>
          <Calendar v-model="claimForm.claim_date" dateFormat="yy-mm-dd" showIcon placeholder="选择出险日期" />
        </div>

        <div class="col-12">
          <label class="font-bold mb-2 block">理赔金额 (元)</label>
          <InputNumber v-model="claimForm.claim_amount" mode="currency" currency="CNY" locale="zh-CN" placeholder="0.00" />
        </div>

        <div class="col-12">
          <label class="font-bold mb-2 block">理赔状态</label>
          <Dropdown v-model="claimForm.status" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="选择理赔状态" />
        </div>

        <div class="col-12">
          <label class="font-bold mb-2 block">事故与出险描述</label>
          <Textarea v-model="claimForm.description" rows="3" placeholder="填写事故经过、受损情况或定损说明..." />
        </div>
      </div>

      <template #footer>
        <Button label="取消" icon="pi pi-times" text @click="claimDialogVisible = false" />
        <Button label="提交" icon="pi pi-check" :loading="submittingClaim" @click="saveClaim" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import PageHeader from '../components/PageHeader.vue'
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { insuranceAPI } from '../api'
import { formatDate as fmtDate, parseLocalDate, toLocalDateString } from '../utils/date'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()

const loading = ref(false)
const insurance = ref(null)

const claimDialogVisible = ref(false)
const submittingClaim = ref(false)

const claimForm = ref({
  claim_date: new Date(),
  claim_amount: 0,
  status: 'completed',
  description: ''
})

const statusOptions = [
  { label: '处理中', value: 'processing' },
  { label: '已理赔赔付', value: 'completed' },
  { label: '已拒赔', value: 'rejected' }
]

onMounted(() => {
  loadDetail()
})

const loadDetail = async () => {
  loading.value = true
  try {
    const res = await insuranceAPI.getDetail(route.params.id)
    if (res.success) {
      insurance.value = res.data
    }
  } catch (err) {
    toast.add({ severity: 'error', summary: '错误', detail: '获取保单详情失败', life: 3000 })
  } finally {
    loading.value = false
  }
}

const formatDate = fmtDate

const formatNumber = (num) => {
  return Number(num || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const isPdf = (url) => {
  if (!url) return false
  return /\.pdf(?:$|\?)/i.test(url)
}

const getStatusLabel = (val) => {
  const map = { processing: '处理中', completed: '已赔付', rejected: '已拒赔' }
  return map[val] || val
}

const getStatusSeverity = (val) => {
  const map = { processing: 'warning', completed: 'success', rejected: 'danger' }
  return map[val] || 'info'
}

const openAddClaimDialog = () => {
  claimForm.value = {
    claim_date: new Date(),
    claim_amount: 0,
    status: 'completed',
    description: ''
  }
  claimDialogVisible.value = true
}

const saveClaim = async () => {
  submittingClaim.value = true
  try {
    const payload = {
      ...claimForm.value,
      claim_date: claimForm.value.claim_date ? toLocalDateString(claimForm.value.claim_date) : null
    }

    await insuranceAPI.createClaim(route.params.id, payload)
    toast.add({ severity: 'success', summary: '成功', detail: '出险记录已添加', life: 3000 })

    claimDialogVisible.value = false
    loadDetail()
  } catch (err) {
    toast.add({ severity: 'error', summary: '错误', detail: err.message || '添加出险记录失败', life: 3000 })
  } finally {
    submittingClaim.value = false
  }
}

const confirmDeleteClaim = (item) => {
  confirm.require({
    message: '确定要删除该条出险理赔记录吗？',
    header: '删除确认',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await insuranceAPI.deleteClaim(item.id)
        toast.add({ severity: 'success', summary: '成功', detail: '出险记录已删除', life: 3000 })
        loadDetail()
      } catch (err) {
        toast.add({ severity: 'error', summary: '错误', detail: '删除失败', life: 3000 })
      }
    }
  })
}
</script>
