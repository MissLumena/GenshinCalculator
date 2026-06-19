/**
 * Mock-данные V2 (без бэкенда).
 * Персонажи вынесены в characters.js; здесь — артефакты, формулы и расчёт.
 */
import { CHARACTERS, findCharacterById } from './characters';
import {
  DEFAULT_ARTIFACT_SET_ID,
  resolveArtifactSetId,
  getLegacyArtifactSetsForBonuses,
} from './artifacts';
import { getCharacterIconUrl } from './characterIcons';
import {
  formatCharacterChartLabel,
  getCharacterNameEn,
  getCharacterNameRu,
} from './lib/characterName';
import { calculateCharacterDps } from './lib/dpsCalculator';

export { CHARACTERS };
export {
  getCharacterIconUrl,
  getCharacterIconUrls,
  getCharacterSplashUrls,
  getCharacterSideIconUrl,
  getCharacterConstellationPortraitUrls,
  getTravelerDuoPortraitSets,
} from './characterIcons';
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

export const ELEMENTAL_RES_ELEMENTS = ['Pyro', 'Hydro', 'Dendro', 'Anemo', 'Cryo', 'Electro', 'Geo', 'Physical'];

export const ELEMENTAL_RES_BONUS_OPTIONS = [
  { value: 'Pyro', label: 'Бонус пиро сопротивления' },
  { value: 'Hydro', label: 'Бонус гидро сопротивления' },
  { value: 'Dendro', label: 'Бонус дендро сопротивления' },
  { value: 'Anemo', label: 'Бонус анемо сопротивления' },
  { value: 'Cryo', label: 'Бонус крио сопротивления' },
  { value: 'Electro', label: 'Бонус электро сопротивления' },
  { value: 'Geo', label: 'Бонус гео сопротивления' },
  { value: 'Physical', label: 'Бонус физ. сопротивления' },
];

export const MAX_ELEMENTAL_RES_BONUSES = 2;

/** Нормализует один бонус сопротивления стихии. */
export function normalizeElementalResBonus(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const element = ELEMENTAL_RES_ELEMENTS.includes(raw.element) ? raw.element : null;
  if (!element) return null;
  return {
    element,
    value: Math.max(0, Number(raw.value) || 0),
  };
}

/** Нормализует до двух бонусов сопротивления (массив или legacy-объект). */
export function normalizeElementalResBonuses(raw) {
  const items = [];

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const normalized = normalizeElementalResBonus(entry);
      if (normalized && !items.some((item) => item.element === normalized.element)) {
        items.push(normalized);
      }
      if (items.length >= MAX_ELEMENTAL_RES_BONUSES) break;
    }
    return items.length ? items : null;
  }

  const single = normalizeElementalResBonus(raw);
  return single ? [single] : null;
}

/** Возвращает два слота бонусов (null для пустых). */
export function getElementalResBonusSlots(raw) {
  const list = normalizeElementalResBonuses(raw) ?? [];
  return [
    list[0] ?? null,
    list[1] ?? null,
  ];
}

/** Обновляет один слот бонуса сопротивления (0 или 1). */
export function patchElementalResBonusSlot(raw, slotIndex, patch) {
  if (slotIndex < 0 || slotIndex >= MAX_ELEMENTAL_RES_BONUSES) {
    return normalizeElementalResBonuses(raw);
  }

  const slots = getElementalResBonusSlots(raw);
  const current = slots[slotIndex];

  if (patch.element === null || patch.element === '') {
    slots[slotIndex] = null;
  } else if ('element' in patch) {
    slots[slotIndex] = normalizeElementalResBonus({
      element: patch.element,
      value: patch.value ?? (current?.element === patch.element ? current.value : 0),
    });
  } else if ('value' in patch && current?.element) {
    slots[slotIndex] = normalizeElementalResBonus({
      element: current.element,
      value: patch.value,
    });
  }

  if (slots[slotIndex]?.element) {
    const otherIndex = slotIndex === 0 ? 1 : 0;
    if (slots[otherIndex]?.element === slots[slotIndex].element) {
      slots[otherIndex] = null;
    }
  }

  const compact = slots.filter(Boolean);
  return compact.length ? compact : null;
}

