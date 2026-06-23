import { execSync } from 'node:child_process';

/**
 * Освобождает порт на Windows (убивает процесс, который его слушает).
 * На других ОС — no-op.
 */
export function freePort(port) {
  if (process.platform !== 'win32') return;

  try {
    const output = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
    const pids = new Set();

    for (const line of output.split('\n')) {
      if (!line.includes(`127.0.0.1:${port}`) && !line.includes(`0.0.0.0:${port}`)) {
        continue;
      }
      if (!line.includes('LISTENING')) continue;
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts.at(-1));
      if (pid > 0) pids.add(pid);
    }

    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
      } catch {
        // процесс уже завершился
      }
    }
  } catch {
    // netstat недоступен — пропускаем
  }
}
