/**
 * URL-адреса иконок персonaжей: jmp.blue + enka.network (fallback).
 */

/** Slug-и, доступные на genshin.jmp.blue */
export const JMP_SLUGS = new Set([
  'albedo', 'aloy', 'amber', 'arlecchino', 'ayaka', 'ayato', 'baizhu', 'barbara',
  'beidou', 'bennett', 'candace', 'charlotte', 'chevreuse', 'chongyun', 'clorinde',
  'collei', 'diluc', 'diona', 'emilie', 'eula', 'faruzan', 'fischl', 'freminet',
  'furina', 'gaming', 'ganyu', 'gorou', 'hu-tao', 'jean', 'kachina', 'kaeya',
  'kazuha', 'keqing', 'kinich', 'kirara', 'klee', 'kokomi', 'kuki-shinobu', 'layla',
  'lisa', 'lynette', 'lyney', 'mika', 'mona', 'mualani', 'nahida', 'navia',
  'neuvillette', 'nilou', 'ningguang', 'noelle', 'qiqi', 'raiden', 'razor', 'rosaria',
  'sara', 'sayu', 'sethos', 'shenhe', 'shikanoin-heizou', 'sigewinne', 'sucrose',
  'tartaglia', 'thoma', 'tighnari', 'traveler-anemo', 'venti', 'wanderer', 'wriothesley', 'xiangling',
  'xianyun', 'xiao', 'xingqiu', 'xinyan', 'yae-miko', 'yanfei', 'yaoyao', 'yelan',
  'yoimiya', 'yun-jin', 'zhongli', 'alhaitham',
]);

/** id персонажа → slug на jmp.blue (если отличается от id) */
export const JMP_SLUG_OVERRIDES = {
  'kamisato-ayaka': 'ayaka',
  'kamisato-ayato': 'ayato',
  'kaedehara-kazuha': 'kazuha',
  'raiden-shogun': 'raiden',
  'kujou-sara': 'sara',
  'sangonomiya-kokomi': 'kokomi',
};

/** id → имя файла на enka.network (UI_AvatarIcon_*.png) */
export const ENKA_ICON_NAMES = {
  'kamisato-ayaka': 'Ayaka',
  'kamisato-ayato': 'Ayato',
  'kaedehara-kazuha': 'Kazuha',
  'kujou-sara': 'Sara',
  'sangonomiya-kokomi': 'Kokomi',
  'hu-tao': 'Hutao',
  'raiden-shogun': 'Shougun',
  'shikanoin-heizou': 'Heizo',
  'yae-miko': 'Yae',
  'kuki-shinobu': 'Shinobu',
  'amber': 'Ambor',
  'lan-yan': 'Lanyan',
  'pulonia': 'Prune',
  'traveler': 'PlayerBoy',
  'alhaitham': 'Alhatham',
  skirk: 'SkirkNew',
  mannequin: 'MannequinBoy',
  loen: 'Lohen',
  ororon: 'Olorun',
  yagoda: 'Jahoda',
};

function defaultEnkaName(id) {
  return id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function getJmpSlug(character) {
  if (character.iconId && JMP_SLUGS.has(character.iconId)) {
    return character.iconId;
  }
  const override = JMP_SLUG_OVERRIDES[character.id];
  if (override) return override;
  if (JMP_SLUGS.has(character.id)) return character.id;
  return null;
}

function getEnkaName(character) {
  return ENKA_ICON_NAMES[character.id] || defaultEnkaName(character.id);
}

/** Список URL иконок в порядке приоритета */
export function getCharacterIconUrls(character) {
  if (!character) return [];

  const urls = [];
  const jmpSlug = getJmpSlug(character);
  if (jmpSlug) {
    urls.push(`https://genshin.jmp.blue/characters/${jmpSlug}/icon`);
  }

  const enkaName = getEnkaName(character);
  urls.push(`https://enka.network/ui/UI_AvatarIcon_${enkaName}.png`);

  return urls;
}

/** id → имя файла сплеш-арта на enka.network (UI_Gacha_AvatarImg_*.png) */
export const ENKA_SPLASH_NAMES = {
  loen: 'Lohen',
};

function getEnkaSplashName(character) {
  return ENKA_SPLASH_NAMES[character.id] || ENKA_ICON_NAMES[character.id] || defaultEnkaName(character.id);
}

/** URL сплеш-арта для витрины на главной */
export function getCharacterSplashUrls(character) {
  if (!character) return [];

  const splashName = getEnkaSplashName(character);
  return [`https://enka.network/ui/UI_Gacha_AvatarImg_${splashName}.png`];
}

/** Первый URL (для обратной совместимости) */
export function getCharacterIconUrl(character) {
  return getCharacterIconUrls(character)[0] || '';
}

/** Боковой портрет без фона (enka) */
export function getCharacterSideIconUrl(character) {
  if (!character) return '';
  const enkaName = getEnkaName(character);
  return `https://enka.network/ui/UI_AvatarIcon_Side_${enkaName}.png`;
}

/**
 * Портреты для панели созвездий: полный рост, прозрачный фон.
 * Gacha splash → боковой портрет → круглая иконка (jmp.portrait с белым фоном не используем).
 */
export function getCharacterConstellationPortraitUrls(character) {
  if (!character) return [];

  const urls = [
    ...getCharacterSplashUrls(character),
    getCharacterSideIconUrl(character),
    ...getCharacterIconUrls(character),
  ];

  return [...new Set(urls.filter(Boolean))];
}
