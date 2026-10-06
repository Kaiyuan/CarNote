<!--
  能耗记录页面 - 完整版
-->

<template>
  <div>
    <div class="flex flex-column md:flex-row justify-content-between align-items-center mb-4">
      <h1 class="text-3xl font-bold m-0 mb-2 md:mb-0">能耗记录</h1>
      <div class="flex gap-2">
        <Button label="导出" icon="pi pi-download" severity="secondary" outlined @click="exportData" />
        <Button label="导入" icon="pi pi-upload" severity="secondary" outlined @click="() => $refs.fileInput.click()" />
        <input ref="fileInput" type="file" accept=".csv" style="display: none" @change="importData" />
        <Button label="记录能耗" icon="pi pi-plus" @click="openAddDialog" />
      </div>
    </div>

    <!-- 过滤器 -->
    <div class="grid p-fluid mb-4">
      <div class="col-12 md:col-4">
        <span class="p-float-label">
          <Dropdown v-model="filters.vehicle_id" :options="vehicles" optionLabel="plate_number" optionValue="id"
            showClear @change="loadLogs" placeholder="选择车辆" class="w-full" />
          <label>筛选车辆</label>
        </span>
      </div>
    </div>

    <!-- 桌面端列表 -->
    <DataTable :value="logs" :loading="loading" stripedRows paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]"
      responsiveLayout="scroll" class="hidden md:block">
      <Column field="log_date" header="日期" sortable>
        <template #body="slotProps">
          {{ formatDate(slotProps.data.log_date) }}
        </template>
      </Column>
      <Column field="vehicle_plate" header="车牌号"></Column>
      <Column field="mileage" header="里程 (km)" sortable>
        <template #body="slotProps">
          {{ formatNumber(slotProps.data.mileage) }}
        </template>
      </Column>
      <Column field="type" header="类型">
        <template #body="slotProps">
          <Tag :value="getTypeLabel(slotProps.data.energy_type)"
            :severity="getTypeSeverity(slotProps.data.energy_type)" />
        </template>
      </Column>
      <Column field="amount" header="数量">
        <template #body="slotProps">
          {{ slotProps.data.amount }} {{ getUnit(slotProps.data.energy_type) }}
        </template>
      </Column>
      <Column field="cost" header="费用 (元)" sortable>
        <template #body="slotProps">
          {{ formatCurrency(slotProps.data.cost) }}
        </template>
      </Column>
      <Column field="consumption_per_100km" header="百公里能耗">
        <template #body="slotProps">
          <span v-if="slotProps.data.consumption_per_100km"
            :class="{ 'text-green-600 font-bold': Number(slotProps.data.consumption_per_100km) < 8, 'text-orange-500': Number(slotProps.data.consumption_per_100km) > 12 }">
            {{ Number(slotProps.data.consumption_per_100km).toFixed(2) }}
          </span>
          <span v-else>--</span>
        </template>
      </Column>
      <Column header="记录状态">
        <template #body="slotProps">
          <Tag v-if="Number(slotProps.data.record_control) === 1" value="已暂停" severity="warning" />
          <Tag v-else-if="Number(slotProps.data.record_control) === 2" value="已恢复" severity="success" />
          <span v-else class="text-500">—</span>
        </template>
      </Column>
      <Column header="操作">
        <template #body="slotProps">
          <Button icon="pi pi-pencil" text rounded @click="editLog(slotProps.data)" />
          <Button icon="pi pi-trash" text rounded severity="danger" @click="() => { deleteLog(slotProps.data.id); }" />
        </template>
      </Column>
    </DataTable>

    <!-- 移动端列表 (卡片视图) -->
    <DataView :value="logs" :paginator="true" :rows="10" class="block md:hidden">
      <template #list="slotProps">
        <div class="grid grid-nogutter">
          <div v-for="(item, index) in slotProps.items" :key="index" class="col-12">
            <div class="flex flex-column p-3 gap-2 border-bottom-1 surface-border">
              <!-- 第一行: 车牌 + 能耗 -->
              <div class="flex justify-content-between align-items-start">
                <span class="text-2xl font-bold">{{ item.vehicle_plate }}</span>
                <div v-if="item.consumption_per_100km" class="text-2xl font-bold text-green-500">
                  {{ Number(item.consumption_per_100km).toFixed(2) }}
                </div>
              </div>

              <!-- 第二行: 日期 + 里程 -->
              <div class="flex justify-content-between align-items-center -mt-2">
                <span class="text-500 text-sm">{{ formatDate(item.log_date) }}</span>
                <span class="text-lg font-bold text-500">{{ formatNumber(item.mileage) }}km</span>
              </div>

              <!-- 第三行: 类型数量 + 费用 -->
              <div class="flex justify-content-between align-items-center mt-2">
                <div class="flex align-items-center gap-2">
                  <Tag :value="getTypeLabel(item.energy_type)" :severity="getTypeSeverity(item.energy_type)"
                    class="text-base px-2" />
                  <span class="text-3xl font-bold">{{ item.amount }}{{ getUnit(item.energy_type) }}</span>
                </div>
                <div class="text-3xl font-bold">
                  {{ formatCurrency(item.cost) }}
                </div>
              </div>

              <!-- 第四行: 操作按钮 -->
              <div class="flex justify-content-center gap-5 mt-2">
                <Button icon="pi pi-pencil" text rounded size="small" @click="editLog(item)" />
                <Button icon="pi pi-trash" text rounded severity="danger" size="small" @click="deleteLog(item.id)" />
              </div>
            </div>
          </div>
        </div>
      </template>
    </DataView>

    <!-- 添加/编辑对话框 -->
    <Dialog :visible="showDialog" @update:visible="showDialog = $event" :header="editingLog ? '编辑记录' : '添加能耗记录'"
      :modal="true" :breakpoints="{ '960px': '85vw', '640px': '95vw' }" :style="{ width: '600px' }">
      <div class="field">
        <label>车辆 *</label>
        <Dropdown v-model="logForm.vehicle_id" :options="vehicles" optionLabel="plate_number" optionValue="id"
          placeholder="选择车辆" class="w-full" :disabled="!!editingLog" @change="onVehicleSelect" />
      </div>

      <div class="field">
        <label>日期 *</label>
        <Calendar v-model="logForm.log_date" showTime hourFormat="24" dateFormat="yy-mm-dd" class="w-full"
          @date-select="onDateSelect" />
      </div>

      <div class="field">
        <label>当前里程 (km) *</label>
        <InputNumber v-model="logForm.mileage" class="w-full" :min="0" />
      </div>

      <div class="field">
        <label>能源类型 *</label>
        <Dropdown v-model="logForm.energy_type" :options="energyTypes" optionLabel="label" optionValue="value"
          class="w-full" />
      </div>

      <div class="flex flex-column md:flex-row gap-3 mb-3">
        <div class="flex-1 field m-0">
          <label class="block mb-2">数量 ({{ getUnit(logForm.energy_type) }}) *</label>
          <InputNumber v-model="logForm.amount" class="w-full" :min="0" :maxFractionDigits="2"
            :inputProps="{ inputmode: 'decimal' }" />
        </div>
        <div class="flex-1 field m-0">
          <label class="block mb-2">总费用 (元) *</label>
          <InputNumber v-model="logForm.cost" class="w-full" :min="0" :maxFractionDigits="2"
            :inputProps="{ inputmode: 'decimal' }" />
        </div>
      </div>

      <div class="flex align-items-center mb-3" style="gap: 0.5rem;">
        <div class="field-checkbox m-0 flex align-items-center">
          <Checkbox v-model="logForm.is_full" :binary="true" inputId="is_full"
            :disabled="logForm.controlChecked" />
          <label for="is_full" class="ml-2 mb-0">加满/充满</label>
        </div>
        <div class="field-checkbox m-0 flex align-items-center">
          <Checkbox v-model="logForm.controlChecked" :binary="true" inputId="record_control"
            :disabled="pendingResume" @change="onControlCheck" />
          <label for="record_control" class="ml-2 mb-0">
            {{ pendingResume ? '开始记录' : '暂停记录' }}
          </label>
        </div>
      </div>

      <div class="field">
        <label>位置 (补能站名称)</label>
        <div class="p-inputgroup">
          <InputText v-model="logForm.location_name" placeholder="输入补能站/站点名称" />
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
        <label>备注</label>
        <Textarea v-model="logForm.notes" rows="2" class="w-full" />
      </div>

      <template #footer>
        <Button label="取消" text @click="showDialog = false" />
        <Button label="保存" @click="saveLog" :loading="saving" />
      </template>
    </Dialog>
    <!-- 地图选择对话框 -->
    <Dialog :visible="showMapDialog" @update:visible="showMapDialog = $event" header="选择位置" :modal="true"
      :breakpoints="{ '960px': '90vw', '640px': '95vw' }" :style="{ width: '800px', maxWidth: '95vw' }">
      <LocationPicker v-if="showMapDialog" :initialLat="logForm.location_lat" :initialLng="logForm.location_lng"
        @confirm="onLocationSelected" />
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, defineAsyncComponent, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useRouter, useRoute } from 'vue-router'
import DataView from 'primevue/dataview'
import { energyAPI, vehicleAPI, locationsAPI } from '../api'
import logger from '../utils/logger'
import { toUtcIsoString, formatDateTime, parseDate } from '../utils/date'

