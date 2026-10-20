/**
 * 轻量级国际化方案
 *
 * - 使用中文原文作为 key，便于对既有界面做渐进式翻译。
 * - $t / t 可用于新增组件和动态文案。
 * - startAutoLocalization 会自动本地化模板中的静态文案、按钮文字、
 *   对话框标题以及 placeholder / title / aria-label 属性。
 */
import { reactive, computed, watch } from 'vue'
import en from './messages/en'
import zhTW from './messages/zh-TW'
import ja from './messages/ja'
import ko from './messages/ko'
import fr from './messages/fr'
import it from './messages/it'

const STORAGE_KEY = 'carnote_locale'

export const SUPPORTED_LOCALES = [
    { code: 'zh-CN', label: '简体中文', short: '简' },
    { code: 'zh-TW', label: '繁體中文', short: '繁' },
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'ja', label: '日本語', short: '日' },
    { code: 'ko', label: '한국어', short: '한' },
    { code: 'fr', label: 'Français', short: 'FR' },
    { code: 'it', label: 'Italiano', short: 'IT' }
]

const dictionaries = {
    'zh-CN': {},
    'zh-TW': zhTW,
    en,
    ja,
    ko,
    fr,
    it
}

function normalizeLocale(value) {
    if (!value) return null
    const lower = String(value).toLowerCase()
    if (lower.startsWith('zh')) {
        return /tw|hk|mo|hant/.test(lower) ? 'zh-TW' : 'zh-CN'
    }
    if (lower.startsWith('ja')) return 'ja'
    if (lower.startsWith('ko')) return 'ko'
    if (lower.startsWith('fr')) return 'fr'
    if (lower.startsWith('it')) return 'it'
    if (lower.startsWith('en')) return 'en'
    return null
}

function readLocale() {
    try {
        const stored = normalizeLocale(localStorage.getItem(STORAGE_KEY))
        if (stored) return stored
    } catch {
        /* ignore storage errors */
    }
    if (typeof navigator !== 'undefined') {
        const detected = normalizeLocale(navigator.language)
        if (detected) return detected
    }
    return 'zh-CN'
}

const state = reactive({
    locale: readLocale()
})

function lookup(key, locale) {
    if (!key) return key
    if (locale === 'zh-CN') return key
    const dict = dictionaries[locale] || {}
    if (dict[key] !== undefined) return dict[key]

    // 兼容 "xxx *" / "xxx:" 这类标签
    if (key.endsWith(' *')) {
        const base = key.slice(0, -2)
        if (dict[base] !== undefined) return `${dict[base]} *`
    }
    if (key.endsWith(':')) {
        const base = key.slice(0, -1)
        if (dict[base] !== undefined) return `${dict[base]}:`
    }

    if (locale === 'zh-TW') return key
    const english = en
    if (english[key] !== undefined) return english[key]
    return key
}

export function t(key, params) {
    // 读取 locale，使模板渲染自动建立响应式依赖
    const locale = state.locale
    let value = lookup(key, locale)
    if (params && typeof value === 'string') {
        value = value.replace(/\{(\w+)\}/g, (_, name) =>
            params[name] !== undefined ? String(params[name]) : `{${name}}`
        )
    }
    return value
}

function hasTranslation(key, locale = state.locale) {
    if (!key || locale === 'zh-CN') return false
    const dict = dictionaries[locale] || {}
    if (dict[key] !== undefined) return true
    if (locale !== 'zh-TW' && en[key] !== undefined) return true
    return false
}

export function setLocale(value) {
    const next = normalizeLocale(value) || value
    if (!SUPPORTED_LOCALES.some(item => item.code === next)) return
    state.locale = next
    try {
        localStorage.setItem(STORAGE_KEY, next)
    } catch {
        /* ignore storage errors */
    }
    if (typeof document !== 'undefined') {
        document.documentElement.lang = next
    }
    retranslateAll()
}

export const locale = computed({
    get: () => state.locale,
    set: (value) => setLocale(value)
})

export function useI18n() {
    return {
        t,
        locale,
        setLocale,
        supportedLocales: SUPPORTED_LOCALES
    }
}

export function installI18n(app) {
    app.config.globalProperties.$t = t
    app.provide('i18n', { t, locale, setLocale, supportedLocales: SUPPORTED_LOCALES })
    if (typeof document !== 'undefined') {
        document.documentElement.lang = state.locale
    }
}

export function monthLabel(month, format = 'short') {
    try {
        const date = new Date(2020, Number(month) - 1, 1)
        return new Intl.DateTimeFormat(state.locale, { month: format }).format(date)
    } catch {
        return `${month}月`
    }
}

