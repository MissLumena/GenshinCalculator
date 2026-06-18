/** Русское имя персонажа */
export function getCharacterNameRu(character) {
  return character?.nameRu || character?.name || '';
}

/** Английское имя персонажа */
export function getCharacterNameEn(character) {
  return character?.nameEn || character?.name || '';
}

/** Подпись для графиков: «Лоэн / Loen» */
export function formatCharacterChartLabel(character) {
  const nameRu = getCharacterNameRu(character);
  const nameEn = getCharacterNameEn(character);
  if (!nameRu) return nameEn;
  if (!nameEn) return nameRu;
  if (nameEn === nameRu) return nameRu;
  return `${nameRu} / ${nameEn}`;
}