const LocationPicker = defineAsyncComponent(() => import('../components/LocationPicker.vue'))

const toast = useToast()
const router = useRouter()
const route = useRoute()

// 状态
const logs = ref([])
const vehicles = ref([])
const loading = ref(false)
const showDialog = ref(false)
const showMapDialog = ref(false)
const saving = ref(false)
const editingLog = ref(null)
const nearbyLocations = ref([])
const pendingResume = ref(false)

// 过滤器
const filters = ref({
  vehicle_id: null
})

// 表单数据
const defaultForm = {
  vehicle_id: null,
  log_date: new Date(),
  mileage: null,
  energy_type: 'fuel',
  amount: null,
  cost: null,
  is_full: true,
  controlChecked: false,
  record_control: 0,
  location_name: '',
  location_lat: null,
  location_lng: null,
  notes: ''
}

const logForm = ref({ ...defaultForm })

const energyTypes = [
  { label: '汽油', value: 'fuel' },
  { label: '电能', value: 'electric' }
]

const checkPendingResume = async (vehicleId) => {
  pendingResume.value = false
  if (!vehicleId) return
  try {
    const res = await energyAPI.getList({
      vehicle_id: vehicleId,
      limit: 1,
      offset: 0
    })
    let list = []
    if (res.success && res.data) {
      list = Array.isArray(res.data) ? res.data : (res.data.logs || [])
    }
    if (list.length > 0 && Number(list[0].record_control) === 1) {
      pendingResume.value = true
      // 上一条是暂停：新建记录强制勾选「开始记录」，且不可取消
      if (!editingLog.value) {
        logForm.value.controlChecked = true
        logForm.value.is_full = true
      }
    }
  } catch (e) {
    logger.error('checkPendingResume failed', e)
  }
}

