import { describe, it, expect } from 'vitest';
import {
  calculateMockDps,
  getSetBonuses,
  getDefaultConfig,
  findCharacter,
  normalizeArtifacts,
  getDefaultArtifacts,
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
    expect(config.artifacts.set).toBe(DEFAULT_ARTIFACT_SET_ID);
    expect(config.artifacts.set2).toBeNull();
    expect(config.artifacts.hp).toBeDefined();
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
