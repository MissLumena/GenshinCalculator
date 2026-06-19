import { describe, it, expect } from 'vitest';
import { getDefaultConfig } from '../mockData';
import {
  characterConfigsEqual,
  resolveCharacterConfig,
} from './characterConfigEditor';

describe('resolveCharacterConfig', () => {
  const character = { id: 'hu-tao', name: 'Hu Tao', nameRu: 'Ху Тао' };

  it('returns saved config when present', () => {
    const saved = { ...getDefaultConfig(character), atk: { base: 2400, bonus: 0 }, level: 90 };
    const result = resolveCharacterConfig(character, [saved]);
    expect(result.atk.base).toBe(2400);
    expect(result.characterId).toBe('hu-tao');
  });

  it('normalizes elemental resistance bonuses from saved config', () => {
    const saved = {
      ...getDefaultConfig(character),
      elementalResBonuses: [
        { element: 'Geo', value: 30 },
        { element: 'Cryo', value: 15 },
      ],
    };
    const result = resolveCharacterConfig(character, [saved]);
    expect(result.elementalResBonuses).toEqual([
      { element: 'Geo', value: 30 },
      { element: 'Cryo', value: 15 },
    ]);
  });

  it('migrates legacy single elementalResBonus field', () => {
    const saved = {
      ...getDefaultConfig(character),
      elementalResBonus: { element: 'Anemo', value: 12 },
    };
    const result = resolveCharacterConfig(character, [saved]);
    expect(result.elementalResBonuses).toEqual([{ element: 'Anemo', value: 12 }]);
  });
});

describe('characterConfigsEqual', () => {
  it('detects equal configs', () => {
    const a = getDefaultConfig({ id: 'a', name: 'A', nameRu: 'A' });
    const b = { ...a };
    expect(characterConfigsEqual(a, b)).toBe(true);
  });

  it('detects different configs', () => {
    const a = getDefaultConfig({ id: 'a', name: 'A', nameRu: 'A' });
    const b = { ...a, level: 80 };
    expect(characterConfigsEqual(a, b)).toBe(false);
  });
});