const onControlCheck = () => {
  if (logForm.value.controlChecked) {
    logForm.value.is_full = true
  }
}

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

// 获取日志列表
const loadLogs = async () => {
  loading.value = true
  try {
    const params = {}
    if (filters.value.vehicle_id) {
      params.vehicle_id = filters.value.vehicle_id
    }

    logger.debug('正在加载能耗记录，参数:', params)
    const res = await energyAPI.getList(params)
    logger.debug('API 响应:', res)

    if (res.success) {
      let logsData = []

      if (res.data) {
        if (Array.isArray(res.data)) {
          logsData = res.data
        } else if (res.data.logs && Array.isArray(res.data.logs)) {
          logsData = res.data.logs
        } else if (typeof res.data === 'object') {
          logger.warn('未知的 data 格式:', res.data)
          logsData = []
        }
      }

      logs.value = logsData.map(log => ({
        ...log,
        vehicle_plate: log.plate_number || vehicles.value.find(v => v.id === log.vehicle_id)?.plate_number || '未知车辆'
      }))

      if (logs.value.length === 0) {
        toast.add({ severity: 'info', summary: '提示', detail: '暂无能耗记录', life: 3000 })
      }
    } else {
      logger.error('API 返回 success: false')
      toast.add({ severity: 'error', summary: '错误', detail: res.message || '加载失败', life: 3000 })
    }
  } catch (error) {
    logger.error('加载能耗记录失败:', error)
    const errorMsg = error.response?.data?.message || error.message || '加载记录失败'
    toast.add({ severity: 'error', summary: '错误', detail: errorMsg, life: 3000 })
  } finally {
    loading.value = false
  }
}

