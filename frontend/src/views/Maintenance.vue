<!--
  保养维修页面 - 完整版
-->

<template>
  <div>
    <div class="flex flex-column md:flex-row justify-content-between align-items-center mb-4">
      <h1 class="text-3xl font-bold m-0 mb-2 md:mb-0">保养维修</h1>
      <div class="flex gap-2">
        <Button label="记录保养" icon="pi pi-plus" @click="openAddDialog" />
      </div>
    </div>

    <!-- 过滤器 -->
    <div class="grid p-fluid mb-4">
      <div class="col-12 md:col-4">
        <span class="p-float-label">
          <Dropdown v-model="filters.vehicle_id" :options="vehicles" optionLabel="plate_number" optionValue="id"
            showClear @change="loadRecords" placeholder="选择车辆" class="w-full" />
          <label>筛选车辆</label>
        </span>
      </div>
      <div class="col-12 md:col-4">
        <span class="p-float-label">
          <Dropdown v-model="filters.type" :options="serviceTypes" optionLabel="label" optionValue="value" showClear
            @change="loadRecords" placeholder="类型" class="w-full" />
          <label>筛选类型</label>
        </span>
      </div>
    </div>

    <!-- 列表 -->
    <DataTable :value="records" :loading="loading" stripedRows paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]"
      responsiveLayout="stack" breakpoint="960px" class="responsive-table">
      <Column field="maintenance_date" header="日期" sortable>
        <template #body="slotProps">
          {{ formatDate(slotProps.data.maintenance_date) }}
        </template>
      </Column>
      <Column field="vehicle_plate" header="车辆"></Column>
      <Column field="type" header="类型">
        <template #body="slotProps">
          <Tag :value="getTypeLabel(slotProps.data.type)" :severity="getTypeSeverity(slotProps.data.type)" />
        </template>
      </Column>
      <Column field="description" header="项目描述"
        style="max-width: 15rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></Column>
      <Column field="mileage" header="里程" sortable>
        <template #body="slotProps">
          {{ formatNumber(slotProps.data.mileage) }} km
        </template>
      </Column>
      <Column field="cost" header="费用" sortable>
        <template #body="slotProps">
          {{ formatCurrency(slotProps.data.cost) }}
        </template>
      </Column>
      <Column header="下次保养">
        <template #body="slotProps">
          <div class="text-sm" v-if="slotProps.data.next_maintenance_date || slotProps.data.next_maintenance_mileage">
            <div v-if="slotProps.data.next_maintenance_date">📅 {{ formatDate(slotProps.data.next_maintenance_date) }}
            </div>
            <div v-if="slotProps.data.next_maintenance_mileage">🚗 {{
              formatNumber(slotProps.data.next_maintenance_mileage) }}
              km</div>
          </div>
          <span v-else class="text-400">--</span>
        </template>
      </Column>
      <Column header="操作">
        <template #body="slotProps">
          <Button icon="pi pi-pencil" text rounded @click="editRecord(slotProps.data)" />
          <Button icon="pi pi-trash" text rounded severity="danger" @click="deleteRecord(slotProps.data.id)" />
        </template>
      </Column>
    </DataTable>

    <!-- 添加/编辑对话框 -->
    <Dialog :visible="showDialog" @update:visible="showDialog = $event" :header="editingRecord ? '编辑记录' : '添加保养/维修记录'"
      :modal="true" :breakpoints="{ '960px': '85vw', '640px': '95vw' }" :style="{ width: '600px' }">
      <div class="field">
        <label>车辆 *</label>
        <Dropdown v-model="recordForm.vehicle_id" :options="vehicles" optionLabel="plate_number" optionValue="id"
          placeholder="选择车辆" class="w-full" :disabled="!!editingRecord" @change="onVehicleSelect" />
      </div>

      <div class="formgrid grid">
        <div class="field col-6">
          <label>日期 *</label>
          <Calendar v-model="recordForm.maintenance_date" showTime hourFormat="24" dateFormat="yy-mm-dd"
            class="w-full" />
        </div>
        <div class="field col-6">
          <label>类型 *</label>
          <Dropdown v-model="recordForm.type" :options="serviceTypes" optionLabel="label" optionValue="value"
            class="w-full" />
        </div>
      </div>

      <div class="formgrid grid">
        <div class="field col-6">
          <label>当前里程 (km) *</label>
          <InputNumber v-model="recordForm.mileage" class="w-full" :min="0" />
        </div>
        <div class="field col-6">
          <label>总费用 (元)</label>
          <InputNumber v-model="recordForm.cost" class="w-full" :min="0" :maxFractionDigits="2"
            :inputProps="{ inputmode: 'decimal' }" />
        </div>
      </div>

      <div class="field">
        <label>服务提供商 (4S店/修理厂)</label>
        <div class="p-inputgroup">
          <InputText v-model="recordForm.service_provider" class="w-full" placeholder="输入店名" />
          <Button icon="pi pi-map-marker" @click="getCurrentLocation" v-tooltip="'获取当前位置'" />
          <Button icon="pi pi-map" severity="secondary" @click="showMapDialog = true" v-tooltip="'在地图上选择'" />
        </div>
        <!-- 附近站点推荐 -->
        <div v-if="nearbyLocations.length > 0" class="mt-2 surface-100 p-2 border-round">
          <small class="text-600 block mb-1">发现附近站点 (点击自动填写):</small>
          <div class="flex flex-wrap gap-2">
            <Button v-for="loc in nearbyLocations" :key="loc.name" :label="loc.name" size="small" outlined
              severity="info" class="p-1 text-xs" @click="selectNearby(loc)" />
          </div>
        </div>
      </div>

      <div class="field">
        <label>项目描述 *</label>
        <Textarea v-model="recordForm.description" rows="3" class="w-full" placeholder="例如：更换机油、机滤、空调滤芯" />
      </div>

      <Divider align="left">
        <div class="inline-flex align-items-center">
          <i class="pi pi-bell mr-2"></i>
          <b>设置下次保养提醒</b>
        </div>
      </Divider>

      <div class="formgrid grid">
        <div class="field col-6">
          <label>下次保养日期</label>
          <Calendar v-model="recordForm.next_maintenance_date" dateFormat="yy-mm-dd" class="w-full" showIcon />
        </div>
        <div class="field col-6">
          <label>下次保养里程 (km)</label>
          <InputNumber v-model="recordForm.next_maintenance_mileage" class="w-full" :min="0" placeholder="例如: 10000" />
        </div>
      </div>

      <div class="field">
        <label>备注</label>
        <Textarea v-model="recordForm.notes" rows="2" class="w-full" />
      </div>

      <template #footer>
        <Button label="取消" text @click="showDialog = false" />
        <Button label="保存" @click="saveRecord" :loading="saving" />
      </template>
    </Dialog>

    <!-- 地图选择对话框 -->
    <Dialog :visible="showMapDialog" @update:visible="showMapDialog = $event" header="选择位置" :modal="true"
      :breakpoints="{ '960px': '90vw', '640px': '95vw' }" :style="{ width: '800px', maxWidth: '95vw' }">
      <LocationPicker :initialLat="recordForm.location_lat" :initialLng="recordForm.location_lng"
        @confirm="onLocationSelected" />
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { maintenanceAPI, vehicleAPI, locationsAPI } from '../api'
import logger from '../utils/logger'
import { formatDate as fmtDate, parseLocalDate, toLocalDateString } from '../utils/date'

