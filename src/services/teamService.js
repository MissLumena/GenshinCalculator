/**
 * Загрузка состава команды с join user_characters → game_characters.
 */
import { getSupabaseClient } from '../lib/supabase';
import { dbCharacterToFrontend } from './mappers';

const EMPTY_SLOTS = [null, null, null, null];

function wrapSupabaseError(error, context) {
  const message = error?.message || 'Неизвестная ошибка Supabase';
  return new Error(`${context}: ${message}`);
}

/** ATK одного персонажа = atk_base + atk_bonus */
export function calcCharacterAtk(atkBase, atkBonus) {
  return Number(atkBase || 0) + Number(atkBonus || 0);
}

/** Суммарный ATK команды по заполненным слотам */
export function calcTeamTotalAtk(slots) {
  return (slots || [])
    .filter(Boolean)
    .reduce((sum, slot) => sum + (slot.atk ?? 0), 0);
}

/** Преобразует строку join Supabase в объект слота UI */
export function mapTeamMemberRow(member, findCharacter) {
  const userChar = member.user_characters;
  if (!userChar) return null;

  const gameChar = userChar.game_characters;
  const characterId = userChar.game_character_id;
  const catalogChar = gameChar
    ? dbCharacterToFrontend(gameChar)
    : findCharacter?.(characterId);

  if (!catalogChar) return null;

  return {
    slotIndex: member.slot_index,
    userCharacterId: member.user_character_id,
    characterId,
    nameRu: gameChar?.name_ru || catalogChar.nameRu,
    nameEn: gameChar?.name_en || catalogChar.name,
    element: gameChar?.element || catalogChar.element,
    constellation: userChar.constellation ?? 0,
    level: userChar.level ?? 90,
    atk: calcCharacterAtk(userChar.atk_base, userChar.atk_bonus),
    char: catalogChar,
  };
}

/** Собирает 4 слота и totalAtk из ответа Supabase */
export function buildTeamComposition(members, findCharacter) {
  const slots = [...EMPTY_SLOTS];

  for (const member of members || []) {
    const slot = mapTeamMemberRow(member, findCharacter);
    if (slot && slot.slotIndex >= 0 && slot.slotIndex < 4) {
      slots[slot.slotIndex] = slot;
    }
  }

  return {
    slots,
    totalAtk: calcTeamTotalAtk(slots),
  };
}

/** Оптимистичное добавление персонажа в слот (до сохранения на сервер). */
export function prepareTeamMemberAdd(team, savedConfigs, slotIdx, characterId, defaultConfig) {
  if (slotIdx == null || slotIdx < 0 || slotIdx > 3) {
    return { nextTeam: team, nextConfigs: savedConfigs, createdConfig: null };
  }

  const existing = savedConfigs.find((c) => c.characterId === characterId);
  const nextConfigs = existing ? savedConfigs : [...savedConfigs, defaultConfig];
  const nextTeam = [...team];
  nextTeam[slotIdx] = characterId;

  return {
    nextTeam,
    nextConfigs,
    createdConfig: existing ? null : defaultConfig,
  };
}

/** Локальный режим (без входа): из savedConfigs + team */
export function buildLocalTeamComposition(team, savedConfigs, findCharacter) {
  const slots = team.map((characterId, slotIndex) => {
    if (!characterId) return null;

    const char = findCharacter(characterId);
    const config = savedConfigs.find((c) => c.characterId === characterId);
    if (!char || !config) return null;

    return {
      slotIndex,
      userCharacterId: config.id ?? null,
      characterId,
      nameRu: char.nameRu,
      nameEn: char.name,
      element: char.element,
      constellation: config.constellation ?? 0,
      level: config.level ?? 90,
      atk: calcCharacterAtk(config.atk?.base, config.atk?.bonus),
      char,
    };
  });

  return {
    slots,
    totalAtk: calcTeamTotalAtk(slots),
  };
}

/** Запрос состава команды из БД (join на стороне Supabase) */
export async function fetchTeamComposition(teamId, findCharacter) {
  const supabase = getSupabaseClient();
  if (!supabase || !teamId) {
    return { slots: [...EMPTY_SLOTS], totalAtk: 0 };
  }

  const { data, error } = await supabase
    .from('team_members')
    .select(`
      slot_index,
      user_character_id,
      user_characters (
        id,
        constellation,
        atk_base,
        atk_bonus,
        level,
        game_character_id,
        game_characters (
          id,
          name_en,
          name_ru,
          element,
          weapon,
          rarity,
          region,
          icon_id
        )
      )
    `)
    .eq('team_id', teamId)
    .order('slot_index');

  if (error) {
    throw wrapSupabaseError(error, 'Ошибка загрузки состава команды');
  }

  return buildTeamComposition(data, findCharacter);
}
