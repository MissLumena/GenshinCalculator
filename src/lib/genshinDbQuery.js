import {
  getTravelerConstellationQuery,
  isTravelerCharacter,
} from '../travelerConstellations';

/** id → запрос для genshin-db-api (если nameEn не подходит) */
export const GENSIN_DB_QUERY_OVERRIDES = {
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

export function getGenshinDbQuery(character, options = {}) {
  if (isTravelerCharacter(character) && options.element) {
    return getTravelerConstellationQuery(options.element);
  }
  return GENSIN_DB_QUERY_OVERRIDES[character.id] ?? character.nameEn ?? character.name;
}
