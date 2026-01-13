<!--
  配件管理页面 - 完整版
-->

<template>
  <div>
    <div class="flex flex-column md:flex-row justify-content-between align-items-center mb-4">
      <h1 class="text-3xl font-bold m-0 mb-2 md:mb-0">配件管理</h1>
      <div class="flex gap-2">
        <Button label="添加配件" icon="pi pi-plus" @click="openAddDialog" />
        <Button label="更换记录" icon="pi pi-history" severity="secondary"
          @click="showHistoryDialog = true; loadHistory()" />
      </div>
    </div>

    <!-- 过滤器 -->
    <div class="grid p-fluid mb-4">
      <div class="col-12 md:col-4">
        <span class="p-float-label">
          <Dropdown v-model="filters.vehicle_id" :options="vehicles" optionLabel="plate_number" optionValue="id"
            showClear @change="loadParts" placeholder="选择车辆" class="w-full" />
          <label>筛选车辆</label>
        </span>
      </div>
    </div>

    <!-- 配件列表 -->
    <div v-if="loading" class="text-center py-5">
      <ProgressSpinner />
    </div>
    <div v-else-if="parts.length === 0" class="text-center py-5 text-600">
      <i class="pi pi-box mb-3" style="font-size: 3rem"></i>
      <p>暂无配件记录</p>
    </div>
    <div v-else class="grid">
      <div v-for="part in parts" :key="part.id" class="col-12 md:col-6 lg:col-4 xl:col-3">
        <Card class="h-full shadow-2 hover:shadow-4 cursor-pointer transition-duration-200">
          <template #title>
            <div class="flex justify-content-between align-items-start">
              <div class="text-xl">{{ part.name }}</div>
              <Tag :value="getStatusLabel(part.status)" :severity="getStatusSeverity(part.status)" />
            </div>
          </template>
          <template #subtitle>
            <div class="text-sm mt-1">
              {{ getVehiclePlate(part.vehicle_id) }}
              <span v-if="part.part_number" class="text-600 ml-2">#{{ part.part_number }}</span>
            </div>
          </template>
          <template #content>
            <div class="text-sm text-700">
              <div class="mb-2">
                <i class="pi pi-calendar mr-2"></i>
                安装日期: {{ formatDate(part.installed_date) }}
              </div>
              <div class="mb-2">
                <i class="pi pi-car mr-2"></i>
                安装里程: {{ formatNumber(part.installed_mileage) }} km
              </div>
              <div class="mb-2" v-if="part.recommended_replacement_months || part.recommended_replacement_mileage">
                <i class="pi pi-clock mr-2"></i>
                预期寿命:
                <span v-if="part.recommended_replacement_months">{{ part.recommended_replacement_months }}月</span>
                <span v-if="part.recommended_replacement_months && part.recommended_replacement_mileage"> / </span>
                <span v-if="part.recommended_replacement_mileage">{{ formatNumber(part.recommended_replacement_mileage)
                }} km</span>
              </div>
              <div class="mt-3 surface-200 border-round overflow-hidden" style="height: 6px"
                v-if="part.recommended_replacement_mileage && part.current_mileage">
                <div class="bg-primary h-full"
                  :style="{ width: calculateHealth(part) + '%', backgroundColor: getHealthColor(part) + ' !important' }">
                </div>
              </div>
            </div>
          </template>
          <template #footer>
            <div class="flex justify-content-between gap-2">
              <Button label="更换" icon="pi pi-refresh" outlined size="small" @click="openReplaceDialog(part)" />
              <div class="flex gap-1">
                <Button icon="pi pi-pencil" text rounded size="small" @click="editPart(part)" />
                <Button icon="pi pi-trash" text rounded size="small" severity="danger" @click="deletePart(part.id)" />
              </div>
            </div>
          </template>
        </Card>
      </div>
    </div>

    <!-- 添加/编辑配件对话框 -->
    <Dialog v-model:visible="showDialog" :header="editingPart ? '编辑配件' : '添加新配件'" :modal="true"
      :breakpoints="{ '960px': '75vw', '640px': '95vw' }" :style="{ width: '500px' }">
      <div class="field">
        <label>车辆 *</label>
        <Dropdown v-model="partForm.vehicle_id" :options="vehicles" optionLabel="plate_number" optionValue="id"
          placeholder="选择车辆" class="w-full" :disabled="!!editingPart" />
      </div>

      <div class="field">
        <label>配件名称 *</label>
        <InputText v-model="partForm.name" class="w-full" placeholder="如：空气滤芯" />
      </div>

      <div class="field">
        <label>配件编号</label>
        <InputText v-model="partForm.part_number" class="w-full" />
      </div>

      <Divider align="left"><b>安装信息</b></Divider>

      <div class="formgrid grid">
        <div class="field col-12 md:col-6">
          <label>日期 *</label>
          <Calendar v-model="partForm.installed_date" dateFormat="yy-mm-dd" class="w-full" showIcon />
        </div>
        <div class="field col-12 md:col-6">
          <label>里程 (km) *</label>
          <InputNumber v-model="partForm.installed_mileage" class="w-full" :min="0" />
        </div>
      </div>

      <div class="formgrid grid">
        <div class="field col-12 md:col-6">
          <label>寿命 (月)</label>
          <InputNumber v-model="partForm.recommended_replacement_months" class="w-full" :min="0" suffix=" 月" />
        </div>
        <div class="field col-12 md:col-6">
          <label>寿命 (km)</label>
          <InputNumber v-model="partForm.recommended_replacement_mileage" class="w-full" :min="0" suffix=" km" />
        </div>
      </div>

      <div class="field">
        <label>备注</label>
        <Textarea v-model="partForm.notes" rows="2" class="w-full" />
      </div>

      <template #footer>
        <Button label="取消" text @click="showDialog = false" />
        <Button label="保存" @click="savePart" :loading="saving" />
      </template>
    </Dialog>

    <!-- 更换配件记录对话框 -->
    <Dialog v-model:visible="showReplaceDialog" header="记录配件更换" :modal="true"
      :breakpoints="{ '960px': '75vw', '640px': '95vw' }" :style="{ width: '500px' }">
      <div v-if="replacingPart" class="mb-4 surface-100 p-3 border-round">
        <div class="font-bold mb-1">正在更换: {{ replacingPart.part_name }}</div>
        <div class="text-sm text-600">
          当前安装于: {{ formatDate(replacingPart.install_date) }} ({{ replacingPart.install_mileage }} km)
        </div>
      </div>

      <div class="field">
        <label>更换日期 *</label>
        <Calendar v-model="replaceForm.replacement_date" dateFormat="yy-mm-dd" class="w-full" showIcon />
      </div>

      <div class="field">
        <label>更换里程 (km) *</label>
        <InputNumber v-model="replaceForm.mileage" class="w-full" :min="0" />
      </div>

      <div class="field">
        <label>费用 (元)</label>
        <InputNumber v-model="replaceForm.cost" class="w-full" :min="0" :maxFractionDigits="2" />
      </div>

      <div class="field">
        <label>位置/供应商</label>
        <div class="p-inputgroup">
          <InputText v-model="replaceForm.service_provider" class="w-full" placeholder="修理厂/4S店" />
          <Button icon="pi pi-map-marker" @click="getCurrentLocation" v-tooltip="'获取当前位置'" />
        </div>
        <!-- 附近站点推荐 -->
        <div v-if="nearbyLocations.length > 0" class="mt-2 surface-100 p-2 border-round">
          <small class="text-600 block mb-1">发现附近店面 (点击自动填写):</small>
          <div class="flex flex-wrap gap-2">
            <Button v-for="loc in nearbyLocations" :key="loc.name" :label="loc.name" size="small" outlined
              severity="info" class="p-1 text-xs" @click="selectNearby(loc)" />
          </div>
        </div>
      </div>

      <div class="field-checkbox">
        <Checkbox v-model="replaceForm.reset_install" :binary="true" inputId="reset_install" />
        <label for="reset_install" class="ml-2">重置配件安装时间为新日期</label>
      </div>

      <div class="field">
        <label>备注</label>
        <Textarea v-model="replaceForm.notes" rows="2" class="w-full" />
      </div>

      <template #footer>
        <Button label="取消" text @click="showReplaceDialog = false" />
        <Button label="确认更换" @click="confirmReplace" :loading="saving" />
      </template>
    </Dialog>

    <!-- 历史记录对话框 -->
    <Dialog v-model:visible="showHistoryDialog" header="配件更换历史" :modal="true"
      :breakpoints="{ '960px': '90vw', '640px': '95vw' }" :style="{ width: '700px' }" maximizable>
      <DataTable :value="historyRecords" :loading="historyLoading" stripedRows paginator :rows="10">
        <Column field="replacement_date" header="更换日期">
          <template #body="slotProps">
            {{ formatDate(slotProps.data.replacement_date) }}
          </template>
        </Column>
        <Column field="new_part_name" header="配件名称"></Column>
        <Column field="mileage" header="里程">
          <template #body="slotProps">
            {{ formatNumber(slotProps.data.mileage) }}
          </template>
        </Column>
        <Column field="cost" header="费用">
          <template #body="slotProps">
            {{ formatCurrency(slotProps.data.cost) }}
          </template>
        </Column>
      </DataTable>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { partsAPI, vehicleAPI, locationsAPI } from '../api'

