/** Загружает deploy/cloudflare-env-paste.txt и запускает vite build (для Cloudflare Git). */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, 'deploy', 'cloudflare-env-paste.txt');

for (const line of readFileSync(envFile, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const value = trimmed.slice(idx + 1).trim();
  if (key) process.env[key] = value;
}

const result = spawnSync('npm', ['run', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

if (result.status === 0) {
  const assetsIgnore = [
    '# Меньше файлов — стабильнее upload с Windows',
    'background/windrise-source.jpg',
    'background/windrise-2560.jpg',
    'background/windrise-1920.jpg',
    'background/windrise-1280.jpg',
    'background/windrise.png',
    '',
  ].join('\n');
  writeFileSync(join(root, 'dist', '.assetsignore'), assetsIgnore, 'utf8');
}

process.exit(result.status ?? 1);
