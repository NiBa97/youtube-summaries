import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

if (!process.env.VITE_GIT_SHA) {
  try {
    process.env.VITE_GIT_SHA = execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim()
  } catch {
    process.env.VITE_GIT_SHA = 'unknown'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
