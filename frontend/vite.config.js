import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import fs from 'fs'

const vipFrontendPath = path.resolve(__dirname, '../vip/frontend');
const hasVip = fs.existsSync(path.join(vipFrontendPath, 'index.js'));

// Vite 配置
export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@vip': vipFrontendPath
        }
    },
    define: {
        __HAS_VIP__: hasVip
    },
    plugins: [
        vue(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
            manifest: {
                name: 'CarNote 车记录',
                short_name: 'CarNote',
                description: '您的车辆全能管家',
                theme_color: '#3B82F6',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            }
        })
    ],
    server: {
        port: 53301,
        proxy: {
            // API 代理到后端
            '/api': {
                target: 'http://localhost:53300',
                changeOrigin: true,
                secure: false
            },
            '/uploads': {
                target: 'http://localhost:53300',
                changeOrigin: true,
                secure: false
            }
        }
    },
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false
    }
})