const LocationPicker = defineAsyncComponent(() => import('../components/LocationPicker.vue'))

const toast = useToast()

// 状态
const records = ref([])
const vehicles = ref([])
const loading = ref(false)
const showDialog = ref(false)
const saving = ref(false)
const editingRecord = ref(null)
const nearbyLocations = ref([])
const showMapDialog = ref(false)

// 过滤器
const filters = ref({
  vehicle_id: null,
  type: null
})

const serviceTypes = [
  { label: '保养', value: 'maintenance' },
  { label: '维修', value: 'repair' },
  { label: '更新', value: 'upgrade' },
  { label: '其他', value: 'other' }
]

// 表单数据
const defaultForm = {
  vehicle_id: null,
  maintenance_date: new Date(),
  type: 'maintenance',
  mileage: null,
  cost: null,
  service_provider: '',
  description: '',
  next_maintenance_mileage: null,
  notes: '',
  location_name: '',
  location_lat: null,
  location_lng: null
}

const recordForm = ref({ ...defaultForm })

// 获取车辆列表
const loadVehicles = async () => {
  try {
    const res = await vehicleAPI.getList()
    if (res.success) {
      vehicles.value = res.data
    }
  } catch (error) {
    logger.error('Failed to load vehicles', error)
  }
}

// 获取记录列表
const loadRecords = async () => {
  loading.value = true
  try {
    const params = {}
    if (filters.value.vehicle_id) params.vehicle_id = filters.value.vehicle_id
    if (filters.value.type) params.service_type = filters.value.type

    const res = await maintenanceAPI.getList(params)
    if (res.success) {
      records.value = res.data.map(rec => ({
        ...rec,
        vehicle_plate: vehicles.value.find(v => v.id === rec.vehicle_id)?.plate_number || '未知车辆'
      }))
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: '错误', detail: '加载记录失败', life: 3000 })
  } finally {
    loading.value = false
  }
}

