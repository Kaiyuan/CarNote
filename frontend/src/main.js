/**
 * Vue 主入口文件
 * 初始化 Vue 应用并注册 PrimeVue 组件
 */

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import PrimeVue from 'primevue/config'
import logger from './utils/logger'

// PrimeVue 样式
import 'primevue/resources/themes/lara-light-blue/theme.css'
import 'primevue/resources/primevue.min.css'
import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'
import './assets/styles/main.css'

// PrimeVue 组件
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dialog from 'primevue/dialog'
import Toast from 'primevue/toast'
import ToastService from 'primevue/toastservice'
import Dropdown from 'primevue/dropdown'
import Calendar from 'primevue/calendar'
import Textarea from 'primevue/textarea'
import Chip from 'primevue/chip'
import Tag from 'primevue/tag'
import Menubar from 'primevue/menubar'
import Chart from 'primevue/chart'

// 创建应用
const app = createApp(App)

// 使用插件
app.use(router)
app.use(PrimeVue, { ripple: true })
app.use(ToastService)

// 注册全局组件
// 注册全局组件
app.component('Button', Button)
app.component('InputText', InputText)
app.component('InputNumber', InputNumber)
app.component('Card', Card)
app.component('DataTable', DataTable)
app.component('Column', Column)
app.component('Dialog', Dialog)
app.component('Toast', Toast)
app.component('Dropdown', Dropdown)
app.component('Calendar', Calendar)
app.component('Textarea', Textarea)
app.component('Chip', Chip)
app.component('Tag', Tag)
app.component('Menubar', Menubar)
app.component('Chart', Chart)

import Avatar from 'primevue/avatar'
import Badge from 'primevue/badge'
import Tooltip from 'primevue/tooltip'
import SelectButton from 'primevue/selectbutton'

import Sidebar from 'primevue/sidebar'

app.component('Avatar', Avatar)
app.component('Badge', Badge)
app.directive('tooltip', Tooltip)
app.component('SelectButton', SelectButton)
app.component('Sidebar', Sidebar)
import Checkbox from 'primevue/checkbox'
import Divider from 'primevue/divider'
import ProgressSpinner from 'primevue/progressspinner'

app.component('Checkbox', Checkbox)
app.component('Divider', Divider)
app.component('ProgressSpinner', ProgressSpinner)

import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
app.component('TabView', TabView)
app.component('TabPanel', TabPanel)

// --- VIP 模块加载封装 ---
const startApp = async () => {
    // 立即挂载应用，不要在挂载前 await，防止 UI 阻塞
    app.mount('#app')

    if (typeof __HAS_VIP__ !== 'undefined' && __HAS_VIP__) {
        try {
            // 异步加载 VIP 模块
            const vipModule = await import('@vip/index.js');
            if (vipModule && typeof vipModule.init === 'function') {
                await vipModule.init(app, router);
            }
        } catch (err) {
            logger.error('[VIP] 加载前端 VIP 模块失败:', err);
        }
    }
}

startApp();
