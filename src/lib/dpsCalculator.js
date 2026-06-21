import { getSetBonuses } from '../mockData';
import { enrichWeapon, findWeaponById } from '../weapons';
import { mergeStatBonuses, parseStatBonusesFromText } from './setBonusParser';
import { resolveTalentLevelsForDps } from './talentLevelLimits';

const WEAPON_BASE_ATK_L90 = {
  1: 250,
  2: 320,
  3: 390,
  4: 510,
  5: 608,
};

const WEAPON_SUBSTAT_L90 = {
  5: {
    critDmg: 66.2,
    critRate: 33.1,
    atkPercent: 49.6,
    em: 221,
    energyRecharge: 55.1,
    hpPercent: 49.6,
    defPercent: 41.3,
  },
  4: {
    critDmg: 55.1,
    critRate: 27.6,
    atkPercent: 41.3,
    em: 165,
    energyRecharge: 45.9,
    hpPercent: 41.3,
    defPercent: 34.5,
  },
  3: {
    critDmg: 42.4,
    critRate: 21.2,
    atkPercent: 31.8,
    em: 127,
    energyRecharge: 35.3,
    hpPercent: 31.8,
    defPercent: 26.5,
  },
};

const SUBSTAT_KEYWORDS = [
  { pattern: /крит\.?\s*урон|crit\s*dmg/i, key: 'critDmg' },
  { pattern: /шанс крит|крит\.?\s*шанс|crit\s*rate/i, key: 'critRate' },
  { pattern: /сил[аы] атаки|atk/i, key: 'atkPercent' },
  { pattern: /мастерство стихий|elemental mastery/i, key: 'em' },
  { pattern: /восстановление энергии|energy recharge/i, key: 'energyRecharge' },
  { pattern: /макс\.?\s*hp|max hp/i, key: 'hpPercent' },
  { pattern: /^hp$| hp /i, key: 'hpPercent' },
  { pattern: /защит|def/i, key: 'defPercent' },
];

const SKILL_BASE_MULTIPLIER = {
  auto: 1,
  skill: 1.5,
  burst: 3.2,
};

const ROTATION_FREQUENCY = {
  auto: 1.25,
  skill: 0.55,
  burst: 0.18,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}


function mapSubStatKey(subStatText) {
  const text = String(subStatText || '');
  for (const entry of SUBSTAT_KEYWORDS) {
    if (entry.pattern.test(text)) return entry.key;
  }
  return null;
}

export function getWeaponStatContribution(weaponId, weaponLevel = 90) {
  if (!weaponId) {
    return {
      baseAtk: 0,
      bonuses: parseStatBonusesFromText(''),
      label: null,
    };
  }

  const weapon = enrichWeapon(findWeaponById(weaponId));
  if (!weapon) {
    return {
      baseAtk: 0,
      bonuses: parseStatBonusesFromText(''),
      label: weaponId,
    };
  }

  const rarity = weapon.rarity || 4;
  const levelScale = clamp(Number(weaponLevel) || 90, 1, 90) / 90;
  const baseAtk = Math.round((WEAPON_BASE_ATK_L90[rarity] || WEAPON_BASE_ATK_L90[4]) * levelScale);

  const subStatKey = mapSubStatKey(weapon.subStat);
  const subStatTable = WEAPON_SUBSTAT_L90[rarity] || WEAPON_SUBSTAT_L90[4];
  const passiveBonuses = parseStatBonusesFromText(weapon.description || '');

  const bonuses = parseStatBonusesFromText('');
  if (subStatKey && subStatTable[subStatKey]) {
    bonuses[subStatKey] += subStatTable[subStatKey] * levelScale;
  }

  return {
    baseAtk,
    bonuses: mergeStatBonuses(bonuses, passiveBonuses),
    label: weapon.nameRu || weapon.nameEn,
    rarity,
  };
}

