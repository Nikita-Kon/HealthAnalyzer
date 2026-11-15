import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'node:path'

// `npm run build:single` packs the whole app into one HTML (for quick demos / artifacts)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
      ...(mode === 'single' ? [viteSingleFile()] : []),
    ],
    server: {
      host: '0.0.0.0',
      port: 5000,
      allowedHosts: ['demo.nikitak.dev'],
      proxy: {
        '/api': {
          target: env.API_PROXY || 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
    build: mode === 'single' ? { outDir: 'dist-single' } : undefined,
  }
})
