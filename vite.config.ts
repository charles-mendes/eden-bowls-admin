import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

function resolveAppBasePath() {
  const raw = process.env.VITE_APP_BASE_PATH?.trim() || '/'
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

export default defineConfig({
  base: resolveAppBasePath(),
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    clearMocks: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    pool: 'threads',
    maxWorkers: 4,
    fileParallelism: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})
