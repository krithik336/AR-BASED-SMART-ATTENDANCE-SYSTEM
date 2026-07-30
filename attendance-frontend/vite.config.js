import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // exposes on LAN so you can open it on your phone for camera testing
    port: 5173,
  },
})
