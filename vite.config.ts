import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const webPort = Number(env.VITE_DEV_PORT || 5173);
  const apiPort = Number(env.PORT || 3001);

  const apiProxy = {
    '/api': {
      target: `http://127.0.0.1:${apiPort}`,
      changeOrigin: true,
    },
  };

  return {
    plugins: [react()],
    server: {
      port: webPort,
      strictPort: true,
      proxy: apiProxy,
    },
    preview: {
      port: Number(env.VITE_PREVIEW_PORT || 4173),
      strictPort: true,
      proxy: apiProxy,
    },
  };
});