export function relativeTime(value) {
    if (!value) return ''
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const diff = Date.now() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    try {
        const rtf = new Intl.RelativeTimeFormat(state.locale, { numeric: 'auto' })
        if (Math.abs(minutes) < 60) return rtf.format(-minutes, 'minute')
        if (Math.abs(hours) < 24) return rtf.format(-hours, 'hour')
        return rtf.format(-days, 'day')
    } catch {
        if (days > 0) return `${days} 天前`
        if (hours > 0) return `${hours} 小时前`
        if (minutes > 0) return `${minutes} 分钟前`
        return '刚刚'
    }
}

/* ------------------------------------------------------------------ */
/* Automatic localization of existing template copy                    */
/* ------------------------------------------------------------------ */

const textOriginals = new WeakMap()
const lastTextValues = new WeakMap()
const attrOriginals = new WeakMap()
const trackedTexts = new Set()
const trackedAttrs = new Set()
const ATTRIBUTES = ['placeholder', 'title', 'aria-label']
let observer = null
let applying = false
let started = false

const SKIP_SELECTOR = 'script, style, code, pre, textarea, .notranslate, [contenteditable="true"]'

function shouldSkip(node) {
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node
    return !el || el.closest(SKIP_SELECTOR)
}

function translateCore(core) {
    if (!/[\u4e00-\u9fff]/.test(core)) return core
    if (!hasTranslation(core)) return core
    return t(core)
}

function translateString(value) {
    const match = String(value).match(/^(\s*)([\s\S]*?)(\s*)$/)
    if (!match) return value
    const [, leading, core, trailing] = match
    if (!core) return value
    const translated = translateCore(core)
    return translated === core ? value : `${leading}${translated}${trailing}`
}

function applyText(node) {
    if (!node.nodeValue || !/[\u4e00-\u9fff]/.test(node.nodeValue)) return
    if (shouldSkip(node)) return

    const current = node.nodeValue
    const last = lastTextValues.get(node)
    let original = textOriginals.get(node)

    if (original === undefined) {
        original = current
        textOriginals.set(node, original)
        trackedTexts.add(node)
    } else if (current !== last) {
        // Vue 更新了文本，记录新的原文
        original = current
        textOriginals.set(node, original)
    }

    const translated = translateString(original)
    if (translated !== current) {
        applying = true
        node.nodeValue = translated
        applying = false
        lastTextValues.set(node, translated)
    } else {
        lastTextValues.set(node, current)
    }
}

function applyAttribute(el, name) {
    if (!el || !el.getAttribute || !ATTRIBUTES.includes(name)) return
    if (shouldSkip(el)) return
    const current = el.getAttribute(name)
    if (!current || !/[\u4e00-\u9fff]/.test(current)) return

    let record = attrOriginals.get(el)
    if (!record) {
        record = {}
        attrOriginals.set(el, record)
        trackedAttrs.add(el)
    }

    const last = record[`__last_${name}`]
    if (record[name] === undefined) {
        record[name] = current
    } else if (current !== last) {
        record[name] = current
    }

    const translated = translateString(record[name])
    if (translated !== current) {
        applying = true
        el.setAttribute(name, translated)
        applying = false
        record[`__last_${name}`] = translated
    } else {
        record[`__last_${name}`] = current
    }
}

function scanNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        applyText(node)
        return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    if (node.closest && node.closest(SKIP_SELECTOR)) return

    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
    let current
    while ((current = walker.nextNode())) {
        applyText(current)
    }

    ATTRIBUTES.forEach(name => applyAttribute(node, name))
    const elements = node.querySelectorAll('[placeholder], [title], [aria-label]')
    elements.forEach(el => {
        ATTRIBUTES.forEach(name => applyAttribute(el, name))
    })
}

function handleMutations(mutations) {
    if (applying) return
    for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
            applyText(mutation.target)
        } else if (mutation.type === 'attributes') {
            applyAttribute(mutation.target, mutation.attributeName)
        } else if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => scanNode(node))
        }
    }
}

function retranslateAll() {
    if (!started || typeof document === 'undefined') return
    applying = true
    trackedTexts.forEach(node => {
        if (!node.isConnected) {
            trackedTexts.delete(node)
            return
        }
        const original = textOriginals.get(node)
        if (original === undefined) return
        const translated = translateString(original)
        node.nodeValue = translated
        lastTextValues.set(node, translated)
    })
    trackedAttrs.forEach(el => {
        if (!el.isConnected) {
            trackedAttrs.delete(el)
            return
        }
        const record = attrOriginals.get(el)
        if (!record) return
        ATTRIBUTES.forEach(name => {
            if (record[name] === undefined) return
            const translated = translateString(record[name])
            el.setAttribute(name, translated)
            record[`__last_${name}`] = translated
        })
    })
    applying = false
}

export function startAutoLocalization() {
    if (started || typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
    started = true
    scanNode(document.body)
    observer = new MutationObserver(handleMutations)
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ATTRIBUTES
    })
    watch(() => state.locale, retranslateAll)
}

export default { t, installI18n, useI18n, setLocale, locale, SUPPORTED_LOCALES }
