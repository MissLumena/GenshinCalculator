/**
 * V2 — полный список персонажей, сгруппированный по регионам.
 * iconId — slug для genshin.jmp.blue (аватар из игры).
 */

export const CHARACTER_REGIONS = [
  { id: 'special', label: 'Особые' },
  { id: 'mondstadt', label: 'Мондштадт' },
  { id: 'liyue', label: 'Ли Юэ' },
  { id: 'inazuma', label: 'Инацума' },
  { id: 'sumeru', label: 'Сумеру' },
  { id: 'fontaine', label: 'Фонтейн' },
  { id: 'natlan', label: 'Натлан' },
  { id: 'nodkrai', label: 'Nod-Krai' },
  { id: 'snezhnaya', label: 'Снежная' },
  { id: 'celestia', label: 'Небеса' },
];

/** [id, nameEn, nameRu, region, element, weapon, rarity, iconId?] */
const RAW = [
  // Особые
  ['traveler', 'Traveler', 'Путешественник', 'special', 'Anemo', 'Sword', 5, 'traveler-anemo'],
  ['aloy', 'Aloy', 'Элой', 'special', 'Cryo', 'Bow', 5],
  ['skirk', 'Skirk', 'Скирк', 'special', 'Cryo', 'Sword', 5],
  ['mannequin', 'Training Dummy', 'Манекен', 'special', 'Physical', 'Polearm', 1, 'mannequin'],
  // Мондstadt
  ['albedo', 'Albedo', 'Альбедо', 'mondstadt', 'Geo', 'Sword', 5],
  ['barbara', 'Barbara', 'Барбара', 'mondstadt', 'Hydro', 'Catalyst', 4],
  ['bennett', 'Bennett', 'Беннет', 'mondstadt', 'Pyro', 'Sword', 4],
  ['venti', 'Venti', 'Венти', 'mondstadt', 'Anemo', 'Bow', 5],
  ['jean', 'Jean', 'Джинн', 'mondstadt', 'Anemo', 'Sword', 5],
  ['diluc', 'Diluc', 'Дилюк', 'mondstadt', 'Pyro', 'Claymore', 5],
  ['diona', 'Diona', 'Диона', 'mondstadt', 'Cryo', 'Bow', 4],
  ['klee', 'Klee', 'Кли', 'mondstadt', 'Pyro', 'Catalyst', 5],
  ['kaeya', 'Kaeya', 'Кэйa', 'mondstadt', 'Cryo', 'Sword', 4],
  ['lisa', 'Lisa', 'Лиза', 'mondstadt', 'Electro', 'Catalyst', 4],
  ['mika', 'Mika', 'Мика', 'mondstadt', 'Cryo', 'Polearm', 4],
  ['mona', 'Mona', 'Мона', 'mondstadt', 'Hydro', 'Catalyst', 5],
  ['noelle', 'Noelle', 'Ноэлль', 'mondstadt', 'Geo', 'Claymore', 4],
  ['rosaria', 'Rosaria', 'Розария', 'mondstadt', 'Cryo', 'Polearm', 4],
  ['razor', 'Razor', 'Рэйзор', 'mondstadt', 'Electro', 'Claymore', 4],
  ['sucrose', 'Sucrose', 'Сахароза', 'mondstadt', 'Anemo', 'Catalyst', 4],
  ['fischl', 'Fischl', 'Фишль', 'mondstadt', 'Electro', 'Bow', 4],
  ['amber', 'Amber', 'Эмбер', 'mondstadt', 'Pyro', 'Bow', 4],
  ['eula', 'Eula', 'Эола', 'mondstadt', 'Cryo', 'Claymore', 5],
  ['dahlia', 'Dahlia', 'Далия', 'mondstadt', 'Hydro', 'Sword', 4],
  ['durin', 'Durin', 'Дурин', 'mondstadt', 'Pyro', 'Sword', 5],
  ['varka', 'Varka', 'Варка', 'mondstadt', 'Anemo', 'Claymore', 5],
  ['pulonia', 'Pulonia', 'Прюн', 'mondstadt', 'Hydro', 'Catalyst', 4],
  ['loen', 'Loen', 'Лоэн', 'mondstadt', 'Anemo', 'Bow', 4],
  // Ли Юэ
  ['baizhu', 'Baizhu', 'Бай Чжу', 'liyue', 'Dendro', 'Catalyst', 5],
  ['beidou', 'Beidou', 'Бэй Доу', 'liyue', 'Electro', 'Claymore', 4],
  ['ganyu', 'Ganyu', 'Гань Юй', 'liyue', 'Cryo', 'Bow', 5],
  ['yelan', 'Yelan', 'Е Лань', 'liyue', 'Hydro', 'Bow', 5],
  ['keqing', 'Keqing', 'Кэ Цин', 'liyue', 'Electro', 'Sword', 5],
  ['ningguang', 'Ningguang', 'Нин Гуан', 'liyue', 'Geo', 'Catalyst', 4],
  ['xingqiu', 'Xingqiu', 'Син Цю', 'liyue', 'Hydro', 'Sword', 4],
  ['xinyan', 'Xinyan', 'Синь Янь', 'liyue', 'Pyro', 'Claymore', 4],
  ['xiangling', 'Xiangling', 'Сян Лин', 'liyue', 'Pyro', 'Polearm', 4],
  ['xiao', 'Xiao', 'Сяо', 'liyue', 'Anemo', 'Polearm', 5],
  ['hu-tao', 'Hu Tao', 'Ху Тао', 'liyue', 'Pyro', 'Polearm', 5],
  ['qiqi', 'Qiqi', 'Ци Ци', 'liyue', 'Cryo', 'Sword', 5],
  ['zhongli', 'Zhongli', 'Чжун Ли', 'liyue', 'Geo', 'Polearm', 5],
  ['chongyun', 'Chongyun', 'Чун Юнь', 'liyue', 'Cryo', 'Claymore', 4],
  ['shenhe', 'Shenhe', 'Шэнь Хэ', 'liyue', 'Cryo', 'Polearm', 5],
  ['yun-jin', 'Yun Jin', 'Юнь Цзинь', 'liyue', 'Geo', 'Polearm', 4],
  ['yanfei', 'Yanfei', 'Янь Фэй', 'liyue', 'Pyro', 'Catalyst', 4],
  ['yaoyao', 'Yaoyao', 'Яо Яо', 'liyue', 'Dendro', 'Polearm', 4],
  ['xianyun', 'Xianyun', 'Сianyun', 'liyue', 'Anemo', 'Catalyst', 5],
  ['gaming', 'Gaming', 'Ка Мин', 'liyue', 'Pyro', 'Claymore', 4],
  ['lan-yan', 'Lan Yan', 'Лань Янь', 'liyue', 'Anemo', 'Catalyst', 4],
  ['zibai', 'Zibai', 'Цзы Бай', 'liyue', 'Geo', 'Sword', 5],
  // Инадзuma
  ['kamisato-ayaka', 'Ayaka', 'Аяка', 'inazuma', 'Cryo', 'Sword', 5],
  ['kamisato-ayato', 'Ayato', 'Аято', 'inazuma', 'Hydro', 'Sword', 5],
  ['gorou', 'Gorou', 'Gorou', 'inazuma', 'Geo', 'Bow', 4],
  ['yae-miko', 'Yae Miko', 'Yae Miko', 'inazuma', 'Electro', 'Catalyst', 5],
  ['yoimiya', 'Yoimiya', 'Yoimiya', 'inazuma', 'Pyro', 'Bow', 5],
  ['kaedehara-kazuha', 'Kazuha', 'Kazuha', 'inazuma', 'Anemo', 'Sword', 5],
  ['kuki-shinobu', 'Kuki Shinobu', 'Shinobu', 'inazuma', 'Electro', 'Sword', 4],
  ['raiden-shogun', 'Raiden Shogun', 'Raiden', 'inazuma', 'Electro', 'Polearm', 5],
  ['kujou-sara', 'Sara', 'Sara', 'inazuma', 'Electro', 'Bow', 4],
  ['sayu', 'Sayu', 'Sayu', 'inazuma', 'Anemo', 'Claymore', 4],
  ['thoma', 'Thoma', 'Thoma', 'inazuma', 'Pyro', 'Polearm', 4],
  ['shikanoin-heizou', 'Heizou', 'Heizou', 'inazuma', 'Anemo', 'Catalyst', 4],
  ['kirara', 'Kirara', 'Kirara', 'inazuma', 'Dendro', 'Sword', 4],
  ['sangonomiya-kokomi', 'Kokomi', 'Kokomi', 'inazuma', 'Hydro', 'Catalyst', 5],
  // Sumeru
  ['tighnari', 'Tighnari', 'Tighnari', 'sumeru', 'Dendro', 'Bow', 5],
  ['collei', 'Collei', 'Collei', 'sumeru', 'Dendro', 'Bow', 4],
  ['nilou', 'Nilou', 'Nilou', 'sumeru', 'Hydro', 'Sword', 5],
  ['candace', 'Candace', 'Candace', 'sumeru', 'Hydro', 'Polearm', 4],
  ['layla', 'Layla', 'Layla', 'sumeru', 'Cryo', 'Sword', 4],
  ['nahida', 'Nahida', 'Nahida', 'sumeru', 'Dendro', 'Catalyst', 5],
  ['wanderer', 'Wanderer', 'Wanderer', 'sumeru', 'Anemo', 'Catalyst', 5],
  ['faruzan', 'Faruzan', 'Faruzan', 'sumeru', 'Anemo', 'Bow', 4],
  ['sethos', 'Sethos', 'Sethos', 'sumeru', 'Electro', 'Bow', 4],
  // Фонтейн
  ['lyney', 'Lyney', 'Lyney', 'fontaine', 'Pyro', 'Bow', 5],
  ['lynette', 'Lynette', 'Lynette', 'fontaine', 'Anemo', 'Sword', 4],
  ['freminet', 'Freminet', 'Freminet', 'fontaine', 'Cryo', 'Claymore', 4],
  ['neuvillette', 'Neuvillette', 'Neuvillette', 'fontaine', 'Hydro', 'Catalyst', 5],
  ['furina', 'Furina', 'Furina', 'fontaine', 'Hydro', 'Sword', 5],
  ['charlotte', 'Charlotte', 'Charlotte', 'fontaine', 'Cryo', 'Catalyst', 4],
  ['navia', 'Navia', 'Navia', 'fontaine', 'Geo', 'Claymore', 5],
  ['chevreuse', 'Chevreuse', 'Chevreuse', 'fontaine', 'Pyro', 'Polearm', 4],
  ['clorinde', 'Clorinde', 'Clorinde', 'fontaine', 'Electro', 'Sword', 5],
  ['sigewinne', 'Sigewinne', 'Sigewinne', 'fontaine', 'Hydro', 'Bow', 5],
  ['emilie', 'Emilie', 'Emilie', 'fontaine', 'Dendro', 'Polearm', 5],
  ['escoffier', 'Escoffier', 'Elegg', 'fontaine', 'Cryo', 'Polearm', 5],
  // Natlan
  ['mualani', 'Mualani', 'Mualani', 'natlan', 'Hydro', 'Catalyst', 5],
  ['kachina', 'Kachina', 'Kachina', 'natlan', 'Geo', 'Polearm', 4],
  ['kinich', 'Kinich', 'Kinich', 'natlan', 'Dendro', 'Claymore', 5],
  ['xilonen', 'Xilonen', 'Xilonen', 'natlan', 'Geo', 'Sword', 5],
  ['ororon', 'Ororon', 'Оророн', 'natlan', 'Electro', 'Bow', 4],
  ['chasca', 'Chasca', 'Chasca', 'natlan', 'Anemo', 'Bow', 5],
  ['mavuika', 'Mavuika', 'Mavuika', 'natlan', 'Pyro', 'Claymore', 5],
  ['citlali', 'Citlali', 'Citlali', 'natlan', 'Cryo', 'Catalyst', 5],
  ['iansan', 'Iansan', 'Iansan', 'natlan', 'Electro', 'Polearm', 4],
  // Nod-Krai
  ['ineffa', 'Ineffa', 'Ineffa', 'nodkrai', 'Electro', 'Polearm', 5],
  ['lauma', 'Lauma', 'Lauma', 'nodkrai', 'Dendro', 'Catalyst', 5],
  ['aino', 'Aino', 'Ayno', 'nodkrai', 'Hydro', 'Bow', 4],
  ['flins', 'Flins', 'Flynn', 'nodkrai', 'Anemo', 'Sword', 5],
  ['nefer', 'Nefer', 'Nefer', 'nodkrai', 'Dendro', 'Catalyst', 5],
  ['yagoda', 'Yagoda', 'Ягода', 'nodkrai', 'Hydro', 'Catalyst', 4],
  ['columbina', 'Columbina', 'Kolombina', 'nodkrai', 'Hydro', 'Catalyst', 5],
  ['illuga', 'Illuga', 'Illugi', 'nodkrai', 'Geo', 'Claymore', 5],
  ['linnea', 'Linnea', 'Linnea', 'nodkrai', 'Anemo', 'Bow', 5],
  // Snezhnaya
  ['tartaglia', 'Tartaglia', 'Tartaglia', 'snezhnaya', 'Hydro', 'Bow', 5],
  ['arlecchino', 'Arlecchino', 'Arlecchino', 'snezhnaya', 'Pyro', 'Polearm', 5],
  // Celestia
  ['nicole', 'Nicole', 'Николь', 'celestia', 'Electro', 'Sword', 5],
];

function buildCharacter([id, name, nameRu, region, element, weapon, rarity, iconId]) {
  return { id, name, nameRu, region, element, weapon, rarity, iconId: iconId || id };
}

export const CHARACTERS = RAW.map(buildCharacter);

export function findCharacterById(id) {
  return CHARACTERS.find((c) => c.id === id);
}

export function getCharactersByRegion(regionId) {
  return CHARACTERS.filter((c) => c.region === regionId);
}