export function getArtifactStatContribution(artifacts, artifactSets = []) {
  const normalized = artifacts || {};
  const substats = parseStatBonusesFromText('');
  substats.critRate += Number(normalized.critRate || 0);
  substats.critDmg += Number(normalized.critDmg || 0);
  substats.atkPercent += Number(normalized.atkPercent || 0);
  substats.em += Number(normalized.em || 0);

  const setBonuses = getSetBonuses(normalized, artifactSets);
  const parsedSets = setBonuses.map((bonus) => ({
    ...bonus,
    stats: parseStatBonusesFromText(bonus.text),
  }));

  const mergedSets = mergeStatBonuses(...parsedSets.map((item) => item.stats));
  return {
    substats,
    setBonuses: parsedSets,
    bonuses: mergeStatBonuses(substats, mergedSets),
  };
}

export function getConstellationMultipliers(constellation) {
  const level = clamp(Number(constellation) || 0, 0, 6);
  return {
    auto: 1 + (level >= 1 ? 0.05 : 0) + (level >= 6 ? 0.15 : 0) + level * 0.02,
    skill: 1 + (level >= 2 ? 0.10 : 0) + (level >= 4 ? 0.10 : 0) + level * 0.02,
    burst: 1 + (level >= 3 ? 0.08 : 0) + (level >= 5 ? 0.12 : 0) + level * 0.02,
  };
}

export function getTalentMultiplier(level, skillKey) {
  if (level == null || level === '' || !Number.isFinite(Number(level))) return 0;

  const lv = clamp(Number(level), 1, 13);
  if (skillKey === 'burst') return 0.45 + (lv - 1) * 0.061;
  if (skillKey === 'skill') return 0.55 + (lv - 1) * 0.05;
  return 0.62 + (lv - 1) * 0.042;
}

function getElementalDmgBonus(bonuses, characterElement) {
  if (!characterElement) return 0;
  const key = String(characterElement).toLowerCase();
  return bonuses.elementalDmg?.[key] || 0;
}

export function buildEffectiveStats(config, character, options = {}) {
  const artifactSets = options.artifactSets || [];
  const weaponLevel = config?.weaponLevel ?? config?.level ?? 90;

  const weapon = getWeaponStatContribution(config?.equippedWeaponId, weaponLevel);
  const artifacts = getArtifactStatContribution(config?.artifacts, artifactSets);
  const mergedBonuses = mergeStatBonuses(artifacts.bonuses, weapon.bonuses);

  const characterBaseAtk = Number(config?.atk?.base || 0);
  const flatAtk = Number(config?.atk?.bonus || 0);
  const baseAtk = characterBaseAtk + weapon.baseAtk;
  const atkPercent = mergedBonuses.atkPercent;
  const totalAtk = Math.round(baseAtk * (1 + atkPercent / 100) + flatAtk);

  const critRate = clamp(
    Number(config?.critRate || 0) + mergedBonuses.critRate,
    0,
    100,
  );
  const critDmg = Number(config?.critDmg || 0) + mergedBonuses.critDmg;
  const em = Number(config?.em || 0) + mergedBonuses.em;
  const energyRecharge = Number(config?.energyRecharge || 0) + mergedBonuses.energyRecharge;

  const elementalDmgBonus = getElementalDmgBonus(mergedBonuses, character?.element);

  return {
    totalAtk,
    critRate,
    critDmg,
    em,
    energyRecharge,
    elementalDmgBonus,
    physicalDmgBonus: mergedBonuses.physicalDmg,
    generalDmgBonus: mergedBonuses.generalDmg,
    skillDmgBonus: mergedBonuses.skillDmg,
    burstDmgBonus: mergedBonuses.burstDmg,
    normalDmgBonus: mergedBonuses.normalDmg,
    sources: {
      character: {
        baseAtk: characterBaseAtk,
        flatAtk,
        critRate: Number(config?.critRate || 0),
        critDmg: Number(config?.critDmg || 0),
        em: Number(config?.em || 0),
        level: Number(config?.level || 90),
      },
      weapon,
      artifacts,
      constellation: config?.constellation ?? 0,
      talentLevels: resolveTalentLevelsForDps(config, character),
    },
  };
}

