import { useSiteStore } from './siteStore';

/**
 * 集中式日志管理工具
 * 只有在后台开启“调试模式”时，才会向浏览器控制台输出 debug 和 info 级别的日志。
 */
const logger = {
    debug(...args) {
        const { state } = useSiteStore();
        if (state.debugMode) {
            console.debug('[DEBUG]', ...args);
        }
    },

    info(...args) {
        const { state } = useSiteStore();
        if (state.debugMode) {
            console.log('[INFO]', ...args);
        }
    },

    warn(...args) {
        // 警告信息通常无论是否调试模式都应该显示，或者也可以受控
        const { state } = useSiteStore();
        if (state.debugMode) {
            console.warn('[WARN]', ...args);
        }
    },

    error(...args) {
        // 错误信息始终显示
        console.error('[ERROR]', ...args);
    }
};

export default logger;
