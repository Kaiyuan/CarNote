<!--
  首页 - 数据分析仪表盘
-->

<template>
  <div class="home-page">
    <PageHeader eyebrow="Overview" :live="true" title="车辆概览"
      :description="`欢迎回来，${displayName}。在这里查看车辆里程、费用与保养状态。`">
      <template #actions>
        <!-- VIP: 多车对比开关 -->
        <div v-if="isAdvanced" class="compare-toggle">
          <Checkbox v-model="comparisonMode" :binary="true" inputId="compMode" />
          <label for="compMode">多车对比</label>
        </div>

        <Dropdown v-if="!comparisonMode" v-model="selectedVehicleId" :options="vehicles" optionLabel="plate_number"
          optionValue="id" placeholder="选择车辆" class="vehicle-select" />
        <MultiSelect v-else v-model="selectedVehicleIds" :options="vehicles" optionLabel="plate_number"
          optionValue="id" placeholder="选择对比车辆" class="vehicle-select" display="chip" />

        <Button label="记一笔" icon="pi pi-plus" @click="router.push('/energy?action=add')" />
      </template>
    </PageHeader>

    <!-- 时间范围工具栏 -->
    <div class="home-toolbar">
      <div class="flex align-items-center gap-2 flex-wrap">
        <SelectButton v-model="timeRange" :options="filteredTimeRanges" optionLabel="label" optionValue="value"
          :allowEmpty="false" class="hidden sm:flex" />
        <Dropdown v-model="timeRange" :options="filteredTimeRanges" optionLabel="label" optionValue="value"
          class="sm:hidden" />
      </div>
      <div class="flex align-items-center gap-2 flex-wrap">
        <Calendar v-if="timeRange === 'custom'" v-model="customDates" selectionMode="range" :manualInput="false"
          placeholder="选择日期范围" showIcon />
        <span class="home-updated"><i class="pi pi-verified"></i> 数据实时同步</span>
      </div>
    </div>

    <!-- 加载中状态 -->
    <div v-if="loading && !selectedVehicleId && !comparisonMode" class="cn-card">
      <div class="flex justify-content-center align-items-center py-8">
        <ProgressSpinner />
      </div>
    </div>

    <!-- 空状态提示 -->
    <div v-else-if="!selectedVehicleId && !loading && !comparisonMode" class="cn-card cn-empty">
      <i class="pi pi-car"></i>
      <div class="text-xl font-semibold text-900 mb-2">开始您的车辆管理之旅</div>
      <div class="text-600 mb-4">请先添加一辆车来查看分析数据</div>
      <Button label="添加车辆" icon="pi pi-plus" @click="router.push('/vehicles')" />
    </div>

    <!-- 仪表盘内容 -->
    <div v-else>
      <!-- 核心指标卡片 -->
      <div class="cn-stat-grid">
        <div class="cn-stat-card">
          <div class="cn-stat-top">
            <div>
              <div class="cn-stat-label">总里程</div>
              <div class="cn-stat-value">{{ formatNumber(overview.total_mileage) }}<small>km</small></div>
            </div>
            <span class="cn-stat-icon"><i class="pi pi-compass"></i></span>
          </div>
          <div class="cn-stat-footer">
            <span class="cn-trend neutral">累计行驶</span>
            <span class="cn-stat-hint">{{ rangeLabel }}</span>
          </div>
        </div>

        <div class="cn-stat-card">
          <div class="cn-stat-top">
            <div>
              <div class="cn-stat-label">总花费</div>
              <div class="cn-stat-value">{{ formatCurrency(overview.total_cost) }}</div>
            </div>
            <span class="cn-stat-icon"><i class="pi pi-wallet"></i></span>
          </div>
          <div class="cn-stat-footer">
            <span v-if="overview.avg_cost_per_km" class="cn-trend up">
              {{ formatCurrency(overview.avg_cost_per_km) }}/km
            </span>
            <span v-else class="cn-trend neutral">暂无数据</span>
            <span class="cn-stat-hint">平均用车成本</span>
          </div>
        </div>

        <div class="cn-stat-card">
          <div class="cn-stat-top">
            <div>
              <div class="cn-stat-label">平均能耗</div>
              <div class="cn-stat-value">
                {{ overview.avg_consumption ? Number(overview.avg_consumption).toFixed(1) : '--' }}
                <small>{{ unit }}</small>
              </div>
            </div>
            <span class="cn-stat-icon"><i class="pi pi-bolt"></i></span>
          </div>
          <div class="cn-stat-footer">
            <span class="cn-trend neutral">能效分析</span>
            <span class="cn-stat-hint">{{ unit === 'kWh/100km' ? '纯电能耗' : '燃油能耗' }}</span>
          </div>
        </div>

        <div class="cn-stat-card">
          <div class="cn-stat-top">
            <div>
              <div class="cn-stat-label">上次保养</div>
              <div class="cn-stat-value">
                {{ overview.last_maintenance_date ? formatDate(overview.last_maintenance_date) : '无记录' }}
              </div>
            </div>
            <span class="cn-stat-icon"><i class="pi pi-wrench"></i></span>
          </div>
          <div class="cn-stat-footer">
            <span v-if="overview.last_maintenance_days" class="cn-trend up">
              {{ overview.last_maintenance_days }} 天前
            </span>
            <span v-else class="cn-trend neutral">保养状态</span>
            <span class="cn-stat-hint">保持定期保养</span>
          </div>
        </div>
      </div>

      <!-- 主图表区域 -->
      <div class="home-chart-grid">
        <div class="cn-card p-4">
          <div class="cn-section-header">
            <div>
              <h2 class="cn-section-title">用车趋势</h2>
              <p class="cn-section-subtitle">按月度统计的行驶里程与用车费用</p>
            </div>
            <div class="cn-legend">
              <span class="cn-legend-item"><span class="cn-legend-dot" style="background:#101828"></span>里程</span>
              <span class="cn-legend-item"><span class="cn-legend-dot" style="background:#cbd5e1"></span>费用</span>
            </div>
          </div>
          <Chart type="bar" :data="monthlyTrendData" :options="mainChartOptions" class="home-main-chart" />
        </div>

        <!-- 费用构成 -->
        <div class="cn-card p-4 flex flex-column">
          <div class="cn-section-header">
            <div>
              <h2 class="cn-section-title">费用构成</h2>
              <p class="cn-section-subtitle">当前周期内的支出分布</p>
            </div>
            <Button icon="pi pi-ellipsis-h" text rounded severity="secondary" aria-label="更多" />
          </div>

          <div class="cn-mix-total">
            <div>
              <div class="cn-stat-label">总支出</div>
              <div class="cn-mix-value">{{ formatCurrency(expenseTotal) }}</div>
            </div>
            <Tag :value="`${expenseList.length} 类`" severity="secondary" rounded />
          </div>

          <div class="cn-mix-bar">
            <template v-for="item in expenseList" :key="item.label">
              <div v-if="item.value > 0" class="cn-mix-segment"
                :style="{ width: item.percent + '%', backgroundColor: item.color }"></div>
            </template>
          </div>

          <div class="cn-mix-list">
            <div v-for="item in expenseList" :key="item.label" class="cn-mix-row">
              <div class="cn-mix-row-label">
                <span class="cn-legend-dot" :style="{ backgroundColor: item.color }"></span>
                {{ item.label }}
              </div>
              <div>
                <span class="cn-mix-row-value">{{ formatCurrency(item.value) }}</span>
                <span class="cn-mix-row-share">{{ item.percent }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 最近活动 + 车辆信息 -->
      <div class="home-bottom-grid">
        <div class="cn-card p-0">
          <div class="cn-section-header home-table-header">
            <div>
              <h2 class="cn-section-title">最近活动</h2>
              <p class="cn-section-subtitle">最新的补能、保养与配件记录</p>
            </div>
            <Button label="查看全部" icon="pi pi-arrow-right" iconPos="right" text size="small"
              @click="router.push('/energy')" />
          </div>

          <DataTable :value="recentActivities" :rows="5" responsiveLayout="stack" breakpoint="960px"
            class="home-table">
            <Column field="type" header="类型" style="width: 7rem">
              <template #body="slotProps">
                <Tag :severity="getActivitySeverity(slotProps.data.type)"
                  :value="getActivityLabel(slotProps.data.type)" />
              </template>
            </Column>
            <Column field="date" header="日期" style="width: 8rem">
              <template #body="slotProps">{{ formatDate(slotProps.data.date) }}</template>
            </Column>
            <Column field="description" header="描述"></Column>
            <Column field="cost" header="金额" alignFrozen="right" frozen style="width: 9rem">
              <template #body="slotProps">
                <span class="font-semibold text-900">{{ formatCurrency(slotProps.data.cost) }}</span>
              </template>
            </Column>
            <template #empty>
              <div class="cn-empty" style="padding: 2.5rem 1rem">
                <i class="pi pi-inbox"></i>
                <span>暂无最近活动</span>
              </div>
            </template>
          </DataTable>
        </div>

        <div class="cn-card p-4 flex flex-column">
          <div class="cn-section-header">
            <div>
              <h2 class="cn-section-title">{{ comparisonMode ? '对比车辆' : '车辆信息' }}</h2>
              <p class="cn-section-subtitle">{{ comparisonMode ? '当前参与对比的车辆' : '所选车辆的基本资料' }}</p>
            </div>
            <span class="cn-stat-icon"><i class="pi pi-car"></i></span>
          </div>

          <template v-if="comparisonMode">
            <div class="cn-info-list">
              <div v-for="vehicle in comparedVehicles" :key="vehicle.id" class="cn-info-row">
                <span class="cn-info-label">{{ vehicle.plate_number }}</span>
                <span class="cn-info-value">{{ vehicle.brand || vehicle.model || '车辆' }}</span>
              </div>
            </div>
          </template>

          <template v-else-if="selectedVehicle">
            <div class="vehicle-hero">
              <div class="vehicle-plate">{{ selectedVehicle.plate_number }}</div>
              <Tag :value="getPowerTypeLabel(selectedVehicle.power_type)"
                :severity="getPowerSeverity(selectedVehicle.power_type)" />
            </div>

            <div class="cn-info-list">
              <div class="cn-info-row">
                <span class="cn-info-label">品牌 / 型号</span>
                <span class="cn-info-value">{{ [selectedVehicle.brand, selectedVehicle.model].filter(Boolean).join(' ') || '未填写' }}</span>
              </div>
              <div class="cn-info-row">
                <span class="cn-info-label">当前里程</span>
                <span class="cn-info-value">{{ formatNumber(selectedVehicle.current_mileage) }} km</span>
              </div>
              <div class="cn-info-row">
                <span class="cn-info-label">购车时间</span>
                <span class="cn-info-value">{{ selectedVehicle.purchase_date ? formatDate(selectedVehicle.purchase_date) : '未填写' }}</span>
              </div>
              <div class="cn-info-row">
                <span class="cn-info-label">年度花费</span>
                <span class="cn-info-value">{{ formatCurrency(overview.total_cost) }}</span>
              </div>
            </div>
          </template>

          <Button label="查看车辆详情" icon="pi pi-arrow-right" iconPos="right" outlined class="w-full mt-auto"
            @click="router.push('/vehicles')" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSiteStore } from '../utils/siteStore'