const toast = useToast()

// 状态
const parts = ref([])
const vehicles = ref([])
const historyRecords = ref([])
const loading = ref(false)
const historyLoading = ref(false)
const showDialog = ref(false)
const showReplaceDialog = ref(false)
const showHistoryDialog = ref(false)
const saving = ref(false)
const editingPart = ref(null)
const replacingPart = ref(null)
const nearbyLocations = ref([])

// 过滤器
const filters = ref({
  vehicle_id: null
})

// 表单数据
const defaultPartForm = {
  vehicle_id: null,
  name: '',
  part_number: '',
  installed_date: new Date(),
  installed_mileage: null,
  recommended_replacement_months: null,
  recommended_replacement_mileage: null,
  notes: ''
}

const partForm = ref({ ...defaultPartForm })

const replaceForm = ref({
  replacement_date: new Date(),
  mileage: null,
  cost: null,
  service_provider: '',
  notes: '',
  reset_install: true,
  location_name: '',
  location_lat: null,
  location_lng: null
})

// 获取车辆列表
const loadVehicles = async () => {
  try {
    const res = await vehicleAPI.getList()
    if (res.success) {
      vehicles.value = res.data
    }
  } catch (error) {
    console.error('Failed to load vehicles', error)
  }
}

// 获取配件列表
const loadParts = async () => {
  loading.value = true
  try {
    const params = {}
    if (filters.value.vehicle_id) params.vehicle_id = filters.value.vehicle_id

    const res = await partsAPI.getList(params)
    if (res.success) {
      parts.value = res.data
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: '错误', detail: '加载配件失败', life: 3000 })
  } finally {
    loading.value = false
  }
}

