/**
 * Mock-данные V2 (без бэкенда).
 * Персонажи вынесены в characters.js; здесь — артефакты, формулы и расчёт.
 */
import { CHARACTERS, findCharacterById } from './characters';
import { getCharacterIconUrl } from './characterIcons';

export { CHARACTERS };
export { getCharacterIconUrl, getCharacterIconUrls } from './characterIcons';
export const findCharacter = findCharacterById;

export const ELEMENT_COLORS = {
  Pyro: 'bg-red-500',
  Hydro: 'bg-blue-500',
  Electro: 'bg-purple-500',
  Cryo: 'bg-cyan-400',
  Anemo: 'bg-teal-400',
  Geo: 'bg-yellow-600',
  Dendro: 'bg-green-500',
  Physical: 'bg-gray-500',
};

/** Сеты артефактов с бонусами 2pc / 4pc */
export const ARTIFACT_SETS = [
  { id: 'crimson', name: 'Crimson Witch of Flames', bonus2: 'Pyro DMG +15%', bonus4: 'Increases Overloaded, Burning, and Pyro DMG by 40%' },
  { id: 'shimenawa', name: 'Shimenawa\'s Reminiscence', bonus2: 'ATK +18%', bonus4: 'Normal/Charged/Plunging DMG +50% when off-field' },
  { id: 'emblem', name: 'Emblem of Severed Fate', bonus2: 'ER +20%', bonus4: 'Burst DMG +25% of ER (max 75%)' },
  { id: 'gladiator', name: 'Gladiator\'s Finale', bonus2: 'ATK +18%', bonus4: 'Normal ATK DMG +35% (Sword/Claymore/Polearm)' },
  { id: 'wanderer', name: 'Wanderer\'s Troupe', bonus2: 'Elemental Mastery +80', bonus4: 'Charged ATK DMG +35% (Catalyst/Bow)' },
  { id: 'noblesse', name: 'Noblesse Oblige', bonus2: 'Burst DMG +20%', bonus4: 'Using Burst increases party ATK by 20% for 12s' },
  { id: 'heart-of-depth', name: 'Heart of Depth', bonus2: 'Hydro DMG +15%', bonus4: 'Normal/Charged ATK DMG +30% for 15s after Skill' },
  { id: 'viridescent', name: 'Viridescent Venerer', bonus2: 'Anemo DMG +15%', bonus4: 'Swirl reduces enemy RES by 40% for 10s' },
];

/** Основные статы по слотам артефактов */
export const MAIN_STATS = {
  flower: ['HP'],
  plume: ['ATK'],
  sands: ['ATK%', 'HP%', 'DEF%', 'EM', 'ER'],
  goblet: ['Pyro DMG', 'Hydro DMG', 'Electro DMG', 'Cryo DMG', 'Anemo DMG', 'Geo DMG', 'Dendro DMG', 'Physical DMG', 'ATK%'],
  circlet: ['CRIT Rate', 'CRIT DMG', 'ATK%', 'HP%', 'DEF%', 'EM', 'Healing Bonus'],
};

export const SUBSTAT_OPTIONS = ['ATK', 'ATK%', 'HP', 'HP%', 'DEF', 'DEF%', 'CRIT Rate', 'CRIT DMG', 'EM', 'ER'];

/** Слоты артефактов */
export const ARTIFACT_SLOTS = [
  { key: 'flower', label: 'Flower of Life' },
  { key: 'plume', label: 'Plume of Death' },
  { key: 'sands', label: 'Sands of Eon' },
  { key: 'goblet', label: 'Goblet of Eonothem' },
  { key: 'circlet', label: 'Circlet of Logos' },
];

/** Описания созвездий (mock — одинаковый шаблон для всех) */
export const CONSTELLATION_DESCRIPTIONS = [
  'C0 — Базовые способности без дополнительных эффектов.',
  'C1 — Улучшает Elemental Skill: снижает перезарядку на 20%.',
  'C2 — Увеличивает CRIT Rate на 15% при использовании Burst.',
  'C3 — Повышает уровень Elemental Skill на 3.',
  'C4 — Нанесённый урон увеличивается на 25% при HP ниже 50%.',
  'C5 — Повышает уровень Elemental Burst на 3.',
  'C6 — Мощное улучшение: дополнительный удар при каждой 3-й атаке.',
];

