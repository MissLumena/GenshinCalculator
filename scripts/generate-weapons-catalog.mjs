/**
 * Полный каталог оружия Genshin (200+) из genshin-db-api.
 * Запуск: node scripts/generate-weapons-catalog.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V5 = 'https://genshin-db-api.vercel.app/api/v5/weapons';
const LEGACY = 'https://genshin-db-api.vercel.app/api/weapons';
const JMP = 'https://genshin.jmp.blue/weapons';
const ENKA = 'https://enka.network/ui';

const TYPE_MAP = {
  WEAPON_SWORD_ONE_HAND: 'Sword',
  WEAPON_CLAYMORE: 'Claymore',
  WEAPON_POLE: 'Polearm',
  WEAPON_BOW: 'Bow',
  WEAPON_CATALYST: 'Catalyst',
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

function buildDescription(en, ru) {
  return ru?.effect || en?.r5?.description || en?.r1?.description || en?.effectTemplateRaw || en?.description || '';
}

function buildPassiveName(en, ru) {
  return ru?.effectname || en?.effectName || '';
}

function buildSubStat(en, ru) {
  return ru?.substat || en?.mainStatText || '';
}

function buildIconUrls(slug, enkaIcon, mihoyoIcon) {
  const urls = [];
  if (slug) urls.push(`${JMP}/${slug}/icon`);
  if (enkaIcon) urls.push(`${ENKA}/${enkaIcon}.png`);
  if (mihoyoIcon) urls.push(mihoyoIcon);
  return [...new Set(urls.filter(Boolean))];
}

async function fetchRussian(nameEn) {
  return fetchJson(`${LEGACY}?query=${encodeURIComponent(nameEn)}&resultLanguage=Russian`);
}

async function main() {
  process.stdout.write('Loading English weapons from genshin-db v5...\n');
  const englishList = await fetchJson(
    `${V5}?query=names&matchCategories=true&verboseCategories=true&resultLanguage=English`,
  );
  if (!Array.isArray(englishList) || englishList.length < 200) {
    throw new Error(`Expected 200+ weapons, got ${englishList?.length || 0}`);
  }

  const slugCounts = new Map();
  for (const item of englishList) {
    const base = slugify(item.name);
    slugCounts.set(base, (slugCounts.get(base) || 0) + 1);
  }

  const weapons = [];
  const meta = {};
  const batchSize = 12;

  for (let i = 0; i < englishList.length; i += batchSize) {
    const batch = englishList.slice(i, i + batchSize);
    const ruRows = await Promise.all(batch.map((item) => fetchRussian(item.name)));

    batch.forEach((en, index) => {
      const ru = ruRows[index];
      const baseSlug = slugify(en.name);
      const id = slugCounts.get(baseSlug) > 1 ? `${baseSlug}-${en.id}` : baseSlug;
      const type = TYPE_MAP[en.weaponType] || en.weaponText || 'Sword';
      const enkaIcon = ru?.images?.nameicon || en.images?.filename_icon || null;
      const mihoyoIcon = en.images?.mihoyo_icon || null;

      weapons.push({
        id,
        gameId: en.id,
        nameEn: en.name,
        nameRu: ru?.name || en.name,
        type,
        rarity: Number(en.rarity) || 3,
      });

      meta[id] = {
        gameId: en.id,
        nameRu: ru?.name || en.name,
        passiveNameRu: buildPassiveName(en, ru),
        passiveNameEn: en.effectName || '',
        effectRu: buildDescription(en, ru),
        effectEn: en.r5?.description || en.r1?.description || en.description || '',
        subStat: buildSubStat(en, ru),
        enkaIcon,
        iconUrls: buildIconUrls(baseSlug, enkaIcon, mihoyoIcon),
      };
    });

    process.stdout.write(`RU batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(englishList.length / batchSize)} (${weapons.length}/${englishList.length})\n`);
    await sleep(150);
  }

  weapons.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    if (b.rarity !== a.rarity) return b.rarity - a.rarity;
    return a.nameEn.localeCompare(b.nameEn);
  });

  const byType = weapons.reduce((acc, weapon) => {
    acc[weapon.type] = (acc[weapon.type] || 0) + 1;
    return acc;
  }, {});

  const catalogPath = path.join(root, 'src/data/weaponsCatalog.js');
  const metaPath = path.join(root, 'src/data/weaponCatalogMeta.js');

  fs.mkdirSync(path.dirname(catalogPath), { recursive: true });

  fs.writeFileSync(
    catalogPath,
    `/** Автогенерация: node scripts/generate-weapons-catalog.mjs */\n`
      + `export const WEAPON_CATALOG_SOURCE = 'genshin-db-api';\n`
      + `export const WEAPON_CATALOG_GENERATED_AT = ${JSON.stringify(new Date().toISOString())};\n`
      + `export const WEAPON_CATALOG_COUNTS = ${JSON.stringify(byType, null, 2)};\n`
      + `export const WEAPONS = ${JSON.stringify(weapons, null, 2)};\n`,
    'utf8',
  );

  fs.writeFileSync(
    metaPath,
    `/** Автогенерация: node scripts/generate-weapons-catalog.mjs */\n`
      + `export const WEAPON_CATALOG_META = ${JSON.stringify(meta, null, 2)};\n`,
    'utf8',
  );

  process.stdout.write(`Wrote ${weapons.length} weapons → ${catalogPath}\n`);
  process.stdout.write(`Counts: ${JSON.stringify(byType)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
