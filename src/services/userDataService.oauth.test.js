import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('signInWithOAuth', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('blocks OAuth for Russian users before redirect', async () => {
    const signInWithOAuth = vi.fn();
    vi.doMock('../lib/supabase', () => ({
      getSupabaseClient: () => ({ auth: { signInWithOAuth } }),
    }));

    const { signInWithOAuth: signIn } = await import('./userDataService');

    await expect(signIn('google', 'RU')).rejects.toThrow(/Google и Apple/i);
    expect(signInWithOAuth).not.toHaveBeenCalled();
  });

  it('redirects Mail.ru OAuth through backend start endpoint', async () => {
    const assignMock = vi.fn();
    vi.doMock('../lib/supabase', () => ({
      getSupabaseClient: () => ({ auth: { signInWithOAuth: vi.fn() } }),
    }));
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173', assign: assignMock } });

    const { signInWithOAuth: signIn } = await import('./userDataService');

    await signIn('mailru', 'RU');
    expect(assignMock).toHaveBeenCalledWith('/api/auth/mailru/start');
  });

  it('uses Supabase OAuth for Google outside Russia', async () => {
    const signInWithOAuthMock = vi.fn().mockResolvedValue({ data: { url: 'https://accounts.google.com/o/oauth2' }, error: null });
    const assignMock = vi.fn();
    vi.doMock('../lib/supabase', () => ({
      getSupabaseClient: () => ({ auth: { signInWithOAuth: signInWithOAuthMock } }),
    }));
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173', assign: assignMock } });

    const { signInWithOAuth: signIn } = await import('./userDataService');

    await signIn('google', 'DE');
    expect(signInWithOAuthMock).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({
        redirectTo: 'http://localhost:5173/auth/callback',
      }),
    });
    expect(assignMock).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2');
  });
});
