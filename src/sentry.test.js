import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/react';
import { captureAppError, getSentryConfig, initSentry } from './sentry';

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  init: vi.fn(),
}));

describe('frontend Sentry config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not initialize without DSN', async () => {
    expect(getSentryConfig({ MODE: 'test' })).toBeNull();
    await expect(initSentry({ MODE: 'test' })).resolves.toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('initializes with env values', async () => {
    const env = {
      MODE: 'production',
      VITE_SENTRY_DSN: 'https://public@sentry.example/1',
      VITE_SENTRY_ENVIRONMENT: 'production',
      VITE_SENTRY_TRACES_SAMPLE_RATE: '0.25',
      VITE_SENTRY_RELEASE: 'genshin@1.0.0',
    };

    await expect(initSentry(env)).resolves.toBe(true);
    expect(Sentry.init).toHaveBeenCalledWith({
      dsn: 'https://public@sentry.example/1',
      environment: 'production',
      tracesSampleRate: 0.25,
      release: 'genshin@1.0.0',
    });
  });

  it('captures ErrorBoundary errors with React context', async () => {
    const error = new Error('boom');
    const info = { componentStack: 'App' };
    const env = { VITE_SENTRY_DSN: 'https://public@sentry.example/1' };

    captureAppError(error, info, env);
    await vi.waitFor(() => {
      expect(Sentry.captureException).toHaveBeenCalled();
    });

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      contexts: { react: info },
    });
  });
});
