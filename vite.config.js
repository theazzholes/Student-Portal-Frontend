import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from'@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://the-ah-api-hkgfbafrczcyf5bb.eastus2-01.azurewebsites.net',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
