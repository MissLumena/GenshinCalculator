import { describe, it, expect } from 'vitest';
import {
  calculateMockDps,
  getSetBonuses,
  getDefaultConfig,
  findCharacter,
  normalizeArtifacts,
  getDefaultArtifacts,
  getConfigTotalAtk,
  applyConfigTotalAtk,
  normalizeElementalResBonus,
  normalizeElementalResBonuses,
  getElementalResBonusSlots,
  patchElementalResBonusSlot,
  ELEMENTAL_RES_BONUS_OPTIONS,
} from './mockData';
import { DEFAULT_ARTIFACT_SET_ID } from './artifacts';

describe('mockData', () => {
  it('findCharacter returns character by id', () => {
    const char = findCharacter('hu-tao');
    expect(char).toBeDefined();
    expect(char.name).toBe('Hu Tao');
    expect(char.nameRu).toBe('Ху Тао');
  });

  it('getDefaultConfig creates valid config', () => {
    const char = findCharacter('ganyu');
    const config = getDefaultConfig(char);
    expect(config.level).toBe(90);
    expect(getConfigTotalAtk(config.atk)).toBe(400);
    expect(config.talentLevels).toEqual({ auto: 10, skill: 10, burst: 10 });
    expect(config.artifacts.set).toBe(DEFAULT_ARTIFACT_SET_ID);
    expect(config.artifacts.set2).toBeNull();
    expect(config.artifacts.hp).toBeDefined();
    expect(config.elementalResBonuses).toBeNull();
  });

  it('normalizeElementalResBonuses accepts up to two unique bonuses', () => {
    expect(normalizeElementalResBonuses([
      { element: 'Hydro', value: 25 },
      { element: 'Pyro', value: 40 },
    ])).toEqual([
      { element: 'Hydro', value: 25 },
      { element: 'Pyro', value: 40 },
    ]);
    expect(normalizeElementalResBonuses({ element: 'Geo', value: 15 })).toEqual([
      { element: 'Geo', value: 15 },
    ]);
    expect(normalizeElementalResBonuses([
      { element: 'Pyro', value: 10 },
      { element: 'Pyro', value: 20 },
      { element: 'Cryo', value: 30 },
    ])).toEqual([
      { element: 'Pyro', value: 10 },
      { element: 'Cryo', value: 30 },
    ]);
  });

  it('patchElementalResBonusSlot updates slots without duplicate elements', () => {
    const first = patchElementalResBonusSlot(null, 0, { element: 'Pyro', value: 40 });
    expect(first).toEqual([{ element: 'Pyro', value: 40 }]);

    const second = patchElementalResBonusSlot(first, 1, { element: 'Hydro', value: 20 });
    expect(second).toEqual([
      { element: 'Pyro', value: 40 },
      { element: 'Hydro', value: 20 },
    ]);

    const replaced = patchElementalResBonusSlot(second, 1, { element: 'Pyro', value: 10 });
    expect(replaced).toEqual([{ element: 'Pyro', value: 10 }]);

    expect(getElementalResBonusSlots(second)).toEqual([
      { element: 'Pyro', value: 40 },
      { element: 'Hydro', value: 20 },
    ]);
  });

  it('normalizeElementalResBonus accepts valid element bonuses', () => {
    expect(normalizeElementalResBonus({ element: 'Hydro', value: 25 })).toEqual({
      element: 'Hydro',
      value: 25,
    });
    expect(normalizeElementalResBonus({ element: 'Unknown', value: 10 })).toBeNull();
  });

  it('ELEMENTAL_RES_BONUS_OPTIONS lists all resistance bonus types', () => {
    expect(ELEMENTAL_RES_BONUS_OPTIONS).toHaveLength(8);
    expect(ELEMENTAL_RES_BONUS_OPTIONS.map((option) => option.value)).toEqual([
      'Pyro', 'Hydro', 'Dendro', 'Anemo', 'Cryo', 'Electro', 'Geo', 'Physical',
    ]);
    expect(ELEMENTAL_RES_BONUS_OPTIONS.at(-1)?.label).toBe('Бонус физ. сопротивления');
  });

  it('applyConfigTotalAtk stores total in base', () => {
    expect(applyConfigTotalAtk(2500)).toEqual({ base: 2500, bonus: 0 });
    expect(getConfigTotalAtk({ base: 300, bonus: 100 })).toBe(400);
  });

  it('normalizeArtifacts converts legacy slot format', () => {
    const legacy = {
      flower: {
        set: 'emblem',
        mainStat: 'HP',
        substats: [{ stat: 'EM', value: 42 }],
      },
    };
    const result = normalizeArtifacts(legacy);
    expect(result.set).toBe('emblem-of-severed-fate');
    expect(result.em).toBe(42);
  });

  it('getSetBonuses detects 4-piece set', () => {
    const char = findCharacter('hu-tao');
    const config = getDefaultConfig(char);
    const bonuses = getSetBonuses(config.artifacts);
    expect(bonuses.some((b) => b.pieces === 4)).toBe(true);
  });

  it('getSetBonuses returns 4+2 bonuses when set2 is configured', () => {
    const bonuses = getSetBonuses({
      ...getDefaultArtifacts(),
      set: 'emblem-of-severed-fate',
      set2: 'noblesse-oblige',
    });
    expect(bonuses).toHaveLength(2);
    expect(bonuses.map((bonus) => bonus.pieces)).toEqual([4, 2]);
  });

  it('calculateMockDps returns positive damage values', () => {
    const char = findCharacter('raiden-shogun');
    const config = getDefaultConfig(char);
    const result = calculateMockDps(config, char);
    expect(result.totalDps).toBeGreaterThan(0);
    expect(result.iconUrl).toContain('raiden');
    expect(result.skills.burst.crit).toBeGreaterThan(result.skills.burst.normal);
  });
});
