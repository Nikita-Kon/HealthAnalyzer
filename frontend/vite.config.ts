import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'node:path'

// `npm run build:single` packs the whole app into one HTML (for quick demos / artifacts)
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    ...(mode === 'single' ? [viteSingleFile()] : []),
  ],
  server: {
    // demo.nikitak.dev forwards to local port 5000
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: ['demo.nikitak.dev'],
    // the browser calls /api/v1 on the same host; Vite forwards it to FastAPI on :8000 (no CORS needed).
    // API_PROXY points it at another backend instead, e.g. API_PROXY=https://demo.nikitak.dev
    proxy: { '/api': { target: process.env.API_PROXY ?? 'http://localhost:8000', changeOrigin: true } },
  },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  build: mode === 'single' ? { outDir: 'dist-single' } : undefined,
}))
