import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

/** Serves the screenshot harness only in dev; production builds never copy it. */
function devScreenshotHarness(): Plugin {
  return {
    name: 'zclear-dev-screenshot-harness',
    configureServer(server) {
      const html = readFileSync(
        fileURLToPath(new URL('./dev/theme-shot.html', import.meta.url)),
        'utf8',
      );
      server.middlewares.use('/theme-shot.html', (_request, response) => {
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(html);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devScreenshotHarness()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
  },
});
