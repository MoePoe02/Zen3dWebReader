import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  // Ensure pdf.js worker is NOT bundled/inlined by Vite.
  // It must remain as a standalone file so the worker's import.meta.url
  // is its actual URL, allowing it to resolve relative assets like openjpeg_wasm.
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
  build: {
    rollupOptions: {
      external: [],
    },
  },
})
