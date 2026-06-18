/**
 * Полный каталог сетов артефактов до 6.6 из genshin-db-api.
 * Запуск: node scripts/generate-artifacts-catalog.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V5 = 'https://genshin-db-api.vercel.app/api/v5/artifacts';
const LEGACY = 'https://genshin-db-api.vercel.app/api/artifacts';
const JMP_LIST = 'https://genshin.jmp.blue/artifacts';
const ENKA = 'https://enka.network/ui';
const MAX_VERSION = 6.6;

const PRAYER_SET_BONUSES = {
  'prayers-for-destiny': {
    bonus2: '1pc: Hydro DMG +15%',
    bonus4: 'Сет из одного слота (Circlet).',
  },
  'prayers-for-illumination': {
    bonus2: '1pc: Pyro DMG +15%',
    bonus4: 'Сет из одного слота (Circlet).',
  },
  'prayers-for-wisdom': {
    bonus2: '1pc: Electro DMG +15%',
    bonus4: 'Сет из одного слота (Circlet).',
  },
  'prayers-to-springtime': {
    bonus2: '1pc: Cryo DMG +15%',
    bonus4: 'Сет из одного слота (Circlet).',
  },
};

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function buildIconUrls(en, jmpId) {
  const urls = [];
  const flowerFile = en?.images?.filename_flower;
  if (flowerFile) {
    urls.push(`${ENKA}/${flowerFile}.png`);
    if (en.images?.mihoyo_flower) urls.push(en.images.mihoyo_flower);
  }
  if (jmpId) urls.push(`${JMP_LIST}/${jmpId}/icon`);
  return [...new Set(urls.filter(Boolean))];
}

async function fetchRussian(nameEn) {
  return fetchJson(`${LEGACY}?query=${encodeURIComponent(nameEn)}&resultLanguage=Russian`);
}

async function fetchEnglishLegacy(nameEn) {
  return fetchJson(`${LEGACY}?query=${encodeURIComponent(nameEn)}&resultLanguage=English`);
}

async function main() {
  process.stdout.write('Loading artifact sets...\n');
  const englishList = await fetchJson(
    `${V5}?query=names&matchCategories=true&verboseCategories=true&resultLanguage=English`,
  );

  if (!Array.isArray(englishList)) {
    throw new Error('Failed to load artifacts from genshin-db v5');
  }

  const filtered = englishList.filter((item) => parseFloat(item.version || 0) <= MAX_VERSION);

  const sets = [];
  const meta = {};
  const batchSize = 10;

  for (let i = 0; i < filtered.length; i += batchSize) {
    const batch = filtered.slice(i, i + batchSize);
    const ruRows = await Promise.all(batch.map((item) => fetchRussian(item.name)));

    batch.forEach((en, index) => {
      const ru = ruRows[index];
      const id = slugify(en.name);
      const prayerBonus = PRAYER_SET_BONUSES[id];
      const bonus2 = prayerBonus?.bonus2 || ru?.['2pc'] || en.effect2Pc || '';
      const bonus4 = prayerBonus?.bonus4 || ru?.['4pc'] || en.effect4Pc || en.r1?.description || '';

      sets.push({
        id,
        gameId: en.id,
        nameEn: en.name,
        nameRu: ru?.name || en.name,
        bonus2,
        bonus4,
        maxRarity: Math.max(...(en.rarityList || [4])),
        version: en.version || null,
      });

      meta[id] = {
        gameId: en.id,
        nameRu: ru?.name || en.name,
        bonus2Ru: bonus2,
        bonus4Ru: bonus4,
        bonus2En: en.effect2Pc || '',
        bonus4En: en.effect4Pc || en.r1?.description || '',
        iconUrls: buildIconUrls(en, id),
        version: en.version || null,
      };
    });

    process.stdout.write(`RU batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(filtered.length / batchSize)} (${sets.length}/${filtered.length})\n`);
    await sleep(120);
  }

  sets.sort((a, b) => a.nameEn.localeCompare(b.nameEn));

  const catalogPath = path.join(root, 'src/data/artifactsCatalog.js');
  const metaPath = path.join(root, 'src/data/artifactCatalogMeta.js');

  fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
  fs.writeFileSync(
    catalogPath,
    `/** Автогенерация: node scripts/generate-artifacts-catalog.mjs (≤ ${MAX_VERSION}) */\n`
      + `export const ARTIFACT_CATALOG_MAX_VERSION = ${MAX_VERSION};\n`
      + `export const ARTIFACT_SETS = ${JSON.stringify(sets, null, 2)};\n`,
    'utf8',
  );
  fs.writeFileSync(
    metaPath,
    `/** Автогенерация: node scripts/generate-artifacts-catalog.mjs */\n`
      + `export const ARTIFACT_CATALOG_META = ${JSON.stringify(meta, null, 2)};\n`,
    'utf8',
  );

  process.stdout.write(`Wrote ${sets.length} artifact sets → ${catalogPath}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
