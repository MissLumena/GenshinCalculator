/**
 * Преобразование между форматом UI и строками Supabase.
 */
import { ARTIFACT_SLOTS, slotsToSimplified, simplifiedToSlots, getDefaultArtifacts, normalizeArtifacts } from '../mockData';

function emptyArtifacts() {
  return simplifiedToSlots(getDefaultArtifacts());
}

export function dbCharacterToFrontend(row) {
  return {
    id: row.id,
    name: row.name_en,
    nameRu: row.name_ru,
    element: row.element,
    weapon: row.weapon,
    rarity: row.rarity,
    region: row.region,
    iconId: row.icon_id || row.id,
  };
}

export function dbArtifactSetToFrontend(row) {
  return {
    id: row.id,
    name: row.name,
    bonus2: row.bonus_2pc,
    bonus4: row.bonus_4pc,
  };
}

export function dbRowToConfig(row, artifacts = []) {
  if (row.artifacts_summary && Object.keys(row.artifacts_summary).length > 0) {
    return {
      id: row.id,
      characterId: row.game_character_id,
      level: row.level,
      atk: { base: Number(row.atk_base), bonus: Number(row.atk_bonus) },
      hp: Number(row.hp),
      def: Number(row.defense),
      em: Number(row.em),
      critRate: Number(row.crit_rate),
      critDmg: Number(row.crit_dmg),
      energyRecharge: Number(row.energy_recharge),
      constellation: row.constellation,
      artifacts: normalizeArtifacts(row.artifacts_summary),
    };
  }

  const artifactMap = emptyArtifacts();
  for (const artifact of artifacts) {
    artifactMap[artifact.slot] = {
      set: artifact.set_id,
      mainStat: artifact.main_stat,
      substats: Array.isArray(artifact.substats) ? artifact.substats : [],
    };
  }

  return {
    id: row.id,
    characterId: row.game_character_id,
    level: row.level,
    atk: { base: Number(row.atk_base), bonus: Number(row.atk_bonus) },
    hp: Number(row.hp),
    def: Number(row.defense),
    em: Number(row.em),
    critRate: Number(row.crit_rate),
    critDmg: Number(row.crit_dmg),
    energyRecharge: Number(row.energy_recharge),
    constellation: row.constellation,
    artifacts: slotsToSimplified(artifactMap),
  };
}

export function configToDbRow(config, userId) {
  return {
    user_id: userId,
    game_character_id: config.characterId,
    level: config.level,
    atk_base: config.atk.base,
    atk_bonus: config.atk.bonus,
    hp: config.hp,
    defense: config.def,
    em: config.em,
    energy_recharge: config.energyRecharge,
    crit_rate: config.critRate,
    crit_dmg: config.critDmg,
    constellation: config.constellation,
    artifacts_summary: config.artifacts,
  };
}

export function configToArtifactRows(userCharacterId, artifacts) {
  const slots = simplifiedToSlots(artifacts);
  return ARTIFACT_SLOTS.map(({ key }) => ({
    user_character_id: userCharacterId,
    slot: key,
    set_id: slots[key].set,
    main_stat: slots[key].mainStat,
    substats: slots[key].substats,
  }));
}

/** Объединяет локальный справочник с данными из Supabase (приоритет у БД). */
export function mergeCharacters(dbCharacters, localCharacters) {
  const dbMap = new Map(dbCharacters.map((c) => [c.id, c]));
  const seen = new Set();
  const merged = [];

  for (const local of localCharacters) {
    merged.push(dbMap.get(local.id) || local);
    seen.add(local.id);
  }

  for (const dbChar of dbCharacters) {
    if (!seen.has(dbChar.id)) {
      merged.push(dbChar);
    }
  }

  return merged;
}