import { vehicleAPI, analyticsAPI, energyAPI, maintenanceAPI } from '../api'
import logger from '../utils/logger'
import { formatDate as fmtDate } from '../utils/date'
import Chart from 'primevue/chart'
import PageHeader from '../components/PageHeader.vue'

const router = useRouter()
const siteStore = useSiteStore()
const currentUser = ref(JSON.parse(localStorage.getItem('currentUser') || '{}'))

// State
const vehicles = ref([])
const selectedVehicleId = ref(null)
const selectedVehicleIds = ref([])
const timeRange = ref('year')
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

const comparisonData = ref([])

const displayName = computed(() => currentUser.value?.nickname || currentUser.value?.username || '车主')

const rangeLabel = computed(() => {
  const labels = { '6months': '近半年', 'year': '近一年', 'all': '全部时间', 'custom': '自定义范围' }
  return labels[timeRange.value] || '累计统计'
})

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

    if (timeRange.value === 'custom' && customDates.value && customDates.value[0] && customDates.value[1]) {
      params.start_date = customDates.value[0].toISOString().split('T')[0]
      params.end_date = customDates.value[1].toISOString().split('T')[0]
      params.range = 'custom'
    }

    if (comparisonMode.value) {
      const vehiclesToCompare = selectedVehicleIds.value.length > 0
        ? vehicles.value.filter(v => selectedVehicleIds.value.includes(v.id))
        : vehicles.value

      if (vehiclesToCompare.length === 0) {
        loading.value = false
        return
      }

      const allData = await Promise.all(vehiclesToCompare.map(async (v) => {
        const [ov, ex, mon] = await Promise.all([
          analyticsAPI.getOverview(v.id, params).catch(() => ({ success: false })),
          analyticsAPI.getExpenses(v.id, params).catch(() => ({ success: false })),
          analyticsAPI.getMonthlyTrend(v.id, params).catch(() => ({ success: false }))
        ])
        return { vehicle: v, overview: ov.data, expenses: ex.data, monthly: mon.data }
      }))

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

const fetchRecentActivities = async (vehicleId) => {
  try {
    const [energyRes, maintRes] = await Promise.all([
      energyAPI.getList({ vehicle_id: vehicleId, page: 1, limit: 5 }),
      maintenanceAPI.getList({ vehicle_id: vehicleId, page: 1, limit: 5 })
    ])

    const activities = []

    if (energyRes.success) {
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

    return activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5)
  } catch (e) {
    logger.error('获取最近活动失败:', e)
    return []
  }
}

// Computed Props
const selectedVehicle = computed(() => vehicles.value.find(ve => ve.id === selectedVehicleId.value) || null)

const comparedVehicles = computed(() => {
  if (selectedVehicleIds.value.length > 0) {
    return vehicles.value.filter(v => selectedVehicleIds.value.includes(v.id))
  }
  return vehicles.value
})

const unit = computed(() => {
  const v = selectedVehicle.value
  return v?.power_type === 'electric' ? 'kWh/100km' : 'L/100km'
})

// Charts Logic
const mainChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#101828',
      padding: 10,
      cornerRadius: 8,
      titleFont: { size: 12 },
      bodyFont: { size: 12 }
    }
  },
  scales: {
    y: {
      type: 'linear',
      display: true,
      position: 'left',
      beginAtZero: true,
      border: { display: false },
      grid: { color: '#f1f5f9', drawTicks: false },
      ticks: { color: '#98a2b3', padding: 8, callback: (value) => '¥' + value }
    },
    y1: {
      type: 'linear',
      display: true,
      position: 'right',
      beginAtZero: true,
      border: { display: false },
      grid: { drawOnChartArea: false },
      ticks: { color: '#98a2b3', padding: 8, callback: (value) => value + ' km' }
    },
    x: {
      border: { display: false },
      grid: { display: false },
      ticks: { color: '#98a2b3', padding: 6 }
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
        backgroundColor: '#e2e8f0',
        hoverBackgroundColor: '#cbd5e1',
        data: data.map(d => d.total_cost),
        borderRadius: 6,
        barPercentage: 0.55,
        categoryPercentage: 0.7,
        yAxisID: 'y'
      },
      {
        type: 'line',
        label: '里程',
        borderColor: '#101828',
        borderWidth: 2,
        pointBackgroundColor: '#101828',
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: false,
        tension: 0.38,
        data: data.map(d => d.total_mileage || 0),
        yAxisID: 'y1'
      }
    ]
  }
})

