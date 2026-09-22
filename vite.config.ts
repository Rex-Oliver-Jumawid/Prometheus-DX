import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiPort = Number(process.env.E2E_API_PORT ?? '3001');
const webPort = Number(process.env.E2E_WEB_PORT ?? '5173');

const apiProxy = {
  '/api': {
    target: `http://127.0.0.1:${apiPort}`,
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: webPort,
    strictPort: Boolean(process.env.E2E_WEB_PORT),
    proxy: apiProxy,
  },
  preview: {
    port: 4173,
    proxy: apiProxy,
  },
});
