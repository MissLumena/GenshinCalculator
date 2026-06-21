import { describe, expect, it } from 'vitest';
import {
  assertOAuthAllowedForCountry,
  isOAuthAllowedForCountry,
  isOAuthBlockedCountry,
  isOAuthProviderAllowedInCountry,
  OAUTH_PROVIDER_MAILRU,
} from './oauthPolicy';

describe('oauthPolicy', () => {
  it('blocks Google and Apple in Russia', () => {
    expect(isOAuthBlockedCountry('RU')).toBe(true);
    expect(isOAuthBlockedCountry('ru')).toBe(true);
    expect(isOAuthAllowedForCountry('RU')).toBe(false);
    expect(isOAuthProviderAllowedInCountry('google', 'RU')).toBe(false);
    expect(isOAuthProviderAllowedInCountry('apple', 'RU')).toBe(false);
  });

  it('allows Mail.ru in Russia', () => {
    expect(isOAuthProviderAllowedInCountry(OAUTH_PROVIDER_MAILRU, 'RU')).toBe(true);
  });

  it('allows other countries', () => {
    expect(isOAuthBlockedCountry('DE')).toBe(false);
    expect(isOAuthAllowedForCountry('US')).toBe(true);
    expect(isOAuthProviderAllowedInCountry('google', 'US')).toBe(true);
  });

  it('does not block when country unknown', () => {
    expect(isOAuthBlockedCountry(null)).toBe(false);
    expect(isOAuthAllowedForCountry(undefined)).toBe(true);
    expect(isOAuthProviderAllowedInCountry('google', undefined)).toBe(true);
  });

  it('throws readable error for blocked Google/Apple in Russia', () => {
    expect(() => assertOAuthAllowedForCountry('google', 'RU')).toThrow(/Google и Apple/i);
    expect(() => assertOAuthAllowedForCountry('apple', 'RU')).toThrow(/Google и Apple/i);
  });

  it('does not throw for Mail.ru in Russia', () => {
    expect(() => assertOAuthAllowedForCountry(OAUTH_PROVIDER_MAILRU, 'RU')).not.toThrow();
  });
});