const expenseColorList = ['#101828', '#475467', '#98a2b3', '#d0d5dd']

const expenseList = computed(() => {
  const s = expenseData.value?.summary || {}
  const items = [
    { label: '补能费用', value: s.energy || 0 },
    { label: '保养维修', value: s.maintenance || 0 },
    { label: '配件更换', value: s.parts || 0 },
    { label: '保险费用', value: s.insurance || 0 }
  ]
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0)
  return items.map((item, index) => ({
    ...item,
    color: expenseColorList[index],
    percent: total > 0 ? Math.round((Number(item.value) / total) * 100) : 0
  }))
})

const expenseTotal = computed(() => {
  return expenseList.value.reduce((sum, item) => sum + Number(item.value || 0), 0) || overview.value.total_cost || 0
})

// Formatters
const formatNumber = (n) => n ? Number(n).toLocaleString() : 0
const formatCurrency = (v) => v ? '¥' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '¥0.00'
const formatDate = (date) => fmtDate(date, '未填写')
const getActivityLabel = (t) => t === 'energy' ? '能耗' : '保养'
const getActivitySeverity = (t) => t === 'energy' ? 'info' : 'warning'
const getPowerTypeLabel = (type) => ({ fuel: '燃油', electric: '纯电', hybrid: '混动' }[type] || type)
const getPowerSeverity = (type) => ({ fuel: 'warning', electric: 'info', hybrid: 'success' }[type] || 'secondary')

