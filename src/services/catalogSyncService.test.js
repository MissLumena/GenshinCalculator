import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureGameCharacterInDb, ensureCatalogForConfig } from './catalogSyncService';

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}));

describe('catalogSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ensureGameCharacterInDb calls upsert_game_character RPC', async () => {
    mockRpc.mockResolvedValue({ error: null });

    const ok = await ensureGameCharacterInDb({
      id: 'hu-tao',
      nameEn: 'Hu Tao',
      nameRu: 'Ху Тао',
      element: 'Pyro',
      weapon: 'Polearm',
      rarity: 5,
      region: 'liyue',
      iconId: 'hu-tao',
    });

    expect(ok).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('upsert_game_character', expect.objectContaining({
      p_id: 'hu-tao',
      p_name_ru: 'Ху Тао',
    }));
  });

  it('ensureCatalogForConfig falls back to select when RPC is missing', async () => {
    mockRpc.mockResolvedValue({
      error: { message: 'Could not find the function public.upsert_game_character', code: 'PGRST202' },
    });

    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'hu-tao' }, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    mockFrom.mockReturnValue({ select });

    await ensureCatalogForConfig(
      { characterId: 'hu-tao', artifacts: { set: 'crimson' } },
      (id) => ({
        id,
        nameEn: 'Hu Tao',
        nameRu: 'Ху Тао',
        element: 'Pyro',
        weapon: 'Polearm',
        rarity: 5,
        region: 'liyue',
      }),
      [{ id: 'crimson', name: 'Crimson', bonus2: 'a', bonus4: 'b' }],
    );

    expect(mockFrom).toHaveBeenCalledWith('game_characters');
  });

  it('ensureCatalogForConfig syncs both artifact sets in 4+2 loadout', async () => {
    mockRpc
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null });

    await ensureCatalogForConfig(
      {
        characterId: 'hu-tao',
        artifacts: { set: 'emblem-of-severed-fate', set2: 'noblesse-oblige' },
      },
      (id) => ({
        id,
        nameEn: 'Hu Tao',
        nameRu: 'Ху Тао',
        element: 'Pyro',
        weapon: 'Polearm',
        rarity: 5,
        region: 'liyue',
      }),
      [
        { id: 'emblem-of-severed-fate', name: 'Emblem', bonus2: 'a', bonus4: 'b' },
        { id: 'noblesse-oblige', name: 'Noblesse', bonus2: 'c', bonus4: 'd' },
      ],
    );

    expect(mockRpc).toHaveBeenCalledWith('upsert_artifact_set', expect.objectContaining({
      p_id: 'emblem-of-severed-fate',
    }));
    expect(mockRpc).toHaveBeenCalledWith('upsert_artifact_set', expect.objectContaining({
      p_id: 'noblesse-oblige',
    }));
  });
});
