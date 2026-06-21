/** Ключ стихии для CSS-темы панели созвездий (data-constellation-element). */
export function getConstellationElementKey(element) {
  const normalized = String(element || '').trim();
  const map = {
    Pyro: 'pyro',
    Hydro: 'hydro',
    Electro: 'electro',
    Cryo: 'cryo',
    Anemo: 'anemo',
    Geo: 'geo',
    Dendro: 'dendro',
    Physical: 'physical',
  };
  return map[normalized] || 'anemo';
}
