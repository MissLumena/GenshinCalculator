/** Доступные стихии созвездий Путешественника. */
export const TRAVELER_CONSTELLATION_ELEMENTS = ['Anemo', 'Geo', 'Electro', 'Dendro', 'Hydro', 'Pyro'];

export const TRAVELER_ELEMENT_LABELS_RU = {
  Anemo: 'Анемо',
  Geo: 'Гео',
  Electro: 'Электро',
  Dendro: 'Дендро',
  Hydro: 'Гидро',
  Pyro: 'Пиро',
};

export const TRAVELER_CONSTELLATION_NAME_RU = 'Звёздный Путник';

const TRAVELER_SHAPE_URLS = {
  Anemo: 'https://static.wikia.nocookie.net/gensin-impact/images/c/c6/Viator_Anemo_Shape.png/revision/latest?cb=20220506221755',
  Geo: 'https://static.wikia.nocookie.net/gensin-impact/images/2/2b/Viator_Geo_Shape.png/revision/latest?cb=20220506221832',
  Electro: 'https://static.wikia.nocookie.net/gensin-impact/images/e/e4/Viator_Electro_Shape.png/revision/latest?cb=20220506221816',
  Dendro: 'https://static.wikia.nocookie.net/gensin-impact/images/6/69/Viator_Dendro_Shape.png/revision/latest?cb=20250123200004',
  Hydro: 'https://static.wikia.nocookie.net/gensin-impact/images/e/e7/Viator_Hydro_Shape.png/revision/latest?cb=20230901003734',
  Pyro: 'https://static.wikia.nocookie.net/gensin-impact/images/9/9e/Viator_Pyro_Shape.png/revision/latest?cb=20250103050433',
};

export function isTravelerCharacter(character) {
  return character?.id === 'traveler';
}

export function normalizeTravelerElement(element, fallback = 'Anemo') {
  return TRAVELER_CONSTELLATION_ELEMENTS.includes(element) ? element : fallback;
}

export function getTravelerConstellationQuery(element) {
  return `Traveler ${normalizeTravelerElement(element)}`;
}

export function getTravelerShapeNameEn(element) {
  return `Viator ${normalizeTravelerElement(element)}`;
}

export function getTravelerShapeCharacterId(element) {
  return `traveler-${normalizeTravelerElement(element).toLowerCase()}`;
}

export function getTravelerStaticShapeUrl(element) {
  return TRAVELER_SHAPE_URLS[normalizeTravelerElement(element)] || null;
}

export function getTravelerConstellationCacheKey(element) {
  return `traveler:${normalizeTravelerElement(element)}`;
}
