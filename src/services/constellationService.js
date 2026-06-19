/**

 * Данные созвездий: genshin-db-api (RU + иконки enka) + jmp.blue fallback.

 */

import { getJmpSlug, getCharacterConstellationPortraitUrls } from '../characterIcons';
import { getStaticConstellationShapeUrl } from '../constellationShapeUrls';
import { getGenshinDbQuery } from '../lib/genshinDbQuery';
import {
  getTravelerConstellationCacheKey,
  getTravelerShapeCharacterId,
  getTravelerShapeNameEn,
  isTravelerCharacter,
  normalizeTravelerElement,
  TRAVELER_CONSTELLATION_NAME_RU,
} from '../travelerConstellations';

const GENSIN_DB_API = 'https://genshin-db-api.vercel.app/api';
const ENKA_UI_BASE = 'https://enka.network/ui';
const CONSTELLATION_DATA_VERSION = 6;

/** Персонажи, у которых genshin-db отдаёт «???» вместо названия созвездия */
const CONSTELLATION_OVERRIDES = {
  columbina: {
    nameRu: 'Коломбина Гипоселениа',
    nameEn: 'Columbina Hyposelenia',
  },
};

const cache = new Map();
const imageCache = new Map();
const fandomShapeCache = new Map();

function getConstellationCacheKey(character, options = {}) {
  if (isTravelerCharacter(character) && options.element) {
    return getTravelerConstellationCacheKey(options.element);
  }
  return character?.id;
}

function getJmpSlugForConstellation(character, travelerElement = null) {
  if (isTravelerCharacter(character)) {
    return normalizeTravelerElement(travelerElement) === 'Anemo' ? getJmpSlug(character) : null;
  }
  return getJmpSlug(character);
}



function enkaAssetUrl(assetName) {

  if (!assetName) return null;

  return `${ENKA_UI_BASE}/${assetName}.png`;

}

/** Enka «constellation» из genshin-db — часто Eff_UI_Talent_* (иконка эффекта), не силуэт созвездия. */
export function isEnkaConstellationShapeAsset(assetName) {
  if (!assetName || typeof assetName !== 'string') return false;
  return !assetName.startsWith('Eff_UI_Talent_');
}

function getEnkaShapeUrl(images) {
  const assetName = images?.constellation;
  if (!isEnkaConstellationShapeAsset(assetName)) return null;
  return enkaAssetUrl(assetName);
}



function storeImageUrls(characterId, shapeUrl, items) {

  const byLevel = {};

  for (const item of items) {

    if (item.iconUrl) byLevel[item.level] = item.iconUrl;

  }

  imageCache.set(characterId, { shapeUrl, byLevel });

}



function buildC0Item(data, character) {

  const constellationName = data?.constellation || character.nameRu;

  const baseDescription = data?.description

    || `${character.nameRu} использует базовый набор талантов без бонусов созвездий.`;



  return {

    level: 0,

    title: constellationName,

    description: baseDescription,

    iconUrl: null,

  };

}



function mapApiConstellations(data, character) {

  const items = [buildC0Item(data, character)];



  (data.constellations || [])

    .slice()

    .sort((a, b) => a.level - b.level)

    .forEach((entry) => {

      items.push({

        level: entry.level,

        title: entry.name,

        description: String(entry.description || '').replace(/\\n/g, '\n'),

        iconUrl: null,

      });

    });



  return items;

}



function buildUnavailableConstellations(character) {
  return {
    constellationName: '',
    shapeUrl: null,
    items: [],
    fromApi: false,
    unavailable: true,
  };
}

async function fetchGenshinDbJson(path, query, resultLanguage = 'Russian') {
  const url = `${GENSIN_DB_API}/${path}?query=${encodeURIComponent(query)}&resultLanguage=${encodeURIComponent(resultLanguage)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`genshin-db ${path} failed: ${response.status}`);
  }
  return response.json();
}

function normalizeConstellationNameForFandom(name) {
  return String(name || '').trim().replace(/'/g, '');
}

function isInvalidConstellationName(name, character) {
  const normalized = normalizeConstellationNameForFandom(name);
  if (!normalized || normalized === '???') return true;

  const characterNames = new Set(
    [
      character?.nameEn,
      character?.name,
      character?.nameRu,
      getGenshinDbQuery(character),
    ]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase()),
  );

  return characterNames.has(normalized.toLowerCase());
}

function resolveConstellationNames(character, charData, charDataEn, constData, constDataEn) {
  const override = CONSTELLATION_OVERRIDES[character?.id];
  if (override) {
    return {
      nameRu: override.nameRu,
      nameEn: override.nameEn,
    };
  }

  const nameRu = [charData?.constellation, constData?.name]
    .find((name) => !isInvalidConstellationName(name, character))
    ?? character.nameRu;

  const nameEn = [
    charDataEn?.constellation,
    constDataEn?.name,
    charData?.constellation,
    constData?.name,
  ].find((name) => !isInvalidConstellationName(name, character))
    ?? character.nameEn;

  return { nameRu, nameEn };
}

function parseFandomShapeResponse(data) {
  if (data?.url) return data.url;
  const page = Object.values(data?.query?.pages || {})[0];
  return page?.imageinfo?.[0]?.url || null;
}

function getFandomApiEndpoints(normalized) {
  const fileName = `${normalized} Shape.png`;
  const title = `File:${fileName.replace(/ /g, '_')}`;
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'imageinfo',
    iiprop: 'url',
    titles: title,
  });
  const query = params.toString();
  const endpoints = [];

  if (typeof window !== 'undefined') {
    endpoints.push(`/fandom-api/api.php?${query}`);
    endpoints.push(`/api/media/fandom-constellation-shape?constellation=${encodeURIComponent(normalized)}`);
  }

  endpoints.push(`https://genshin-impact.fandom.com/api.php?${query}`);
  return endpoints;
}

