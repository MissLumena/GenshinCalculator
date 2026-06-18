/**
 * Загрузка справочников game_characters и artifact_sets из Supabase.
 */
import { getSupabaseClient } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';
import { CHARACTERS } from '../characters';
import { ARTIFACT_SETS as LOCAL_ARTIFACT_SETS } from '../mockData';
import {
  dbArtifactSetToFrontend,
  dbCharacterToFrontend,
  mergeCharacters,
  mergeArtifactSets,
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

  const [charactersResult, artifactSetsResult] = await withTimeout(
    Promise.all([
      supabase.from('game_characters').select('*').order('name_ru'),
      supabase.from('artifact_sets').select('*').order('name'),
    ]),
    8000,
    'Таймаут загрузки справочников из Supabase',
  );

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
    artifactSets: mergeArtifactSets(dbArtifactSets, LOCAL_ARTIFACT_SETS),
    fromSupabase: true,
  };
}
