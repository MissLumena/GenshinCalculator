/**
 * Анализ genshin-db-api: какой талант получает +3 на C3/C5.
 * Запуск: node scripts/analyze-talent-limits.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://genshin-db-api.vercel.app/api';

const QUERY_OVERRIDES = {
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
  traveler: 'Traveler Anemo',
  pulonia: 'Prune',
  yagoda: 'Jahoda',
  loen: 'Lohen',
  skirk: 'Skirk',
  columbina: 'Columbina',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) return null;
  return res.json();
}

function loadCharacterIds() {
  const source = fs.readFileSync(path.join(root, 'src/characters.js'), 'utf8');
  return [...source.matchAll(/\['([a-z0-9-]+)', '([^']+)'/g)].map((m) => ({
    id: m[1],
    nameEn: m[2],
  }));
}

function normalizeName(value) {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractBoostedTalentName(description) {
  const text = String(description || '').replace(/\*\*/g, '');
  const ru = text.match(/Увеличивает уровень(?: элементального навыка| навыка)?\s+(.+?)\s+на\s+3/i);
  if (ru) return ru[1].trim();
  const en = text.match(/Increases (?:the )?(?:Level )?(?:of )?(.+?) by 3/i);
  if (en) return en[1].trim();
  return null;
}

function wordsMatch(a, b) {
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const minLen = Math.min(a.length, b.length);
  if (minLen < 4) return false;
  let prefix = 0;
  while (prefix < minLen && a[prefix] === b[prefix]) prefix += 1;
  return prefix >= minLen - 1 || prefix >= 4;
}

function mapTalentSlot(talentNames, boostedName) {
  const target = normalizeName(boostedName);
  if (!target) return null;
  for (const [slot, name] of Object.entries(talentNames)) {
    if (!name) continue;
    const normalized = normalizeName(name);
    if (normalized === target || normalized.includes(target) || target.includes(normalized)) {
      return slot;
    }
  }

  const targetWords = target.split(' ').filter((word) => word.length > 2);
  let best = { slot: null, score: 0 };
  for (const [slot, name] of Object.entries(talentNames)) {
    const words = normalizeName(name).split(' ').filter((word) => word.length > 2);
    const score = targetWords.filter((word) => words.some((candidate) => wordsMatch(word, candidate))).length;
    if (score > best.score) best = { slot, score };
  }

  const threshold = targetWords.length <= 2 ? 1 : 2;
  return best.score >= threshold ? best.slot : null;
}

function queryFor(character) {
  return QUERY_OVERRIDES[character.id] ?? character.nameEn;
}

async function main() {
  const characters = loadCharacterIds();
  const entries = {};
  const cap10Only = [];
  const errors = [];
  const unresolved = [];

  for (const character of characters) {
    const query = queryFor(character);
    try {
      const [talents, constellations] = await Promise.all([
        fetchJson(`${API}/talents?query=${encodeURIComponent(query)}&resultLanguage=Russian`),
        fetchJson(`${API}/constellations?query=${encodeURIComponent(query)}&resultLanguage=Russian`),
      ]);
      await sleep(120);

      if (!talents || !constellations) {
        errors.push({ id: character.id, query, reason: 'missing talents or constellations' });
        cap10Only.push(character.id);
        continue;
      }

      const talentNames = {
        auto: talents.combat1?.name,
        skill: talents.combat2?.name,
        burst: talents.combat3?.name,
      };

      const boosts = { auto: null, skill: null, burst: null };
      for (const level of [1, 2, 3, 4, 5, 6]) {
        const desc = constellations[`c${level}`]?.description
          || constellations[`c${level}`]?.effect
          || '';
        const boostedName = extractBoostedTalentName(desc);
        if (!boostedName) continue;
        const slot = mapTalentSlot(talentNames, boostedName);
        if (!slot) {
          unresolved.push({ id: character.id, level, boostedName, talentNames });
          continue;
        }
        boosts[slot] = level;
      }

      if (!boosts.auto && !boosts.skill && !boosts.burst) {
        cap10Only.push(character.id);
      }

      entries[character.id] = {
        query,
        talentNames,
        boosts,
      };
    } catch (error) {
      errors.push({ id: character.id, query, reason: error.message });
      cap10Only.push(character.id);
    }
  }

  const canSkill13 = Object.entries(entries).filter(([, e]) => e.boosts.skill).map(([id]) => id);
  const canBurst13 = Object.entries(entries).filter(([, e]) => e.boosts.burst).map(([id]) => id);
  const canAuto13 = Object.entries(entries).filter(([, e]) => e.boosts.auto).map(([id]) => id);

  const report = {
    generatedAt: new Date().toISOString(),
    source: 'genshin-db-api talents + constellations (RU)',
    note: 'Игра позволяет фактически прокачать до 13 (10 + созвездие +3). В данных API «Макс. уровень: 15» — теоретический потолок.',
    summary: {
      total: characters.length,
      withSkillBoost: canSkill13.length,
      withBurstBoost: canBurst13.length,
      withAutoBoost: canAuto13.length,
      cap10Only: cap10Only.length,
      unresolved: unresolved.length,
      errors: errors.length,
    },
    cap10Only,
    canSkill13,
    canBurst13,
    canAuto13,
    entries,
    unresolved,
    errors,
  };

  const reportPath = path.join(root, 'src/data/talentLevelLimitsReport.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const generatedPath = path.join(root, 'src/data/talentConstellationBoosts.js');
  const generated = `/** Автогенерация: node scripts/analyze-talent-limits.mjs */
export const TALENT_CONSTELLATION_BOOSTS = ${JSON.stringify(entries, null, 2)};

export const TALENT_LEVEL_CAP_10_ONLY = ${JSON.stringify(cap10Only, null, 2)};
`;
  fs.writeFileSync(generatedPath, generated, 'utf8');

  console.log(JSON.stringify(report.summary, null, 2));
  console.log('cap10Only:', cap10Only.join(', '));
  if (unresolved.length) console.log('unresolved sample:', unresolved.slice(0, 5));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
