import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Container builds get VITE_GIT_SHA passed in (Coolify's SOURCE_COMMIT is a
// full 40-char sha, so shorten it); local builds fall back to reading git.
if (process.env.VITE_GIT_SHA) {
  process.env.VITE_GIT_SHA = process.env.VITE_GIT_SHA.trim().slice(0, 7)
} else {
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
