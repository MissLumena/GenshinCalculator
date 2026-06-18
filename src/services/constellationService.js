/**

 * Данные созвездий: genshin-db-api (RU + иконки enka) + jmp.blue fallback.

 */

import { getJmpSlug, getCharacterConstellationPortraitUrls } from '../characterIcons';

const GENSIN_DB_API = 'https://genshin-db-api.vercel.app/api';
const ENKA_UI_BASE = 'https://enka.network/ui';

const cache = new Map();
const imageCache = new Map();
const fandomShapeCache = new Map();

/** id → запрос для genshin-db-api (если nameEn не подходит) */
const GENSIN_DB_QUERY_OVERRIDES = {
  'hu-tao': 'Hu Tao',
  'raiden-shogun': 'Raiden Shogun',
  'yun-jin': 'Yun Jin',
  'lan-yan': 'Lan Yan',
  'kaedehara-kazuha': 'Kazuha',
  'kamisato-ayaka': 'Ayaka',
  'kamisato-ayato': 'Ayato',
  'kuki-shinobu': 'Shinobu',
  'sangonomiya-kokomi': 'Kokomi',
  'kujou-sara': 'Sara',
  'shikanoin-heizou': 'Heizou',
  'yae-miko': 'Yae Miko',
  traveler: 'Traveler',
  pulonia: 'Prune',
  yagoda: 'Jahoda',
};



function getGenshinDbQuery(character) {

  return GENSIN_DB_QUERY_OVERRIDES[character.id] ?? character.nameEn ?? character.name;

}



function enkaAssetUrl(assetName) {

  if (!assetName) return null;

  return `${ENKA_UI_BASE}/${assetName}.png`;

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

async function fetchFandomConstellationShapeUrl(constellationNameEn) {
  const normalized = normalizeConstellationNameForFandom(constellationNameEn);
  if (!normalized) return null;

  if (fandomShapeCache.has(normalized)) {
    return fandomShapeCache.get(normalized);
  }

  try {
    const fileName = `${normalized} Shape.png`;
    const title = `File:${fileName.replace(/ /g, '_')}`;
    const api = `https://genshin-impact.fandom.com/api.php?action=query&format=json&prop=imageinfo&iiprop=url&titles=${encodeURIComponent(title)}`;
    const response = await fetch(api);
    if (!response.ok) return null;

    const data = await response.json();
    const page = Object.values(data.query?.pages || {})[0];
    const url = page?.imageinfo?.[0]?.url || null;
    fandomShapeCache.set(normalized, url);
    return url;
  } catch {
    return null;
  }
}

function buildShapeUrlCandidates(images, character, constellationNameEn) {
  const candidates = [];
  const slug = getJmpSlug(character);
  if (slug) {
    candidates.push(`https://genshin.jmp.blue/characters/${slug}/constellation-shape`);
  }

  const enkaShape = enkaAssetUrl(images?.constellation);
  if (enkaShape) candidates.push(enkaShape);

  const normalized = normalizeConstellationNameForFandom(constellationNameEn);
  if (normalized) {
    const fileName = `${normalized} Shape.png`;
    candidates.push(`https://genshin-impact.fandom.com/wiki/Special:FilePath/${encodeURIComponent(fileName)}`);
  }

  return [...new Set(candidates.filter(Boolean))];
}

async function resolveConstellationShape(images, character, constellationNameEn) {
  const fandomUrl = await fetchFandomConstellationShapeUrl(constellationNameEn);
  const candidates = buildShapeUrlCandidates(images, character, constellationNameEn);
  if (fandomUrl) candidates.push(fandomUrl);

  const uniqueCandidates = [...new Set(candidates.filter(Boolean))];
  return {
    shapeUrl: uniqueCandidates[0] || null,
    shapeUrlCandidates: uniqueCandidates,
  };
}

async function applyResolvedShape(result, images, character, constellationNameEn) {
  const { shapeUrl, shapeUrlCandidates } = await resolveConstellationShape(
    images,
    character,
    constellationNameEn,
  );

  result.shapeUrl = shapeUrl;
  result.shapeUrlCandidates = shapeUrlCandidates;

  if (result.items[0] && shapeUrl) {
    result.items[0].iconUrl = shapeUrl;
  }

  return result;
}

function pickShapeUrl(images, character) {
  const slug = getJmpSlug(character);
  if (slug) {
    return `https://genshin.jmp.blue/characters/${slug}/constellation-shape`;
  }
  return enkaAssetUrl(images?.constellation);
}

function mapGenshinDbConstellations(constData, charData, character) {
  const images = constData?.images || {};
  let shapeUrl = pickShapeUrl(images, character);



  const constellationTitle = charData?.constellation || constData?.name || character.nameRu;

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
    shapeUrl = enkaAssetUrl(images?.constellation) || null;
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

async function fetchFromGenshinDb(character) {
  const query = getGenshinDbQuery(character);

  const [constData, charData, charDataEn, constDataEn] = await Promise.all([
    fetchGenshinDbJson('constellations', query),
    fetchGenshinDbJson('characters', query).catch(() => null),
    fetchGenshinDbJson('characters', query, 'English').catch(() => null),
    fetchGenshinDbJson('constellations', query, 'English').catch(() => null),
  ]);

  if (!constData?.c1) {
    throw new Error('Constellation data incomplete');
  }

  const constellationNameEn = charDataEn?.constellation
    || constDataEn?.name
    || charData?.constellation
    || constData?.name
    || character.nameEn;

  const result = mapGenshinDbConstellations(constData, charData, character);
  return applyResolvedShape(result, constData?.images || {}, character, constellationNameEn);
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

  return applyResolvedShape(result, {}, character, data.constellation || character.nameEn);
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



export async function fetchCharacterConstellationData(character) {

  if (!character?.id) {

    return { constellationName: '', shapeUrl: null, items: [], fromApi: false };

  }



  if (cache.has(character.id)) {

    return cache.get(character.id);

  }



  try {

    const result = await fetchFromGenshinDb(character);

    storeImageUrls(character.id, result.shapeUrl, result.items);

    cache.set(character.id, result);

    return result;

  } catch {

    try {

      const result = await fetchFromJmpBlue(character);

      storeImageUrls(character.id, result.shapeUrl, result.items);

      cache.set(character.id, result);

      return result;

    } catch {
      const unavailable = buildUnavailableConstellations(character);
      cache.set(character.id, unavailable);
      return unavailable;
    }

  }

}



export function clearConstellationCache() {
  cache.clear();
  imageCache.clear();
  fandomShapeCache.clear();
}


