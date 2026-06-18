/**
 * Загружает метаданные оружия (RU описание, enka-иконка) и пишет src/data/weaponCatalogMeta.js
 * Запуск: node scripts/fetch-weapon-catalog.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { WEAPONS } from '../src/weapons.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEAPON_INDEX = WEAPONS;

const GENSIN_DB_API = 'https://genshin-db-api.vercel.app/api/weapons';
const JMP_WEAPON_API = 'https://genshin.jmp.blue/weapons';
const ENKA_UI_BASE = 'https://enka.network/ui';

const GENSIN_DB_QUERY_OVERRIDES = {
  'wolf-fang': 'Wolf-Fang',
  'primordial-jade-winged-spear': 'Primordial Jade Winged-Spear',
  "xiphos-moonlight": "Xiphos' Moonlight",
  "moonweavers-dawn": "Moonweaver's Dawn",
  "prospectors-shovel": "Prospector's Shovel",
  "amos-bow": "Amos' Bow",
  "rainbow-serpents-rain-bow": "Rainbow Serpent's Rain Bow",
  "angelos-heptades": "Angelos' Heptades",
  "starcallers-watch": "Starcaller's Watch",
  'calamity-queller': 'Calamity Queller',
};

const MANUAL_META = {
  'disaster-and-remorse': {
    nameRu: 'Бедствие и раскаяние',
    passiveNameRu: 'Песнь скорби и покаяния',
    effectRu:
      'Сигнатурное копьё Лоэна (6.6). Увеличивает CRIT DMG и усиливает урон после использования Elemental Skill.',
    enkaIcon: null,
  },
  "angelos-heptades": {
    nameRu: 'Семь постановлений пыли и света',
    passiveNameRu: 'Семь постановлений пыли и света',
    effectRu:
      'Сигнатурный катализатор Николь (6.6). Увеличивает CRIT Rate и усиливает урон реакций.',
    enkaIcon: null,
  },
  'athame-artis': {
    passiveNameRu: 'Клинок судьбы',
    effectRu: 'Меч 6.6. Усиливает Elemental Skill и даёт бонус к CRIT Rate.',
  },
  azurelight: {
    passiveNameRu: 'Лазурный свет',
    effectRu: 'Меч 6.6. Повышает CRIT Rate и урон заряженной атаки.',
  },
  'lightbearing-moonshard': {
    passiveNameRu: 'Лунный осколок',
    effectRu: 'Меч 6.6. Увеличивает ATK и урон обычных атак.',
  },
  'peak-patrol-song': {
    passiveNameRu: 'Песня патруля вершин',
    effectRu: 'Меч 6.6. Даёт бонус к DEF и урону Elemental Skill.',
  },
  'dawning-frost': {
    passiveNameRu: 'Рассветный мороз',
    effectRu: 'Копьё 6.6. Усиливает Cryo урон и CRIT Rate.',
  },
  'hallowed-fetters': {
    passiveNameRu: 'Священные оковы',
    effectRu: 'Копьё 6.6. Повышает HP и урон после Elemental Burst.',
  },
  'blackmarrow-lantern': {
    passiveNameRu: 'Фонарь чёрного костного мозга',
    effectRu: 'Копьё 6.6. Увеличивает Elemental Mastery и урон реакций.',
  },
  'the-first-great-magic': {
    passiveNameRu: 'Первое великое колдовство',
    effectRu: 'Лук 6.6. Усиливает CRIT DMG и урон заряженной атаки.',
  },
  "rainbow-serpents-rain-bow": {
    passiveNameRu: 'Радужный лук змея дождя',
    effectRu: 'Лук 6.6. Повышает ATK и урон Elemental Skill.',
  },
  'starcallers-watch': {
    passiveNameRu: 'Часы звездочёта',
    effectRu: 'Катализатор 6.6. Увеличивает CRIT Rate и урон Elemental Burst.',
  },
  'sunny-morning-sleep-in': {
    passiveNameRu: 'Сонливое солнечное утро',
    effectRu: 'Катализатор 6.6. Даёт бонус к HP и восстановлению энергии.',
  },
  "prospectors-shovel": {
    passiveNameRu: 'Лопата старателя',
    effectRu: 'Клеймор 6.6. Увеличивает DEF и урон обычных атак.',
  },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function enkaIconUrl(assetName) {
  if (!assetName) return null;
  return `${ENKA_UI_BASE}/${assetName}.png`;
}

async function fetchWeaponMeta(weapon) {
  const query = GENSIN_DB_QUERY_OVERRIDES[weapon.id] || weapon.nameEn;
  const manual = MANUAL_META[weapon.id] || {};

  const [dbRu, dbEn, jmp] = await Promise.all([
    fetchJson(`${GENSIN_DB_API}?query=${encodeURIComponent(query)}&resultLanguage=Russian`),
    fetchJson(`${GENSIN_DB_API}?query=${encodeURIComponent(query)}&resultLanguage=English`),
    fetchJson(`${JMP_WEAPON_API}/${weapon.id}`),
  ]);

  const enkaIcon = dbRu?.images?.nameicon || dbEn?.images?.nameicon || manual.enkaIcon || null;

  return {
    id: weapon.id,
    nameRu: manual.nameRu || dbRu?.name || weapon.nameRu || weapon.nameEn,
    passiveNameRu: manual.passiveNameRu || dbRu?.effectname || jmp?.passiveName || '',
    effectRu:
      manual.effectRu
      || dbRu?.effect
      || jmp?.passiveDesc
      || dbEn?.effect
      || '',
    subStatRu: dbRu?.substat || jmp?.subStat || '',
    enkaIcon,
    iconUrls: [
      `${JMP_WEAPON_API}/${weapon.id}/icon`,
      enkaIconUrl(enkaIcon),
    ].filter(Boolean),
  };
}

async function main() {
  const results = {};
  for (const weapon of WEAPON_INDEX) {
    process.stdout.write(`Fetching ${weapon.id}...\n`);
    results[weapon.id] = await fetchWeaponMeta(weapon);
    await sleep(120);
  }

  const outPath = path.join(root, 'src/data/weaponCatalogMeta.js');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    `/** Автогенерация: node scripts/fetch-weapon-catalog.mjs */\nexport const WEAPON_CATALOG_META = ${JSON.stringify(results, null, 2)};\n`,
    'utf8',
  );
  process.stdout.write(`Wrote ${outPath}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
