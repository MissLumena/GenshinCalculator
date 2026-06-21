/** ISO 3166-1 alpha-2: Google/Apple OAuth недоступны, Mail.ru и email доступны. */
export const OAUTH_BLOCKED_COUNTRY_CODES = new Set(['RU']);

export const OAUTH_PROVIDER_MAILRU = 'mailru';

export const OAUTH_PROVIDERS_GOOGLE_APPLE = ['google', 'apple'];

export const OAUTH_PROVIDERS = [...OAUTH_PROVIDERS_GOOGLE_APPLE, OAUTH_PROVIDER_MAILRU];

export function isOAuthBlockedCountry(countryCode) {
  if (!countryCode || typeof countryCode !== 'string') return false;
  return OAUTH_BLOCKED_COUNTRY_CODES.has(countryCode.trim().toUpperCase());
}

/** Google и Apple доступны вне России. */
export function isOAuthAllowedForCountry(countryCode) {
  return !isOAuthBlockedCountry(countryCode);
}

export function isSupportedOAuthProvider(provider) {
  return OAUTH_PROVIDERS.includes(provider);
}

/** Проверяет, можно ли использовать провайдер в данной стране. */
export function isOAuthProviderAllowedInCountry(provider, countryCode) {
  if (!isSupportedOAuthProvider(provider)) return false;
  if (provider === OAUTH_PROVIDER_MAILRU) return true;
  return isOAuthAllowedForCountry(countryCode);
}

export function assertOAuthAllowedForCountry(provider, countryCode) {
  if (isOAuthProviderAllowedInCountry(provider, countryCode)) return;

  if (provider === OAUTH_PROVIDER_MAILRU) {
    throw new Error('Вход через Mail.ru временно недоступен.');
  }

  throw new Error(
    'Регистрация и вход через Google и Apple недоступны из России. Используйте email или Mail.ru.',
  );
}
