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

    <!-- 记录列表 -->
    <DataTable :value="logs" :loading="loading" stripedRows paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]"
      responsiveLayout="stack" breakpoint="960px" class="responsive-table">
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
      <Column header="操作">
        <template #body="slotProps">
          <Button icon="pi pi-pencil" text rounded @click="editLog(slotProps.data)" />
          <Button icon="pi pi-trash" text rounded severity="danger"
            @click="() => { console.log('Delete clicked!', slotProps.data.id); deleteLog(slotProps.data.id); }" />
        </template>
      </Column>
    </DataTable>

    <!-- 添加/编辑对话框 -->
    <Dialog v-model:visible="showDialog" :header="editingLog ? '编辑记录' : '添加能耗记录'" :modal="true"
      :breakpoints="{ '960px': '85vw', '640px': '95vw' }" :style="{ width: '600px' }">
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
          <InputNumber v-model="logForm.amount" class="w-full" :min="0" :maxFractionDigits="2" />
        </div>
        <div class="flex-1 field m-0">
          <label class="block mb-2">总费用 (元) *</label>
          <InputNumber v-model="logForm.cost" class="w-full" :min="0" :maxFractionDigits="2" />
        </div>
      </div>

      <div class="field-checkbox">
        <Checkbox v-model="logForm.is_full" :binary="true" inputId="is_full" />
        <label for="is_full" class="ml-2">加满/充满</label>
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
    <Dialog v-model:visible="showMapDialog" header="选择位置" :modal="true"
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
import { energyAPI, vehicleAPI, locationsAPI } from '../api'

const LocationPicker = defineAsyncComponent(() => import('../components/LocationPicker.vue'))

const toast = useToast()
const router = useRouter()
const route = useRoute()

// 状态

// 状态
const logs = ref([])
const vehicles = ref([])
const loading = ref(false)
const showDialog = ref(false)
const showMapDialog = ref(false) // 地图对话框
const saving = ref(false)
const editingLog = ref(null)
const nearbyLocations = ref([])

// 过滤器
const filters = ref({
  vehicle_id: null
})

// 表单数据
const defaultForm = {
  vehicle_id: null,
  log_date: new Date(),
  mileage: null,
  energy_type: 'fuel', // 默认燃油
  amount: null,
  cost: null,
  is_full: true,
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

// 获取日志列表
const loadLogs = async () => {
  loading.value = true
  try {
    const params = {}
    if (filters.value.vehicle_id) {
      params.vehicle_id = filters.value.vehicle_id
    }

    console.log('正在加载能耗记录，参数:', params)
    const res = await energyAPI.getList(params)
    console.log('API 响应:', res)

    if (res.success) {
      // 处理多种可能的响应格式
      let logsData = []

      if (res.data) {
        if (Array.isArray(res.data)) {
          // 格式1: { success: true, data: [...] }
          logsData = res.data
          console.log('使用格式1: data 是数组')
        } else if (res.data.logs && Array.isArray(res.data.logs)) {
          // 格式2: { success: true, data: { logs: [...], pagination: {...} } }
          logsData = res.data.logs
          console.log('使用格式2: data.logs 是数组')
        } else if (typeof res.data === 'object') {
          // 格式3: data 是对象但不是数组，尝试转换
          console.warn('未知的 data 格式:', res.data)
          logsData = []
        }
      }

      console.log('解析后的日志数据:', logsData)

      // Backend already returns plate_number in the data, just use it directly
      logs.value = logsData.map(log => ({
        ...log,
        // Use plate_number from backend, fallback to mapping if not present
        vehicle_plate: log.plate_number || vehicles.value.find(v => v.id === log.vehicle_id)?.plate_number || '未知车辆'
      }))

      console.log('最终日志列表:', logs.value)

      if (logs.value.length === 0) {
        toast.add({ severity: 'info', summary: '提示', detail: '暂无能耗记录', life: 3000 })
      }
    } else {
      console.error('API 返回 success: false')
      toast.add({ severity: 'error', summary: '错误', detail: res.message || '加载失败', life: 3000 })
    }
  } catch (error) {
    console.error('加载能耗记录失败:', error)
    console.error('错误详情:', error.response || error.message)
    const errorMsg = error.response?.data?.message || error.message || '加载记录失败'
    toast.add({ severity: 'error', summary: '错误', detail: errorMsg, life: 3000 })
  } finally {
    loading.value = false
  }
}

// 当选择车辆时，自动设置默认能源类型
const onVehicleSelect = () => {
  const vehicle = vehicles.value.find(v => v.id === logForm.value.vehicle_id)
  if (vehicle) {
    if (vehicle.power_type === 'electric') {
      logForm.value.energy_type = 'electric'
    } else {
      logForm.value.energy_type = 'fuel'
    }
    // 可以预填该车上次里程（如果后端支持查询）
  }
}

// 打开添加对话框
const openAddDialog = () => {
  editingLog.value = null
  logForm.value = { ...defaultForm, log_date: new Date() }

  // 如果只有一个车辆，默认选中
  if (vehicles.value.length === 1) {
    logForm.value.vehicle_id = vehicles.value[0].id
    onVehicleSelect()
  } else if (filters.value.vehicle_id) {
    logForm.value.vehicle_id = filters.value.vehicle_id
    onVehicleSelect()
  }

  nearbyLocations.value = []
  showDialog.value = true
}

// 编辑记录
const editLog = (log) => {
  editingLog.value = log
  logForm.value = {
    ...log,
    log_date: new Date(log.log_date),
    is_full: log.is_full === 1 || log.is_full === true
  }
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
    const data = {
      ...logForm.value,
      is_full: logForm.value.is_full ? 1 : 0
    }

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
  console.log('删除记录被调用, ID:', id)

  if (!window.confirm('确定要删除这条记录吗？')) {
    console.log('用户取消删除')
    return
  }

  console.log('开始删除记录...')
  try {
    const res = await energyAPI.delete(id)
    console.log('删除 API 响应:', res)

    if (res.success) {
      toast.add({ severity: 'success', summary: '成功', detail: '删除成功', life: 3000 })
      loadLogs()
    } else {
      toast.add({ severity: 'error', summary: '错误', detail: res.message || '删除失败', life: 3000 })
    }
  } catch (error) {
    console.error('删除记录失败:', error)
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
    console.error('Nearby search failed', e)
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

// 日期选择后自动关闭（Calendar组件会自动处理）
const onDateSelect = () => {
  // PrimeVue Calendar会自动关闭，无需额外处理
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
          console.error('导入记录失败:', err)
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


// 格式化工具函数
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString() + ' ' + new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const formatNumber = (num) => num ? Number(num).toLocaleString() : 0
const formatCurrency = (val) => val ? '¥' + Number(val).toFixed(2) : '¥0.00'

const getTypeLabel = (type) => type === 'electric' ? '充电' : '加油'
const getTypeSeverity = (type) => type === 'electric' ? 'success' : 'warning'
const getUnit = (type) => type === 'electric' ? 'kWh' : 'L'

onMounted(() => {
  loadVehicles()
  loadLogs()

  // Check for quick add action
  const { action } = route.query
  if (action === 'add') {
    showDialog.value = true
    // Optional: Clean up query param
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
