import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from'@tailwindcss/vite'

export default defineConfig({
  plugins: [react(),tailwindcss()],
  base: '/',
  server: {
    proxy: {
      '/api': {
        target: 'https://azzhfunctionapp-h6apc3f6eyf7eagh.northcentralus-01.azurewebsites.net/api',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
