import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHARACTERS } from '../src/characters.js';

const OVERRIDES = {
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
  loen: 'Lohen',
  skirk: 'Skirk',
  columbina: 'Columbina',
};

async function fandomShapeUrl(constellationNameEn) {
  const normalized = String(constellationNameEn || '').trim().replace(/'/g, '');
  if (!normalized || normalized === '???') return null;

  const title = `File:${`${normalized} Shape.png`.replace(/ /g, '_')}`;
  const api = `https://genshin-impact.fandom.com/api.php?action=query&format=json&prop=imageinfo&iiprop=url&titles=${encodeURIComponent(title)}`;
  const data = await fetch(api).then((response) => response.json());
  const page = Object.values(data.query?.pages || {})[0];
  return page?.imageinfo?.[0]?.url || null;
}

const byCharacterId = {};
const byConstellationName = {};

for (const character of CHARACTERS) {
  const query = OVERRIDES[character.id] || character.nameEn;
  const [constRes, charEnRes] = await Promise.all([
    fetch(`https://genshin-db-api.vercel.app/api/constellations?query=${encodeURIComponent(query)}&resultLanguage=English`),
    fetch(`https://genshin-db-api.vercel.app/api/characters?query=${encodeURIComponent(query)}&resultLanguage=English`),
  ]);

  let constData = null;
  let charEn = null;
  try {
    if (constRes.ok) constData = await constRes.json();
    if (charEnRes.ok) charEn = await charEnRes.json();
  } catch {
    continue;
  }
  if (!constData?.c1) continue;
  const constellationName = charEn?.constellation || constData?.name;
  let url = null;
  try {
    url = await fandomShapeUrl(constellationName);
  } catch {
    url = null;
  }
  if (!url) continue;

  byCharacterId[character.id] = url;
  if (constellationName) {
    byConstellationName[constellationName.replace(/'/g, '')] = url;
  }
}

const outPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/constellationShapeUrls.js',
);

const contents = `/** Прямые URL силуэтов созвездий (Fandom CDN). Сгенерировано scripts/generate-constellation-shape-urls.mjs */
export const CONSTELLATION_SHAPE_BY_CHARACTER_ID = ${JSON.stringify(byCharacterId, null, 2)};

export const CONSTELLATION_SHAPE_BY_NAME = ${JSON.stringify(byConstellationName, null, 2)};

export function getStaticConstellationShapeUrl(characterId, constellationNameEn) {
  if (characterId && CONSTELLATION_SHAPE_BY_CHARACTER_ID[characterId]) {
    return CONSTELLATION_SHAPE_BY_CHARACTER_ID[characterId];
  }
  const normalized = String(constellationNameEn || '').trim().replace(/'/g, '');
  if (normalized && CONSTELLATION_SHAPE_BY_NAME[normalized]) {
    return CONSTELLATION_SHAPE_BY_NAME[normalized];
  }
  return null;
}
`;

fs.writeFileSync(outPath, contents, 'utf8');
console.log(`Wrote ${Object.keys(byCharacterId).length} character shape URLs to ${outPath}`);
