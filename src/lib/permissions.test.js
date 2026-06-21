import { describe, expect, it, vi } from 'vitest';
import {
  canDeleteAnyNotionResult,
  canDeleteNotionResult,
  isNotionDeleteSuperuser,
} from './permissions';

describe('permissions', () => {
  const item = { page_id: 'p1', user_id: 'owner-1' };

  it('denies delete for regular users and owners', () => {
    const ownerSession = { user: { id: 'owner-1', email: 'owner@example.com' } };
    const otherSession = { user: { id: 'other-user', email: 'other@example.com' } };

    expect(canDeleteNotionResult(ownerSession, item)).toBe(false);
    expect(canDeleteNotionResult(otherSession, item)).toBe(false);
  });

  it('denies delete for app_metadata superuser with wrong email', () => {
    const session = {
      user: {
        id: 'admin-user',
        email: 'other@example.com',
        app_metadata: { role: 'superuser' },
      },
    };
    expect(isNotionDeleteSuperuser(session)).toBe(false);
    expect(canDeleteNotionResult(session, item)).toBe(false);
  });

  it('allows delete only for configured superuser email', async () => {
    vi.stubEnv('VITE_SUPERUSER_EMAILS', 'kondratovic91@mail.ru');
    vi.resetModules();
    const permissions = await import('./permissions');
    const session = {
      user: { id: 'super-1', email: 'kondratovic91@mail.ru' },
    };

    expect(permissions.isNotionDeleteSuperuser(session)).toBe(true);
    expect(permissions.canDeleteAnyNotionResult(session)).toBe(true);
    expect(permissions.canDeleteNotionResult(session, item)).toBe(true);
    vi.unstubAllEnvs();
  });

  it('uses backend permissions email when session email is missing', async () => {
    vi.stubEnv('VITE_SUPERUSER_EMAILS', 'kondratovic91@mail.ru');
    vi.resetModules();
    const permissions = await import('./permissions');
    const session = { user: { id: 'super-1' } };
    const authPermissions = {
      email: 'kondratovic91@mail.ru',
      can_delete_any_notion_result: true,
    };

    expect(permissions.canDeleteNotionResult(session, item, authPermissions)).toBe(true);
    vi.unstubAllEnvs();
  });
});
