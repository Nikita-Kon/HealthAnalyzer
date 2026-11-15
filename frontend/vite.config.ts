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
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: ['demo.nikitak.dev'],
  },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  build: mode === 'single' ? { outDir: 'dist-single' } : undefined,
}))
