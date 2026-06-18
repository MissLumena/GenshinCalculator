/**
 * Синхронизация справочников game_characters / artifact_sets в Supabase (RPC).
 */
import { getSupabaseClient } from '../lib/supabase';

function wrapSupabaseError(error, context) {
  const message = error?.message || 'Неизвестная ошибка Supabase';
  return new Error(`${context}: ${message}`);
}

function isMissingRpcError(error) {
  const message = error?.message || '';
  return message.includes('Could not find the function')
    || message.includes('schema cache')
    || error?.code === 'PGRST202';
}

export async function ensureGameCharacterInDb(character) {
  const supabase = getSupabaseClient();
  if (!supabase || !character?.id) return false;

  const { error } = await supabase.rpc('upsert_game_character', {
    p_id: character.id,
    p_name_en: character.nameEn || character.name,
    p_name_ru: character.nameRu || character.name,
    p_element: character.element,
    p_weapon: character.weapon,
    p_rarity: character.rarity,
    p_region: character.region,
    p_icon_id: character.iconId || character.id,
  });

  if (error) {
    if (isMissingRpcError(error)) return false;
    throw wrapSupabaseError(error, 'Ошибка синхронизации персонажа');
  }

  return true;
}

export async function ensureArtifactSetInDb(artifactSet) {
  const supabase = getSupabaseClient();
  if (!supabase || !artifactSet?.id) return false;

  const { error } = await supabase.rpc('upsert_artifact_set', {
    p_id: artifactSet.id,
    p_name: artifactSet.name,
    p_bonus_2pc: artifactSet.bonus2,
    p_bonus_4pc: artifactSet.bonus4,
  });

  if (error) {
    if (isMissingRpcError(error)) return false;
    throw wrapSupabaseError(error, 'Ошибка синхронизации сета артефактов');
  }

  return true;
}

export async function ensureCatalogForConfig(config, findCharacter, artifactSets) {
  const character = findCharacter(config.characterId);
  if (!character) {
    throw new Error('Персонаж не найден в справочнике приложения');
  }

  const syncedCharacter = await ensureGameCharacterInDb(character);
  if (!syncedCharacter) {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { data, error } = await supabase
      .from('game_characters')
      .select('id')
      .eq('id', character.id)
      .maybeSingle();

    if (error) {
      throw wrapSupabaseError(error, 'Ошибка проверки персонажа');
    }
    if (!data) {
      throw new Error(
        'Персонаж не синхронизирован с базой данных. Примените миграцию 005_game_catalog_sync.sql в Supabase.',
      );
    }
    return;
  }

  const setIds = [config.artifacts?.set, config.artifacts?.set2].filter(Boolean);
  if (setIds.length === 0) return;

  for (const setId of setIds) {
    const artifactSet = artifactSets.find((set) => set.id === setId);
    if (artifactSet) {
      await ensureArtifactSetInDb(artifactSet);
    }
  }
}
