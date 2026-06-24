import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function readApiPort() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
  const envPath = path.join(root, 'backend', '.env');
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^APP_PORT=(\d+)/m);
    if (match) return Number(match[1]);
  } catch {
    // ignore
  }
  return 8010;
}

const apiPort = readApiPort();
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const defaultSiteUrl = 'https://genshin-calculator-2ow.pages.dev';

if (!process.env.VITE_SITE_URL) {
  try {
    const buildEnv = fs.readFileSync(
      path.join(projectRoot, 'deploy', 'cloudflare-build.env'),
      'utf8',
    );
    const match = buildEnv.match(/^VITE_SITE_URL=(.+)$/m);
    if (match?.[1]?.trim()) {
      process.env.VITE_SITE_URL = match[1].trim();
    }
  } catch {
    // optional deploy env file
  }
}

if (!process.env.VITE_SITE_URL) {
  process.env.VITE_SITE_URL = defaultSiteUrl;
}

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'SUPABASE_'],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    watch: {
      ignored: [
        '**/backend/**',
        '**/test-results/**',
        '**/*.test.{js,jsx,ts,tsx}',
      ],
    },
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
      '/fandom-api': {
        target: 'https://genshin-impact.fandom.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fandom-api/, ''),
      },
      '/constellation-img': {
        target: 'https://static.wikia.nocookie.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/constellation-img/, ''),
      },
    },
  },
  test: {
    environment: 'node',
  },
});
