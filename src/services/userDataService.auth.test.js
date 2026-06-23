import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('signIn', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('requires email with field hint', async () => {
    vi.doMock('../lib/supabase', () => ({
      getSupabaseClient: () => ({ auth: { signInWithPassword: vi.fn() } }),
    }));

    const { signIn } = await import('./userDataService');

    await expect(signIn('', 'secret')).rejects.toMatchObject({
      message: 'Укажите email',
      field: 'email',
    });
  });

  it('requires password with field hint', async () => {
    vi.doMock('../lib/supabase', () => ({
      getSupabaseClient: () => ({ auth: { signInWithPassword: vi.fn() } }),
    }));

    const { signIn } = await import('./userDataService');

    await expect(signIn('user@example.com', '')).rejects.toMatchObject({
      message: 'Укажите пароль',
      field: 'password',
    });
  });

  it('rate limits repeated signIn attempts per email', async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });
    vi.doMock('../lib/supabase', () => ({
      getSupabaseClient: () => ({ auth: { signInWithPassword } }),
    }));

    const { resetAuthRateLimitForTests, signIn } = await import('./userDataService');
    resetAuthRateLimitForTests();

    for (let i = 0; i < 10; i += 1) {
      await signIn('user@example.com', 'wrong-password').catch(() => {});
    }

    await expect(signIn('user@example.com', 'wrong-password')).rejects.toMatchObject({
      message: 'Слишком много попыток. Подождите минуту.',
      field: 'form',
    });
    expect(signInWithPassword).toHaveBeenCalledTimes(10);
  });
});

describe('signUp', () => {
  it('requires displayName with field hint', async () => {
    vi.doMock('../lib/supabase', () => ({
      getSupabaseClient: () => ({ auth: { signUp: vi.fn() } }),
    }));

    const { signUp } = await import('./userDataService');

    await expect(signUp('user@example.com', 'password123', '   ')).rejects.toMatchObject({
      message: 'Укажите имя',
      field: 'displayName',
    });
  });

  it('validates password length with field hint', async () => {
    vi.doMock('../lib/supabase', () => ({
      getSupabaseClient: () => ({ auth: { signUp: vi.fn() } }),
    }));

    const { signUp } = await import('./userDataService');

    await expect(signUp('user@example.com', '123', 'Мира')).rejects.toMatchObject({
      message: 'Пароль должен быть не короче 6 символов',
      field: 'password',
    });
  });
});
