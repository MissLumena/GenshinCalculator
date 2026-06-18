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

  it('returns default config when not saved', () => {
    const result = resolveCharacterConfig(character, []);
    expect(result.level).toBe(90);
    expect(result.characterId).toBe('hu-tao');
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
