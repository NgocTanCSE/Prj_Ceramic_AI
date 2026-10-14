import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  envDir: '../',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    watch: {
      usePolling: true
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 3000
  },
  // ── Bundle optimization: split vendor chunks ──
  // Three.js (~750KB) is code-split into its own lazy chunk
  // so initial page load only ships React + core UI.
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          'canvas-confetti': ['canvas-confetti'],
          vendor: ['react', 'react-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    minify: 'esbuild',
  },
});
