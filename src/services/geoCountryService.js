/**
 * Страна пользователя для ограничения OAuth (Google/Apple).
 */
import { isOAuthAllowedForCountry } from '../lib/oauthPolicy';

const API_BASE = import.meta.env.VITE_API_URL || '';
const DEV_COUNTRY = import.meta.env.VITE_GEO_COUNTRY_OVERRIDE || '';

let cachedPolicy = null;

function buildUrl(path) {
  return `${API_BASE}${path}`;
}

function resolveDevOverride() {
  const code = typeof DEV_COUNTRY === 'string' ? DEV_COUNTRY.trim().toUpperCase() : '';
  if (code.length !== 2) return null;
  return code;
}

export async function fetchAuthCountryPolicy({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedPolicy) return cachedPolicy;

  const devOverride = resolveDevOverride();
  if (devOverride) {
    cachedPolicy = {
      countryCode: devOverride,
      oauthAllowed: isOAuthAllowedForCountry(devOverride),
      source: 'dev',
    };
    return cachedPolicy;
  }

  try {
    const response = await fetch(buildUrl('/api/auth/country'));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    cachedPolicy = {
      countryCode: data.country_code ?? null,
      oauthAllowed: Boolean(data.oauth_allowed),
      source: 'api',
    };
    return cachedPolicy;
  } catch {
    cachedPolicy = {
      countryCode: null,
      oauthAllowed: true,
      source: 'fallback',
    };
    return cachedPolicy;
  }
}

export function clearAuthCountryPolicyCache() {
  cachedPolicy = null;
}
