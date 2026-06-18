/**
 * Каталог оружия Genshin Impact (полный список из genshin-db-api).
 * type — Sword | Claymore | Polearm | Bow | Catalyst
 */
import { WEAPONS, WEAPON_CATALOG_COUNTS, WEAPON_CATALOG_SOURCE } from './data/weaponsCatalog.js';
import { WEAPON_CATALOG_META } from './data/weaponCatalogMeta.js';

export { WEAPONS, WEAPON_CATALOG_COUNTS };

export const WEAPON_CATALOG_VERSION = 'full';

export const WEAPON_TYPES = ['Sword', 'Claymore', 'Polearm', 'Bow', 'Catalyst'];

export const WEAPON_TYPE_LABELS_RU = {
  Sword: 'Мечи',
  Claymore: 'Клейморы',
  Polearm: 'Копья',
  Bow: 'Луки',
  Catalyst: 'Катализаторы',
};

const WEAPON_TYPE_ALIASES = {
  sword: 'Sword',
  claymore: 'Claymore',
  polearm: 'Polearm',
  spear: 'Polearm',
  bow: 'Bow',
  catalyst: 'Catalyst',
};

/** Минимальное число оружий в полном каталоге (для тестов). */
export const MIN_WEAPON_CATALOG_TOTAL = 200;

/** Эталонный список 6.6 — приоритетные сигнатурки (должны быть в полном каталоге). */
export const FEATURED_WEAPON_NAMES = [
  'Freedom-Sworn',
  'Disaster and Remorse',
  "Angelos' Heptades",
  'Staff of Homa',
  'Polar Star',
  'Mistsplitter Reforged',
];

const LEGACY_WEAPON_ID_ALIASES = {
  'calamity-queller-claymore': 'calamity-queller',
  'moonpiercer-catalyst': 'moonpiercer',
};

/** Нормализует тип оружия (Supabase / UI могут отличаться регистром). */
export function normalizeWeaponType(weaponType) {
  if (!weaponType) return '';
  const trimmed = String(weaponType).trim();
  if (WEAPON_TYPES.includes(trimmed)) return trimmed;
  return WEAPON_TYPE_ALIASES[trimmed.toLowerCase()] || trimmed;
}

const WEAPON_BY_ID = new Map(WEAPONS.map((item) => [item.id, item]));
const WEAPON_BY_NAME_EN = new Map(WEAPONS.map((item) => [item.nameEn, item]));

/** @deprecated используйте getWeaponIconUrls */
export function getWeaponIconUrl(weaponId) {
  const urls = getWeaponIconUrls(weaponId);
  return urls[0] || null;
}

export function getWeaponIconUrls(weaponOrId) {
  const weapon = typeof weaponOrId === 'string' ? findWeaponById(weaponOrId) : weaponOrId;
  if (!weapon) return [];
  const metaUrls = WEAPON_CATALOG_META[weapon.id]?.iconUrls;
  if (metaUrls?.length) return metaUrls;
  return [`https://genshin.jmp.blue/weapons/${weapon.id}/icon`];
}

export function findWeaponById(weaponId) {
  if (!weaponId) return null;
  const aliased = LEGACY_WEAPON_ID_ALIASES[weaponId] || weaponId;
  return WEAPON_BY_ID.get(aliased) || null;
}

export function findWeaponByName(nameEn) {
  if (!nameEn) return null;
  return WEAPON_BY_NAME_EN.get(nameEn) || null;
}

export function getWeaponMeta(weaponId) {
  const weapon = findWeaponById(weaponId);
  if (!weapon) return null;
  const meta = WEAPON_CATALOG_META[weapon.id] || {};
  return {
    ...weapon,
    nameRu: meta.nameRu || weapon.nameRu,
    passiveName: meta.passiveNameRu || meta.passiveNameEn || '',
    description: meta.effectRu || meta.effectEn || '',
    subStat: meta.subStat || '',
    iconUrls: getWeaponIconUrls(weapon),
  };
}

export function enrichWeapon(weapon) {
  if (!weapon) return null;
  const meta = WEAPON_CATALOG_META[weapon.id] || {};
  return {
    ...weapon,
    nameRu: meta.nameRu || weapon.nameRu,
    passiveName: meta.passiveNameRu || meta.passiveNameEn || '',
    description: meta.effectRu || meta.effectEn || '',
    subStat: meta.subStat || '',
    iconUrls: getWeaponIconUrls(weapon),
  };
}

export function getWeaponsForType(weaponType) {
  const normalizedType = normalizeWeaponType(weaponType);
  if (!normalizedType) return [];
  return WEAPONS.filter((item) => item.type === normalizedType);
}

export function getEnrichedWeaponsForType(weaponType) {
  return getWeaponsForType(weaponType).map(enrichWeapon);
}

export function getEnrichedWeaponsGrouped() {
  return WEAPON_TYPES.map((type) => ({
    type,
    label: WEAPON_TYPE_LABELS_RU[type] || type,
    weapons: getEnrichedWeaponsForType(type),
  }));
}

export function getWeaponCatalogTotal() {
  return WEAPONS.length;
}

export function getWeaponCatalogCounts() {
  if (WEAPON_CATALOG_COUNTS && Object.keys(WEAPON_CATALOG_COUNTS).length > 0) {
    return { ...WEAPON_CATALOG_COUNTS };
  }
  return WEAPON_TYPES.reduce((acc, type) => {
    acc[type] = getWeaponsForType(type).length;
    return acc;
  }, {});
}

export function getWeaponCatalogSource() {
  return WEAPON_CATALOG_SOURCE || 'local';
}

export function getWeaponLabel(weaponId, { preferRu = true } = {}) {
  const weapon = findWeaponById(weaponId);
  if (!weapon) return '';
  if (preferRu && weapon.nameRu && weapon.nameRu !== weapon.nameEn) {
    return `${weapon.nameRu} (${weapon.nameEn})`;
  }
  return weapon.nameEn;
}

/** Ключ оружия в artifacts_summary JSONB (Supabase). */
export const EQUIPPED_WEAPON_SUMMARY_KEY = '_equippedWeaponId';

export function stripWeaponFromArtifactsSummary(summary) {
  if (!summary || typeof summary !== 'object') {
    return { artifacts: summary, equippedWeaponId: null };
  }
  const { [EQUIPPED_WEAPON_SUMMARY_KEY]: equippedWeaponId, ...artifacts } = summary;
  return {
    artifacts,
    equippedWeaponId: equippedWeaponId || null,
  };
}

export function mergeWeaponIntoArtifactsSummary(artifacts, equippedWeaponId) {
  const base = { ...(artifacts || {}) };
  if (equippedWeaponId) {
    base[EQUIPPED_WEAPON_SUMMARY_KEY] = equippedWeaponId;
  } else {
    delete base[EQUIPPED_WEAPON_SUMMARY_KEY];
  }
  return base;
}
