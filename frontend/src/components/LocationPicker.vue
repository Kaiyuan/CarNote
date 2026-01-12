<template>
  <div class="location-picker">
    <div v-if="!mapReady" class="flex align-items-center justify-content-center" style="height: 400px; background: #f8f9fa;">
       <ProgressSpinner />
    </div>
    <div id="map" style="height: 400px; width: 100%; border-radius: 6px;"></div>
    
    <div class="mt-3 flex justify-content-between align-items-center">
        <div class="text-sm text-600">
            <i class="pi pi-map-marker mr-1"></i>
            {{ selectedLocation ? `已选: ${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}` : '点击地图选择位置' }}
        </div>
        <Button label="确认选择" @click="confirm" :disabled="!selectedLocation" />
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
    initialLat: Number,
    initialLng: Number
})

const emit = defineEmits(['confirm'])

const map = ref(null)
const marker = ref(null)
const selectedLocation = ref(null)
const mapReady = ref(false)

// 修复 Leaflet 图标问题
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

onMounted(() => {
    initMap()
})

const initMap = () => {
    // 默认北京
    let lat = props.initialLat || 39.9042
    let lng = props.initialLng || 116.4074
    let zoom = props.initialLat ? 15 : 10
    
    // 如果没有初始坐标，尝试获取当前位置
    if (!props.initialLat && "geolocation" in navigator) {
         navigator.geolocation.getCurrentPosition((position) => {
             lat = position.coords.latitude
             lng = position.coords.longitude
             zoom = 15
             setupMap(lat, lng, zoom)
         }, () => {
             setupMap(lat, lng, zoom)
         })
    } else {
        setupMap(lat, lng, zoom)
    }
}

const setupMap = (lat, lng, zoom) => {
    mapReady.value = true
    // 确保 DOM 元素存在
    setTimeout(() => {
        if (map.value) return // 防止重复初始化
        
        map.value = L.map('map').setView([lat, lng], zoom)
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map.value)
        
        // 如果有初始值，添加标记
        if (props.initialLat && props.initialLng) {
            setMarker(props.initialLat, props.initialLng)
        }
        
        // 点击事件
        map.value.on('click', (e) => {
            setMarker(e.latlng.lat, e.latlng.lng)
        })
    }, 100)
}

const setMarker = (lat, lng) => {
    if (marker.value) {
        map.value.removeLayer(marker.value)
    }
    marker.value = L.marker([lat, lng]).addTo(map.value)
    selectedLocation.value = { lat, lng }
}

const confirm = () => {
    if (selectedLocation.value) {
        emit('confirm', selectedLocation.value)
    }
}
</script>

<style scoped>
.location-picker {
    position: relative;
}
</style>
