import { describe, expect, it } from 'vitest';
import {
  WEAPONS,
  FEATURED_WEAPON_NAMES,
  WEAPON_CATALOG_VERSION,
  MIN_WEAPON_CATALOG_TOTAL,
  findWeaponById,
  findWeaponByName,
  getWeaponIconUrl,
  getWeaponIconUrls,
  getWeaponMeta,
  getWeaponsForType,
  getWeaponLabel,
  getWeaponCatalogCounts,
  getWeaponCatalogTotal,
  normalizeWeaponType,
  mergeWeaponIntoArtifactsSummary,
  stripWeaponFromArtifactsSummary,
} from './weapons';
import { WEAPON_CATALOG_META } from './data/weaponCatalogMeta.js';

describe('weapons catalog', () => {
  it(`contains full ${WEAPON_CATALOG_VERSION} catalog with 200+ weapons`, () => {
    expect(getWeaponCatalogTotal()).toBeGreaterThanOrEqual(MIN_WEAPON_CATALOG_TOTAL);
    expect(WEAPONS.length).toBe(getWeaponCatalogTotal());
  });

  it('reports counts by weapon type', () => {
    const counts = getWeaponCatalogCounts();
    expect(counts.Sword).toBeGreaterThan(40);
    expect(counts.Claymore).toBeGreaterThan(30);
    expect(counts.Polearm).toBeGreaterThan(30);
    expect(counts.Bow).toBeGreaterThan(30);
    expect(counts.Catalyst).toBeGreaterThan(40);
    expect(Object.values(counts).reduce((sum, n) => sum + n, 0)).toBe(WEAPONS.length);
  });

  it('includes featured signature weapons', () => {
    for (const name of FEATURED_WEAPON_NAMES) {
      expect(findWeaponByName(name), name).toBeTruthy();
    }
    expect(findWeaponByName('Disaster and Remorse')?.nameRu).toContain('Бедствие');
  });

  it('normalizes weapon type aliases', () => {
    expect(normalizeWeaponType('sword')).toBe('Sword');
    expect(normalizeWeaponType(' Polearm ')).toBe('Polearm');
    expect(getWeaponsForType('bow').length).toBeGreaterThan(30);
  });

  it('has meta with icons and descriptions for every weapon', () => {
    for (const weapon of WEAPONS) {
      expect(WEAPON_CATALOG_META[weapon.id], weapon.id).toBeTruthy();
      expect(WEAPON_CATALOG_META[weapon.id].iconUrls?.length, weapon.id).toBeGreaterThan(0);
      expect(WEAPON_CATALOG_META[weapon.id].effectRu, weapon.id).toBeTruthy();
    }
    expect(Object.keys(WEAPON_CATALOG_META).length).toBe(WEAPONS.length);
  });

  it('returns enriched weapon meta', () => {
    const meta = getWeaponMeta('staff-of-homa');
    expect(meta?.description).toBeTruthy();
    expect(meta?.iconUrls?.length).toBeGreaterThan(0);
    expect(meta?.passiveName).toBeTruthy();
    expect(meta?.nameRu).toContain('Хом');
  });

  it('builds icon urls with jmp and enka fallbacks', () => {
    expect(getWeaponIconUrl('staff-of-homa')).toContain('staff-of-homa');
    expect(getWeaponIconUrls('freedom-sworn').length).toBeGreaterThan(1);
    expect(getWeaponIconUrl(null)).toBeNull();
  });

  it('migrates legacy weapon ids', () => {
    expect(findWeaponById('calamity-queller-claymore')?.nameEn).toBe('Calamity Queller');
    expect(findWeaponById('moonpiercer-catalyst')?.nameEn).toBe('Moonpiercer');
  });

  it('filters weapons by character type', () => {
    const swords = getWeaponsForType('Sword');
    expect(swords.length).toBeGreaterThan(40);
    expect(swords.every((item) => item.type === 'Sword')).toBe(true);
    expect(swords.some((item) => item.id === 'mistsplitter-reforged')).toBe(true);
  });

  it('returns weapon label with Russian name when available', () => {
    expect(getWeaponLabel('disaster-and-remorse')).toContain('Бедствие');
  });

  it('roundtrips equipped weapon via artifacts_summary helpers', () => {
    const merged = mergeWeaponIntoArtifactsSummary(
      { set: 'emblem', hp: 0, critRate: 0, critDmg: 0, atkPercent: 0, em: 0 },
      'staff-of-homa',
    );
    const { artifacts, equippedWeaponId } = stripWeaponFromArtifactsSummary(merged);
    expect(equippedWeaponId).toBe('staff-of-homa');
    expect(artifacts.set).toBe('emblem');
    expect(artifacts._equippedWeaponId).toBeUndefined();
  });

  it('has unique weapon ids', () => {
    const ids = WEAPONS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
