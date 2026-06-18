import { describe, expect, it, vi } from 'vitest';

import { buildNotionSavePayload } from './notionService';

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
    expect(payload.members[0]).toContain('Венти C0');
    expect(payload.levels_label).toBe('90, 80');
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

  it('fetchNotionResults maps backend 500 to helpful message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => 'text/plain' },
      text: async () => 'Internal Server Error',
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchNotionResults } = await import('./notionService');
    await expect(fetchNotionResults()).rejects.toThrow(/dev:full|dev:api/i);

    vi.unstubAllGlobals();
  });
});
