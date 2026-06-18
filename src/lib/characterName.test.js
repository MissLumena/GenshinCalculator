import { describe, it, expect } from 'vitest';
import {
  formatCharacterChartLabel,
  getCharacterNameEn,
  getCharacterNameRu,
} from './characterName';

describe('characterName', () => {
  const loen = { id: 'loen', name: 'Loen', nameRu: 'Лоэн' };

  it('returns Russian and English names', () => {
    expect(getCharacterNameRu(loen)).toBe('Лоэн');
    expect(getCharacterNameEn(loen)).toBe('Loen');
  });

  it('formats chart label with both languages', () => {
    expect(formatCharacterChartLabel(loen)).toBe('Лоэн / Loen');
  });

  it('falls back to English when Russian is missing', () => {
    expect(getCharacterNameRu({ name: 'Venti' })).toBe('Venti');
    expect(formatCharacterChartLabel({ name: 'Venti' })).toBe('Venti');
  });
});
