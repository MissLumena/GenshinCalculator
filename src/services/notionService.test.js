import { describe, expect, it, vi } from 'vitest';

import { buildNotionSavePayload, validateNotionSavePayload } from './notionService';

describe('notionService', () => {
  it('buildNotionSavePayload formats team summary', () => {
    const team = ['venti', 'hu-tao'];
    const findCharacter = (id) => ({
      venti: { id: 'venti', nameRu: 'Венти' },
      'hu-tao': { id: 'hu-tao', nameRu: 'Ху Тао' },
    }[id]);
    const getConfig = (id) => ({
      venti: { level: 90, constellation: 0, atk: { base: 300, bonus: 100 } },
      'hu-tao': { level: 80, constellation: 1, atk: { base: 320, bonus: 120 } },
    }[id]);

    const payload = buildNotionSavePayload({
      team,
      getConfig,
      findCharacter,
      totalDps: 12000,
      displayName: 'Tester',
    });

    expect(payload.team_label).toBe('Венти, Ху Тао');
    expect(payload.total_dps).toBe(12000);
    expect(payload.members[0]).toMatch(/^venti\|/);
    expect(payload.members[0]).toContain('Венти C0');
    expect(payload.levels_label).toBe('90, 80|venti,hu-tao');
    expect(payload.display_name).toBe('Tester');
  });

  it('saveResultToNotion sends bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ item: { page_id: 'p1' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { saveResultToNotion } = await import('./notionService');
    await saveResultToNotion({ team_label: 'A', total_dps: 1000, members: [] }, 'token-123');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notion/save-result',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      }),
    );

    vi.unstubAllGlobals();
  });

  it('validateNotionSavePayload rejects zero dps', () => {
    try {
      validateNotionSavePayload({
        team_label: 'Вентi',
        total_dps: 0,
        members: [],
      });
      throw new Error('expected validation error');
    } catch (error) {
      expect(error.message).toMatch(/DPS/i);
      expect(error.field).toBe('total_dps');
    }
  });

  it('validateNotionSavePayload rejects empty team with field', () => {
    try {
      validateNotionSavePayload({
        team_label: '   ',
        total_dps: 1000,
        members: [],
      });
      throw new Error('expected validation error');
    } catch (error) {
      expect(error.field).toBe('team_label');
    }
  });

  it('saveResultToNotion maps validation errors to readable text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      headers: { get: () => 'application/json' },
      json: async () => ({
        detail: [{
          loc: ['body', 'total_dps'],
          msg: 'Input should be greater than 0',
        }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { saveResultToNotion } = await import('./notionService');
    await expect(saveResultToNotion({ team_label: 'A', total_dps: 0, members: [] }, 'token'))
      .rejects.toThrow(/Суммарный DPS/i);

    vi.unstubAllGlobals();
  });

  it('saveResultToNotion maps 401 to session message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      json: async () => ({ detail: 'Invalid or expired token' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { saveResultToNotion } = await import('./notionService');
    await expect(saveResultToNotion({ team_label: 'A', total_dps: 1000, members: [] }, 'token'))
      .rejects.toThrow(/Сессия истекла/i);

    vi.unstubAllGlobals();
  });

  it('fetchNotionResults requires access token', async () => {
    const { fetchNotionResults } = await import('./notionService');
    await expect(fetchNotionResults(null)).rejects.toThrow(/Войдите в аккаунт/i);
  });

  it('fetchNotionResults sends bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ items: [{ page_id: 'p1' }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchNotionResults } = await import('./notionService');
    const data = await fetchNotionResults('token-abc');
    expect(data.items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notion/results',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-abc',
        }),
      }),
    );

    vi.unstubAllGlobals();
  });

  it('fetchNotionResults retries transient 502 responses', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        headers: { get: () => 'text/plain' },
        text: async () => 'Bad Gateway',
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ items: [] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchNotionResults } = await import('./notionService');
    await expect(fetchNotionResults('token-abc')).resolves.toEqual({ items: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });

  it('fetchNotionResults surfaces proxy 500 without body as API unavailable', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => 'text/plain' },
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchNotionResults } = await import('./notionService');
    await expect(fetchNotionResults('token-abc')).rejects.toThrow(/API недоступен/i);

    vi.unstubAllGlobals();
  });

  it('fetchNotionResults surfaces backend 500 with detail', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
      json: async () => ({ detail: 'Internal Server Error' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchNotionResults } = await import('./notionService');
    await expect(fetchNotionResults('token-abc')).rejects.toThrow(/Internal Server Error/i);

    vi.unstubAllGlobals();
  });
});
