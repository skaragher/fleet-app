// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  
  // Configuration du serveur
  server: {
    port: 5173, // Changez à 5173 pour éviter les problèmes CORS
    host: true,
    open: true,
    cors: true,
    // Permet au frontend (Vite) d'appeler le backend via `/api/*` sans changer le code.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  },
  
  // Résolution des alias
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@router': path.resolve(__dirname, './src/router'),
      '@services': path.resolve(__dirname, './src/services')
    }
  }
})
