import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
   server: {
      port: 5175, // ensure this matches the URL
      strictPort: true, // avoid fallback ports
    },

})
