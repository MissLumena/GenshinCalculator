import { describe, expect, it } from 'vitest';
import { CHARACTERS } from './characters';
import { CHARACTER_SIGNATURE_WEAPONS } from './data/characterSignatureWeapons.js';
import {
  findWeaponById,
  getSignatureWeaponId,
  normalizeWeaponType,
  sortWeaponsWithSignatureFirst,
} from './weapons';

describe('character signature weapons', () => {
  it('maps only to existing weapons with matching character type', () => {
    const mismatches = [];

    for (const [characterId, weaponId] of Object.entries(CHARACTER_SIGNATURE_WEAPONS)) {
      const character = CHARACTERS.find((item) => item.id === characterId);
      const weapon = findWeaponById(weaponId);

      expect(character, `unknown character ${characterId}`).toBeTruthy();
      expect(weapon, `unknown weapon ${weaponId} for ${characterId}`).toBeTruthy();

      const resolvedId = getSignatureWeaponId(characterId, character.weapon);
      if (resolvedId !== weaponId) {
        mismatches.push({ characterId, weaponId, characterWeapon: character.weapon, weaponType: weapon.type });
      }
    }

    expect(mismatches, JSON.stringify(mismatches)).toEqual([]);
  });

  it('returns signature weapon id for hu-tao polearm', () => {
    expect(getSignatureWeaponId('hu-tao', 'Polearm')).toBe('staff-of-homa');
  });

  it('returns signature weapons for loen, flins and nicole', () => {
    expect(getSignatureWeaponId('loen', 'Polearm')).toBe('disaster-and-remorse');
    expect(getSignatureWeaponId('flins', 'Polearm')).toBe('bloodsoaked-ruins');
    expect(getSignatureWeaponId('nicole', 'Catalyst')).toBe('angelos-heptades');
  });

  it('returns null when weapon type does not match character', () => {
    expect(getSignatureWeaponId('hu-tao', 'Sword')).toBeNull();
  });
});

describe('sortWeaponsWithSignatureFirst', () => {
  const sample = [
    { id: 'freedom-sworn', nameRu: 'A' },
    { id: 'staff-of-homa', nameRu: 'B' },
    { id: 'mistsplitter-reforged', nameRu: 'C' },
  ];

  it('moves signature weapon to the front', () => {
    const sorted = sortWeaponsWithSignatureFirst(sample, 'staff-of-homa');
    expect(sorted.map((item) => item.id)).toEqual([
      'staff-of-homa',
      'freedom-sworn',
      'mistsplitter-reforged',
    ]);
  });

  it('keeps order when signature is already first or missing', () => {
    expect(sortWeaponsWithSignatureFirst(sample, 'freedom-sworn')).toBe(sample);
    expect(sortWeaponsWithSignatureFirst(sample, null)).toBe(sample);
  });
});

describe('five-star characters signature coverage', () => {
  it('has signature mapping for most playable 5-star characters', () => {
    const fiveStars = CHARACTERS.filter((item) => item.rarity === 5 && item.id !== 'traveler');
    const withSig = fiveStars.filter(
      (item) => getSignatureWeaponId(item.id, normalizeWeaponType(item.weapon)) != null,
    );

    expect(withSig.length).toBeGreaterThanOrEqual(50);
  });
});
