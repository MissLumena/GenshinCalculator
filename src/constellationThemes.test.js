import { describe, expect, it } from 'vitest';
import { getConstellationElementKey } from './constellationThemes';

describe('getConstellationElementKey', () => {
  it('maps Genshin elements to theme keys', () => {
    expect(getConstellationElementKey('Pyro')).toBe('pyro');
    expect(getConstellationElementKey('Hydro')).toBe('hydro');
    expect(getConstellationElementKey('Electro')).toBe('electro');
    expect(getConstellationElementKey('Cryo')).toBe('cryo');
    expect(getConstellationElementKey('Anemo')).toBe('anemo');
    expect(getConstellationElementKey('Geo')).toBe('geo');
    expect(getConstellationElementKey('Dendro')).toBe('dendro');
  });

  it('falls back to anemo for unknown elements', () => {
    expect(getConstellationElementKey('')).toBe('anemo');
    expect(getConstellationElementKey(undefined)).toBe('anemo');
    expect(getConstellationElementKey('Unknown')).toBe('anemo');
  });
});