/** Сеты артефактов с бонусами 2pc / 4pc (полный каталог ≤ 6.6) */
export const ARTIFACT_SETS = getLegacyArtifactSetsForBonuses();

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
export const CONSTELLATION_ITEMS = [
  {
    level: 0,
    title: 'Базовые способности',
    description: 'Базовые способности без дополнительных эффектов.',
  },
  {
    level: 1,
    title: 'Улучшение навыка',
    description: 'Улучшает Elemental Skill: снижает перезарядку на 20%.',
  },
  {
    level: 2,
    title: 'Критический импульс',
    description: 'Увеличивает CRIT Rate на 15% при использовании Elemental Burst.',
  },
  {
    level: 3,
    title: 'Мастерство навыка',
    description: 'Повышает уровень Elemental Skill на 3.',
  },
  {
    level: 4,
    title: 'Решительный удар',
    description: 'Нанесённый урон увеличивается на 25% при HP ниже 50%.',
  },
  {
    level: 5,
    title: 'Мастерство взрыва',
    description: 'Повышает уровень Elemental Burst на 3.',
  },
  {
    level: 6,
    title: 'Высшее созвездие',
    description: 'Мощное улучшение: дополнительный удар при каждой 3-й атаке.',
  },
];

export const CONSTELLATION_DESCRIPTIONS = CONSTELLATION_ITEMS.map(
  (item) => `C${item.level} — ${item.description}`,
);

/** Формулы для тултипов */
export const FORMULAS = {
  avgDmg: 'Avg DMG = ATK × множитель навыка × (1 + CRIT Rate × CRIT DMG) × бонусы',
  critDmg: 'Crit DMG = урон × (1 + CRIT DMG%)',
  teamDps: 'Team DPS = Σ(урон навыков × частота в ротации) с учётом артефактов, оружия, созвездий и талантов',
  setBonus: 'Set Bonus применяется к соответствующему типу урона',
};

/** Упрощённые поля артефактов (одна панель) */
export const ARTIFACT_SUMMARY_FIELDS = [
  { key: 'hp', label: 'HP' },
  { key: 'critRate', label: 'CRIT Rate' },
  { key: 'critDmg', label: 'CRIT DMG' },
  { key: 'atkPercent', label: 'ATK%' },
  { key: 'em', label: 'EM' },
];

export function getDefaultArtifacts() {
  return {
    set: DEFAULT_ARTIFACT_SET_ID,
    set2: null,
    hp: 0,
    critRate: 0,
    critDmg: 0,
    atkPercent: 0,
    em: 0,
  };
}

