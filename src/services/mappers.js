/**
 * Преобразование между форматом UI и строками Supabase.
 */
import { ARTIFACT_SLOTS, slotsToSimplified, simplifiedToSlots, getDefaultArtifacts, normalizeArtifacts } from '../mockData';
import {
  stripWeaponFromArtifactsSummary,
  mergeWeaponIntoArtifactsSummary,
  normalizeWeaponType,
} from '../weapons';
import { CHARACTER_NAME_RU } from '../characterNamesRu.js';
import { resolveArtifactSetId } from '../artifacts';

function emptyArtifacts() {
  return simplifiedToSlots(getDefaultArtifacts());
}

function resolveCharacterNames(row) {
  const nameEn = row.name_en || row.name || row.id;
  const nameRu = CHARACTER_NAME_RU[row.id] ?? row.name_ru ?? nameEn;
  return { nameEn, nameRu };
}

export function dbCharacterToFrontend(row) {
  const { nameEn, nameRu } = resolveCharacterNames(row);
  return {
    id: row.id,
    name: nameEn,
    nameEn,
    nameRu,
    element: row.element,
    weapon: normalizeWeaponType(row.weapon),
    rarity: row.rarity,
    region: row.region,
    iconId: row.icon_id || row.id,
  };
}

export function dbArtifactSetToFrontend(row) {
  return {
    id: resolveArtifactSetId(row.id),
    name: row.name,
    bonus2: row.bonus_2pc,
    bonus4: row.bonus_4pc,
  };
}

/** Объединяет локальный полный каталог с данными Supabase. */
export function mergeArtifactSets(dbSets, localSets) {
  const localMap = new Map(localSets.map((set) => [set.id, set]));
  const merged = localSets.map((set) => localMap.get(set.id) || set);
  const seen = new Set(merged.map((set) => set.id));

  for (const dbSet of dbSets) {
    const id = resolveArtifactSetId(dbSet.id);
    if (!seen.has(id)) {
      merged.push({ ...dbSet, id });
      seen.add(id);
    }
  }

  return merged;
}

export function dbRowToConfig(row, artifacts = []) {
  if (row.artifacts_summary && Object.keys(row.artifacts_summary).length > 0) {
    const { artifacts: artifactFields, equippedWeaponId } = stripWeaponFromArtifactsSummary(
      row.artifacts_summary,
    );
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
      artifacts: normalizeArtifacts(artifactFields),
      equippedWeaponId,
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
    equippedWeaponId: null,
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
    artifacts_summary: mergeWeaponIntoArtifactsSummary(
      config.artifacts,
      config.equippedWeaponId,
    ),
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
