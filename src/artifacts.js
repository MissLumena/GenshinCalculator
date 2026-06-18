/**
 * Каталог сетов артефактов Genshin Impact (≤ 6.6).
 */
import {
  ARTIFACT_SETS,
  ARTIFACT_CATALOG_MAX_VERSION,
} from './data/artifactsCatalog.js';
import { ARTIFACT_CATALOG_META } from './data/artifactCatalogMeta.js';

export { ARTIFACT_SETS, ARTIFACT_CATALOG_MAX_VERSION };

export const DEFAULT_ARTIFACT_SET_ID = 'crimson-witch-of-flames';

/** Старые короткие id из ранних версий калькулятора и Supabase seed. */
export const LEGACY_ARTIFACT_SET_ID_ALIASES = {
  crimson: 'crimson-witch-of-flames',
  shimenawa: 'shimenawas-reminiscence',
  emblem: 'emblem-of-severed-fate',
  gladiator: 'gladiators-finale',
  wanderer: 'wanderers-troupe',
  noblesse: 'noblesse-oblige',
  viridescent: 'viridescent-venerer',
};

const SET_BY_ID = new Map(ARTIFACT_SETS.map((item) => [item.id, item]));

export function resolveArtifactSetId(setId) {
  if (!setId) return DEFAULT_ARTIFACT_SET_ID;
  const aliased = LEGACY_ARTIFACT_SET_ID_ALIASES[setId] || setId;
  if (SET_BY_ID.has(aliased)) return aliased;
  const byName = ARTIFACT_SETS.find(
    (item) => item.nameEn.toLowerCase() === String(setId).toLowerCase()
      || item.nameRu.toLowerCase() === String(setId).toLowerCase(),
  );
  return byName?.id || aliased;
}

export function findArtifactSetById(setId) {
  const resolved = resolveArtifactSetId(setId);
  return SET_BY_ID.get(resolved) || null;
}

export function getArtifactSetIconUrls(setId) {
  const resolved = resolveArtifactSetId(setId);
  const meta = ARTIFACT_CATALOG_META[resolved];
  if (meta?.iconUrls?.length) return meta.iconUrls;
  return [];
}

export function enrichArtifactSet(set) {
  if (!set) return null;
  const meta = ARTIFACT_CATALOG_META[set.id] || {};
  const bonus2 = meta.bonus2Ru || set.bonus2 || meta.bonus2En || '';
  const bonus4 = meta.bonus4Ru || set.bonus4 || meta.bonus4En || '';
  return {
    ...set,
    name: set.nameRu || set.nameEn,
    nameRu: meta.nameRu || set.nameRu || set.nameEn,
    bonus2: bonus2 || (bonus4 ? '—' : ''),
    bonus4: bonus4 || bonus2,
    iconUrls: getArtifactSetIconUrls(set.id),
    version: meta.version || set.version || null,
  };
}

export function getEnrichedArtifactSets() {
  return ARTIFACT_SETS.map(enrichArtifactSet);
}

export function getArtifactCatalogTotal() {
  return ARTIFACT_SETS.length;
}

export function getArtifactSetLabel(setId, { preferRu = true } = {}) {
  const set = findArtifactSetById(setId);
  if (!set) return '';
  if (preferRu && set.nameRu && set.nameRu !== set.nameEn) {
    return `${set.nameRu} (${set.nameEn})`;
  }
  return set.nameEn;
}

/** Для совместимости с mockData.getSetBonuses */
export function toLegacyArtifactSetShape(set) {
  const enriched = enrichArtifactSet(set);
  return {
    id: enriched.id,
    name: enriched.nameRu || enriched.nameEn,
    bonus2: enriched.bonus2,
    bonus4: enriched.bonus4,
  };
}

export function getLegacyArtifactSetsForBonuses() {
  return getEnrichedArtifactSets().map(toLegacyArtifactSetShape);
}
