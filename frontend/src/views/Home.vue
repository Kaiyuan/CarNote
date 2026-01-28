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
      <div class="flex gap-2 align-items-center w-full md:w-auto overflow-hidden">
        <!-- VIP: 多车对比开关 -->
        <div v-if="isAdvanced" class="flex align-items-center bg-primary-50 px-3 py-2 border-round-xl mr-2">
          <Checkbox v-model="comparisonMode" :binary="true" inputId="compMode" />
          <label for="compMode"
            class="ml-2 text-primary font-bold text-sm cursor-pointer whitespace-nowrap">多车对比</label>
        </div>

        <Button label="记一笔" icon="pi pi-plus" class="p-button-primary flex-shrink-0"
          @click="router.push('/energy?action=add')" />

        <Dropdown v-if="!comparisonMode" v-model="selectedVehicleId" :options="vehicles" optionLabel="plate_number"
          optionValue="id" placeholder="车辆" class="flex-auto md:w-14rem min-w-0" />
        <div v-else class="flex-auto md:w-14rem bg-white border-round border-1 border-300 px-3 py-2 text-sm text-600">
          对比模式: 全车辆</div>

        <!-- 桌面端显示范围选择器 -->
        <SelectButton v-model="timeRange" :options="filteredTimeRanges" optionLabel="label" optionValue="value"
          :allowEmpty="false" class="hidden lg:flex flex-shrink-0" />
        <!-- 移动端显示范围下拉框 -->
        <Dropdown v-model="timeRange" :options="filteredTimeRanges" optionLabel="label" optionValue="value"
          placeholder="范围" class="flex-auto lg:hidden min-w-0" />
      </div>
    </div>

    <!-- VIP: 自定义时间范围日期选择 -->
    <div v-if="timeRange === 'custom'" class="flex gap-2 mb-4 animate-fadein">
      <Calendar v-model="customDates" selectionMode="range" :manualInput="false" placeholder="选择日期范围"
        class="w-full md:w-20rem" showIcon />
    </div>

    <!-- 加载中状态 -->
    <div v-if="loading && !selectedVehicleId && !comparisonMode"
      class="flex justify-content-center align-items-center py-8">
      <ProgressSpinner />
    </div>

    <!-- 空状态提示 -->
    <div v-else-if="!selectedVehicleId && !loading && !comparisonMode" class="text-center py-8">
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
          <div class="flex justify-content-center align-items-center relative" style="height: 12rem">
            <Chart type="doughnut" :data="expenseChartData" :options="pieOptions" class="expense-chart" />
            <!-- Center Text Overlay -->
            <div class="absolute flex flex-column align-items-center justify-content-center pointer-events-none">
              <span class="text-xs text-500">总计</span>
              <span class="text-lg font-bold text-900">{{ formatCurrency(overview.total_cost) }}</span>
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
          <DataTable :value="recentActivities" :rows="5" responsiveLayout="stack" breakpoint="960px">
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
import { useSiteStore } from '../utils/siteStore'
import { vehicleAPI, analyticsAPI, energyAPI, maintenanceAPI } from '../api' // Added energy/maintenance APIs
import logger from '../utils/logger'
import Chart from 'primevue/chart'

const router = useRouter()
const siteStore = useSiteStore()
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

// --- VIP 相关逻辑 ---
const comparisonMode = ref(false)
const customDates = ref(null)
const vipStore = ref(null)

const isAdvanced = computed(() => {
  if (!siteStore.state.hasVip || !vipStore.value) return false
  return ['advanced', 'premium'].includes(vipStore.value.state.status?.tier)
})

const filteredTimeRanges = computed(() => {
  if (siteStore.state.hasVip && isAdvanced.value) {
    return [...timeRanges, { label: '自定义', value: 'custom' }]
  }
  return timeRanges
})

// 多车对比数据存储
const comparisonData = ref([])

// ------------------

// Fetch Vehicles
const loadVehicles = async () => {
  loading.value = true
  try {
    const res = await vehicleAPI.getList()
    if (res.success && res.data.length > 0) {
      vehicles.value = res.data
      selectedVehicleId.value = res.data[0].id
    }
  } catch (e) {
    logger.error('加载车辆失败:', e)
  } finally {
    loading.value = false
  }
}