// 获取历史记录
const loadHistory = async () => {
  historyLoading.value = true
  try {
    const params = {}
    if (filters.value.vehicle_id) params.vehicle_id = filters.value.vehicle_id

    const res = await partsAPI.getReplacements(params)
    if (res.success) {
      historyRecords.value = res.data
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: '错误', detail: '加载历史失败', life: 3000 })
  } finally {
    historyLoading.value = false
  }
}

// 打开添加对话框
const openAddDialog = () => {
  editingPart.value = null
  partForm.value = { ...defaultPartForm, installed_date: new Date() }

  if (vehicles.value.length === 1) {
    partForm.value.vehicle_id = vehicles.value[0].id
  } else if (filters.value.vehicle_id) {
    partForm.value.vehicle_id = filters.value.vehicle_id
  }

  showDialog.value = true
}

// 编辑配件
const editPart = (part) => {
  editingPart.value = part
  partForm.value = {
    ...part,
    installed_date: new Date(part.installed_date)
  }
  showDialog.value = true
}

// 保存配件
const savePart = async () => {
  if (!partForm.value.vehicle_id || !partForm.value.name || !partForm.value.installed_date) {
    toast.add({ severity: 'warn', summary: '提示', detail: '请填写必填项(车辆、名称、安装日期)', life: 3000 })
    return
  }

  saving.value = true
  try {
    const data = { ...partForm.value }

    let res
    if (editingPart.value) {
      res = await partsAPI.update(editingPart.value.id, data)
    } else {
      res = await partsAPI.create(data)
    }

    if (res.success) {
      toast.add({ severity: 'success', summary: '成功', detail: res.message, life: 3000 })
      showDialog.value = false
      loadParts()
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: '错误', detail: error.message || '保存失败', life: 3000 })
  } finally {
    saving.value = false
  }
}

// 打开更换对话框
const openReplaceDialog = (part) => {
  replacingPart.value = part
  replaceForm.value = {
    replacement_date: new Date(),
    mileage: null,  // 理想情况下应自动填入车辆当前里程
    cost: null,
    service_provider: '',
    notes: '',
    reset_install: true
  }
  nearbyLocations.value = []
  showReplaceDialog.value = true
}

