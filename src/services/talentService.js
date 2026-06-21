/**
 * Описания навыков персонажей: genshin-db-api (RU) + иконки enka.
 */

import { getGenshinDbQuery } from '../lib/genshinDbQuery';
import {
  getTravelerConstellationCacheKey,
  isTravelerCharacter,
  normalizeTravelerElement,
} from '../travelerConstellations';

const GENSIN_DB_API = 'https://genshin-db-api.vercel.app/api';
const ENKA_UI_BASE = 'https://enka.network/ui';
const TALENT_DATA_VERSION = 1;

const cache = new Map();

export const TALENT_SLOTS = [
  { key: 'combat1', label: 'Обычная атака', badge: 'NA' },
  { key: 'combat2', label: 'Элементальный навык', badge: 'E' },
  { key: 'combat3', label: 'Взрыв стихии', badge: 'Q' },
  { key: 'passive1', label: 'Пассивный талант I', badge: 'A1' },
  { key: 'passive2', label: 'Пассивный талант II', badge: 'A4' },
  { key: 'passive3', label: 'Пассивный талант III', badge: 'A0' },
];

function getTalentCacheKey(character, options = {}) {
  if (isTravelerCharacter(character) && options.element) {
    return `v${TALENT_DATA_VERSION}:talents:${getTravelerConstellationCacheKey(options.element)}`;
  }
  return `v${TALENT_DATA_VERSION}:talents:${character?.id}`;
}

function getTalentIconUrl(images) {
  if (!images || typeof images !== 'object') return null;

  const asset = images.skill
    || images.normal
    || images.combat
    || Object.values(images).find((value) => typeof value === 'string');

  if (!asset || typeof asset !== 'string') return null;
  return `${ENKA_UI_BASE}/${asset}.png`;
}

function mapTalentSlot(raw, slot) {
  if (!raw?.name) return null;

  const description = typeof raw.info === 'string' && raw.info.trim()
    ? raw.info
    : (typeof raw.description === 'string' ? raw.description : '');

  return {
    key: slot.key,
    label: slot.label,
    badge: slot.badge,
    name: raw.name,
    description,
    iconUrl: getTalentIconUrl(raw.images),
  };
}

function mapTalentsResponse(data) {
  if (!data || typeof data !== 'object') return [];

  return TALENT_SLOTS
    .map((slot) => mapTalentSlot(data[slot.key], slot))
    .filter(Boolean);
}

export async function fetchCharacterTalents(character, options = {}) {
  if (!character) {
    return { talents: [], unavailable: true, element: null, fromApi: false };
  }

  const cacheKey = getTalentCacheKey(character, options);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const query = getGenshinDbQuery(character, options);
  const url = `${GENSIN_DB_API}/talents?query=${encodeURIComponent(query)}&resultLanguage=Russian`;

  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(`Не удалось загрузить навыки: ${error.message}`);
  }

  if (!response.ok) {
    throw new Error(`Не удалось загрузить навыки: HTTP ${response.status}`);
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`Не удалось разобрать ответ API навыков: ${error.message}`);
  }

  const talents = mapTalentsResponse(data);
  const element = isTravelerCharacter(character)
    ? normalizeTravelerElement(options.element || character.element)
    : character.element;

  const result = {
    talents,
    unavailable: talents.length === 0,
    element,
    fromApi: true,
  };

  cache.set(cacheKey, result);
  return result;
}

export function clearTalentCache() {
  cache.clear();
}