function inferSetsFromSlots(slots) {
  const counts = {};
  for (const slot of Object.values(slots)) {
    if (slot?.set) {
      const id = resolveArtifactSetId(slot.set);
      counts[id] = (counts[id] || 0) + 1;
    }
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const primarySet = sorted[0]?.[0] || DEFAULT_ARTIFACT_SET_ID;
  let secondarySet = null;

  if (sorted.length > 1) {
    const [, secondaryCount] = sorted[1];
    if (secondaryCount >= 2) {
      secondarySet = sorted[1][0];
    } else if (sorted[0][1] === 4 && secondaryCount >= 1) {
      secondarySet = sorted[1][0];
    }
  }

  if (secondarySet === primarySet) {
    secondarySet = null;
  }

  return { set: primarySet, set2: secondarySet };
}

/** Слоты БД → упрощённый формат UI */
export function slotsToSimplified(slots) {
  if (!slots?.flower) return getDefaultArtifacts();

  const pickStat = (statNames) => {
    for (const slot of Object.values(slots)) {
      const sub = slot.substats?.find((s) => statNames.includes(s.stat));
      if (sub) return sub.value;
    }
    return 0;
  };

  const { set, set2 } = inferSetsFromSlots(slots);

  return {
    set,
    set2,
    hp: pickStat(['HP']),
    critRate: pickStat(['CRIT Rate']),
    critDmg: pickStat(['CRIT DMG']),
    atkPercent: pickStat(['ATK%']),
    em: pickStat(['EM']),
  };
}

/** Упрощённый формат → слоты для Supabase */
export function simplifiedToSlots(artifacts) {
  const primarySet = resolveArtifactSetId(artifacts.set || DEFAULT_ARTIFACT_SET_ID);
  const secondarySet = artifacts.set2
    ? resolveArtifactSetId(artifacts.set2)
    : primarySet;
  const stat = (name, value) => [{ stat: name, value: value ?? 0 }];

  return {
    flower: { set: primarySet, mainStat: 'HP', substats: stat('HP', artifacts.hp) },
    plume: { set: secondarySet, mainStat: 'ATK', substats: stat('CRIT Rate', artifacts.critRate) },
    sands: { set: primarySet, mainStat: 'ATK%', substats: stat('CRIT DMG', artifacts.critDmg) },
    goblet: { set: primarySet, mainStat: 'ATK%', substats: stat('ATK%', artifacts.atkPercent) },
    circlet: { set: secondarySet, mainStat: 'CRIT Rate', substats: stat('EM', artifacts.em) },
  };
}

/** Поддержка старого формата из localStorage */
export function normalizeArtifacts(artifacts) {
  if (artifacts?.set != null && artifacts.hp !== undefined) {
    const set = resolveArtifactSetId(artifacts.set);
    let set2 = artifacts.set2 ? resolveArtifactSetId(artifacts.set2) : null;
    if (set2 === set) set2 = null;

    return {
      ...getDefaultArtifacts(),
      ...artifacts,
      set,
      set2,
    };
  }
  if (artifacts?.flower) return slotsToSimplified(artifacts);
  return getDefaultArtifacts();
}

/** Дефолтная конфигурация персонажа */
export function getDefaultConfig(character) {
  return {
    characterId: character.id,
    level: 90,
    atk: { base: 400, bonus: 0 },
    hp: 18000,
    def: 800,
    em: 100,
    critRate: 50,
    critDmg: 120,
    energyRecharge: 120,
    constellation: 0,
    artifacts: getDefaultArtifacts(),
    equippedWeaponId: null,
    elementalResBonuses: null,
    talentLevels: { auto: 10, skill: 10, burst: 10 },
  };
}

/** Суммарный ATK персонажа (base + bonus). */
export function getConfigTotalAtk(atk) {
  return Math.max(0, Number(atk?.base) || 0) + Math.max(0, Number(atk?.bonus) || 0);
}

/** Записывает ATK в одно поле (bonus обнуляется). */
export function applyConfigTotalAtk(total) {
  const value = Math.max(0, Number(total) || 0);
  return { base: value, bonus: 0 };
}

/** Расчёт DPS с учётом статов, артефактов, оружия, созвездий и уровней талантов */
export function calculateMockDps(config, character, options = {}) {
  return calculateCharacterDps(config, character, {
    artifactSets: options.artifactSets,
    formatName: formatCharacterChartLabel,
    iconUrl: getCharacterIconUrl(character),
  });
}

function findArtifactSetEntry(setId, artifactSets) {
  return artifactSets.find((s) => s.id === setId)
    || artifactSets.find((s) => resolveArtifactSetId(s.id) === setId);
}

export function getSetBonuses(artifacts, artifactSets = ARTIFACT_SETS) {
  const normalized = normalizeArtifacts(artifacts);

  if (normalized.set) {
    const primarySet = findArtifactSetEntry(normalized.set, artifactSets);
    if (!primarySet) return [];

    if (normalized.set2) {
      const secondarySet = findArtifactSetEntry(normalized.set2, artifactSets);
      const bonuses = [
        {
          set: primarySet.name,
          text: primarySet.bonus4,
          pieces: 4,
          setId: primarySet.id,
        },
      ];
      if (secondarySet) {
        bonuses.push({
          set: secondarySet.name,
          text: secondarySet.bonus2,
          pieces: 2,
          setId: secondarySet.id,
        });
      }
      return bonuses;
    }

    return [
      { set: primarySet.name, text: primarySet.bonus2, pieces: 2, setId: primarySet.id },
      { set: primarySet.name, text: primarySet.bonus4, pieces: 4, setId: primarySet.id },
    ];
  }

  const counts = {};
  Object.values(artifacts).forEach((slot) => {
    if (slot?.set) counts[slot.set] = (counts[slot.set] || 0) + 1;
  });
  const bonuses = [];
  Object.entries(counts).forEach(([setId, count]) => {
    const set = findArtifactSetEntry(setId, artifactSets);
    if (!set) return;
    if (count >= 2) {
      bonuses.push({ set: set.name, text: set.bonus2, pieces: 2, setId: set.id });
    }
    if (count >= 4) {
      bonuses.push({ set: set.name, text: set.bonus4, pieces: 4, setId: set.id });
    }
  });
  return bonuses;
}