watch(selectedVehicleId, (newVal) => {
  if (newVal) {
    loadDashboardData()
  }
})

watch(timeRange, (newVal) => {
  if (selectedVehicleId.value) {
    loadDashboardData()
  }
})

watch(comparisonMode, (newVal) => {
  if (newVal && vehicles.value.length > 0) {
    selectedVehicleIds.value = vehicles.value.map(v => v.id)
  }
  loadDashboardData()
})

watch(selectedVehicleIds, () => {
  if (comparisonMode.value) {
    loadDashboardData()
  }
})

watch(customDates, (newVal) => {
  if (newVal && newVal[0] && newVal[1]) {
    loadDashboardData()
  }
})

onMounted(async () => {
  if (typeof __HAS_VIP__ !== 'undefined' && __HAS_VIP__) {
    try {
      const { useVipStore } = await import('@vip/utils/vipStore')
      vipStore.value = useVipStore()
      vipStore.value.fetchStatus()
    } catch (e) {
      logger.error('[VIP] 加载 Store 失败:', e)
    }
  }
  loadVehicles()
})
</script>

<style scoped>
.home-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 0.55rem 0.65rem;
  margin-bottom: 1rem;
  background: var(--cn-card);
  border: 1px solid var(--cn-border);
  border-radius: 12px;
}

