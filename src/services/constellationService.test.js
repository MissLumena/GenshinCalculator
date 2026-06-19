import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('../constellationShapeUrls', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getStaticConstellationShapeUrl: vi.fn(actual.getStaticConstellationShapeUrl),
  };
});

import { findCharacterById } from '../characters';

import {

  fetchCharacterConstellationData,

  getConstellationLevelIconUrl,

  getConstellationShapeUrl,

  clearConstellationCache,

  isEnkaConstellationShapeAsset,

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
    expect(data.shapeUrlCandidates[0]).toBe('https://genshin.jmp.blue/characters/venti/constellation-shape');
    expect(data.items[1]).toMatchObject({
      level: 1,
      title: 'Дробящий шторм',
      description: 'Дополнительные стрелы.',
      iconUrl: 'https://enka.network/ui/UI_Talent_S_Venti_01.png',
    });
  });

  it('skips Eff_UI_Talent enka assets when resolving constellation shape', () => {
    expect(isEnkaConstellationShapeAsset('Eff_UI_Talent_Prune')).toBe(false);
    expect(isEnkaConstellationShapeAsset('UI_Talent_Constellation_Venti')).toBe(true);
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



    expect(data.shapeUrl).toContain('Laterna_Vigilis_Shape');
    expect(data.shapeUrlCandidates[0]).toContain('Laterna_Vigilis_Shape');
    expect(data.shapeUrlCandidates).not.toContain('https://enka.network/ui/Eff_UI_Talent_Flins.png');
    expect(data.items[1].iconUrl).toBe('https://enka.network/ui/UI_Talent_S_Flins_01.png');

    expect(getConstellationLevelIconUrl(flins, 1)).toBe(

      'https://enka.network/ui/UI_Talent_S_Flins_01.png',

    );

  });



  it('loads fandom shape first for Prune when enka asset is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'Prune',
          c1: { name: 'C1', effect: 'Эффект.' },
          images: {
            constellation: 'Eff_UI_Talent_Prune',
            c1: 'UI_Talent_S_Prune_01',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          constellation: 'Turris Venefica',
          element: 'Anemo',
          description: 'Описание.',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          constellation: 'Turris Venefica',
          element: 'Anemo',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'Turris Venefica',
          c1: { name: 'C1', effect: 'Effect.' },
          images: { constellation: 'Eff_UI_Talent_Prune' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: { pages: { 1: { imageinfo: [{ url: 'https://example.com/turris-venefica-shape.png' }] } } },
        }),
      }));

    const pulonia = findCharacterById('pulonia');
    const data = await fetchCharacterConstellationData(pulonia);

    expect(data.shapeUrl).toContain('Turris_Venefica_Shape');
    expect(data.shapeUrlCandidates[0]).toContain('Turris_Venefica_Shape');
    expect(data.element).toBe('Anemo');
  });



  it('returns unavailable when API is offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const flins = findCharacterById('flins');
    const data = await fetchCharacterConstellationData(flins);

    expect(data.fromApi).toBe(false);
    expect(data.unavailable).toBe(true);
    expect(data.items).toHaveLength(0);
  });

  it('resolves Columbina constellation when genshin-db returns ???', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'Columbina',
          c1: { name: 'Radiance Over Blossoms and Peaks', effect: 'Effect.' },
          images: {
            constellation: 'Eff_UI_Talent_Columbina',
            c1: 'UI_Talent_S_Columbina_01',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          constellation: '???',
          description: 'Дева Луны из Нод-Края.',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          constellation: '???',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'Columbina',
          c1: { name: 'Radiance Over Blossoms and Peaks', effect: 'Effect.' },
          images: { constellation: 'Eff_UI_Talent_Columbina' },
        }),
      }));

    const columbina = findCharacterById('columbina');
    const data = await fetchCharacterConstellationData(columbina);

    expect(data.fromApi).toBe(true);
    expect(data.constellationName).toBe('Коломбина Гипоселениа');
    expect(data.shapeUrl).toContain('Columbina_Hyposelenia_Shape');
    expect(data.shapeUrlCandidates[0]).toContain('Columbina_Hyposelenia_Shape');
    expect(data.items[1].iconUrl).toBe('https://enka.network/ui/UI_Talent_S_Columbina_01.png');
  });

  it('loads traveler constellations per selected element', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'Traveler (Geo)',
          c1: { name: 'Несокрушимая стена', effect: 'Geo effect.' },
          images: {
            constellation: 'Eff_UI_Talent_Player_Girl_Geo',
            c1: 'UI_Talent_S_PlayerGirl_Geo_01',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'Traveler (Geo)',
          c1: { name: 'Invincible Stonewall', effect: 'Geo effect.' },
          images: { constellation: 'Eff_UI_Talent_Player_Girl_Geo' },
        }),
      }));

    const traveler = findCharacterById('traveler');
    const data = await fetchCharacterConstellationData(traveler, { element: 'Geo' });

    expect(data.fromApi).toBe(true);
    expect(data.constellationName).toBe('Звёздный Путник');
    expect(data.travelerElement).toBe('Geo');
    expect(data.element).toBe('Geo');
    expect(data.shapeUrl).toContain('Viator_Geo_Shape');
    expect(data.items[1].title).toBe('Несокрушимая стена');
  });

  it('loads traveler pyro constellations', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'Traveler (Pyro)',
          c1: { name: 'Starfire Flow', effect: 'Pyro effect.' },
          images: {
            constellation: 'Eff_UI_Talent_Player_Girl_Pyro',
            c1: 'UI_Talent_S_PlayerGirl_Pyro_01',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'Traveler (Pyro)',
          c1: { name: 'Starfire Flow', effect: 'Pyro effect.' },
          images: { constellation: 'Eff_UI_Talent_Player_Girl_Pyro' },
        }),
      }));

    const traveler = findCharacterById('traveler');
    const data = await fetchCharacterConstellationData(traveler, { element: 'Pyro' });

    expect(data.travelerElement).toBe('Pyro');
    expect(data.shapeUrl).toContain('Viator_Pyro_Shape');
  });

});

