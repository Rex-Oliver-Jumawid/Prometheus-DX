import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Keep the standalone design in .model as the only source of truth.
// Serve it directly in development and emit it as a static page in production.
const landingPagePath = resolve(process.cwd(), '.model/landing-page.html');

function landingPagePlugin(): Plugin {
  const serveLanding = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const markup = readFileSync(landingPagePath);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Length', String(markup.length));
    res.setHeader('Cache-Control', 'no-store');
    res.end(req.method === 'HEAD' ? undefined : markup);
  };

  return {
    name: 'prometheus-landing',
    configureServer(server) {
      server.middlewares.use('/landing-page.html', serveLanding);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/landing-page.html', serveLanding);
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'landing-page.html',
        source: readFileSync(landingPagePath),
      });
    },
  };
}

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
    plugins: [react(), landingPagePlugin()],
    server: {
      port: webPort,
      strictPort: true,
      allowedHosts: ['obsolete-isolating-tribute.ngrok-free.dev'],
      proxy: apiProxy,
    },
    preview: {
      port: Number(env.VITE_PREVIEW_PORT || 4173),
      strictPort: true,
      proxy: apiProxy,
    },
  };
});