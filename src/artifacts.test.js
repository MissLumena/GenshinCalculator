import { describe, expect, it } from 'vitest';
import {
  ARTIFACT_SETS,
  ARTIFACT_CATALOG_MAX_VERSION,
  DEFAULT_ARTIFACT_SET_ID,
  findArtifactSetById,
  resolveArtifactSetId,
  getArtifactCatalogTotal,
  getEnrichedArtifactSets,
  LEGACY_ARTIFACT_SET_ID_ALIASES,
} from './artifacts';
import { ARTIFACT_CATALOG_META } from './data/artifactCatalogMeta.js';
import { getDefaultArtifacts, getSetBonuses, normalizeArtifacts } from './mockData';

describe('artifacts catalog', () => {
  it(`contains all sets up to version ${ARTIFACT_CATALOG_MAX_VERSION}`, () => {
    expect(getArtifactCatalogTotal()).toBeGreaterThanOrEqual(50);
    expect(ARTIFACT_SETS.length).toBe(getArtifactCatalogTotal());
    for (const set of ARTIFACT_SETS) {
      expect(parseFloat(set.version || 0)).toBeLessThanOrEqual(ARTIFACT_CATALOG_MAX_VERSION);
    }
  });

  it('includes signature and starter sets', () => {
    expect(findArtifactSetById('emblem-of-severed-fate')).toBeTruthy();
    expect(findArtifactSetById('crimson-witch-of-flames')).toBeTruthy();
    expect(findArtifactSetById('adventurer')).toBeTruthy();
  });

  it('migrates legacy artifact set ids', () => {
    expect(resolveArtifactSetId('crimson')).toBe('crimson-witch-of-flames');
    expect(resolveArtifactSetId('emblem')).toBe('emblem-of-severed-fate');
    for (const [legacy, modern] of Object.entries(LEGACY_ARTIFACT_SET_ID_ALIASES)) {
      expect(resolveArtifactSetId(legacy)).toBe(modern);
    }
  });

  it('has icons and bonuses for every set', () => {
    for (const set of ARTIFACT_SETS) {
      const meta = ARTIFACT_CATALOG_META[set.id];
      expect(meta, set.id).toBeTruthy();
      expect(meta.iconUrls?.length, set.id).toBeGreaterThan(0);
      expect(set.bonus2 || set.bonus4, set.id).toBeTruthy();
    }
  });

  it('normalizes saved artifact configs with legacy ids', () => {
    const normalized = normalizeArtifacts({ set: 'emblem', hp: 100, critRate: 0, critDmg: 0, atkPercent: 0, em: 0 });
    expect(normalized.set).toBe('emblem-of-severed-fate');
  });

  it('uses modern default artifact set', () => {
    expect(getDefaultArtifacts().set).toBe(DEFAULT_ARTIFACT_SET_ID);
  });

  it('returns set bonuses for selected catalog entry', () => {
    const bonuses = getSetBonuses({ set: 'noblesse-oblige', hp: 0, critRate: 0, critDmg: 0, atkPercent: 0, em: 0 });
    expect(bonuses.length).toBe(2);
    expect(bonuses[0].pieces).toBe(2);
    expect(bonuses[1].pieces).toBe(4);
  });

  it('returns 4+2 bonuses for dual artifact sets', () => {
    const bonuses = getSetBonuses({
      set: 'emblem-of-severed-fate',
      set2: 'noblesse-oblige',
      hp: 0,
      critRate: 0,
      critDmg: 0,
      atkPercent: 0,
      em: 0,
    });
    expect(bonuses.length).toBe(2);
    expect(bonuses[0].pieces).toBe(4);
    expect(bonuses[0].setId).toBe('emblem-of-severed-fate');
    expect(bonuses[1].pieces).toBe(2);
    expect(bonuses[1].setId).toBe('noblesse-oblige');
  });

  it('clears duplicate secondary set during normalization', () => {
    const normalized = normalizeArtifacts({
      set: 'emblem-of-severed-fate',
      set2: 'emblem-of-severed-fate',
      hp: 0,
      critRate: 0,
      critDmg: 0,
      atkPercent: 0,
      em: 0,
    });
    expect(normalized.set2).toBeNull();
  });

  it('defaults secondary set to null', () => {
    expect(getDefaultArtifacts().set2).toBeNull();
  });

  it('enriches sets with icon urls', () => {
    const enriched = getEnrichedArtifactSets();
    expect(enriched.every((set) => set.iconUrls?.length > 0)).toBe(true);
  });
});
