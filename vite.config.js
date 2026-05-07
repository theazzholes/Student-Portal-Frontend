import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const CUSTOM_DOMAIN_BASE = '/'
const GITHUB_PROJECT_BASE = '/Student-Portal-Frontend/'

export default defineConfig(({ command, mode }) => ({
  plugins: [react(), tailwindcss()],
  base: command === 'build' && mode === 'github-pages' ? GITHUB_PROJECT_BASE : CUSTOM_DOMAIN_BASE,
}))
