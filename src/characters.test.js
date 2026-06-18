import { describe, it, expect } from 'vitest';
import { CHARACTERS, CHARACTER_REGIONS } from './characters';
import { getCharacterIconUrls, getCharacterIconUrl } from './characterIcons';

describe('characters', () => {
  it('contains Nicole with Russian name', () => {
    const nicole = CHARACTERS.find((c) => c.id === 'nicole');
    expect(nicole).toBeDefined();
    expect(nicole.nameRu).toBe('Николь');
    expect(nicole.region).toBe('celestia');
  });

  it('contains all regions from the V2 spec', () => {
    const ids = CHARACTER_REGIONS.map((r) => r.id);
    expect(ids).toContain('mondstadt');
    expect(ids).toContain('celestia');
  });

  it('contains Loen with correct Russian name, rarity and element', () => {
    const loen = CHARACTERS.find((c) => c.id === 'loen');
    expect(loen).toBeDefined();
    expect(loen.nameRu).toBe('Лоэн');
    expect(loen.rarity).toBe(5);
    expect(loen.element).toBe('Cryo');
  });

  it('contains Flins as Electro', () => {
    const flins = CHARACTERS.find((c) => c.id === 'flins');
    expect(flins).toBeDefined();
    expect(flins.nameRu).toBe('Флинс');
    expect(flins.element).toBe('Electro');
  });

  it('contains Wriothesley (Ризли) in Fontaine', () => {
    const wriothesley = CHARACTERS.find((c) => c.id === 'wriothesley');
    expect(wriothesley).toBeDefined();
    expect(wriothesley.nameRu).toBe('Ризли');
    expect(wriothesley.region).toBe('fontaine');
    expect(wriothesley.element).toBe('Cryo');
    expect(wriothesley.weapon).toBe('Catalyst');
    expect(wriothesley.rarity).toBe(5);
  });

  it('every character has distinct Russian and English names', () => {
    const hasCyrillic = (value) => /[\u0400-\u04FF]/.test(value);
    for (const character of CHARACTERS) {
      expect(character.nameEn, character.id).toBeTruthy();
      expect(character.nameRu, character.id).toBeTruthy();
      expect(character.nameRu, character.id).not.toBe(character.nameEn);
      expect(hasCyrillic(character.nameRu), `${character.id} nameRu`).toBe(true);
    }
  });

  it('groups characters by region without duplicates', () => {
    const ids = CHARACTERS.map((c) => c.id);
    expect(ids.length).toBe(new Set(ids).size);
    expect(CHARACTERS.length).toBeGreaterThan(100);
  });
});

describe('characterIcons', () => {
  it('contains Alhaitham in Sumeru', () => {
    const alhaitham = CHARACTERS.find((c) => c.id === 'alhaitham');
    expect(alhaitham).toBeDefined();
    expect(alhaitham.nameRu).toBe('Аль-Хайтам');
    expect(alhaitham.region).toBe('sumeru');
    const urls = getCharacterIconUrls(alhaitham);
    expect(urls.some((u) => u.includes('alhaitham'))).toBe(true);
  });

  it('getCharacterIconUrls returns jmp + enka for Hu Tao', () => {
    const char = CHARACTERS.find((c) => c.id === 'hu-tao');
    const urls = getCharacterIconUrls(char);
    expect(urls[0]).toContain('hu-tao');
    expect(urls.some((u) => u.includes('enka.network'))).toBe(true);
  });

  it('getCharacterIconUrls returns jmp + enka for Wriothesley', () => {
    const char = CHARACTERS.find((c) => c.id === 'wriothesley');
    const urls = getCharacterIconUrls(char);
    expect(urls[0]).toContain('wriothesley');
    expect(urls.some((u) => u.includes('Wriothesley'))).toBe(true);
  });

  it('getCharacterIconUrls uses enka for Nicole', () => {
    const char = CHARACTERS.find((c) => c.id === 'nicole');
    const urls = getCharacterIconUrls(char);
    expect(urls.some((u) => u.includes('Nicole'))).toBe(true);
  });

  it('getCharacterIconUrl returns first available URL', () => {
    const char = CHARACTERS.find((c) => c.id === 'ganyu');
    expect(getCharacterIconUrl(char)).toContain('ganyu');
  });

  it('getCharacterIconUrls uses correct enka names for new avatars', () => {
    const cases = [
      ['skirk', 'SkirkNew'],
      ['mannequin', 'MannequinBoy'],
      ['loen', 'Lohen'],
      ['ororon', 'Olorun'],
      ['yagoda', 'Jahoda'],
    ];

    for (const [id, enkaName] of cases) {
      const char = CHARACTERS.find((c) => c.id === id);
      expect(char, id).toBeDefined();
      const urls = getCharacterIconUrls(char);
      expect(urls.some((u) => u.includes(enkaName)), id).toBe(true);
    }
  });
});
