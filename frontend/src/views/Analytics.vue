<!--
  数据分析页面
-->

<template>
    <div>
        <div class="flex flex-column md:flex-row justify-content-between align-items-center mb-4">
            <h1 class="text-3xl font-bold m-0 mb-2 md:mb-0">数据分析</h1>
            <div class="flex gap-2 align-items-center w-full md:w-auto">
                <Dropdown v-model="selectedVehicleId" :options="vehicles" optionLabel="plate_number" optionValue="id"
                    placeholder="选择车辆" class="flex-auto md:w-14rem min-w-0" @change="loadAllData" />
                <Dropdown v-model="timeRange" :options="timeRanges" optionLabel="label" optionValue="value"
                    placeholder="范围" class="flex-auto md:w-10rem min-w-0" @change="loadAllData" />
            </div>
        </div>

        <div v-if="!selectedVehicleId" class="text-center py-8">
            <i class="pi pi-chart-bar mb-3" style="font-size: 4rem; color: var(--surface-400)"></i>
            <div class="text-xl text-600">请选择一辆车以查看分析数据</div>
        </div>

        <div v-else class="grid">
            <!-- 概览卡片 -->
            <div class="col-12 md:col-6 lg:col-3">
                <Card class="h-full shadow-1 border-left-3 border-blue-500">
                    <template #content>
                        <div class="text-600 mb-2">总里程</div>
                        <div class="text-2xl font-bold text-900">{{ formatNumber(overview.total_mileage) }} km</div>
                    </template>
                </Card>
            </div>
            <div class="col-12 md:col-6 lg:col-3">
                <Card class="h-full shadow-1 border-left-3 border-green-500">
                    <template #content>
                        <div class="text-600 mb-2">总花费</div>
                        <div class="text-2xl font-bold text-900">{{ formatCurrency(overview.total_cost) }}</div>
                        <div class="text-sm text-green-600 mt-1" v-if="overview.avg_cost_per_km">
                            {{ formatCurrency(overview.avg_cost_per_km) }}/km
                        </div>
                    </template>
                </Card>
            </div>
            <div class="col-12 md:col-6 lg:col-3">
                <Card class="h-full shadow-1 border-left-3 border-orange-500">
                    <template #content>
                        <div class="text-600 mb-2">平均能耗</div>
                        <div class="text-2xl font-bold text-900">
                            {{ overview.avg_consumption ? overview.avg_consumption.toFixed(2) : '--' }}
                            <span class="text-base font-normal text-600">{{ unit }}</span>
                        </div>
                    </template>
                </Card>
            </div>
            <div class="col-12 md:col-6 lg:col-3">
                <Card class="h-full shadow-1 border-left-3 border-purple-500">
                    <template #content>
                        <div class="text-600 mb-2">最近保养</div>
                        <div class="text-xl font-bold text-900">
                            {{ overview.last_maintenance_date ? formatDate(overview.last_maintenance_date) : '无记录' }}
                        </div>
                        <div class="text-sm text-600 mt-1" v-if="overview.last_maintenance_days">
                            {{ overview.last_maintenance_days }} 天前
                        </div>
                    </template>
                </Card>
            </div>

            <!-- 图表区域 -->
            <div class="col-12 lg:col-8">
                <Card class="shadow-2 h-full">
                    <template #title>能耗趋势</template>
                    <template #content>
                        <Chart type="line" :data="consumptionChartData" :options="chartOptions" class="h-20rem" />
                    </template>
                </Card>
            </div>

            <div class="col-12 lg:col-4">
                <Card class="shadow-2 h-full">
                    <template #title>费用构成</template>
                    <template #content>
                        <div class="flex justify-content-center">
                            <Chart type="doughnut" :data="expenseChartData" :options="doughnutOptions" class="w-full"
                                style="max-height: 20rem" />
                        </div>
                    </template>
                </Card>
            </div>

            <div class="col-12">
                <Card class="shadow-2">
                    <template #title>月度费用统计</template>
                    <template #content>
                        <Chart type="bar" :data="monthlyTrendData" :options="chartOptions" class="h-20rem" />
                    </template>
                </Card>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { vehicleAPI, analyticsAPI } from '../api'
import Chart from 'primevue/chart'

// 状态
const vehicles = ref([])
const selectedVehicleId = ref(null)
const timeRange = ref('year')
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
        console.error('Failed to load vehicles', error)
    }
}

// 加载所有分析数据
const loadAllData = async () => {
    if (!selectedVehicleId.value) return

    try {
        const params = { range: timeRange.value }

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
        console.error('Failed to load analytics', error)
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
            position: 'bottom'
        }
    }
}

const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'right'
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
                borderColor: '#42A5F5',
                backgroundColor: 'rgba(66, 165, 245, 0.2)',
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
                backgroundColor: ['#42A5F5', '#66BB6A', '#FFA726', '#AB47BC'],
                hoverBackgroundColor: ['#64B5F6', '#81C784', '#FFB74D', '#BA68C8']
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
                backgroundColor: '#FFA726',
                data: monthlyData.value.map(d => d.total_cost)
            },
            {
                label: '行驶里程 (km)',
                backgroundColor: '#42A5F5',
                yAxisID: 'y1',
                data: monthlyData.value.map(d => d.total_mileage) // 注意：需要后端支持
            }
        ]
    }
})

// 格式化工具
const formatNumber = (num) => num ? num.toLocaleString() : 0
const formatCurrency = (val) => val ? '¥' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '¥0.00'
const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString() : ''

onMounted(() => {
    loadVehicles()
})
</script>
