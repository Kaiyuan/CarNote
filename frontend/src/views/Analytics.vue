<!--
  数据分析页面
-->

<template>
    <div>
        <PageHeader eyebrow="Insights" title="数据分析"
            description="从能耗、费用与里程趋势中发现用车规律，做出更明智的决策。" />

        <div class="cn-filter-bar">
            <div style="width: 16rem; max-width: 100%">
                <Dropdown v-model="selectedVehicleId" :options="vehicles" optionLabel="plate_number" optionValue="id"
                    placeholder="选择车辆" class="w-full" @change="loadAllData" />
            </div>
            <div style="width: 12rem; max-width: 100%">
                <Dropdown v-model="timeRange" :options="timeRanges" optionLabel="label" optionValue="value"
                    placeholder="时间范围" class="w-full" @change="loadAllData" />
            </div>
            <div class="analytics-check">
                <Checkbox v-model="excludeLent" :binary="true" inputId="exclude_lent" @change="loadAllData" />
                <label for="exclude_lent">排除借出记录</label>
            </div>
        </div>

        <div v-if="!selectedVehicleId" class="cn-card cn-empty">
            <i class="pi pi-chart-bar"></i>
            <div class="text-lg font-semibold text-900 mb-1">暂无可分析的数据</div>
            <div class="text-600">请选择一辆车以查看分析数据</div>
        </div>

        <div v-else>
            <!-- 概览卡片 -->
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
                        <span v-if="overview.avg_cost_per_km" class="cn-trend up">{{ formatCurrency(overview.avg_cost_per_km) }}/km</span>
                        <span v-else class="cn-trend neutral">暂无数据</span>
                        <span class="cn-stat-hint">平均用车成本</span>
                    </div>
                </div>

                <div class="cn-stat-card">
                    <div class="cn-stat-top">
                        <div>
                            <div class="cn-stat-label">平均能耗</div>
                            <div class="cn-stat-value">
                                {{ overview.avg_consumption ? overview.avg_consumption.toFixed(2) : '--' }}
                                <small>{{ unit }}</small>
                            </div>
                        </div>
                        <span class="cn-stat-icon"><i class="pi pi-bolt"></i></span>
                    </div>
                    <div class="cn-stat-footer">
                        <span class="cn-trend neutral">能效分析</span>
                        <span v-if="overview.lent && overview.lent.total_records > 0" class="cn-stat-hint">
                            {{ excludeLent ? '已排除借出记录' : `含借出 ${overview.lent.total_records} 笔` }}
                        </span>
                    </div>
                </div>

                <div class="cn-stat-card">
                    <div class="cn-stat-top">
                        <div>
                            <div class="cn-stat-label">最近保养</div>
                            <div class="cn-stat-value">
                                {{ overview.last_maintenance_date ? formatDate(overview.last_maintenance_date) : '无记录' }}
                            </div>
                        </div>
                        <span class="cn-stat-icon"><i class="pi pi-wrench"></i></span>
                    </div>
                    <div class="cn-stat-footer">
                        <span v-if="overview.last_maintenance_days" class="cn-trend up">{{ overview.last_maintenance_days }} 天前</span>
                        <span v-else class="cn-trend neutral">保养状态</span>
                    </div>
                </div>
            </div>

            <!-- 图表区域 -->
            <div class="analytics-grid">
                <div class="cn-card p-4">
                    <div class="cn-section-header">
                        <div>
                            <h2 class="cn-section-title">能耗趋势</h2>
                            <p class="cn-section-subtitle">每次补能后的百公里能耗变化</p>
                        </div>
                    </div>
                    <Chart type="line" :data="consumptionChartData" :options="chartOptions" class="analytics-chart" />
                </div>

                <div class="cn-card p-4">
                    <div class="cn-section-header">
                        <div>
                            <h2 class="cn-section-title">费用构成</h2>
                            <p class="cn-section-subtitle">所选周期内的支出分类</p>
                        </div>
                    </div>
                    <div class="flex justify-content-center">
                        <Chart type="doughnut" :data="expenseChartData" :options="doughnutOptions" class="analytics-doughnut" />
                    </div>
                </div>
            </div>

            <div class="cn-card p-4">
                <div class="cn-section-header">
                    <div>
                        <h2 class="cn-section-title">月度费用统计</h2>
                        <p class="cn-section-subtitle">按月份对比费用与行驶里程</p>
                    </div>
                </div>
                <Chart type="bar" :data="monthlyTrendData" :options="chartOptions" class="analytics-chart" />
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { vehicleAPI, analyticsAPI } from '../api'
import PageHeader from '../components/PageHeader.vue'
import logger from '../utils/logger'
import { formatDate as fmtDate } from '../utils/date'
import Chart from 'primevue/chart'