const onVehicleSelect = async () => {
  const vehicle = vehicles.value.find(v => v.id === logForm.value.vehicle_id)
  if (vehicle) {
    localStorage.setItem('last_selected_vehicle_id', vehicle.id)

    if (vehicle.power_type === 'electric') {
      logForm.value.energy_type = 'electric'
    } else {
      logForm.value.energy_type = 'fuel'
    }
  }
  if (!editingLog.value && logForm.value.vehicle_id) {
    await checkPendingResume(logForm.value.vehicle_id)
  }
}

// 打开添加对话框
const openAddDialog = async () => {
  editingLog.value = null
  logForm.value = { ...defaultForm, log_date: new Date() }
  pendingResume.value = false

  const lastVehicleId = localStorage.getItem('last_selected_vehicle_id')

  if (lastVehicleId && vehicles.value.some(v => v.id == lastVehicleId)) {
    logForm.value.vehicle_id = Number(lastVehicleId)
    await onVehicleSelect()
  } else if (vehicles.value.length === 1) {
    logForm.value.vehicle_id = vehicles.value[0].id
    await onVehicleSelect()
  } else if (filters.value.vehicle_id) {
    logForm.value.vehicle_id = filters.value.vehicle_id
    await onVehicleSelect()
  }

  nearbyLocations.value = []
  showDialog.value = true
}

// 编辑记录
const editLog = (log) => {
  editingLog.value = log
  const rc = Number(log.record_control) || 0
  logForm.value = {
    ...log,
    log_date: parseDate(log.log_date),
    is_full: log.is_full === 1 || log.is_full === true,
    controlChecked: rc === 1 || rc === 2,
    record_control: rc
  }
  pendingResume.value = (rc === 2)
  showDialog.value = true
}

// 保存记录
const saveLog = async () => {
  if (!logForm.value.vehicle_id || !logForm.value.mileage || !logForm.value.amount || !logForm.value.cost) {
    toast.add({ severity: 'warn', summary: '提示', detail: '请填写所有必填项', life: 3000 })
    return
  }

  saving.value = true
  try {
    // 上一条是暂停时，新建记录强制 record_control = 2（开始记录）
    let rc
    if (!editingLog.value && pendingResume.value) {
      rc = 2
      logForm.value.controlChecked = true
    } else {
      rc = logForm.value.controlChecked
        ? (pendingResume.value ? 2 : 1)
        : 0
    }

    const data = {
      ...logForm.value,
      log_date: toUtcIsoString(logForm.value.log_date),
      is_full: logForm.value.is_full ? 1 : 0,
      record_control: rc
    }
    delete data.controlChecked

    let res
    if (editingLog.value) {
      res = await energyAPI.update(editingLog.value.id, data)
    } else {
      res = await energyAPI.create(data)
    }

    if (res.success) {
      toast.add({ severity: 'success', summary: '成功', detail: res.message, life: 3000 })
      showDialog.value = false
      loadLogs()
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: '错误', detail: error.message || '保存失败', life: 3000 })
  } finally {
    saving.value = false
  }
}

// 删除记录
const deleteLog = async (id) => {
  if (!window.confirm('确定要删除这条记录吗？')) {
    return
  }

  try {
    const res = await energyAPI.delete(id)

    if (res.success) {
      toast.add({ severity: 'success', summary: '成功', detail: '删除成功', life: 3000 })
      loadLogs()
    } else {
      toast.add({ severity: 'error', summary: '错误', detail: res.message || '删除失败', life: 3000 })
    }
  } catch (error) {
    logger.error('删除记录失败:', error)
    toast.add({ severity: 'error', summary: '错误', detail: error.message || '删除失败', life: 3000 })
  }
}

// 获取浏览器当前位置
const getCurrentLocation = () => {
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = position.coords.latitude
      const lng = position.coords.longitude
      logForm.value.location_lat = lat
      logForm.value.location_lng = lng

      toast.add({ severity: 'success', summary: '已获取位置', detail: '坐标已自动填入', life: 2000 })
      searchNearby(lat, lng)
    }, (error) => {
      toast.add({ severity: 'error', summary: '错误', detail: '无法获取位置: ' + error.message, life: 3000 })
    });
  } else {
    toast.add({ severity: 'warn', summary: '不支持', detail: '您的浏览器不支持地理位置', life: 3000 })
  }
}

