import { describe, expect, it } from 'vitest';
import { findCharacterById } from '../characters';
import { getDefaultConfig } from '../mockData';
import { ARTIFACT_SETS } from '../artifacts';
import {
  buildEffectiveStats,
  calculateCharacterDps,
  getConstellationMultipliers,
  getTalentMultiplier,
} from './dpsCalculator';

describe('dpsCalculator', () => {
  it('scales talent multipliers by level', () => {
    expect(getTalentMultiplier(1, 'burst')).toBeLessThan(getTalentMultiplier(10, 'burst'));
    expect(getTalentMultiplier(13, 'burst')).toBeGreaterThan(getTalentMultiplier(10, 'burst'));
    expect(getTalentMultiplier(10, 'skill')).toBeGreaterThan(getTalentMultiplier(10, 'auto'));
    expect(getTalentMultiplier(null, 'burst')).toBe(0);
  });

  it('increases damage with constellation', () => {
    const low = getConstellationMultipliers(0);
    const high = getConstellationMultipliers(6);
    expect(high.burst).toBeGreaterThan(low.burst);
  });

  it('includes weapon and artifact stats in effective ATK', () => {
    const character = findCharacterById('hu-tao');
    const config = {
      ...getDefaultConfig(character),
      atk: { base: 300, bonus: 100 },
      critRate: 50,
      critDmg: 120,
      equippedWeaponId: 'staff-of-homa',
      artifacts: {
        set: 'crimson-witch-of-flames',
        set2: null,
        hp: 0,
        critRate: 10,
        critDmg: 20,
        atkPercent: 15,
        em: 0,
      },
    };

    const stats = buildEffectiveStats(config, character, { artifactSets: ARTIFACT_SETS });
    expect(stats.totalAtk).toBeGreaterThan(400);
    expect(stats.critRate).toBeGreaterThan(50);
    expect(stats.critDmg).toBeGreaterThan(120);
    expect(stats.sources.weapon.label).toContain('Хом');
  });

  it('returns higher DPS with better build investment', () => {
    const character = findCharacterById('venti');
    const baseConfig = {
      ...getDefaultConfig(character),
      constellation: 0,
      talentLevels: { auto: 1, skill: 1, burst: 1 },
      equippedWeaponId: null,
    };
    const investedConfig = {
      ...baseConfig,
      constellation: 6,
      talentLevels: { auto: 10, skill: 13, burst: 13 },
      critRate: 70,
      critDmg: 180,
      equippedWeaponId: 'amos-bow',
      artifacts: {
        set: 'viridescent-venerer',
        set2: null,
        hp: 0,
        critRate: 20,
        critDmg: 40,
        atkPercent: 20,
        em: 80,
      },
    };

    const base = calculateCharacterDps(baseConfig, character, { artifactSets: ARTIFACT_SETS });
    const invested = calculateCharacterDps(investedConfig, character, { artifactSets: ARTIFACT_SETS });

    expect(invested.totalDps).toBeGreaterThan(base.totalDps);
    expect(invested.skills.burst.normal).toBeGreaterThan(base.skills.burst.normal);
  });

  it('returns positive DPS when talent levels are not stored in config', () => {
    const character = findCharacterById('raiden-shogun');
    const config = getDefaultConfig(character);
    delete config.talentLevels;

    const result = calculateCharacterDps(config, character, { artifactSets: ARTIFACT_SETS });
    expect(result.totalDps).toBeGreaterThan(0);
  });
});
