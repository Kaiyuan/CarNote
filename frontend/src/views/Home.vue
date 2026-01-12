<!--
  首页 - 数据分析仪表盘
-->

<template>
  <div>
    <!-- 顶部工具栏 -->
    <div class="flex flex-column md:flex-row justify-content-between align-items-center mb-4 gap-3">
      <div class="flex align-items-center">
        <h2 class="text-xl md:text-2xl font-bold m-0 text-900 line-height-3">欢迎回来, {{ currentUser?.nickname ||
          currentUser?.username }}</h2>
      </div>
      <div class="flex gap-2 align-items-center w-full md:w-auto">
        <Button label="记一笔" icon="pi pi-plus" class="p-button-primary flex-shrink-0"
          @click="router.push('/energy?action=add')" />
        <Dropdown v-model="selectedVehicleId" :options="vehicles" optionLabel="plate_number" optionValue="id"
          placeholder="选择车辆" class="flex-auto md:w-14rem min-w-0" @change="loadDashboardData" />
        <SelectButton v-model="timeRange" :options="timeRanges" optionLabel="label" optionValue="value"
          :allowEmpty="false" @change="loadDashboardData" class="hidden md:flex" />
      </div>
    </div>

    <!-- 空状态提示 -->
    <div v-if="!selectedVehicleId && !loading" class="text-center py-8">
      <div class="surface-card p-6 border-round-2xl shadow-1 inline-block">
        <i class="pi pi-car mb-3 text-primary" style="font-size: 4rem"></i>
        <div class="text-xl font-medium text-900 mb-2">开始您的车辆管理之旅</div>
        <div class="text-600 mb-4">请先添加一辆车来查看分析数据</div>
        <Button label="添加车辆" icon="pi pi-plus" @click="router.push('/vehicles')" />
      </div>
    </div>

    <!-- 仪表盘内容 -->
    <div v-else class="grid">
      <!-- 核心指标卡片 -->
      <div class="col-12 md:col-6 lg:col-3">
        <div class="surface-card shadow-1 p-3 border-round-xl h-full border-left-3 border-blue-500">
          <div class="flex justify-content-between mb-3">
            <div>
              <span class="block text-500 font-medium mb-3">总里程</span>
              <div class="text-900 font-medium text-xl">{{ formatNumber(overview.total_mileage) }} km</div>
            </div>
            <div class="flex align-items-center justify-content-center bg-blue-100 border-round"
              style="width:2.5rem;height:2.5rem">
              <i class="pi pi-compass text-blue-500 text-xl"></i>
            </div>
          </div>
          <span class="text-green-500 font-medium">行驶数据 </span>
          <span class="text-500">累计统计</span>
        </div>
      </div>
      <div class="col-12 md:col-6 lg:col-3">
        <div class="surface-card shadow-1 p-3 border-round-xl h-full border-left-3 border-orange-500">
          <div class="flex justify-content-between mb-3">
            <div>
              <span class="block text-500 font-medium mb-3">总花费</span>
              <div class="text-900 font-medium text-xl">{{ formatCurrency(overview.total_cost) }}</div>
            </div>
            <div class="flex align-items-center justify-content-center bg-orange-100 border-round"
              style="width:2.5rem;height:2.5rem">
              <i class="pi pi-wallet text-orange-500 text-xl"></i>
            </div>
          </div>
          <div class="text-sm text-500 mt-1" v-if="overview.avg_cost_per_km">
            平均 <span class="text-orange-500 font-medium">{{ formatCurrency(overview.avg_cost_per_km) }}/km</span>
          </div>
        </div>
      </div>
      <div class="col-12 md:col-6 lg:col-3">
        <div class="surface-card shadow-1 p-3 border-round-xl h-full border-left-3 border-cyan-500">
          <div class="flex justify-content-between mb-3">
            <div>
              <span class="block text-500 font-medium mb-3">平均能耗</span>
              <div class="text-900 font-medium text-xl">
                {{ overview.avg_consumption ? overview.avg_consumption.toFixed(1) : '--' }}
                <span class="text-sm text-500">{{ unit }}</span>
              </div>
            </div>
            <div class="flex align-items-center justify-content-center bg-cyan-100 border-round"
              style="width:2.5rem;height:2.5rem">
              <i class="pi pi-bolt text-cyan-500 text-xl"></i>
            </div>
          </div>
          <span class="text-cyan-500 font-medium">能效分析 </span>
        </div>
      </div>
      <div class="col-12 md:col-6 lg:col-3">
        <div class="surface-card shadow-1 p-3 border-round-xl h-full border-left-3 border-purple-500">
          <div class="flex justify-content-between mb-3">
            <div>
              <span class="block text-500 font-medium mb-3">上次保养</span>
              <div class="text-900 font-medium text-xl">
                {{ overview.last_maintenance_date ? formatDate(overview.last_maintenance_date) : '无记录' }}
              </div>
            </div>
            <div class="flex align-items-center justify-content-center bg-purple-100 border-round"
              style="width:2.5rem;height:2.5rem">
              <i class="pi pi-wrench text-purple-500 text-xl"></i>
            </div>
          </div>
          <span v-if="overview.last_maintenance_days" class="text-purple-500 font-medium">{{
            overview.last_maintenance_days }} 天前</span>
        </div>
      </div>

      <!-- 主图表区域 (月度趋势) -->
      <div class="col-12 xl:col-8">
        <div class="surface-card shadow-1 border-round-xl p-4 h-full">
          <div class="flex justify-content-between align-items-center mb-4">
            <h5 class="text-xl font-bold m-0 text-900">月度用车分析</h5>
            <div class="flex align-items-center">
              <span class="p-badge p-badge-dot bg-blue-500 mr-2"></span>
              <span class="text-500 text-sm mr-3">里程</span>
              <span class="p-badge p-badge-dot bg-orange-500 mr-2"></span>
              <span class="text-500 text-sm">花费</span>
            </div>
          </div>
          <Chart type="bar" :data="monthlyTrendData" :options="mainChartOptions" class="h-20rem" />
        </div>
      </div>

      <!-- 费用分布 (圆环图) -->
      <div class="col-12 xl:col-4">
        <div class="surface-card shadow-1 border-round-xl p-4 h-auto">
          <div class="flex justify-content-between align-items-center mb-4">
            <h5 class="text-xl font-bold m-0 text-900">费用构成</h5>
            <Button icon="pi pi-ellipsis-h" text rounded aria-label="Menu" />
          </div>
          <div class="flex justify-content-center align-items-center relative" style="height: 16rem">
            <Chart type="doughnut" :data="expenseChartData" :options="doughnutOptions" class="w-full" />
            <!-- Center Text Overlay -->
            <div class="absolute flex flex-column align-items-center justify-content-center pointer-events-none">
              <span class="text-sm text-500">总计</span>
              <span class="text-xl font-bold text-900">{{ formatCurrency(overview.total_cost) }}</span>
            </div>
          </div>
          <div class="mt-4">
            <div class="flex justify-content-between align-items-center mb-2" v-for="(item, index) in expenseList"
              :key="index">
              <div class="flex align-items-center">
                <span class="border-circle w-1rem h-1rem mr-2" :style="{ backgroundColor: item.color }"></span>
                <span class="text-700">{{ item.label }}</span>
              </div>
              <span class="font-medium text-900">{{ formatCurrency(item.value) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 最近活动列表 (Transactions Style) -->
      <div class="col-12">
        <div class="surface-card shadow-1 border-round-xl p-4">
          <div class="flex justify-content-between align-items-center mb-4">
            <h5 class="text-xl font-bold m-0 text-900">最近活动</h5>
            <Button label="查看全部" text size="small" @click="router.push('/energy')" />
          </div>
          <DataTable :value="recentActivities" :rows="5" responsiveLayout="scroll">
            <Column field="type" header="类型">
              <template #body="slotProps">
                <Tag :severity="getActivitySeverity(slotProps.data.type)" :value="getActivityLabel(slotProps.data.type)"
                  rounded></Tag>
              </template>
            </Column>
            <Column field="date" header="日期">
              <template #body="slotProps">{{ formatDate(slotProps.data.date) }}</template>
            </Column>
            <Column field="description" header="描述"></Column>
            <Column field="cost" header="金额" alignFrozen="right" frozen>
              <template #body="slotProps">
                <span class="text-900 font-medium">{{ formatCurrency(slotProps.data.cost) }}</span>
              </template>
            </Column>
          </DataTable>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { vehicleAPI, analyticsAPI, energyAPI, maintenanceAPI } from '../api' // Added energy/maintenance APIs
import Chart from 'primevue/chart'

const router = useRouter()
const currentUser = ref(JSON.parse(localStorage.getItem('currentUser') || '{}'))

// State
const vehicles = ref([])
const selectedVehicleId = ref(null)
const timeRange = ref('year') // default to year
const loading = ref(false)

const overview = ref({})
const expenseData = ref({})
const monthlyData = ref([])
const recentActivities = ref([])

// Options
const timeRanges = [
  { label: '半年', value: '6months' },
  { label: '一年', value: 'year' },
  { label: '全部', value: 'all' }
]

// Fetch Vehicles
const loadVehicles = async () => {
  try {
    const res = await vehicleAPI.getList()
    if (res.success && res.data.length > 0) {
      vehicles.value = res.data
      selectedVehicleId.value = res.data[0].id
      loadDashboardData()
    }
  } catch (e) { console.error(e) }
}

// Fetch Dashboard Data
const loadDashboardData = async () => {
  if (!selectedVehicleId.value) return
  loading.value = true

  try {
    const params = { range: timeRange.value }
    const yearParams = { year: new Date().getFullYear() }

    console.log('加载仪表盘数据，车辆ID:', selectedVehicleId.value)
    console.log('参数:', { params, yearParams })

    const [ovRes, exRes, monRes, actRes] = await Promise.all([
      analyticsAPI.getOverview(selectedVehicleId.value).catch(e => {
        console.error('获取总览数据失败:', e)
        return { success: false, error: e }
      }),
      analyticsAPI.getExpenses(selectedVehicleId.value, params).catch(e => {
        console.error('获取费用数据失败:', e)
        return { success: false, error: e }
      }),
      analyticsAPI.getMonthlyTrend(selectedVehicleId.value, yearParams).catch(e => {
        console.error('获取月度趋势失败:', e)
        return { success: false, error: e }
      }),
      fetchRecentActivities(selectedVehicleId.value).catch(e => {
        console.error('获取最近活动失败:', e)
        return []
      })
    ])

    console.log('总览数据响应:', ovRes)
    console.log('费用数据响应:', exRes)
    console.log('月度趋势响应:', monRes)
    console.log('最近活动响应:', actRes)

    if (ovRes.success) overview.value = ovRes.data
    if (exRes.success) expenseData.value = exRes.data
    if (monRes.success) monthlyData.value = monRes.data
    recentActivities.value = actRes

  } catch (e) {
    console.error('加载仪表盘数据失败:', e)
  } finally {
    loading.value = false
  }
}

// Fetch Recent Activities (Manual combination of latest energy and maintenance)
const fetchRecentActivities = async (vehicleId) => {
  try {
    // Fetch last 5 energy logs and last 5 maintenance records
    const [energyRes, maintRes] = await Promise.all([
      energyAPI.getList({ vehicle_id: vehicleId, page: 1, limit: 5 }),
      maintenanceAPI.getList({ vehicle_id: vehicleId, page: 1, limit: 5 })
    ])

    console.log('能耗活动响应:', energyRes)
    console.log('保养活动响应:', maintRes)

    const activities = []

    if (energyRes.success) {
      // Handle nested data structure: { success, data: { logs, pagination } }
      const energyLogs = energyRes.data?.logs || energyRes.data || []
      energyLogs.forEach(log => {
        activities.push({
          type: 'energy',
          date: log.log_date || log.date,
          description: `里程: ${log.mileage}km`,
          cost: log.cost,
          timestamp: new Date(log.log_date || log.date).getTime()
        })
      })
    }

    if (maintRes.success) {
      const maintRecords = maintRes.data?.logs || maintRes.data || []
      maintRecords.forEach(rec => {
        activities.push({
          type: 'maintenance',
          date: rec.maintenance_date || rec.date,
          description: `${rec.type} - ${rec.description || '无描述'}`,
          cost: rec.cost,
          timestamp: new Date(rec.maintenance_date || rec.date).getTime()
        })
      })
    }

    // Sort by date desc and take top 5
    return activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5)

  } catch (e) {
    console.error('获取最近活动失败:', e)
    return []
  }
}

// Computed Props
const unit = computed(() => {
  const v = vehicles.value.find(ve => ve.id === selectedVehicleId.value)
  return v?.power_type === 'electric' ? 'kWh/100km' : 'L/100km'
})

// Charts Logic
const mainChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } }, // Custom legend used in template
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: '#f3f4f6', drawBorder: false },
      ticks: { color: '#9ca3af' }
    },
    x: {
      grid: { display: false },
      ticks: { color: '#9ca3af' }
    }
  }
}

