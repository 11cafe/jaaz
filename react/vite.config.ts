import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

const PORT = 57988

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Base configuration that applies to all environments
  const config = {
    plugins: [
      TanStackRouterVite({
        target: 'react',
        autoCodeSplitting: true,
        generatedRouteTree: 'src/route-tree.gen.ts',
      }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5174,
      proxy: {},
    },
  }

  // Configure server based on environment
  if (mode === 'development') {
    config.server.proxy = {
      '/api': {
        target: `http://127.0.0.1:${PORT}`,
        changeOrigin: true,
        // Uncomment the following if you want to remove the /api prefix when forwarding to Flask
        // rewrite: (path) => path.replace(/^\/api/, '')
      },
      // Also proxy WebSocket connections
      '/ws': {
        target: `ws://127.0.0.1:${PORT}`,
        ws: true,
      },
    }
  }

  return config
})
