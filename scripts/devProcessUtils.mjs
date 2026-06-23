/** Правила перезапуска dev-процессов (npm run dev:full). */

/** После стабильной работы сбрасываем счётчик перезапусков. */
export const STABLE_UPTIME_MS = 60_000;

/** Базовая задержка перед перезапуском. */
export const DEV_RESTART_DELAY_MS = 1500;

/** Максимальная задержка (экспоненциальный backoff). */
export const MAX_RESTART_DELAY_MS = 15_000;

/** Не перезапускать watchdog'ом, пока сервис ещё поднимается (Notion check и reload). */
export const DEV_STARTUP_GRACE_MS = 25_000;

export function canRestartDevProcess({ shuttingDown }) {
  return !shuttingDown;
}

export function isDevProcessAlive(child) {
  return Boolean(child && child.exitCode === null && child.signalCode === null);
}

export function isInStartupGrace(startedAtMs, nowMs = Date.now()) {
  return startedAtMs > 0 && nowMs - startedAtMs < DEV_STARTUP_GRACE_MS;
}

export function nextRestartDelay(restartCount) {
  const delay = DEV_RESTART_DELAY_MS * (2 ** Math.min(restartCount, 4));
  return Math.min(delay, MAX_RESTART_DELAY_MS);
}

export function shouldResetRestartCounter(uptimeMs) {
  return uptimeMs >= STABLE_UPTIME_MS;
}
