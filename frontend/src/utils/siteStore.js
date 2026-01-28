import { reactive, readonly } from 'vue'
import { systemAPI } from '../api'

const state = reactive({
    siteName: 'CarNote',
    siteDescription: '',
    siteIcon: null,
    allowRegistration: true,
    isFirstUser: false,
    hasVip: false,
    afdianWebhookToken: '',
    afdianWebhookKey: '',
    loading: false
})

export const useSiteStore = () => {
    const setHasVip = (val) => {
        state.hasVip = val
    }

    const fetchConfig = async () => {
        state.loading = true
        try {
            const res = await systemAPI.getConfig()
            if (res.success) {
                state.siteName = res.data.siteName || 'CarNote'
                state.siteDescription = res.data.siteDescription || ''
                state.siteIcon = res.data.siteIcon
                state.allowRegistration = res.data.allowRegistration
                state.isFirstUser = res.data.isFirstUser
                state.afdianWebhookToken = res.data.afdianWebhookToken || ''
                state.afdianWebhookKey = res.data.afdianWebhookKey || ''

                // Update document title and meta
                document.title = state.siteName
                updateMetaDescription(state.siteDescription)
            }
        } catch (e) {
            console.error('Failed to fetch site config:', e)
        } finally {
            state.loading = false
        }
    }

    const updateMetaDescription = (desc) => {
        let meta = document.querySelector('meta[name="description"]')
        if (!meta) {
            meta = document.createElement('meta')
            meta.name = 'description'
            document.head.appendChild(meta)
        }
        meta.content = desc
    }

    const updateConfig = async (updates) => {
        try {
            const res = await systemAPI.updateConfig(updates)
            if (res.success) {
                if (updates.site_name) {
                    state.siteName = updates.site_name
                    document.title = state.siteName
                }
                if (updates.site_description) {
                    state.siteDescription = updates.site_description
                    updateMetaDescription(state.siteDescription)
                }
                if (updates.allow_registration !== undefined) {
                    state.allowRegistration = updates.allow_registration
                }
                if (updates.afdian_webhook_token !== undefined) {
                    state.afdianWebhookToken = updates.afdian_webhook_token
                }
                if (updates.afdian_webhook_key !== undefined) {
                    state.afdianWebhookKey = updates.afdian_webhook_key
                }
                return true
            }
        } catch (e) {
            console.error('Failed to update config:', e)
            throw e
        }
    }

    return {
        state: readonly(state),
        fetchConfig,
        updateConfig,
        setHasVip,
        setSiteIcon: (url) => { state.siteIcon = url }
    }
}
