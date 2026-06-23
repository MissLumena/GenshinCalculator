const DEFAULT_TRACES_SAMPLE_RATE = 0.1;
let sentryModulePromise = null;

function parseSampleRate(value) {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_TRACES_SAMPLE_RATE;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_TRACES_SAMPLE_RATE;
  }

  return Math.min(Math.max(parsed, 0), 1);
}

export function getSentryConfig(env = import.meta.env) {
  const dsn = String(env.VITE_SENTRY_DSN || '').trim();
  if (!dsn) {
    return null;
  }

  const environment = String(
    env.VITE_SENTRY_ENVIRONMENT || env.MODE || 'development',
  ).trim();
  const release = String(env.VITE_SENTRY_RELEASE || '').trim();

  return {
    dsn,
    environment: environment || 'development',
    tracesSampleRate: parseSampleRate(env.VITE_SENTRY_TRACES_SAMPLE_RATE),
    ...(release ? { release } : {}),
  };
}

function loadSentryModule() {
  if (!sentryModulePromise) {
    sentryModulePromise = import('@sentry/react');
  }
  return sentryModulePromise;
}

export async function initSentry(env = import.meta.env) {
  const config = getSentryConfig(env);
  if (!config) {
    return false;
  }

  const Sentry = await loadSentryModule();
  Sentry.init(config);
  return true;
}

export function captureAppError(error, info, env = import.meta.env) {
  if (!getSentryConfig(env)) {
    return;
  }

  void loadSentryModule()
    .then((Sentry) => {
      Sentry.captureException(error, {
        contexts: info ? { react: info } : undefined,
      });
    })
    .catch((loadError) => {
      console.error('Sentry load error:', loadError);
    });
}