const onVehicleSelect = () => {
  // 可以在这里预填该车当前的里程
}

// 打开添加对话框
const openAddDialog = () => {
  editingRecord.value = null
  recordForm.value = { ...defaultForm, maintenance_date: new Date() }

  // 智能预选
  if (vehicles.value.length === 1) {
    recordForm.value.vehicle_id = vehicles.value[0].id
  } else if (filters.value.vehicle_id) {
    recordForm.value.vehicle_id = filters.value.vehicle_id
  }

  nearbyLocations.value = []
  showDialog.value = true
}

// 编辑记录
const editRecord = (record) => {
  editingRecord.value = record
  recordForm.value = {
    ...record,
    maintenance_date: parseLocalDate(record.maintenance_date),
    next_maintenance_date: record.next_maintenance_date ? parseLocalDate(record.next_maintenance_date) : null
  }
  showDialog.value = true
}

// 保存记录
const saveRecord = async () => {
  if (!recordForm.value.vehicle_id || !recordForm.value.mileage || !recordForm.value.description || !recordForm.value.type || !recordForm.value.maintenance_date) {
    toast.add({ severity: 'warn', summary: '提示', detail: '请填写必填项(车辆、时间、类型、里程、描述)', life: 3000 })
    return
  }

  saving.value = true
  try {
    const data = { ...recordForm.value }
    if (data.maintenance_date) data.maintenance_date = toLocalDateString(data.maintenance_date)
    if (data.next_maintenance_date) data.next_maintenance_date = toLocalDateString(data.next_maintenance_date)

    let res
    if (editingRecord.value) {
      res = await maintenanceAPI.update(editingRecord.value.id, data)
    } else {
      res = await maintenanceAPI.create(data)
    }

    if (res.success) {
      toast.add({ severity: 'success', summary: '成功', detail: res.message, life: 3000 })
      showDialog.value = false
      loadRecords()
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: '错误', detail: error.message || '保存失败', life: 3000 })
  } finally {
    saving.value = false
  }
}

// 获取浏览器当前位置
const getCurrentLocation = () => {
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude
      const lng = position.coords.longitude
      recordForm.value.location_lat = lat
      recordForm.value.location_lng = lng
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
    logger.error('Nearby search failed', e)
  }
}

const selectNearby = (loc) => {
  recordForm.value.service_provider = loc.name
  recordForm.value.location_name = loc.name
  recordForm.value.location_lat = loc.latitude
  recordForm.value.location_lng = loc.longitude
  toast.add({ severity: 'info', summary: '已选择站点', detail: loc.name, life: 2000 })
}

const onLocationSelected = (loc) => {
  recordForm.value.location_lat = loc.lat
  recordForm.value.location_lng = loc.lng
  showMapDialog.value = false
  searchNearby(loc.lat, loc.lng)
}

const deleteRecord = async (id) => {
  if (!confirm('确定要删除这条记录吗？')) return
  try {
    const res = await maintenanceAPI.delete(id)
    if (res.success) {
      toast.add({ severity: 'success', summary: '成功', detail: '删除成功', life: 3000 })
      loadRecords()
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: '错误', detail: '删除失败', life: 3000 })
  }
}

// 格式化工具
const formatDate = fmtDate

const formatNumber = (num) => num ? num.toLocaleString() : 0
const formatCurrency = (val) => val ? '¥' + val.toFixed(2) : '¥0.00'

const getTypeLabel = (type) => {
  const map = { 'maintenance': '保养', 'repair': '维修', 'upgrade': '更新', 'other': '其他' }
  return map[type] || type
}

const getTypeSeverity = (type) => {
  const map = { 'maintenance': 'success', 'repair': 'danger', 'upgrade': 'info', 'other': 'warning' }
  return map[type] || 'info'
}

onMounted(async () => {
  const route = useRoute()
  await loadVehicles()

  if (route.query.vehicle_id) {
    filters.value.vehicle_id = parseInt(route.query.vehicle_id)
  }

  loadRecords()
})
</script>

<style scoped>
.field {
  margin-bottom: 1rem;
}

.field label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
}
</style>