// 搜索附近站点
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
  logForm.value.location_name = loc.name
  logForm.value.location_lat = loc.latitude
  logForm.value.location_lng = loc.longitude
  toast.add({ severity: 'info', summary: '已选择站点', detail: loc.name, life: 2000 })
}

const onLocationSelected = (loc) => {
  logForm.value.location_lat = loc.lat
  logForm.value.location_lng = loc.lng
  showMapDialog.value = false
  searchNearby(loc.lat, loc.lng)
}

const onDateSelect = () => {
}

// 导出数据为CSV
const exportData = () => {
  if (logs.value.length === 0) {
    toast.add({ severity: 'warn', summary: '提示', detail: '没有数据可导出', life: 3000 })
    return
  }

  const headers = ['日期', '车牌号', '里程(km)', '能源类型', '数量', '费用(元)', '单价', '百公里能耗', '位置', '备注']
  const rows = logs.value.map(log => [
    formatDate(log.log_date),
    log.vehicle_plate || log.plate_number,
    log.mileage,
    log.energy_type === 'fuel' ? '燃油' : '电能',
    log.amount,
    log.cost || '',
    log.unit_price || '',
    log.consumption_per_100km || '',
    log.location_name || '',
    log.notes || ''
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `能耗记录_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  toast.add({ severity: 'success', summary: '成功', detail: `已导出 ${logs.value.length} 条记录`, life: 3000 })
}

// 导入CSV数据
const importData = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async (e) => {
    try {
      const text = e.target.result
      const lines = text.split('\n').filter(line => line.trim())

      if (lines.length < 2) {
        toast.add({ severity: 'error', summary: '错误', detail: 'CSV文件格式不正确', life: 3000 })
        return
      }

      const records = []
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(',').map(cell => cell.replace(/^"|"$/g, '').trim())
        if (cells.length < 5) continue

        const vehicle = vehicles.value.find(v => v.plate_number === cells[1])
        if (!vehicle) {
          console.warn(`未找到车牌 ${cells[1]} 对应的车辆，跳过该记录`)
          continue
        }

        records.push({
          vehicle_id: vehicle.id,
          log_date: cells[0],
          mileage: parseFloat(cells[2]),
          energy_type: cells[3] === '燃油' ? 'fuel' : 'electric',
          amount: parseFloat(cells[4]),
          cost: cells[5] ? parseFloat(cells[5]) : null,
          unit_price: cells[6] ? parseFloat(cells[6]) : null,
          location_name: cells[8] || null,
          notes: cells[9] || null
        })
      }

      if (records.length === 0) {
        toast.add({ severity: 'warn', summary: '提示', detail: '没有有效的记录可导入', life: 3000 })
        return
      }

      let successCount = 0
      for (const record of records) {
        try {
          const res = await energyAPI.create(record)
          if (res.success) successCount++
        } catch (err) {
          logger.error('导入记录失败:', err)
        }
      }

      toast.add({
        severity: 'success',
        summary: '导入完成',
        detail: `成功导入 ${successCount}/${records.length} 条记录`,
        life: 5000
      })

      loadLogs()
    } catch (error) {
      console.error('导入失败:', error)
      toast.add({ severity: 'error', summary: '错误', detail: '导入失败，请检查文件格式', life: 3000 })
    } finally {
      event.target.value = ''
    }
  }

  reader.readAsText(file, 'UTF-8')
}

const formatDate = formatDateTime

const formatNumber = (num) => num ? Number(num).toLocaleString() : 0
const formatCurrency = (val) => val ? '¥' + Number(val).toFixed(2) : '¥0.00'

const getTypeLabel = (type) => type === 'electric' ? '充电' : '加油'
const getTypeSeverity = (type) => type === 'electric' ? 'success' : 'warning'
const getUnit = (type) => type === 'electric' ? 'kWh' : 'L'

onMounted(async () => {
  await loadVehicles()
  loadLogs()

  const { action } = route.query
  if (action === 'add') {
    openAddDialog()
    router.replace({ query: null })
  }
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
