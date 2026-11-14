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
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: {
    // FastAPI serves /api/v1 on :8000 — proxy it in dev so VITE_API_URL=/api/v1 just works
    proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } },
  },
  build: mode === 'single' ? { outDir: 'dist-single' } : undefined,
}))