.home-updated {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--cn-subtle);
  font-size: 0.75rem;
  padding-right: 0.35rem;
}

.home-updated i {
  color: var(--cn-success);
}

.compare-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--cn-border);
  border-radius: 10px;
  background: var(--cn-card);
}

.compare-toggle label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--cn-muted);
    cursor: pointer;
}

.vehicle-select {
  min-width: 10rem;
}

.home-chart-grid {
  display: grid;
  grid-template-columns: minmax(0, 2.1fr) minmax(300px, 1fr);
  gap: 1rem;
  margin-bottom: 1rem;
}

.home-main-chart {
  height: 310px;
}

.home-bottom-grid {
  display: grid;
  grid-template-columns: minmax(0, 2.1fr) minmax(300px, 1fr);
  gap: 1rem;
}

.home-table-header {
  padding: 1.25rem 1.25rem 0.9rem;
  margin-bottom: 0;
}

.home-table {
  border: 0 !important;
  border-top: 1px solid var(--cn-border) !important;
  border-radius: 0 0 var(--cn-radius) var(--cn-radius) !important;
  box-shadow: none !important;
}

.home-table :deep(.p-datatable-thead > tr > th) {
  padding-left: 1.25rem;
  padding-right: 1.25rem;
}

.home-table :deep(.p-datatable-tbody > tr > td) {
  padding-left: 1.25rem;
  padding-right: 1.25rem;
}

.vehicle-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
  margin-bottom: 0.85rem;
  border-radius: 12px;
  background: var(--surface-50);
  border: 1px solid var(--cn-border);
}

.vehicle-plate {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--cn-text);
}

@media screen and (max-width: 1100px) {

  .home-chart-grid,
  .home-bottom-grid {
    grid-template-columns: 1fr;
  }
}

@media screen and (max-width: 640px) {
  .vehicle-select {
    min-width: 0;
    width: 100%;
  }

  .home-toolbar {
    padding: 0.55rem;
  }

  .home-main-chart {
    height: 260px;
  }
}
</style>
