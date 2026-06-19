import { spawn } from 'node:child_process';
import { backendDir, readApiPort, resolvePython, root } from './devConfig.mjs';
import { syncSupabaseEnv } from './sync-supabase-env.mjs';

const port = readApiPort();

syncSupabaseEnv(root, backendDir);

console.log(`[dev:api] http://127.0.0.1:${port}`);

const child = spawn(
  resolvePython(),
  ['-m', 'uvicorn', 'app.main:app', '--reload', '--reload-dir', 'app', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: backendDir, stdio: 'inherit', shell: false, windowsHide: true },
);

child.on('exit', (code) => process.exit(code ?? 0));
