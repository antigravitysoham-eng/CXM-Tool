import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind every interface so a phone on the same Wi-Fi can reach the dev
    // server, not just this machine. Harmless locally, and the alternative is
    // discovering it does not work only once you have the handset in your hand.
    host: true,
    port: 5173
  }
})
