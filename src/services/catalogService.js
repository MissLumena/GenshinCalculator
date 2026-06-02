/**
 * Загрузка справочников game_characters и artifact_sets из Supabase.
 */
import { getSupabaseClient } from '../lib/supabase';
import { CHARACTERS } from '../characters';
import { ARTIFACT_SETS as LOCAL_ARTIFACT_SETS } from '../mockData';
import {
  dbArtifactSetToFrontend,
  dbCharacterToFrontend,
  mergeCharacters,
} from './mappers';

function wrapSupabaseError(error, context) {
  const message = error?.message || 'Неизвестная ошибка Supabase';
  return new Error(`${context}: ${message}`);
}

export async function fetchCatalog() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      characters: CHARACTERS,
      artifactSets: LOCAL_ARTIFACT_SETS,
      fromSupabase: false,
    };
  }

  const [charactersResult, artifactSetsResult] = await Promise.all([
    supabase.from('game_characters').select('*').order('name_ru'),
    supabase.from('artifact_sets').select('*').order('name'),
  ]);

  if (charactersResult.error) {
    throw wrapSupabaseError(charactersResult.error, 'Ошибка загрузки персонажей');
  }
  if (artifactSetsResult.error) {
    throw wrapSupabaseError(artifactSetsResult.error, 'Ошибка загрузки сетов артефактов');
  }

  const dbCharacters = (charactersResult.data || []).map(dbCharacterToFrontend);
  const dbArtifactSets = (artifactSetsResult.data || []).map(dbArtifactSetToFrontend);

  return {
    characters: mergeCharacters(dbCharacters, CHARACTERS),
    artifactSets: dbArtifactSets.length > 0 ? dbArtifactSets : LOCAL_ARTIFACT_SETS,
    fromSupabase: true,
  };
}