async function fetchFandomConstellationShapeUrl(constellationNameEn) {
  const normalized = normalizeConstellationNameForFandom(constellationNameEn);
  if (!normalized || normalized === '???') return null;

  if (fandomShapeCache.has(normalized)) {
    return fandomShapeCache.get(normalized);
  }

  const staticUrl = getStaticConstellationShapeUrl(null, normalized);
  if (staticUrl) {
    fandomShapeCache.set(normalized, staticUrl);
    return staticUrl;
  }

  try {
    for (const api of getFandomApiEndpoints(normalized)) {
      try {
        const response = await fetch(api);
        if (!response.ok) continue;

        const data = await response.json();
        const url = parseFandomShapeResponse(data);
        if (url) {
          fandomShapeCache.set(normalized, url);
          return url;
        }
      } catch {
        // try next endpoint
      }
    }
  } catch {
    return null;
  }

  fandomShapeCache.set(normalized, null);
  return null;
}

function buildShapeUrlCandidates(images, character, constellationNameEn, fandomUrl = null, travelerElement = null) {
  const candidates = [];
  const shapeCharacterId = isTravelerCharacter(character) && travelerElement
    ? getTravelerShapeCharacterId(travelerElement)
    : character?.id;
  const staticUrl = getStaticConstellationShapeUrl(shapeCharacterId, constellationNameEn);

  const slug = getJmpSlugForConstellation(character, travelerElement);
  if (slug) {
    candidates.push(`https://genshin.jmp.blue/characters/${slug}/constellation-shape`);
  }

  if (staticUrl) candidates.push(staticUrl);

  if (fandomUrl && fandomUrl !== staticUrl) {
    candidates.push(fandomUrl);
  }

  const enkaShape = getEnkaShapeUrl(images);
  if (enkaShape) candidates.push(enkaShape);

  return [...new Set(candidates.filter(Boolean))];
}

async function resolveConstellationShape(images, character, constellationNameEn, travelerElement = null) {
  const fandomUrl = await fetchFandomConstellationShapeUrl(constellationNameEn);
  const candidates = buildShapeUrlCandidates(
    images,
    character,
    constellationNameEn,
    fandomUrl,
    travelerElement,
  );

  const uniqueCandidates = [...new Set(candidates.filter(Boolean))];
  return {
    shapeUrl: uniqueCandidates[0] || null,
    shapeUrlCandidates: uniqueCandidates,
  };
}

async function applyResolvedShape(result, images, character, constellationNameEn, travelerElement = null) {
  const { shapeUrl, shapeUrlCandidates } = await resolveConstellationShape(
    images,
    character,
    constellationNameEn,
    travelerElement,
  );

  result.shapeUrl = shapeUrl;
  result.shapeUrlCandidates = shapeUrlCandidates;

  if (result.items[0] && shapeUrl) {
    result.items[0].iconUrl = shapeUrl;
  }

  return result;
}

function pickShapeUrl(images, character, travelerElement = null) {
  const slug = getJmpSlugForConstellation(character, travelerElement);
  if (slug) {
    return `https://genshin.jmp.blue/characters/${slug}/constellation-shape`;
  }
  if (isTravelerCharacter(character) && travelerElement) {
    return getStaticConstellationShapeUrl(
      getTravelerShapeCharacterId(travelerElement),
      getTravelerShapeNameEn(travelerElement),
    );
  }
  return getEnkaShapeUrl(images);
}

function mapGenshinDbConstellations(constData, charData, character, constellationTitle, travelerElement = null) {
  const images = constData?.images || {};
  let shapeUrl = pickShapeUrl(images, character, travelerElement);

  const c0Description = charData?.description
    || `${character.nameRu} использует базовый набор талантов без бонусов созвездий.`;

  const items = [{
    level: 0,
    title: constellationTitle,
    description: c0Description,
    iconUrl: shapeUrl || enkaAssetUrl(images.c1),
  }];



  for (let level = 1; level <= 6; level += 1) {

    const entry = constData?.[`c${level}`];

    if (!entry) continue;

    const iconUrl = enkaAssetUrl(images[`c${level}`]);

    items.push({

      level,

      title: entry.name,

      description: entry.effect,

      iconUrl,

    });

  }



  if (!shapeUrl) {
    shapeUrl = getEnkaShapeUrl(images) || null;
  }

  if (items[0] && shapeUrl) {
    items[0].iconUrl = shapeUrl;
  }



  return {
    constellationName: constellationTitle,
    shapeUrl,
    shapeUrlCandidates: shapeUrl ? [shapeUrl] : [],
    items,
    fromApi: true,
  };
}

