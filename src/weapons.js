/**
 * Каталог оружия Genshin Impact (полный список из genshin-db-api).
 * type — Sword | Claymore | Polearm | Bow | Catalyst
 */
import { WEAPONS, WEAPON_CATALOG_COUNTS, WEAPON_CATALOG_SOURCE } from './data/weaponsCatalog.js';
import { WEAPON_CATALOG_META } from './data/weaponCatalogMeta.js';
import { CHARACTER_SIGNATURE_WEAPONS } from './data/characterSignatureWeapons.js';

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

import { normalizeElementalResBonuses } from './mockData';

/** Ключи доп. полей конфига в artifacts_summary JSONB (Supabase). */
export const EQUIPPED_WEAPON_SUMMARY_KEY = '_equippedWeaponId';
export const ELEMENTAL_RES_BONUSES_KEY = '_elementalResBonuses';
/** @deprecated legacy single bonus keys */
export const ELEMENTAL_RES_BONUS_ELEMENT_KEY = '_elementalResBonusElement';
export const ELEMENTAL_RES_BONUS_VALUE_KEY = '_elementalResBonusValue';
export const TALENT_LEVELS_SUMMARY_KEY = '_talentLevels';

function normalizeTalentLevelsSummary(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const result = {};
  for (const key of ['auto', 'skill', 'burst']) {
    if (raw[key] == null || raw[key] === '') continue;
    const parsed = Number(raw[key]);
    if (Number.isFinite(parsed)) {
      result[key] = Math.min(13, Math.max(1, parsed));
    }
  }
  return Object.keys(result).length ? result : null;
}

export function stripWeaponFromArtifactsSummary(summary) {
  if (!summary || typeof summary !== 'object') {
    return {
      artifacts: summary,
      equippedWeaponId: null,
      elementalResBonuses: null,
      talentLevels: null,
    };
  }
  const {
    [EQUIPPED_WEAPON_SUMMARY_KEY]: equippedWeaponId,
    [ELEMENTAL_RES_BONUSES_KEY]: resBonusesRaw,
    [ELEMENTAL_RES_BONUS_ELEMENT_KEY]: legacyResElement,
    [ELEMENTAL_RES_BONUS_VALUE_KEY]: legacyResValue,
    [TALENT_LEVELS_SUMMARY_KEY]: talentLevelsRaw,
    ...artifacts
  } = summary;

  const elementalResBonuses = normalizeElementalResBonuses(
    resBonusesRaw ?? (legacyResElement
      ? { element: legacyResElement, value: legacyResValue }
      : null),
  );

  return {
    artifacts,
    equippedWeaponId: equippedWeaponId || null,
    elementalResBonuses,
    talentLevels: normalizeTalentLevelsSummary(talentLevelsRaw),
  };
}

export function mergeConfigExtrasIntoArtifactsSummary(artifacts, {
  equippedWeaponId,
  elementalResBonuses,
  talentLevels,
} = {}) {
  const base = { ...(artifacts || {}) };
  if (equippedWeaponId) {
    base[EQUIPPED_WEAPON_SUMMARY_KEY] = equippedWeaponId;
  } else {
    delete base[EQUIPPED_WEAPON_SUMMARY_KEY];
  }

  const normalizedResBonuses = normalizeElementalResBonuses(elementalResBonuses);
  if (normalizedResBonuses) {
    base[ELEMENTAL_RES_BONUSES_KEY] = normalizedResBonuses;
  } else {
    delete base[ELEMENTAL_RES_BONUSES_KEY];
  }
  delete base[ELEMENTAL_RES_BONUS_ELEMENT_KEY];
  delete base[ELEMENTAL_RES_BONUS_VALUE_KEY];

  const normalizedTalentLevels = normalizeTalentLevelsSummary(talentLevels);
  if (normalizedTalentLevels) {
    base[TALENT_LEVELS_SUMMARY_KEY] = normalizedTalentLevels;
  } else {
    delete base[TALENT_LEVELS_SUMMARY_KEY];
  }

  return base;
}

export function mergeWeaponIntoArtifactsSummary(artifacts, equippedWeaponId, extras = undefined) {
  if (extras !== undefined && extras !== null && typeof extras === 'object' && !Array.isArray(extras)) {
    return mergeConfigExtrasIntoArtifactsSummary(artifacts, {
      equippedWeaponId,
      ...extras,
    });
  }

  return mergeConfigExtrasIntoArtifactsSummary(artifacts, {
    equippedWeaponId,
    elementalResBonuses: extras === undefined ? null : extras,
  });
}

/** Id сигнатурного оружия для персонажа (null, если нет или тип не совпадает). */
export function getSignatureWeaponId(characterId, characterWeaponType) {
  if (!characterId) return null;
  const weaponId = CHARACTER_SIGNATURE_WEAPONS[characterId];
  if (!weaponId) return null;

  const weapon = findWeaponById(weaponId);
  if (!weapon) return null;

  const normalizedType = normalizeWeaponType(characterWeaponType);
  if (normalizedType && weapon.type !== normalizedType) {
    return null;
  }

  return weaponId;
}

/** Ставит сигнатуру первой в списке, сохраняя порядок остальных. */
export function sortWeaponsWithSignatureFirst(weapons, signatureWeaponId) {
  if (!signatureWeaponId || !Array.isArray(weapons) || weapons.length <= 1) {
    return weapons;
  }

  const sigIndex = weapons.findIndex((weapon) => weapon.id === signatureWeaponId);
  if (sigIndex <= 0) {
    return weapons;
  }

  const sorted = [...weapons];
  const [signatureWeapon] = sorted.splice(sigIndex, 1);
  sorted.unshift(signatureWeapon);
  return sorted;
}
