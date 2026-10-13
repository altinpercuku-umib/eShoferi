import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward /api requests to Django. To the browser, the API and the app
    // then share one origin, so cookies and CSRF work without any CORS setup.
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