async function fetchFromGenshinDb(character, options = {}) {
  const query = getGenshinDbQuery(character, options);
  const travelerElement = isTravelerCharacter(character)
    ? normalizeTravelerElement(options.element)
    : null;

  const [constData, charData, charDataEn, constDataEn] = await Promise.all([
    fetchGenshinDbJson('constellations', query),
    fetchGenshinDbJson('characters', query).catch(() => null),
    fetchGenshinDbJson('characters', query, 'English').catch(() => null),
    fetchGenshinDbJson('constellations', query, 'English').catch(() => null),
  ]);

  if (!constData?.c1) {
    throw new Error('Constellation data incomplete');
  }

  let { nameRu, nameEn } = resolveConstellationNames(
    character,
    charData,
    charDataEn,
    constData,
    constDataEn,
  );

  if (travelerElement) {
    nameRu = TRAVELER_CONSTELLATION_NAME_RU;
    nameEn = getTravelerShapeNameEn(travelerElement);
  }

  const result = mapGenshinDbConstellations(
    constData,
    charData,
    character,
    nameRu,
    travelerElement,
  );
  result.element = travelerElement || charDataEn?.element || charData?.element || character.element;
  const resolved = await applyResolvedShape(
    result,
    constData?.images || {},
    character,
    nameEn,
    travelerElement,
  );
  resolved.dataVersion = CONSTELLATION_DATA_VERSION;
  if (travelerElement) {
    resolved.travelerElement = travelerElement;
  }
  return resolved;
}



async function fetchFromJmpBlue(character) {

  const slug = getJmpSlug(character);

  if (!slug) {

    throw new Error('No jmp slug');

  }



  const response = await fetch(`https://genshin.jmp.blue/characters/${slug}?lang=en`);

  if (!response.ok) {

    throw new Error(`Constellation fetch failed: ${response.status}`);

  }



  const data = await response.json();

  const items = mapApiConstellations(data, character);

  const shapeUrl = `https://genshin.jmp.blue/characters/${slug}/constellation-shape`;



  for (const item of items) {

    if (item.level === 0) {

      item.iconUrl = shapeUrl;

    } else {

      item.iconUrl = `https://genshin.jmp.blue/characters/${slug}/constellation-${item.level}`;

    }

  }



  const result = {
    constellationName: data.constellation || character.nameRu,
    shapeUrl,
    shapeUrlCandidates: [shapeUrl],
    items,
    fromApi: true,
  };

  const resolved = await applyResolvedShape(result, {}, character, data.constellation || character.nameEn);
  resolved.element = character.element;
  resolved.dataVersion = CONSTELLATION_DATA_VERSION;
  return resolved;
}



export function getCharacterPortraitUrl(character) {
  const urls = getCharacterConstellationPortraitUrls(character);
  return urls[0] || '';
}



export function getConstellationShapeUrl(character) {

  const cached = imageCache.get(character?.id);

  if (cached?.shapeUrl) return cached.shapeUrl;



  const slug = getJmpSlug(character);

  if (!slug) return null;

  return `https://genshin.jmp.blue/characters/${slug}/constellation-shape`;

}



export function getConstellationLevelIconUrl(character, level) {

  const cached = imageCache.get(character?.id);

  if (cached?.byLevel?.[level]) return cached.byLevel[level];



  const slug = getJmpSlug(character);

  if (!slug) return null;

  if (level === 0) return getConstellationShapeUrl(character);

  return `https://genshin.jmp.blue/characters/${slug}/constellation-${level}`;

}



export async function fetchCharacterConstellationData(character, options = {}) {
  if (!character?.id) {
    return { constellationName: '', shapeUrl: null, items: [], fromApi: false };
  }

  const cacheKey = getConstellationCacheKey(character, options);

  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (cached?.dataVersion === CONSTELLATION_DATA_VERSION) {
      return cached;
    }
    cache.delete(cacheKey);
    imageCache.delete(cacheKey);
  }

  try {
    const result = await fetchFromGenshinDb(character, options);

    storeImageUrls(cacheKey, result.shapeUrl, result.items);

    cache.set(cacheKey, result);

    return result;

  } catch {

    try {

      const result = await fetchFromJmpBlue(character);

      storeImageUrls(cacheKey, result.shapeUrl, result.items);

      cache.set(cacheKey, result);

      return result;

    } catch {
      const unavailable = buildUnavailableConstellations(character);
      cache.set(cacheKey, unavailable);
      return unavailable;
    }

  }

}



export function clearConstellationCache() {
  cache.clear();
  imageCache.clear();
  fandomShapeCache.clear();
}


