import { describe, expect, it } from 'vitest';
import {
  canRestartDevProcess,
  DEV_STARTUP_GRACE_MS,
  isDevProcessAlive,
  isInStartupGrace,
  nextRestartDelay,
  shouldResetRestartCounter,
  STABLE_UPTIME_MS,
} from './devProcessUtils.mjs';

describe('devProcessUtils', () => {
  it('allows restart unless shutting down', () => {
    expect(canRestartDevProcess({ shuttingDown: false })).toBe(true);
    expect(canRestartDevProcess({ shuttingDown: true })).toBe(false);
  });

  it('increases restart delay with backoff', () => {
    expect(nextRestartDelay(1)).toBeLessThan(nextRestartDelay(3));
  });

  it('resets restart counter after stable uptime', () => {
    expect(shouldResetRestartCounter(STABLE_UPTIME_MS)).toBe(true);
    expect(shouldResetRestartCounter(STABLE_UPTIME_MS - 1)).toBe(false);
  });

  it('detects alive child process', () => {
    expect(isDevProcessAlive({ exitCode: null, signalCode: null })).toBe(true);
    expect(isDevProcessAlive({ exitCode: 1, signalCode: null })).toBe(false);
    expect(isDevProcessAlive(null)).toBe(false);
  });

  it('respects startup grace window', () => {
    const now = 10_000;
    expect(isInStartupGrace(now - 1_000, now)).toBe(true);
    expect(isInStartupGrace(now - DEV_STARTUP_GRACE_MS, now)).toBe(false);
  });
});
