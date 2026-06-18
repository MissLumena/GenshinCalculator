import { CHARACTERS } from '../src/characters.js';
import { getJmpSlug } from '../src/characterIcons.js';

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

async function ok(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function fandomShape(constellationNameEn) {
  const normalized = String(constellationNameEn || '').trim().replace(/'/g, '');
  if (!normalized) return null;
  const title = `File:${`${normalized} Shape.png`.replace(/ /g, '_')}`;
  const api = `https://genshin-impact.fandom.com/api.php?action=query&format=json&prop=imageinfo&iiprop=url&titles=${encodeURIComponent(title)}`;
  const response = await fetch(api);
  if (!response.ok) return null;
  const data = await response.json();
  const page = Object.values(data.query?.pages || {})[0];
  return page?.imageinfo?.[0]?.url || null;
}

const missing = [];

for (const character of CHARACTERS) {
  const query = GENSIN_DB_QUERY_OVERRIDES[character.id] ?? character.nameEn ?? character.name;
  let constData = null;
  let charDataEn = null;
  try {
    const [constRes, charEnRes] = await Promise.all([
      fetch(`https://genshin-db-api.vercel.app/api/constellations?query=${encodeURIComponent(query)}&resultLanguage=Russian`),
      fetch(`https://genshin-db-api.vercel.app/api/characters?query=${encodeURIComponent(query)}&resultLanguage=English`),
    ]);
    if (constRes.ok) constData = await constRes.json();
    if (charEnRes.ok) charDataEn = await charEnRes.json();
  } catch {
    missing.push(`${character.id}:api-error`);
    continue;
  }

  const slug = getJmpSlug(character);
  const jmp = slug ? `https://genshin.jmp.blue/characters/${slug}/constellation-shape` : null;
  const eff = constData?.images?.constellation
    ? `https://enka.network/ui/${constData.images.constellation}.png`
    : null;
  const fandom = await fandomShape(charDataEn?.constellation || constData?.name);

  const jmpOk = jmp ? await ok(jmp) : false;
  const effOk = eff ? await ok(eff) : false;
  const fandomOk = fandom ? await ok(fandom) : false;

  if (!jmpOk && !effOk && !fandomOk) {
    missing.push(`${character.id} (en=${charDataEn?.constellation || 'n/a'})`);
  }
}

console.log('missing shape count', missing.length);
console.log(missing.join('\n'));
