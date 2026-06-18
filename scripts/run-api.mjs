import { spawn } from 'node:child_process';
import { backendDir, readApiPort, resolvePython } from './devConfig.mjs';

const port = readApiPort();
const isWindows = process.platform === 'win32';

console.log(`[dev:api] http://127.0.0.1:${port}`);

const child = spawn(
  resolvePython(),
  ['-m', 'uvicorn', 'app.main:app', '--reload', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: backendDir, stdio: 'inherit', shell: isWindows },
);

child.on('exit', (code) => process.exit(code ?? 0));
