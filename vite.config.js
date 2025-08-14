import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Set base path for GitHub Pages project site: https://<user>.github.io/rorplanner/
  // If you publish under a different repo name, update this to '/<repo>/'
  base: '/rorplanner/',
  plugins: [react()],
  define: {
    // Inject a build timestamp for display in the app footer
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString())
  },
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