function calcAverageCritMultiplier(critRate, critDmg) {
  return 1 + (critRate / 100) * (critDmg / 100);
}

function calcSkillDamage({
  totalAtk,
  critRate,
  critDmg,
  skillKey,
  talentLevel,
  constellationLevel,
  stats,
  characterElement,
}) {
  const constellation = getConstellationMultipliers(constellationLevel);
  const talentMult = getTalentMultiplier(talentLevel, skillKey);
  const baseMult = SKILL_BASE_MULTIPLIER[skillKey];

  let skillBonus = stats.generalDmgBonus;
  if (skillKey === 'auto') skillBonus += stats.normalDmgBonus;
  if (skillKey === 'skill') skillBonus += stats.skillDmgBonus;
  if (skillKey === 'burst') skillBonus += stats.burstDmgBonus;

  const elementBonus = skillKey === 'auto' && characterElement === 'Physical'
    ? stats.physicalDmgBonus
    : stats.elementalDmgBonus;

  const raw = totalAtk
    * baseMult
    * talentMult
    * constellation[skillKey]
    * (1 + (skillBonus + elementBonus) / 100);

  const avgMult = calcAverageCritMultiplier(critRate, critDmg);
  const normal = Math.round(raw * avgMult);
  const crit = Math.round(raw * (1 + critDmg / 100));

  return {
    normal,
    crit,
    affectedByConst: (
      (skillKey === 'auto' && constellationLevel >= 6)
      || (skillKey === 'skill' && constellationLevel >= 2)
      || (skillKey === 'burst' && constellationLevel >= 4)
    ),
    dps: Math.round(normal * ROTATION_FREQUENCY[skillKey]),
  };
}

export function calculateCharacterDps(config, character, options = {}) {
  const stats = buildEffectiveStats(config, character, options);
  const talentLevels = stats.sources.talentLevels;
  const constellation = stats.sources.constellation;

  const skills = {
    auto: calcSkillDamage({
      totalAtk: stats.totalAtk,
      critRate: stats.critRate,
      critDmg: stats.critDmg,
      skillKey: 'auto',
      talentLevel: talentLevels.auto,
      constellationLevel: constellation,
      stats,
      characterElement: character?.element,
    }),
    skill: calcSkillDamage({
      totalAtk: stats.totalAtk,
      critRate: stats.critRate,
      critDmg: stats.critDmg,
      skillKey: 'skill',
      talentLevel: talentLevels.skill,
      constellationLevel: constellation,
      stats,
      characterElement: character?.element,
    }),
    burst: calcSkillDamage({
      totalAtk: stats.totalAtk,
      critRate: stats.critRate,
      critDmg: stats.critDmg,
      skillKey: 'burst',
      talentLevel: talentLevels.burst,
      constellationLevel: constellation,
      stats,
      characterElement: character?.element,
    }),
  };

  const totalDps = skills.auto.dps + skills.skill.dps + skills.burst.dps;

  return {
    characterId: character.id,
    name: options.formatName?.(character) ?? character.nameRu ?? character.name,
    nameRu: character.nameRu,
    nameEn: character.name,
    iconUrl: options.iconUrl ?? null,
    constellation,
    level: stats.sources.character.level,
    skills: {
      auto: {
        normal: skills.auto.normal,
        crit: skills.auto.crit,
        affectedByConst: skills.auto.affectedByConst,
      },
      skill: {
        normal: skills.skill.normal,
        crit: skills.skill.crit,
        affectedByConst: skills.skill.affectedByConst,
      },
      burst: {
        normal: skills.burst.normal,
        crit: skills.burst.crit,
        affectedByConst: skills.burst.affectedByConst,
      },
    },
    totalDps,
    breakdown: stats,
  };
}
