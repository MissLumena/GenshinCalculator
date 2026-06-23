import fs from 'node:fs';
import path from 'node:path';

const SYNC_KEYS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_JWT_SECRET'];
const ROOT_ONLY_KEYS = ['VITE_SUPERUSER_EMAILS'];
const BACKEND_ONLY_KEYS = ['SUPERUSER_EMAILS'];

function parseEnv(content) {
  const vars = new Map();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    vars.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
  }
  return vars;
}

function readEnvFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function upsertEnvLines(content, entries) {
  let next = content;
  if (next.length > 0 && !next.endsWith('\n')) next += '\n';

  for (const [key, value] of entries) {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    const line = `${key}=${value}`;
    if (pattern.test(next)) {
      next = next.replace(pattern, line);
    } else {
      next += `${line}\n`;
    }
  }

  return next;
}

/**
 * Копирует Supabase-переменные из корневого .env в backend/.env перед запуском API.
 */
export function syncSupabaseEnv(rootDir, backendDir) {
  const rootEnvPath = path.join(rootDir, '.env');
  const backendEnvPath = path.join(backendDir, '.env');

  const rootVars = parseEnv(readEnvFile(rootEnvPath));
  const backendVars = parseEnv(readEnvFile(backendEnvPath));

  const entries = [];
  for (const key of SYNC_KEYS) {
    const value = rootVars.get(key) || backendVars.get(key);
    if (value) entries.push([key, value]);
  }

  const superuserEmails = rootVars.get('SUPERUSER_EMAILS') || backendVars.get('SUPERUSER_EMAILS');
  if (superuserEmails) {
    entries.push(['SUPERUSER_EMAILS', superuserEmails]);
    entries.push(['VITE_SUPERUSER_EMAILS', rootVars.get('VITE_SUPERUSER_EMAILS') || superuserEmails]);
  }

  for (const key of BACKEND_ONLY_KEYS) {
    const value = backendVars.get(key) || rootVars.get(key);
    if (value && !entries.some(([entryKey]) => entryKey === key)) {
      entries.push([key, value]);
    }
  }

  for (const key of ROOT_ONLY_KEYS) {
    const value = rootVars.get(key);
    if (value && !entries.some(([entryKey]) => entryKey === key)) {
      entries.push([key, value]);
    }
  }

  if (entries.length === 0) return false;

  const mergedBackend = upsertEnvLines(
    readEnvFile(backendEnvPath),
    entries.filter(([key]) => key !== 'VITE_SUPERUSER_EMAILS'),
  );
  fs.writeFileSync(backendEnvPath, mergedBackend, 'utf8');

  if (superuserEmails) {
    const rootContent = readEnvFile(rootEnvPath);
    const mergedRoot = upsertEnvLines(rootContent, [[
      'VITE_SUPERUSER_EMAILS',
      rootVars.get('VITE_SUPERUSER_EMAILS') || superuserEmails,
    ]]);
    if (mergedRoot !== rootContent) {
      fs.writeFileSync(rootEnvPath, mergedRoot, 'utf8');
    }
  }

  return true;
}

if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/'))) {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
  const backend = path.join(root, 'backend');
  const synced = syncSupabaseEnv(root, backend);
  console.log(synced ? '[sync-env] Supabase vars synced to backend/.env' : '[sync-env] Nothing to sync');
}
