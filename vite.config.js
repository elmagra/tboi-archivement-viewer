import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/tboi-archivement-viewer/',
  build: {
    assetsInlineLimit: 0,
  },
})
