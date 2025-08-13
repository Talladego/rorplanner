import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy GraphQL calls during dev to avoid browser CORS issues
      '/graphql': {
        target: 'https://production-api.waremu.com',
        changeOrigin: true,
        secure: true,
        headers: {
          origin: 'https://killboard.returnofreckoning.com',
          referer: 'https://killboard.returnofreckoning.com/'
        },
      },
    },
  },
})
