import { describe, expect, it } from 'vitest';
import { isServiceHealthy } from './devHealthCheck.mjs';

describe('devHealthCheck', () => {
  it('returns false for unreachable url', async () => {
    const ok = await isServiceHealthy('http://127.0.0.1:59999/', 500);
    expect(ok).toBe(false);
  });
});
