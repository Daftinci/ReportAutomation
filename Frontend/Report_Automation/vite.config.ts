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
    host: '0.0.0.0',
    allowedHosts: ['sisreport.local'],
    proxy: {
      '/auth':     { target: process.env.VITE_API_URL ?? 'http://localhost:8000', changeOrigin: true },
      '/upload':   { target: process.env.VITE_API_URL ?? 'http://localhost:8000', changeOrigin: true },
      '/jobs':     { target: process.env.VITE_API_URL ?? 'http://localhost:8000', changeOrigin: true },
      '/reports':  { target: process.env.VITE_API_URL ?? 'http://localhost:8000', changeOrigin: true },
      '/generate': { target: process.env.VITE_API_URL ?? 'http://localhost:8000', changeOrigin: true },
      '/health':   { target: process.env.VITE_API_URL ?? 'http://localhost:8000', changeOrigin: true },
      '/users':    { target: process.env.VITE_API_URL ?? 'http://localhost:8000', changeOrigin: true },
    },
  },
})
