/**
 * Быстрая генерация src/data/weaponCatalogMeta.js (jmp.blue + ручные 6.6).
 * node scripts/build-weapon-meta.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WEAPONS } from '../src/weapons.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JMP = 'https://genshin.jmp.blue/weapons';
const ENKA = 'https://enka.network/ui';

const MANUAL = {
  'disaster-and-remorse': {
    nameRu: 'Бедствие и раскаяние',
    passiveNameRu: 'Песнь скорби и покаяния',
    effectRu: 'Сигнатурное копьё Лоэна (6.6). Увеличивает CRIT DMG и усиливает урон после Elemental Skill.',
  },
  "angelos-heptades": {
    nameRu: 'Семь постановлений пыли и света',
    passiveNameRu: 'Семь постановлений пыли и света',
    effectRu: 'Сигнатурный катализатор Николь (6.6). Увеличивает CRIT Rate и усиливает урон реакций.',
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
  "moonweavers-dawn": {
    passiveNameRu: 'Рассвет ткача лун',
    effectRu: 'Меч 6.6. Увеличивает CRIT Rate и урон Elemental Burst.',
  },
};

/** enka UI asset из genshin-db (для fallback иконок) */
const ENKA_ICONS = {
  'freedom-sworn': 'UI_EquipIcon_Sword_Widsith',
  'primordial-jade-cutter': 'UI_EquipIcon_Sword_Morax',
  'mistsplitter-reforged': 'UI_EquipIcon_Sword_Narukami',
  'haran-geppaku-futsu': 'UI_EquipIcon_Sword_Ayato',
  'xiphos-moonlight': 'UI_EquipIcon_Sword_Pleroma',
  'uraku-misugiri': 'UI_EquipIcon_Sword_Uraku',
  'sacrificial-sword': 'UI_EquipIcon_Sword_Fossil',
  'favonius-sword': 'UI_EquipIcon_Sword_Zephyrus',
  'amenoma-kageuchi': 'UI_EquipIcon_Sword_Bakufu',
  'toukabou-shigure': 'UI_EquipIcon_Sword_Kasabou',
  'iron-sting': 'UI_EquipIcon_Sword_Exotic',
  'the-alley-flash': 'UI_EquipIcon_Sword_Outlaw',
  'cinnabar-spindle': 'UI_EquipIcon_Sword_Kunwu',
  'summit-shaper': 'UI_EquipIcon_Sword_Kunwu',
  'aquila-favonia': 'UI_EquipIcon_Sword_Falcon',
  'the-black-sword': 'UI_EquipIcon_Sword_Bloodstained',
  'festering-desire': 'UI_EquipIcon_Sword_Magnum',
  'finale-of-the-deep': 'UI_EquipIcon_Sword_Pox',
  'wolf-fang': 'UI_EquipIcon_Sword_Silver',
  "moonweavers-dawn": 'UI_EquipIcon_Sword_Moonfall',
  'redhorn-stonethresher': 'UI_EquipIcon_Claymore_Itadori',
  'verdict': 'UI_EquipIcon_Claymore_Norway',
  'calamity-queller': 'UI_EquipIcon_Polearm_EmeraldSapphire',
  'ballad-of-the-fjords': 'UI_EquipIcon_Claymore_Fleurfair',
  'bloodtainted-greatsword': 'UI_EquipIcon_Claymore_Siegfry',
  'favonius-greatsword': 'UI_EquipIcon_Claymore_Zephyrus',
  'prototype-rancour': 'UI_EquipIcon_Claymore_Proto',
  'whiteblind': 'UI_EquipIcon_Claymore_Exotic',
  'rainslasher': 'UI_EquipIcon_Claymore_Perdue',
  'royal-greatsword': 'UI_EquipIcon_Claymore_Theocrat',
  'sacrificial-greatsword': 'UI_EquipIcon_Claymore_Fossil',
  'the-bell': 'UI_EquipIcon_Claymore_Troupe',
  'staff-of-homa': 'UI_EquipIcon_Polearm_Homa',
  'primordial-jade-winged-spear': 'UI_EquipIcon_Polearm_Morax',
  'vortex-vanquisher': 'UI_EquipIcon_Polearm_Kunwu',
  'skyward-spine': 'UI_EquipIcon_Polearm_Dvalin',
  'the-catch': 'UI_EquipIcon_Polearm_Mackerel',
  'crescent-pike': 'UI_EquipIcon_Polearm_Proto',
  'lithic-spear': 'UI_EquipIcon_Polearm_Lapis',
  'blackcliff-pole': 'UI_EquipIcon_Polearm_Blackrock',
  'polar-star': 'UI_EquipIcon_Bow_Worldstar',
  'thundering-pulse': 'UI_EquipIcon_Bow_Narukami',
  'skyward-harp': 'UI_EquipIcon_Bow_Dvalin',
  'amos-bow': 'UI_EquipIcon_Bow_Amos',
  'hamayumi': 'UI_EquipIcon_Bow_Fuji',
  'blackcliff-warbow': 'UI_EquipIcon_Bow_Blackrock',
  'emerald-orb': 'UI_EquipIcon_Catalyst_Jade',
  'hakushin-ring': 'UI_EquipIcon_Catalyst_Bakufu',
  'mappa-mare': 'UI_EquipIcon_Catalyst_Exotic',
  'moonpiercer': 'UI_EquipIcon_Polearm_Arakalari',
  'wine-and-song': 'UI_EquipIcon_Catalyst_Ludiharp',
  'lost-prayer-to-the-sacred-winds': 'UI_EquipIcon_Catalyst_Dvalin',
};

async function fetchJmp(id) {
  try {
    const response = await fetch(`${JMP}/${id}`, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function main() {
  const meta = {};
  const batchSize = 8;
  for (let i = 0; i < WEAPONS.length; i += batchSize) {
    const batch = WEAPONS.slice(i, i + batchSize);
    const jmpRows = await Promise.all(batch.map((weapon) => fetchJmp(weapon.id)));
    batch.forEach((weapon, index) => {
      const jmp = jmpRows[index];
      const manual = MANUAL[weapon.id] || {};
      const enkaIcon = ENKA_ICONS[weapon.id] || null;
      meta[weapon.id] = {
        nameRu: manual.nameRu || weapon.nameRu || weapon.nameEn,
        passiveNameRu: manual.passiveNameRu || jmp?.passiveName || '',
        passiveNameEn: jmp?.passiveName || '',
        effectRu: manual.effectRu || jmp?.passiveDesc || '',
        effectEn: jmp?.passiveDesc || '',
        subStat: jmp?.subStat || '',
        enkaIcon,
        iconUrls: [
          `${JMP}/${weapon.id}/icon`,
          ...(weapon.iconIds || [weapon.id])
            .filter((slug) => slug !== weapon.id)
            .map((slug) => `${JMP}/${slug}/icon`),
          enkaIcon ? `${ENKA}/${enkaIcon}.png` : null,
        ].filter(Boolean),
      };
    });
    process.stdout.write(`Batch ${i / batchSize + 1} done\n`);
  }

  const out = path.join(root, 'src/data/weaponCatalogMeta.js');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    `/** Автогенерация: node scripts/build-weapon-meta.mjs */\nexport const WEAPON_CATALOG_META = ${JSON.stringify(meta, null, 2)};\n`,
  );
  process.stdout.write(`Wrote ${out} (${Object.keys(meta).length} weapons)\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