// 状态
const vehicles = ref([])
const selectedVehicleId = ref(null)
const timeRange = ref('year')
const excludeLent = ref(false)
const overview = ref({})
const consumptionData = ref([])
const expenseData = ref({})
const monthlyData = ref([])

const timeRanges = [
    { label: '最近一个月', value: 'month' },
    { label: '最近半年', value: '6months' },
    { label: '最近一年', value: 'year' },
    { label: '全部', value: 'all' }
]

// 获取车辆列表
const loadVehicles = async () => {
    try {
        const res = await vehicleAPI.getList()
        if (res.success) {
            vehicles.value = res.data
            if (vehicles.value.length > 0) {
                selectedVehicleId.value = vehicles.value[0].id
                loadAllData()
            }
        }
    } catch (error) {
        logger.error('Failed to load vehicles', error)
    }
}

// 加载所有分析数据
const loadAllData = async () => {
    if (!selectedVehicleId.value) return

    try {
        const params = {
            range: timeRange.value,
            exclude_lent: excludeLent.value ? 'true' : undefined
        }

        // 并行请求
        const [overviewRes, consumptionRes, expenseRes, monthlyRes] = await Promise.all([
            analyticsAPI.getOverview(selectedVehicleId.value, params),
            analyticsAPI.getConsumption(selectedVehicleId.value, params),
            analyticsAPI.getExpenses(selectedVehicleId.value, params),
            analyticsAPI.getMonthlyTrend(selectedVehicleId.value, params)
        ])

        if (overviewRes.success) overview.value = overviewRes.data
        if (consumptionRes.success) consumptionData.value = consumptionRes.data
        if (expenseRes.success) expenseData.value = expenseRes.data
        if (monthlyRes.success) monthlyData.value = monthlyRes.data

    } catch (error) {
        logger.error('Failed to load analytics', error)
    }
}

// 计算属性：当前车辆单位
const unit = computed(() => {
    const v = vehicles.value.find(ve => ve.id === selectedVehicleId.value)
    if (!v) return ''
    return v.power_type === 'electric' ? 'kWh/100km' : 'L/100km'
})

// 图表配置
const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'bottom',
            labels: { color: '#667085', usePointStyle: true, boxWidth: 8, padding: 18 }
        }
    },
    scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: '#98a2b3' } },
        y: { grid: { color: '#f1f5f9' }, border: { display: false }, ticks: { color: '#98a2b3' } }
    }
}

const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
        legend: {
            position: 'bottom',
            labels: { color: '#667085', usePointStyle: true, boxWidth: 8, padding: 16 }
        }
    }
}

// 能耗趋势图数据
const consumptionChartData = computed(() => {
    return {
        labels: consumptionData.value.map(d => d.date),
        datasets: [
            {
                label: `平均能耗 (${unit.value})`,
                data: consumptionData.value.map(d => d.consumption),
                fill: true,
                borderColor: '#101828',
                backgroundColor: 'rgba(16, 24, 40, 0.06)',
                tension: 0.4
            }
        ]
    }
})

// 费用构成图数据
const expenseChartData = computed(() => {
    const data = expenseData.value || {}
    return {
        labels: ['能耗', '保养', '配件', '其他'],
        datasets: [
            {
                data: [
                    data.energy_cost || 0,
                    data.maintenance_cost || 0,
                    data.parts_cost || 0,
                    data.other_cost || 0
                ],
                backgroundColor: ['#101828', '#475467', '#98a2b3', '#d0d5dd'],
                hoverBackgroundColor: ['#1d2939', '#344054', '#667085', '#98a2b3']
            }
        ]
    }
})

// 月度趋势图数据
const monthlyTrendData = computed(() => {
    return {
        labels: monthlyData.value.map(d => d.month + '月'),
        datasets: [
            {
                label: '总费用',
                backgroundColor: '#e2e8f0',
                data: monthlyData.value.map(d => d.total_cost)
            },
            {
                label: '行驶里程 (km)',
                backgroundColor: '#101828',
                yAxisID: 'y1',
                data: monthlyData.value.map(d => d.total_mileage) // 注意：需要后端支持
            }
        ]
    }
})

// 格式化工具
const formatNumber = (num) => num ? num.toLocaleString() : 0
const formatCurrency = (val) => val ? '¥' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '¥0.00'
const formatDate = fmtDate

onMounted(() => {
    loadVehicles()
})
</script>

<style scoped>
.analytics-check {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--cn-border);
    border-radius: 10px;
    background: var(--surface-50);
}

.analytics-check label {
    color: var(--cn-muted);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
}

.analytics-grid {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr);
    gap: 1rem;
    margin-bottom: 1rem;
}

.analytics-chart {
    height: 300px;
}

.analytics-doughnut {
    max-height: 290px;
}

@media screen and (max-width: 1100px) {
    .analytics-grid {
        grid-template-columns: 1fr;
    }
}
</style>
