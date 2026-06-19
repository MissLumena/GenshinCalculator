/**

 * Запуск FastAPI и Vite: npm run dev / npm run dev:full

 *

 * - без shell: true (нет «Завершить пакетное задание» на Windows)

 * - освобождает порты перед стартом

 * - перезапускает упавший сервис, не убивая второй

 * - watchdog поднимает сервис только если процесс уже завершился

 */

import { spawn } from 'node:child_process';

import path from 'node:path';

import { fileURLToPath } from 'node:url';

import { backendDir, readApiPort, resolvePython, root } from './devConfig.mjs';

import { syncSupabaseEnv } from './sync-supabase-env.mjs';

import { freePort } from './devPortUtils.mjs';

import { isServiceHealthy } from './devHealthCheck.mjs';

import {

  canRestartDevProcess,

  isDevProcessAlive,

  isInStartupGrace,

  nextRestartDelay,

  shouldResetRestartCounter,

} from './devProcessUtils.mjs';



const WEB_PORT = 5173;

const port = readApiPort();

const python = resolvePython();

const isWindows = process.platform === 'win32';

const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

const API_HEALTH_TIMEOUT_MS = 8000;



syncSupabaseEnv(root, backendDir);



freePort(WEB_PORT);

freePort(port);



let shuttingDown = false;

const restartCounts = { api: 0, web: 0 };

const startedAt = { api: 0, web: 0 };

const restarting = { api: false, web: false };

const stoppingIntentionally = { api: false, web: false };

let apiProcess = null;

let webProcess = null;



function killProcessTree(child) {

  if (!child?.pid) return;

  try {

    if (isWindows) {

      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {

        shell: false,

        stdio: 'ignore',

        windowsHide: true,

      });

    } else {

      child.kill('SIGTERM');

    }

  } catch {

    // ignore

  }

}



function resetRestartCount(label) {

  restartCounts[label] = 0;

}



function scheduleRestart(label, startFn) {

  if (!canRestartDevProcess({ shuttingDown })) return;

  if (restarting[label]) return;



  restarting[label] = true;

  restartCounts[label] += 1;

  const delay = nextRestartDelay(restartCounts[label]);



  console.warn(

    `[dev] ${label} недоступен. Перезапуск #${restartCounts[label]} через ${delay}ms…`,

  );



  setTimeout(() => {

    restarting[label] = false;

    if (!shuttingDown) startFn();

  }, delay);

}



function trackStableUptime(label) {

  const checkInterval = setInterval(() => {

    if (shuttingDown) {

      clearInterval(checkInterval);

      return;

    }

    const uptime = Date.now() - startedAt[label];

    if (shouldResetRestartCounter(uptime)) {

      resetRestartCount(label);

    }

  }, 30_000);

}



function stopService(label) {

  const child = label === 'api' ? apiProcess : webProcess;

  if (!child) return;



  stoppingIntentionally[label] = true;

  killProcessTree(child);



  if (label === 'api') {

    apiProcess = null;

  } else {

    webProcess = null;

  }

}



function handleProcessExit(label, code, startFn) {

  const intentional = stoppingIntentionally[label];

  stoppingIntentionally[label] = false;



  if (label === 'api') apiProcess = null;

  else webProcess = null;



  if (shuttingDown || intentional) return;



  if (code) {

    console.warn(`[dev] ${label} exit code: ${code}`);

  }

  scheduleRestart(label, startFn);

}



function startApi() {

  stopService('api');

  apiProcess = spawn(

    python,

    [

      '-m',

      'uvicorn',

      'app.main:app',

      '--reload',

      '--reload-dir',

      'app',

      '--host',

      '127.0.0.1',

      '--port',

      String(port),

    ],

    {

      cwd: backendDir,

      stdio: 'inherit',

      shell: false,

      windowsHide: true,

      env: {

        ...process.env,

        NOTION_STARTUP_CHECK: process.env.NOTION_STARTUP_CHECK ?? 'false',

      },

    },

  );



  startedAt.api = Date.now();

  trackStableUptime('api');



  apiProcess.on('error', (err) => {

    console.error('[dev] Backend error:', err.message);

    if (!stoppingIntentionally.api) {

      scheduleRestart('api', startApi);

    }

  });



  apiProcess.on('exit', (code) => {

    handleProcessExit('api', code, startApi);

  });

}



function startWeb() {

  stopService('web');

  webProcess = spawn(process.execPath, [viteBin], {

    cwd: root,

    stdio: 'inherit',

    shell: false,

    windowsHide: true,

    env: { ...process.env, FORCE_COLOR: '1' },

  });



  startedAt.web = Date.now();

  trackStableUptime('web');



  webProcess.on('error', (err) => {

    console.error('[dev] Vite error:', err.message);

    if (!stoppingIntentionally.web) {

      scheduleRestart('web', startWeb);

    }

  });



  webProcess.on('exit', (code) => {

    handleProcessExit('web', code, startWeb);

  });

}



async function runHealthWatchdog() {

  if (shuttingDown) return;



  const apiUrl = `http://127.0.0.1:${port}/health`;

  const webUrl = `http://127.0.0.1:${WEB_PORT}/`;



  const apiAlive = isDevProcessAlive(apiProcess);

  const webAlive = isDevProcessAlive(webProcess);



  if (!isInStartupGrace(startedAt.api)) {

    const apiOk = apiAlive

      ? await isServiceHealthy(apiUrl, API_HEALTH_TIMEOUT_MS)

      : false;



    if (!apiAlive && !restarting.api) {

      console.warn('[dev] Watchdog: backend не запущен');

      scheduleRestart('api', startApi);

    } else if (apiAlive && !apiOk) {

      console.warn('[dev] Watchdog: backend ещё отвечает медленно, ждём…');

    }

  }



  if (!isInStartupGrace(startedAt.web)) {

    const webOk = webAlive

      ? await isServiceHealthy(webUrl)

      : false;



    if (!webAlive && !restarting.web) {

      console.warn('[dev] Watchdog: frontend не запущен');

      scheduleRestart('web', startWeb);

    } else if (webAlive && !webOk) {

      console.warn('[dev] Watchdog: frontend ещё отвечает медленно, ждём…');

    }

  }

}



function shutdown(code = 0) {

  if (shuttingDown) return;

  shuttingDown = true;

  stoppingIntentionally.api = true;

  stoppingIntentionally.web = true;

  killProcessTree(apiProcess);

  killProcessTree(webProcess);

  apiProcess = null;

  webProcess = null;

  setTimeout(() => process.exit(code), 300);

}



process.on('SIGINT', () => shutdown(0));

process.on('SIGTERM', () => shutdown(0));



if (!process.stdin.isTTY) {

  // Фоновый режим Cursor/CI — не даём stdin закрытию убить дочерние процессы

  process.stdin.resume();

}



startApi();

startWeb();



setInterval(runHealthWatchdog, 20_000);



console.log(`[dev] Backend:  http://127.0.0.1:${port}`);

console.log(`[dev] Frontend: http://127.0.0.1:${WEB_PORT}`);

console.log('[dev] Supervisor: автоперезапуск + watchdog каждые 20с.');

console.log('[dev] Держите терминал открытым или используйте start-dev.cmd');


