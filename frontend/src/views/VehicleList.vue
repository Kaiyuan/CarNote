<!--
  车辆管理页面 - 简化版
-->

<template>
  <div>
    <div class="flex justify-content-between align-items-center mb-4">
      <h1 class="text-3xl font-bold">车辆管理</h1>
      <Button label="添加车辆" icon="pi pi-plus" @click="showDialog = true" />
    </div>

    <!-- 车辆列表 -->
    <DataTable :value="vehicles" :loading="loading" stripedRows responsiveLayout="stack" breakpoint="960px"
      class="responsive-table">
      <Column field="plate_number" header="车牌号" sortable></Column>
      <Column field="brand" header="品牌"></Column>
      <Column field="model" header="型号"></Column>
      <Column field="power_type" header="动力类型">
        <template #body="slotProps">
          <Chip :label="getPowerTypeLabel(slotProps.data.power_type)"
            :class="'power-type-' + slotProps.data.power_type" />
        </template>
      </Column>
      <Column field="current_mileage" header="当前里程">
        <template #body="slotProps">
          {{ formatNumber(slotProps.data.current_mileage) }} km
        </template>
      </Column>
      <Column field="purchase_date" header="购车时间" sortable>
        <template #body="slotProps">{{ formatDate(slotProps.data.purchase_date) }}</template>
      </Column>
      <Column header="操作">
        <template #body="slotProps">
          <Button icon="pi pi-pencil" text rounded @click="editVehicle(slotProps.data)" />
          <Button icon="pi pi-trash" text rounded severity="danger" @click="deleteVehicle(slotProps.data.id)" />
        </template>
      </Column>
    </DataTable>

    <!-- 添加/编辑对话框 -->
    <Dialog :visible="showDialog" @update:visible="showDialog = $event" :header="editingVehicle ? '编辑车辆' : '添加车辆'"
      :modal="true" :breakpoints="{ '960px': '75vw', '640px': '95vw' }" :style="{ width: '500px' }">
      <div class="field">
        <label>车牌号 *</label>
        <InputText v-model="vehicleForm.plate_number" class="w-full" />
      </div>
      <div class="field">
        <label>品牌</label>
        <InputText v-model="vehicleForm.brand" class="w-full" />
      </div>
      <div class="field">
        <label>型号</label>
        <InputText v-model="vehicleForm.model" class="w-full" />
      </div>
      <div class="field">
        <label>年份</label>
        <InputNumber v-model="vehicleForm.year" class="w-full" :useGrouping="false" />
      </div>
      <div class="field">
        <label>动力类型 *</label>
        <Dropdown v-model="vehicleForm.power_type" :options="powerTypes" optionLabel="label" optionValue="value"
          class="w-full" />
      </div>
      <div class="field">
        <label>当前里程</label>
        <InputNumber v-model="vehicleForm.current_mileage" class="w-full" suffix=" km" />
      </div>
      <div class="field">
        <label>购车时间</label>
        <Calendar v-model="vehicleForm.purchase_date" class="w-full" dateFormat="yy-mm-dd" showIcon />
      </div>

      <template #footer>
        <Button label="取消" text @click="showDialog = false" />
        <Button label="保存" @click="saveVehicle" :loading="saving" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { vehicleAPI } from '../api'

const toast = useToast()

// 状态
const vehicles = ref([])
const loading = ref(false)
const showDialog = ref(false)
const saving = ref(false)
const editingVehicle = ref(null)

// 表单数据
const vehicleForm = ref({
  plate_number: '',
  brand: '',
  model: '',
  year: null,
  power_type: 'fuel',
  current_mileage: 0,
  purchase_date: null
})

// 动力类型选项
const powerTypes = [
  { label: '燃油', value: 'fuel' },
  { label: '纯电', value: 'electric' },
  { label: '混动', value: 'hybrid' }
]

// 获取车辆列表
const loadVehicles = async () => {
  loading.value = true
  try {
    const res = await vehicleAPI.getList()
    if (res.success) {
      vehicles.value = res.data
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: '错误', detail: '加载失败', life: 3000 })
  } finally {
    loading.value = false
  }
}

// 编辑车辆
const editVehicle = (vehicle) => {
  editingVehicle.value = vehicle
  vehicleForm.value = { ...vehicle }
  showDialog.value = true
}

// 保存车辆
const saveVehicle = async () => {
  if (!vehicleForm.value.plate_number || !vehicleForm.value.power_type) {
    toast.add({ severity: 'warn', summary: '提示', detail: '请填写必填项', life: 3000 })
    return
  }

  saving.value = true
  try {
    let res
    if (editingVehicle.value) {
      res = await vehicleAPI.update(editingVehicle.value.id, vehicleForm.value)
    } else {
      res = await vehicleAPI.create(vehicleForm.value)
    }

    if (res.success) {
      toast.add({ severity: 'success', summary: '成功', detail: res.message, life: 3000 })
      showDialog.value = false
      loadVehicles()
      resetForm()
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: '错误', detail: error.message || '保存失败', life: 3000 })
  } finally {
    saving.value = false
  }
}

// 删除车辆
const deleteVehicle = async (id) => {
  if (!confirm('确定要删除这辆车吗？')) return

  try {
    const res = await vehicleAPI.delete(id)
    if (res.success) {
      toast.add({ severity: 'success', summary: '成功', detail: '删除成功', life: 3000 })
      loadVehicles()
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: '错误', detail: '删除失败', life: 3000 })
  }
}

// 重置表单
const resetForm = () => {
  editingVehicle.value = null
  vehicleForm.value = {
    plate_number: '',
    brand: '',
    model: '',
    year: null,
    power_type: 'fuel',
    current_mileage: 0,
    purchase_date: null
  }
}

const formatDate = (date) => {
  if (!date) return '未知'
  return new Date(date).toLocaleDateString()
}

const getPowerTypeLabel = (type) => {
  const labels = { 'fuel': '燃油', 'electric': '纯电', 'hybrid': '混动' }
  return labels[type] || type
}

const formatNumber = (num) => num ? num.toLocaleString() : 0

onMounted(() => {
  loadVehicles()
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

.power-type-fuel {
  background-color: #fef3c7;
  color: #92400e;
}

.power-type-electric {
  background-color: #dbeafe;
  color: #1e40af;
}

.power-type-hybrid {
  background-color: #dcfce7;
  color: #166534;
}
</style>
