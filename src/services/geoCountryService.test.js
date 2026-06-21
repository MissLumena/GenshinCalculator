import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  clearAuthCountryPolicyCache,
  fetchAuthCountryPolicy,
} from './geoCountryService';

describe('geoCountryService', () => {
  beforeEach(() => {
    clearAuthCountryPolicyCache();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns blocked policy for RU from API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ country_code: 'RU', oauth_allowed: false }),
    }));

    const policy = await fetchAuthCountryPolicy();
    expect(policy.countryCode).toBe('RU');
    expect(policy.oauthAllowed).toBe(false);
  });

  it('falls back to oauth allowed when API unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    const policy = await fetchAuthCountryPolicy();
    expect(policy.oauthAllowed).toBe(true);
    expect(policy.source).toBe('fallback');
  });
});