/** Формулы для тултипов */
export const FORMULAS = {
  avgDmg: 'Avg DMG = Base × (1 + CRIT Rate × CRIT DMG)',
  critDmg: 'Crit DMG = Base × (1 + CRIT DMG%)',
  teamDps: 'Team DPS = Σ(Character DPS) за время ротации',
  setBonus: 'Set Bonus применяется к соответствующему типу урона',
};

/** Дефолтная конфигурация персонажа */
export function getDefaultConfig(character) {
  return {
    characterId: character.id,
    level: 90,
    atk: { base: 300, bonus: 100 },
    hp: 18000,
    def: 800,
    em: 100,
    critRate: 50,
    critDmg: 120,
    energyRecharge: 120,
    constellation: 0,
    artifacts: {
      flower: { set: 'crimson', mainStat: 'HP', substats: [{ stat: 'CRIT Rate', value: 3.5 }, { stat: 'CRIT DMG', value: 7.0 }, { stat: 'ATK%', value: 4.1 }, { stat: 'EM', value: 23 }] },
      plume: { set: 'crimson', mainStat: 'ATK', substats: [{ stat: 'CRIT Rate', value: 3.9 }, { stat: 'CRIT DMG', value: 7.8 }, { stat: 'HP%', value: 5.3 }, { stat: 'ER', value: 5.8 }] },
      sands: { set: 'crimson', mainStat: 'ATK%', substats: [{ stat: 'CRIT Rate', value: 3.5 }, { stat: 'CRIT DMG', value: 7.0 }, { stat: 'EM', value: 23 }, { stat: 'ATK', value: 16 }] },
      goblet: { set: 'crimson', mainStat: 'Pyro DMG', substats: [{ stat: 'CRIT Rate', value: 3.5 }, { stat: 'CRIT DMG', value: 7.0 }, { stat: 'ATK%', value: 4.1 }, { stat: 'HP', value: 239 }] },
      circlet: { set: 'crimson', mainStat: 'CRIT DMG', substats: [{ stat: 'CRIT Rate', value: 3.5 }, { stat: 'ATK%', value: 4.1 }, { stat: 'EM', value: 23 }, { stat: 'DEF', value: 19 }] },
    },
  };
}

/** Mock-расчёт DPS для демонстрации результатов */
export function calculateMockDps(config, character) {
  const atk = config.atk.base + config.atk.bonus;
  const critMult = 1 + (config.critRate / 100) * (config.critDmg / 100);
  const constBonus = 1 + config.constellation * 0.05;
  const base = atk * critMult * constBonus;

  return {
    characterId: character.id,
    name: character.nameRu || character.name,
    iconUrl: getCharacterIconUrl(character),
    constellation: config.constellation,
    skills: {
      auto: { normal: Math.round(base * 0.8), crit: Math.round(base * 0.8 * (1 + config.critDmg / 100)), affectedByConst: config.constellation >= 6 },
      skill: { normal: Math.round(base * 1.5), crit: Math.round(base * 1.5 * (1 + config.critDmg / 100)), affectedByConst: config.constellation >= 2 },
      burst: { normal: Math.round(base * 3.2), crit: Math.round(base * 3.2 * (1 + config.critDmg / 100)), affectedByConst: config.constellation >= 4 },
    },
    totalDps: Math.round(base * 2.5),
  };
}

export function getSetBonuses(artifacts) {
  const counts = {};
  Object.values(artifacts).forEach((slot) => {
    counts[slot.set] = (counts[slot.set] || 0) + 1;
  });
  const bonuses = [];
  Object.entries(counts).forEach(([setId, count]) => {
    const set = ARTIFACT_SETS.find((s) => s.id === setId);
    if (!set) return;
    if (count >= 2) bonuses.push({ set: set.name, text: set.bonus2, pieces: 2 });
    if (count >= 4) bonuses.push({ set: set.name, text: set.bonus4, pieces: 4 });
  });
  return bonuses;
}
