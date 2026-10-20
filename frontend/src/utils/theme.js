/**
 * 主题管理：亮色 / 暗色 / 跟随系统
 * 暗色主题使用纯黑背景，适合 OLED 与夜间使用。
 */
import { reactive, computed } from 'vue'

const STORAGE_KEY = 'carnote_theme'
export const THEME_MODES = ['light', 'dark', 'system']

const media = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

const state = reactive({
    mode: readMode(),
    systemDark: media ? media.matches : false
})

function readMode() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        return THEME_MODES.includes(stored) ? stored : 'system'
    } catch {
        return 'system'
    }
}

export const isDark = computed(() =>
    state.mode === 'dark' || (state.mode === 'system' && state.systemDark)
)

const mode = computed({
    get: () => state.mode,
    set: (value) => setMode(value)
})

function apply() {
    if (typeof document === 'undefined') return
    const dark = isDark.value
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', dark ? '#000000' : '#101828')
}

export function setMode(value) {
    if (!THEME_MODES.includes(value)) return
    state.mode = value
    try {
        localStorage.setItem(STORAGE_KEY, value)
    } catch {
        /* ignore storage errors */
    }
    apply()
}

export function cycleMode() {
    const order = ['light', 'dark', 'system']
    const next = order[(order.indexOf(state.mode) + 1) % order.length]
    setMode(next)
}

export function initTheme() {
    initiateMediaListener()
    apply()
}

function initiateMediaListener() {
    if (!media) return
    const handler = (event) => {
        state.systemDark = event.matches
        if (state.mode === 'system') apply()
    }
    if (media.addEventListener) {
        media.addEventListener('change', handler)
    } else if (media.addListener) {
        media.addListener(handler)
    }
}

export function useTheme() {
    return {
        mode,
        isDark,
        setMode,
        cycleMode,
        modes: THEME_MODES
    }
}

export default useTheme
