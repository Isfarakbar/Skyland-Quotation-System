import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    // html2pdf includes its rendering stack in one on-demand chunk. It is not
    // part of the initial application bundle and loads only when exporting.
    chunkSizeWarningLimit: 1100,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
