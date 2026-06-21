import {
  TALENT_CONSTELLATION_BOOSTS,
  TALENT_LEVEL_CAP_10_ONLY,
} from '../data/talentConstellationBoosts.js';

export const TALENT_LEVEL_MIN = 1;
export const TALENT_LEVEL_MAX = 10;
export const TALENT_LEVEL_MAX_BOOSTED = 13;

export { TALENT_LEVEL_CAP_10_ONLY };

export function canReachTalentLevel13(character) {
  if (!character?.id || TALENT_LEVEL_CAP_10_ONLY.includes(character.id)) {
    return false;
  }
  const boosts = TALENT_CONSTELLATION_BOOSTS[character.id]?.boosts;
  return Boolean(boosts?.auto || boosts?.skill || boosts?.burst);
}

export function getTalentConstellationBoosts(character) {
  return TALENT_CONSTELLATION_BOOSTS[character?.id]?.boosts ?? {
    auto: null,
    skill: null,
    burst: null,
  };
}

export function getTalentLevelLimits(character, constellation = 0) {
  const maxBase = TALENT_LEVEL_MAX;
  if (!character || TALENT_LEVEL_CAP_10_ONLY.includes(character.id)) {
    return { auto: maxBase, skill: maxBase, burst: maxBase };
  }

  const level = Math.max(0, Math.min(6, Number(constellation) || 0));
  const boosts = getTalentConstellationBoosts(character);

  return {
    auto: boosts.auto && level >= boosts.auto ? TALENT_LEVEL_MAX_BOOSTED : maxBase,
    skill: boosts.skill && level >= boosts.skill ? TALENT_LEVEL_MAX_BOOSTED : maxBase,
    burst: boosts.burst && level >= boosts.burst ? TALENT_LEVEL_MAX_BOOSTED : maxBase,
  };
}

export function normalizeStoredTalentLevel(value, maxLevel) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(maxLevel, Math.max(TALENT_LEVEL_MIN, parsed));
}

export function normalizeTalentLevels(config, character) {
  const limits = getTalentLevelLimits(character, config?.constellation);
  const levels = config?.talentLevels || {};

  return {
    auto: normalizeStoredTalentLevel(levels.auto, limits.auto),
    skill: normalizeStoredTalentLevel(levels.skill, limits.skill),
    burst: normalizeStoredTalentLevel(levels.burst, limits.burst),
  };
}

/** Уровни талантов для расчёта DPS: не заданные считаются 10 (в пределах лимита созвездия). */
export function resolveTalentLevelsForDps(config, character) {
  const limits = getTalentLevelLimits(character, config?.constellation);
  const levels = config?.talentLevels || {};

  const resolve = (key) => {
    const stored = normalizeStoredTalentLevel(levels[key], limits[key]);
    if (stored != null) return stored;
    return Math.min(TALENT_LEVEL_MAX, limits[key]);
  };

  return {
    auto: resolve('auto'),
    skill: resolve('skill'),
    burst: resolve('burst'),
  };
}

export function formatTalentLevelsLabel(levels) {
  const format = (value) => (value == null ? '—' : String(value));
  return `${format(levels?.auto)}/${format(levels?.skill)}/${format(levels?.burst)}`;
}
