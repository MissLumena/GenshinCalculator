import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendDir = path.join(root, 'backend');

export const DEFAULT_API_PORT = 8010;

export function readApiPort() {
  const envPath = path.join(backendDir, '.env');
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^APP_PORT=(\d+)/m);
    if (match) return Number(match[1]);
  } catch {
    // backend/.env may not exist yet
  }
  return DEFAULT_API_PORT;
}

export function resolvePython() {
  const winVenv = path.join(backendDir, '.venv', 'Scripts', 'python.exe');
  const unixVenv = path.join(backendDir, '.venv', 'bin', 'python');
  if (process.platform === 'win32' && fs.existsSync(winVenv)) return winVenv;
  if (fs.existsSync(unixVenv)) return unixVenv;
  return process.platform === 'win32' ? 'python' : 'python3';
}

export { backendDir, root };
