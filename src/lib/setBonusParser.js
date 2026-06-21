const ELEMENT_ALIASES = {
  pyro: 'pyro',
  piro: 'pyro',
  'пиро': 'pyro',
  hydro: 'hydro',
  gidro: 'hydro',
  'гидро': 'hydro',
  electro: 'electro',
  elektro: 'electro',
  'электро': 'electro',
  cryo: 'cryo',
  krio: 'cryo',
  'крио': 'cryo',
  anemo: 'anemo',
  'анемо': 'anemo',
  geo: 'geo',
  'гео': 'geo',
  dendro: 'dendro',
  'дендро': 'dendro',
  physical: 'physical',
  fiz: 'physical',
  'физ': 'physical',
  'физ.': 'physical',
};

function normalizeText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function parsePercentValues(text) {
  return [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)]
    .map((match) => Number(match[1].replace(',', '.')))
    .filter((value) => Number.isFinite(value));
}

function detectElement(text) {
  const lower = text.toLowerCase();
  for (const [alias, element] of Object.entries(ELEMENT_ALIASES)) {
    if (lower.includes(alias)) return element;
  }
  return null;
}

/**
 * Извлекает числовые бонусы из текста 2pc/4pc сета или пассивки оружия.
 */
export function parseStatBonusesFromText(text) {
  const source = normalizeText(text);
  if (!source) {
    return {
      atkPercent: 0,
      critRate: 0,
      critDmg: 0,
      em: 0,
      energyRecharge: 0,
      hpPercent: 0,
      defPercent: 0,
      physicalDmg: 0,
      elementalDmg: {},
      generalDmg: 0,
      burstDmg: 0,
      skillDmg: 0,
      normalDmg: 0,
    };
  }

  const stats = {
    atkPercent: 0,
    critRate: 0,
    critDmg: 0,
    em: 0,
    energyRecharge: 0,
    hpPercent: 0,
    defPercent: 0,
    physicalDmg: 0,
    elementalDmg: {},
    generalDmg: 0,
    burstDmg: 0,
    skillDmg: 0,
    normalDmg: 0,
  };

  const lower = source.toLowerCase();

  const atkMatch = source.match(/(?:ATK|сил[аыу]\s+атаки)[^.\d%]{0,40}(\d+(?:[.,]\d+)?)\s*%/i);
  if (atkMatch) stats.atkPercent += Number(atkMatch[1].replace(',', '.'));

  const critRateMatch = source.match(/(?:CRIT Rate|шанс\s+крит\.?\s*попадания|крит\.?\s*шанс)[^.\d%]{0,40}(\d+(?:[.,]\d+)?)\s*%/i);
  if (critRateMatch) stats.critRate += Number(critRateMatch[1].replace(',', '.'));

  const critDmgMatch = source.match(/(?:CRIT DMG|крит\.?\s*урон)[^.\d%]{0,40}(\d+(?:[.,]\d+)?)\s*%/i);
  if (critDmgMatch) stats.critDmg += Number(critDmgMatch[1].replace(',', '.'));

  const emMatch = source.match(/(?:Elemental Mastery|мастерство стихий)[^.\d]{0,40}(\d+(?:[.,]\d+)?)/i);
  if (emMatch) stats.em += Number(emMatch[1].replace(',', '.'));

  const erMatch = source.match(/(?:Energy Recharge|восстановление энергии)[^.\d%]{0,40}(\d+(?:[.,]\d+)?)\s*%/i);
  if (erMatch) stats.energyRecharge += Number(erMatch[1].replace(',', '.'));

  const hpMatch = source.match(/(?:Max HP|макс\.?\s*HP|HP)[^.\d%]{0,20}(\d+(?:[.,]\d+)?)\s*%/i);
  if (hpMatch && !lower.includes('ниже') && !lower.includes('below')) {
    stats.hpPercent += Number(hpMatch[1].replace(',', '.'));
  }

  const defMatch = source.match(/(?:DEF|защит[аы])[^.\d%]{0,20}(\d+(?:[.,]\d+)?)\s*%/i);
  if (defMatch) stats.defPercent += Number(defMatch[1].replace(',', '.'));

  if (/physical dmg|физ\.?\s*урон/i.test(source)) {
    const values = parsePercentValues(source);
    if (values.length) stats.physicalDmg += values[0];
  }

  const element = detectElement(source);
  if (element && /dmg bonus|урон/i.test(source)) {
    const values = parsePercentValues(source);
    if (values.length) {
      stats.elementalDmg[element] = (stats.elementalDmg[element] || 0) + values[0];
    }
  }

  if (/elemental burst|взрыв[а-яёa-z]*\s+стихии/i.test(source) && /урон|dmg/i.test(source)) {
    const burstMatch = source.match(/(?:elemental burst|взрыв[а-яёa-z]*\s+стихии)[\s\S]{0,120}?(\d+(?:[.,]\d+)?)\s*%/i);
    if (burstMatch) stats.burstDmg += Number(burstMatch[1].replace(',', '.'));
  } else if (/elemental skill|элементальн[а-яёa-z]*/i.test(source) && /урон|dmg/i.test(source)) {
    const skillMatch = source.match(/(?:elemental skill|элементальн[а-яёa-z]*)[\s\S]{0,120}?(\d+(?:[.,]\d+)?)\s*%/i);
    if (skillMatch) stats.skillDmg += Number(skillMatch[1].replace(',', '.'));
  } else if (/normal attack|charged attack|обычн[а-яёa-z]*|заряжен[а-яёa-z]*/i.test(source) && /урон|dmg/i.test(source)) {
    const normalMatch = source.match(/(?:normal attack|charged attack|обычн[а-яёa-z]*|заряжен[а-яёa-z]*)[\s\S]{0,120}?(\d+(?:[.,]\d+)?)\s*%/i);
    if (normalMatch) stats.normalDmg += Number(normalMatch[1].replace(',', '.'));
  } else if (/урон|dmg/i.test(source) && !element) {
    const values = parsePercentValues(source);
    if (values.length) stats.generalDmg += values[0];
  }

  return stats;
}

export function mergeStatBonuses(...items) {
  const merged = parseStatBonusesFromText('');
  for (const item of items) {
    if (!item) continue;
    merged.atkPercent += item.atkPercent || 0;
    merged.critRate += item.critRate || 0;
    merged.critDmg += item.critDmg || 0;
    merged.em += item.em || 0;
    merged.energyRecharge += item.energyRecharge || 0;
    merged.hpPercent += item.hpPercent || 0;
    merged.defPercent += item.defPercent || 0;
    merged.physicalDmg += item.physicalDmg || 0;
    merged.generalDmg += item.generalDmg || 0;
    merged.burstDmg += item.burstDmg || 0;
    merged.skillDmg += item.skillDmg || 0;
    merged.normalDmg += item.normalDmg || 0;

    for (const [element, value] of Object.entries(item.elementalDmg || {})) {
      merged.elementalDmg[element] = (merged.elementalDmg[element] || 0) + value;
    }
  }
  return merged;
}
