import { describe, expect, it, vi } from 'vitest';
import { withTimeout } from './withTimeout';

describe('withTimeout', () => {
  it('resolves when promise completes in time', async () => {
    await expect(withTimeout(Promise.resolve(42), 100)).resolves.toBe(42);
  });

  it('rejects when promise exceeds timeout', async () => {
    vi.useFakeTimers();
    const slow = new Promise((resolve) => {
      setTimeout(() => resolve('late'), 5000);
    });
    const result = withTimeout(slow, 100, 'too slow');
    vi.advanceTimersByTime(101);
    await expect(result).rejects.toThrow('too slow');
    vi.useRealTimers();
  });
});
