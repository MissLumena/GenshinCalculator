import { describe, expect, it, vi, afterEach } from 'vitest';
import { getSuperuserE2eCredentials, SUPERUSER_EMAIL } from './helpers.js';

describe('getSuperuserE2eCredentials', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null when password is missing', () => {
    expect(getSuperuserE2eCredentials()).toBeNull();
  });

  it('returns email and password from env', () => {
    vi.stubEnv('E2E_SUPERUSER_PASSWORD', 'secret-for-ci');
    vi.stubEnv('E2E_SUPERUSER_EMAIL', 'admin@example.com');

    expect(getSuperuserE2eCredentials()).toEqual({
      email: 'admin@example.com',
      password: 'secret-for-ci',
    });
  });

  it('uses default superuser email when E2E_SUPERUSER_EMAIL is not set', () => {
    vi.stubEnv('E2E_SUPERUSER_PASSWORD', 'secret-for-ci');

    expect(getSuperuserE2eCredentials()).toEqual({
      email: SUPERUSER_EMAIL,
      password: 'secret-for-ci',
    });
  });
});