// Fetch Dashboard Data
const loadDashboardData = async () => {
  if (!selectedVehicleId.value && !comparisonMode.value) return
  loading.value = true

  try {
    const params = { range: timeRange.value }

    // 如果是自定义时间范围
    if (timeRange.value === 'custom' && customDates.value && customDates.value[0] && customDates.value[1]) {
      params.start_date = customDates.value[0].toISOString().split('T')[0]
      params.end_date = customDates.value[1].toISOString().split('T')[0]
      params.range = 'custom'
    }

    if (comparisonMode.value) {
      // 对比模式：加载所有车辆的数据并聚合
      const allData = await Promise.all(vehicles.value.map(async (v) => {
        const [ov, ex, mon] = await Promise.all([
          analyticsAPI.getOverview(v.id, params).catch(() => ({ success: false })),
          analyticsAPI.getExpenses(v.id, params).catch(() => ({ success: false })),
          analyticsAPI.getMonthlyTrend(v.id, params).catch(() => ({ success: false }))
        ])
        return { vehicle: v, overview: ov.data, expenses: ex.data, monthly: mon.data }
      }))

      // 简单聚合总览数据
      const summary = { total_mileage: 0, total_cost: 0, avg_consumption: 0, count: 0 }
      allData.forEach(d => {
        if (d.overview) {
          summary.total_mileage += (d.overview.total_mileage || 0)
          summary.total_cost += (d.overview.total_cost || 0)
          summary.avg_consumption += (d.overview.avg_consumption || 0)
          summary.count++
        }
      })
      overview.value = {
        total_mileage: summary.total_mileage,
        total_cost: summary.total_cost,
        avg_consumption: summary.count > 0 ? summary.avg_consumption / summary.count : 0
      }
      loading.value = false
      return
    }

    const [ovRes, exRes, monRes, actRes] = await Promise.all([
      analyticsAPI.getOverview(selectedVehicleId.value, params).catch(e => {
        logger.error('获取总览数据失败:', e)
        return { success: false, error: e }
      }),
      analyticsAPI.getExpenses(selectedVehicleId.value, params).catch(e => {
        logger.error('获取费用数据失败:', e)
        return { success: false, error: e }
      }),
      analyticsAPI.getMonthlyTrend(selectedVehicleId.value, params).catch(e => {
        logger.error('获取月度趋势失败:', e)
        return { success: false, error: e }
      }),
      fetchRecentActivities(selectedVehicleId.value).catch(e => {
        logger.error('获取最近活动失败:', e)
        return []
      })
    ])

    logger.debug('总览数据响应:', ovRes)
    logger.debug('费用数据响应:', exRes)
    logger.debug('月度趋势响应:', monRes)
    logger.debug('最近活动响应:', actRes)

    if (ovRes.success) overview.value = ovRes.data
    if (exRes.success) expenseData.value = exRes.data
    if (monRes.success) monthlyData.value = monRes.data
    recentActivities.value = actRes

  } catch (e) {
    logger.error('加载仪表盘数据失败:', e)
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
    logger.error('获取最近活动失败:', e)
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
      type: 'linear',
      display: true,
      position: 'left',
      beginAtZero: true,
      grid: { color: '#f3f4f6', drawBorder: false },
      ticks: { color: '#9ca3af', callback: (value) => '¥' + value }
    },
    y1: {
      type: 'linear',
      display: true,
      position: 'right',
      beginAtZero: true,
      grid: { drawOnChartArea: false },
      ticks: { color: '#9ca3af', callback: (value) => value + ' km' }
    },
    x: {
      grid: { display: false },
      ticks: { color: '#9ca3af' }
    }
  }
}

const monthlyTrendData = computed(() => {
  const data = Array.isArray(monthlyData.value) ? monthlyData.value : []
  return {
    labels: data.map(d => d.month + '月'),
    datasets: [
      {
        type: 'bar',
        label: '费用',
        backgroundColor: '#FFA726',
        data: data.map(d => d.total_cost),
        borderRadius: 4,
        yAxisID: 'y'
      },
      {
        type: 'line',
        label: '里程',
        borderColor: '#3B82F6',
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        data: data.map(d => d.total_mileage || 0),
        yAxisID: 'y1'
      }
    ]
  }
})

const pieOptions = {
  cutout: '70%',
  plugins: {
    legend: { display: false }
  }
}

const expenseChartData = computed(() => {
  const s = expenseData.value?.summary || {}
  return {
    labels: ['补能费用', '保养维修', '配件更换'],
    datasets: [{
      data: [s.energy || 0, s.maintenance || 0, s.parts || 0],
      backgroundColor: ['#3B82F6', '#10B981', '#F59E0B'],
      borderWidth: 0
    }]
  }
})

const expenseList = computed(() => {
  const s = expenseData.value?.summary || {}
  return [
    { label: '补能费用', value: s.energy || 0, color: '#3B82F6' },
    { label: '保养维修', value: s.maintenance || 0, color: '#10B981' },
    { label: '配件更换', value: s.parts || 0, color: '#F59E0B' }
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
  logger.debug('车辆选择变更:', newVal)
  if (newVal) {
    loadDashboardData()
  }
})

watch(timeRange, (newVal) => {
  logger.debug('时间范围变更:', newVal)
  if (selectedVehicleId.value) {
    loadDashboardData()
  }
})

watch(comparisonMode, () => {
  loadDashboardData()
})

watch(customDates, (newVal) => {
  if (newVal && newVal[0] && newVal[1]) {
    loadDashboardData()
  }
})

onMounted(async () => {
  if (typeof __HAS_VIP__ !== 'undefined' && __HAS_VIP__) {
    try {
      const { useVipStore } = await import('@vip/utils/vipStore');
      vipStore.value = useVipStore();
      vipStore.value.fetchStatus();
    } catch (e) {
      logger.error('[VIP] 加载 Store 失败:', e);
    }
  }
  loadVehicles()
})
</script>

<style scoped>
.expense-chart {
  width: 50% !important;
}
</style>
