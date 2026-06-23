import { describe, expect, it, vi, beforeEach } from 'vitest';
import { findCharacterById } from './characters';
import {
  clearTalentCache,
  fetchCharacterTalents,
  TALENT_SLOTS,
} from './services/talentService';

describe('talentService', () => {
  beforeEach(() => {
    clearTalentCache();
    vi.unstubAllGlobals();
  });

  it('defines six talent slots', () => {
    expect(TALENT_SLOTS).toHaveLength(6);
    expect(TALENT_SLOTS.map((slot) => slot.key)).toEqual([
      'combat1',
      'combat2',
      'combat3',
      'passive1',
      'passive2',
      'passive3',
    ]);
  });

  it('maps talents API response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        combat1: {
          name: 'Обычная атака',
          info: 'Описание обычной атаки.',
          images: { skill: 'Skill_E_Venti_01' },
        },
        combat2: {
          name: 'Элементальный навык',
          info: 'Описание навыка.',
        },
      }),
    }));

    const character = findCharacterById('venti');
    const result = await fetchCharacterTalents(character);

    expect(result.talents).toHaveLength(2);
    expect(result.talents[0]).toMatchObject({
      key: 'combat1',
      name: 'Обычная атака',
      description: 'Описание обычной атаки.',
      iconUrl: 'https://enka.network/ui/Skill_E_Venti_01.png',
    });
    expect(result.unavailable).toBe(false);
  });

  it('returns unavailable when API has no talents', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }));

    const character = findCharacterById('venti');
    const result = await fetchCharacterTalents(character);

    expect(result.talents).toEqual([]);
    expect(result.unavailable).toBe(true);
  });

  it('uses traveler element query override', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        combat2: { name: 'Навык', info: 'Описание.' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const traveler = findCharacterById('traveler');
    await fetchCharacterTalents(traveler, { element: 'Pyro' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('query=Traveler%20Pyro'),
    );
  });
});
