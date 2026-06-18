import { describe, expect, it, beforeEach, vi } from 'vitest';

import { findCharacterById } from '../characters';

import {

  fetchCharacterConstellationData,

  getConstellationLevelIconUrl,

  getConstellationShapeUrl,

  clearConstellationCache,

} from './constellationService';



describe('constellationService', () => {

  beforeEach(() => {

    clearConstellationCache();

    vi.restoreAllMocks();

  });



  it('builds jmp.blue image urls for known characters after fetch', async () => {

    vi.stubGlobal('fetch', vi.fn()

      .mockRejectedValueOnce(new Error('genshin-db down'))

      .mockResolvedValueOnce({

        ok: true,

        json: async () => ({

          constellation: 'Carmen Dei',

          description: 'A bard from Mondstadt.',

          constellations: [

            { level: 1, name: 'Splitting Gale', description: 'Extra arrows.' },

          ],

        }),

      })

      .mockResolvedValueOnce({

        ok: true,

        json: async () => ({

          query: { pages: { 1: { imageinfo: [{ url: 'https://example.com/carmen-dei-shape.png' }] } } },

        }),

      }));



    const venti = findCharacterById('venti');

    await fetchCharacterConstellationData(venti);



    expect(getConstellationShapeUrl(venti)).toBe(

      'https://genshin.jmp.blue/characters/venti/constellation-shape',

    );

    expect(getConstellationLevelIconUrl(venti, 3)).toBe(

      'https://genshin.jmp.blue/characters/venti/constellation-3',

    );

  });



  it('loads Russian constellations and jmp shape from genshin-db-api', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 2201,
          name: 'Венти',
          c1: { name: 'Дробящий шторм', effect: 'Дополнительные стрелы.' },
          images: {
            constellation: 'Eff_UI_Talent_Venti',
            c1: 'UI_Talent_S_Venti_01',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          constellation: 'Бог Песен',
          description: 'Бард из Мондштадта.',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          constellation: 'Carmen Dei',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'Carmen Dei',
          c1: { name: 'Splitting Gale', effect: 'Extra arrows.' },
          images: { constellation: 'Eff_UI_Talent_Venti' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: { pages: { 1: { imageinfo: [{ url: 'https://example.com/carmen-dei-shape.png' }] } } },
        }),
      }));

    const venti = findCharacterById('venti');
    const data = await fetchCharacterConstellationData(venti);

    expect(data.fromApi).toBe(true);
    expect(data.constellationName).toBe('Бог Песен');
    expect(data.shapeUrl).toBe('https://genshin.jmp.blue/characters/venti/constellation-shape');
    expect(data.shapeUrlCandidates).toContain('https://example.com/carmen-dei-shape.png');
    expect(data.items[1]).toMatchObject({
      level: 1,
      title: 'Дробящий шторм',
      description: 'Дополнительные стрелы.',
      iconUrl: 'https://enka.network/ui/UI_Talent_S_Venti_01.png',
    });
  });

  it('loads enka constellation icons for characters missing on jmp.blue', async () => {

    vi.stubGlobal('fetch', vi.fn()

      .mockResolvedValueOnce({

        ok: true,

        json: async () => ({

          name: 'Флинс',

          c1: { name: 'C1', effect: 'Эффект созвездия.' },

          images: {

            constellation: 'Eff_UI_Talent_Flins',

            c1: 'UI_Talent_S_Flins_01',

          },

        }),

      })

      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          constellation: 'Ночной Фонарь',
          description: 'Описание персонажа.',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          constellation: 'Laterna Vigilis',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'Laterna Vigilis',
          c1: { name: 'C1', effect: 'Effect.' },
          images: { constellation: 'Eff_UI_Talent_Flins' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: { pages: { 1: { imageinfo: [{ url: 'https://example.com/laterna-vigilis-shape.png' }] } } },
        }),
      }));



    const flins = findCharacterById('flins');

    const data = await fetchCharacterConstellationData(flins);



    expect(data.shapeUrl).toBe('https://enka.network/ui/Eff_UI_Talent_Flins.png');
    expect(data.shapeUrlCandidates).toContain('https://example.com/laterna-vigilis-shape.png');
    expect(data.items[1].iconUrl).toBe('https://enka.network/ui/UI_Talent_S_Flins_01.png');

    expect(getConstellationLevelIconUrl(flins, 1)).toBe(

      'https://enka.network/ui/UI_Talent_S_Flins_01.png',

    );

  });



  it('returns unavailable when API is offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const flins = findCharacterById('flins');
    const data = await fetchCharacterConstellationData(flins);

    expect(data.fromApi).toBe(false);
    expect(data.unavailable).toBe(true);
    expect(data.items).toHaveLength(0);
  });

});

