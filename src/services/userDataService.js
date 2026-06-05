/**
 * CRUD пользовательских данных: персонажи, команда, артефакты.
 */
import { getSupabaseClient } from '../lib/supabase';
import {
  configToArtifactRows,
  configToDbRow,
  dbRowToConfig,
} from './mappers';
import { fetchTeamComposition } from './teamService';

const DEFAULT_TEAM_NAME = 'Основная команда';

function wrapSupabaseError(error, context) {
  const message = error?.message || 'Неизвестная ошибка Supabase';
  return new Error(`${context}: ${message}`);
}

export async function fetchUserData(userId) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase не настроен');
  }

  const { data: characterRows, error: charactersError } = await supabase
    .from('user_characters')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (charactersError) {
    throw wrapSupabaseError(charactersError, 'Ошибка загрузки персонажей пользователя');
  }

  const characterIds = (characterRows || []).map((row) => row.id);
  let artifactRows = [];

  if (characterIds.length > 0) {
    const { data, error: artifactsError } = await supabase
      .from('character_artifacts')
      .select('*')
      .in('user_character_id', characterIds);

    if (artifactsError) {
      throw wrapSupabaseError(artifactsError, 'Ошибка загрузки артефактов');
    }
    artifactRows = data || [];
  }

  const artifactsByCharacter = artifactRows.reduce((acc, row) => {
    if (!acc[row.user_character_id]) acc[row.user_character_id] = [];
    acc[row.user_character_id].push(row);
    return acc;
  }, {});

  const savedConfigs = (characterRows || []).map((row) =>
    dbRowToConfig(row, artifactsByCharacter[row.id] || []),
  );

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('active_team_id')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    throw wrapSupabaseError(profileError, 'Ошибка загрузки профиля');
  }

  let teamId = profileRow?.active_team_id ?? null;

  if (teamId) {
    const { data: activeTeam, error: activeTeamError } = await supabase
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .eq('user_id', userId)
      .maybeSingle();

    if (activeTeamError) {
      throw wrapSupabaseError(activeTeamError, 'Ошибка загрузки активной команды');
    }
    if (!activeTeam) teamId = null;
  }

  if (!teamId) {
    const { data: defaultTeam, error: defaultTeamError } = await supabase
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .eq('is_default', true)
      .maybeSingle();

    if (defaultTeamError) {
      throw wrapSupabaseError(defaultTeamError, 'Ошибка загрузки команды по умолчанию');
    }
    teamId = defaultTeam?.id ?? null;
  }

  if (!teamId) {
    const { data: fallbackTeam, error: fallbackError } = await supabase
      .from('teams')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fallbackError) {
      throw wrapSupabaseError(fallbackError, 'Ошибка загрузки команды');
    }
    teamId = fallbackTeam?.id ?? null;
  }

  if (!teamId) {
    const { data: newTeam, error: createTeamError } = await supabase
      .from('teams')
      .insert({ user_id: userId, name: DEFAULT_TEAM_NAME, is_default: true })
      .select('id')
      .single();

    if (createTeamError) {
      throw wrapSupabaseError(createTeamError, 'Ошибка создания команды');
    }
    teamId = newTeam.id;

    await supabase
      .from('profiles')
      .update({ active_team_id: teamId })
      .eq('id', userId);
  }

  const { slots, totalAtk } = await fetchTeamComposition(teamId);
  const team = slots.map((slot) => slot?.characterId ?? null);

  return {
    savedConfigs,
    team,
    teamId,
    teamComposition: slots,
    teamTotalAtk: totalAtk,
  };
}

export async function upsertUserCharacter(userId, config) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase не настроен');
  }

  const row = configToDbRow(config, userId);
  let userCharacterId = config.id;

  if (userCharacterId) {
    const { error: updateError } = await supabase
      .from('user_characters')
      .update(row)
      .eq('id', userCharacterId)
      .eq('user_id', userId);

    if (updateError) {
      throw wrapSupabaseError(updateError, 'Ошибка обновления персонажа');
    }
  } else {
    const { data, error: insertError } = await supabase
      .from('user_characters')
      .insert(row)
      .select('id')
      .single();

    if (insertError) {
      throw wrapSupabaseError(insertError, 'Ошибка сохранения персонажа');
    }
    userCharacterId = data.id;
  }

  const artifactRows = configToArtifactRows(userCharacterId, config.artifacts);
  const { error: deleteError } = await supabase
    .from('character_artifacts')
    .delete()
    .eq('user_character_id', userCharacterId);

  if (deleteError) {
    throw wrapSupabaseError(deleteError, 'Ошибка обновления артефактов');
  }

  const { error: insertArtifactsError } = await supabase
    .from('character_artifacts')
    .insert(artifactRows);

  if (insertArtifactsError) {
    throw wrapSupabaseError(insertArtifactsError, 'Ошибка сохранения артефактов');
  }

  return { ...config, id: userCharacterId };
}

export async function syncTeam(userId, teamId, team, savedConfigs) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase не настроен');
  }

  let activeTeamId = teamId;

  if (!activeTeamId) {
    const { data: newTeam, error: createError } = await supabase
      .from('teams')
      .insert({ user_id: userId, name: DEFAULT_TEAM_NAME, is_default: true })
      .select('id')
      .single();

    if (createError) {
      throw wrapSupabaseError(createError, 'Ошибка создания команды');
    }
    activeTeamId = newTeam.id;

    await supabase
      .from('profiles')
      .update({ active_team_id: activeTeamId })
      .eq('id', userId);
  }

  const { error: deleteError } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', activeTeamId);

  if (deleteError) {
    throw wrapSupabaseError(deleteError, 'Ошибка обновления команды');
  }

  const configByCharacterId = new Map(savedConfigs.map((c) => [c.characterId, c]));
  const members = [];

  team.forEach((characterId, slotIndex) => {
    if (!characterId) return;
    const config = configByCharacterId.get(characterId);
    if (!config?.id) return;
    members.push({
      team_id: activeTeamId,
      user_character_id: config.id,
      slot_index: slotIndex,
      rotation_order: slotIndex + 1,
    });
  });

  if (members.length > 0) {
    const { error: insertError } = await supabase.from('team_members').insert(members);
    if (insertError) {
      throw wrapSupabaseError(insertError, 'Ошибка сохранения состава команды');
    }
  }

  return activeTeamId;
}

export async function signIn(email, password) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase не настроен');

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw wrapSupabaseError(error, 'Ошибка входа');
  return data.session;
}

export async function signUp(email, password) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase не настроен');

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw wrapSupabaseError(error, 'Ошибка регистрации');
  return data.session;
}

export async function signOut() {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) throw wrapSupabaseError(error, 'Ошибка выхода');
}

export function onAuthStateChange(callback) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => subscription.unsubscribe();
}

export async function getInitialSession() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw wrapSupabaseError(error, 'Ошибка получения сессии');
  return data.session;
}
