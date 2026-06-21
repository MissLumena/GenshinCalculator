/**
 * Сборка с Supabase env + деплой на Cloudflare Workers.
 * Требует: npx wrangler login (один раз) или CLOUDFLARE_API_TOKEN.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, 'deploy', 'cloudflare-env-paste.txt');

function loadEnvFromPaste() {
  const text = readFileSync(envFile, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

loadEnvFromPaste();
console.log('[deploy] npm run build');
run('npm', ['run', 'build']);
console.log('[deploy] npx wrangler deploy');
run('npx', ['wrangler', 'deploy']);