const monthlyTrendData = computed(() => {
  return {
    labels: monthlyData.value.map(d => d.month + '月'),
    datasets: [
      {
        type: 'bar',
        label: '费用',
        backgroundColor: '#FFA726',
        data: monthlyData.value.map(d => d.total_cost),
        borderRadius: 4,
        barThickness: 20
      },
      {
        type: 'line',
        label: '里程',
        borderColor: '#3B82F6',
        borderWidth: 2,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#3B82F6',
        pointRadius: 4,
        data: monthlyData.value.map(d => d.total_mileage),
        yAxisID: 'y1',
        tension: 0.4
      }
    ]
  }
})

const doughnutOptions = {
  cutout: '70%',
  plugins: { legend: { display: false } }
}

const expenseChartData = computed(() => {
  const d = expenseData.value || {}
  return {
    labels: ['能耗', '保养', '配件', '其他'],
    datasets: [{
      data: [d.energy_cost || 0, d.maintenance_cost || 0, d.parts_cost || 0, d.other_cost || 0],
      backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'],
      borderWidth: 0
    }]
  }
})

const expenseList = computed(() => {
  const d = expenseData.value || {}
  return [
    { label: '能耗花费', value: d.energy_cost || 0, color: '#3B82F6' },
    { label: '保养维修', value: d.maintenance_cost || 0, color: '#10B981' },
    { label: '配件更换', value: d.parts_cost || 0, color: '#F59E0B' },
    { label: '其他费用', value: d.other_cost || 0, color: '#8B5CF6' }
  ]
})

// Formatters
const formatNumber = (n) => n ? n.toLocaleString() : 0
const formatCurrency = (v) => v ? '¥' + v.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '¥0.00'
const formatDate = (d) => d ? new Date(d).toLocaleDateString() : ''
const getActivityLabel = (t) => t === 'energy' ? '能耗' : '保养'
const getActivitySeverity = (t) => t === 'energy' ? 'info' : 'warning'

// Watch for vehicle or time range changes
watch(selectedVehicleId, (newVal) => {
  console.log('车辆选择变更:', newVal)
  if (newVal) {
    loadDashboardData()
  }
})

watch(timeRange, (newVal) => {
  console.log('时间范围变更:', newVal)
  if (selectedVehicleId.value) {
    loadDashboardData()
  }
})

onMounted(() => {
  loadVehicles()
})
</script>

<style scoped>
/* Translucent chart background trick if needed, but PrimeVue cards are white now */
</style>
