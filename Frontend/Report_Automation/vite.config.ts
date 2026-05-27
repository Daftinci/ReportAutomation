import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  server: {
    proxy: {
      '/auth':     { target: 'http://localhost:8000', changeOrigin: true },
      '/upload':   { target: 'http://localhost:8000', changeOrigin: true },
      '/jobs':     { target: 'http://localhost:8000', changeOrigin: true },
      '/reports':  { target: 'http://localhost:8000', changeOrigin: true },
      '/generate': { target: 'http://localhost:8000', changeOrigin: true },
      '/health':   { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
