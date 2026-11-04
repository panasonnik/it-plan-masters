import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

//проксі /api на бекенд
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
