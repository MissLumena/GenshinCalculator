/**
 * Запуск FastAPI и Vite одной командой: npm run dev:full
 */
import { spawn } from 'node:child_process';
import { backendDir, readApiPort, resolvePython, root } from './devConfig.mjs';

const port = readApiPort();
const python = resolvePython();
const isWindows = process.platform === 'win32';

const api = spawn(
  python,
  ['-m', 'uvicorn', 'app.main:app', '--reload', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: backendDir, stdio: 'inherit', shell: isWindows },
);

const web = spawn(isWindows ? 'npm.cmd' : 'npm', ['run', 'dev:web'], {
  cwd: root,
  stdio: 'inherit',
  shell: isWindows,
});

function shutdown(code = 0) {
  api.kill();
  web.kill();
  process.exit(code);
}

api.on('error', (err) => {
  console.error('[dev:full] Не удалось запустить backend:', err.message);
  console.error('Создайте venv: cd backend && python -m venv .venv && pip install -r requirements.txt');
  shutdown(1);
});

web.on('error', (err) => {
  console.error('[dev:full] Не удалось запустить Vite:', err.message);
  shutdown(1);
});

api.on('exit', (code) => {
  if (code && code !== 0) console.error(`[dev:full] Backend завершился с кодом ${code}`);
  shutdown(code ?? 0);
});

web.on('exit', (code) => {
  if (code && code !== 0) console.error(`[dev:full] Vite завершился с кодом ${code}`);
  shutdown(code ?? 0);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log(`[dev:full] Backend: http://127.0.0.1:${port}  |  Frontend: http://127.0.0.1:5173`);
