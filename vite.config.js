import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    open: true,
    strictPort: true,
    watch: {
      usePolling: true
    }
  },
  preview: {
    port: 3000,
    strictPort: true,
  },
  clearScreen: false,
  logLevel: 'info'
})