// 获取浏览器当前位置
const getCurrentLocation = () => {
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude
      const lng = position.coords.longitude
      replaceForm.value.location_lat = lat
      replaceForm.value.location_lng = lng
      toast.add({ severity: 'success', summary: '已获取位置', detail: '坐标已自动填入', life: 2000 })
      searchNearby(lat, lng)
    }, (error) => {
      toast.add({ severity: 'error', summary: '错误', detail: '无法获取位置: ' + error.message, life: 3000 })
    });
  } else {
    toast.add({ severity: 'warn', summary: '不支持', detail: '您的浏览器不支持地理位置', life: 3000 })
  }
}

const searchNearby = async (lat, lng) => {
  try {
    const res = await locationsAPI.searchNearby({ lat, lng })
    if (res.success) {
      nearbyLocations.value = res.data
    }
  } catch (e) {
    console.error('Nearby search failed', e)
  }
}

const selectNearby = (loc) => {
  replaceForm.value.service_provider = loc.name
  replaceForm.value.location_name = loc.name
  replaceForm.value.location_lat = loc.latitude
  replaceForm.value.location_lng = loc.longitude
  toast.add({ severity: 'info', summary: '已选择站点', detail: loc.name, life: 2000 })
}

// 确认更换
const confirmReplace = async () => {
  if (!replaceForm.value.replacement_date || !replaceForm.value.mileage) {
    toast.add({ severity: 'warn', summary: '提示', detail: '请填写日期和里程', life: 3000 })
    return
  }

  saving.value = true
  try {
    const data = {
      part_id: replacingPart.value.id,
      vehicle_id: replacingPart.value.vehicle_id,
      old_part_name: replacingPart.value.name,
      new_part_name: replacingPart.value.name, // 默认同名
      replacement_date: replaceForm.value.replacement_date,
      mileage: replaceForm.value.mileage,
      cost: replaceForm.value.cost,
      service_provider: replaceForm.value.service_provider,
      notes: replaceForm.value.notes,
      location_name: replaceForm.value.location_name,
      location_lat: replaceForm.value.location_lat,
      location_lng: replaceForm.value.location_lng
    }

    const res = await partsAPI.createReplacement(data)

    if (res.success) {
      toast.add({ severity: 'success', summary: '成功', detail: '更换记录已添加', life: 3000 })
      showReplaceDialog.value = false
      loadParts()
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: '错误', detail: error.message || '操作失败', life: 3000 })
  } finally {
    saving.value = false
  }
}


// 删除配件
const deletePart = async (id) => {
  if (!confirm('确定要删除这个配件及其历史记录吗？')) return

  try {
    const res = await partsAPI.delete(id)
    if (res.success) {
      toast.add({ severity: 'success', summary: '成功', detail: '删除成功', life: 3000 })
      loadParts()
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: '错误', detail: '删除失败', life: 3000 })
  }
}

// 辅助函数
const getVehiclePlate = (id) => vehicles.value.find(v => v.id === id)?.plate_number || '未知'
const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString() : ''
const formatNumber = (num) => num ? num.toLocaleString() : 0
const formatCurrency = (val) => val ? '¥' + val.toFixed(2) : '¥0.00'

const getStatusLabel = (status) => {
  const map = { 'normal': '正常', 'warning': '即将更换', 'critical': '急需更换' }
  return map[status] || status
}

const getStatusSeverity = (status) => {
  const map = { 'normal': 'success', 'warning': 'warning', 'critical': 'danger' }
  return map[status] || 'info'
}

const calculateHealth = (part) => {
  // 简单模拟健康度百分比，仅基于里程
  if (!part.recommended_replacement_mileage || !part.current_mileage || !part.installed_mileage) return 100

  const used = part.current_mileage - part.installed_mileage
  const total = part.recommended_replacement_mileage
  const percent = Math.max(0, Math.min(100, 100 - (used / total * 100)))
  return percent
}

const getHealthColor = (part) => {
  const health = calculateHealth(part)
  if (health > 50) return 'var(--green-500)'
  if (health > 20) return 'var(--yellow-500)'
  return 'var(--red-500)'
}

onMounted(async () => {
  await loadVehicles()
  loadParts()
})
</script>

<style scoped>
.field {
  margin-bottom: 1rem;
}
</style>
