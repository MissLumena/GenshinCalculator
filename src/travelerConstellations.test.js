import { describe, expect, it } from 'vitest';
import {
  getTravelerConstellationCacheKey,
  getTravelerConstellationQuery,
  getTravelerShapeCharacterId,
  getTravelerShapeNameEn,
  getTravelerStaticShapeUrl,
  isTravelerCharacter,
  normalizeTravelerElement,
  TRAVELER_CONSTELLATION_ELEMENTS,
} from './travelerConstellations';
import { findCharacterById } from './characters';

describe('travelerConstellations', () => {
  it('detects traveler character', () => {
    expect(isTravelerCharacter(findCharacterById('traveler'))).toBe(true);
    expect(isTravelerCharacter(findCharacterById('venti'))).toBe(false);
  });

  it('builds element-specific query and cache keys', () => {
    expect(getTravelerConstellationQuery('Geo')).toBe('Traveler Geo');
    expect(getTravelerShapeNameEn('Electro')).toBe('Viator Electro');
    expect(getTravelerShapeCharacterId('Dendro')).toBe('traveler-dendro');
    expect(getTravelerConstellationCacheKey('Hydro')).toBe('traveler:Hydro');
  });

  it('normalizes invalid element to Anemo', () => {
    expect(normalizeTravelerElement('Cryo')).toBe('Anemo');
    expect(normalizeTravelerElement('Pyro')).toBe('Pyro');
    expect(normalizeTravelerElement('Geo')).toBe('Geo');
  });

  it('provides static shape urls for every traveler element', () => {
    for (const element of TRAVELER_CONSTELLATION_ELEMENTS) {
      expect(getTravelerStaticShapeUrl(element)).toContain(`Viator_${element}_Shape`);
    }
  });
});
