/**
 * CRUD пользовательских данных: персонажи, команда, артефакты.
 */
import { getSupabaseClient } from '../lib/supabase';
import { fromSupabaseError, toApiError, badRequest } from '../lib/apiErrors';
import { assertSameUser, filterCharacterRowForRole } from '../lib/permissions';
import { validateCharacterConfig, validateTeamComposition } from '../lib/validation';
import { configToArtifactRows, configToDbRow, dbRowToConfig } from './mappers';
import { fetchTeamComposition } from './teamService';

const DEFAULT_TEAM_NAME = 'Основная команда';

function wrapError(error, context) {
  return fromSupabaseError(error, context);
}

export async function fetchUserData(userId, sessionUserId, role = 'user') {
  assertSameUser(sessionUserId, userId, role);

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw badRequest('Supabase не настроен');
  }

  const { data: characterRows, error: charactersError } = await supabase
    .from('user_characters')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (charactersError) {
    throw wrapError(charactersError, 'Ошибка загрузки персонажей пользователя');
  }

  const characterIds = (characterRows || []).map((row) => row.id);
  let artifactRows = [];

  if (characterIds.length > 0) {
    const { data, error: artifactsError } = await supabase
      .from('character_artifacts')
      .select('*')
      .in('user_character_id', characterIds);

    if (artifactsError) {
      throw wrapError(artifactsError, 'Ошибка загрузки артефактов');
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
    throw wrapError(profileError, 'Ошибка загрузки профиля');
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
      throw wrapError(activeTeamError, 'Ошибка загрузки активной команды');
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
      throw wrapError(defaultTeamError, 'Ошибка загрузки команды по умолчанию');
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
      throw wrapError(fallbackError, 'Ошибка загрузки команды');
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
      throw wrapError(createTeamError, 'Ошибка создания команды');
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

async function upsertViaRpc(supabase, row, config) {
  const payload = {
    ...row,
    artifacts_summary: row.artifacts_summary ?? config.artifacts ?? {},
  };
  if (config.id) payload.id = config.id;

  const { data, error } = await supabase.rpc('upsert_user_character', {
    p_payload: payload,
  });

  if (!error) return data;

  if (error.code === 'PGRST202' || /function.*does not exist/i.test(error.message || '')) {
    return null;
  }

  throw wrapError(error, 'Ошибка сохранения персонажа');
}

async function upsertViaTable(supabase, userId, config, role) {
  const row = filterCharacterRowForRole(configToDbRow(config, userId), role);
  let userCharacterId = config.id;

  if (userCharacterId) {
    const { error: updateError } = await supabase
      .from('user_characters')
      .update(row)
      .eq('id', userCharacterId)
      .eq('user_id', userId);

    if (updateError) {
      throw wrapError(updateError, 'Ошибка обновления персонажа');
    }
  } else {
    const { data, error: insertError } = await supabase
      .from('user_characters')
      .insert(row)
      .select('id')
      .single();

    if (insertError) {
      throw wrapError(insertError, 'Ошибка сохранения персонажа');
    }
    userCharacterId = data.id;
  }

  return userCharacterId;
}

export async function upsertUserCharacter(
  userId,
  config,
  role = 'user',
  sessionUserId = userId,
) {
  assertSameUser(sessionUserId, userId, role);

  const validationError = validateCharacterConfig(config);
  if (validationError) {
    throw badRequest(validationError);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw badRequest('Supabase не настроен');
  }

  const row = filterCharacterRowForRole(configToDbRow(config, userId), role);

  let userCharacterId = await upsertViaRpc(supabase, row, config);
  if (userCharacterId == null) {
    userCharacterId = await upsertViaTable(supabase, userId, config, role);
  }

  const artifactRows = configToArtifactRows(userCharacterId, config.artifacts);
  const { error: deleteError } = await supabase
    .from('character_artifacts')
    .delete()
    .eq('user_character_id', userCharacterId);

  if (deleteError) {
    throw wrapError(deleteError, 'Ошибка обновления артефактов');
  }

  if (artifactRows.length > 0) {
    const { error: insertArtifactsError } = await supabase
      .from('character_artifacts')
      .insert(artifactRows);

    if (insertArtifactsError) {
      throw wrapError(insertArtifactsError, 'Ошибка сохранения артефактов');
    }
  }

  return { ...config, id: userCharacterId };
}

async function syncViaRpc(supabase, activeTeamId, members) {
  const { data, error } = await supabase.rpc('sync_team_members', {
    p_team_id: activeTeamId,
    p_members: members,
  });

  if (!error) return data;

  if (error.code === 'PGRST202' || /function.*does not exist/i.test(error.message || '')) {
    return null;
  }

  throw wrapError(error, 'Ошибка синхронизации команды');
}

export async function syncTeam(
  userId,
  teamId,
  team,
  savedConfigs,
  sessionUserId = userId,
  role = 'user',
) {
  assertSameUser(sessionUserId, userId, role);

  const teamError = validateTeamComposition(team, savedConfigs);
  if (teamError) {
    throw badRequest(teamError);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw badRequest('Supabase не настроен');
  }

  let activeTeamId = teamId;

  if (!activeTeamId) {
    const { data: newTeam, error: createError } = await supabase
      .from('teams')
      .insert({ user_id: userId, name: DEFAULT_TEAM_NAME, is_default: true })
      .select('id')
      .single();

    if (createError) {
      throw wrapError(createError, 'Ошибка создания команды');
    }
    activeTeamId = newTeam.id;

    await supabase
      .from('profiles')
      .update({ active_team_id: activeTeamId })
      .eq('id', userId);
  }

  const configByCharacterId = new Map(savedConfigs.map((c) => [c.characterId, c]));
  const members = [];

  team.forEach((characterId, slotIndex) => {
    if (!characterId) return;
    const cfg = configByCharacterId.get(characterId);
    if (!cfg?.id) return;
    members.push({
      user_character_id: cfg.id,
      slot_index: slotIndex,
      rotation_order: slotIndex + 1,
    });
  });

  const rpcResult = await syncViaRpc(supabase, activeTeamId, members);
  if (rpcResult != null) {
    return rpcResult;
  }

  const { error: deleteError } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', activeTeamId);

  if (deleteError) {
    throw wrapError(deleteError, 'Ошибка обновления команды');
  }

  if (members.length > 0) {
    const rows = members.map((m) => ({ team_id: activeTeamId, ...m }));
    const { error: insertError } = await supabase.from('team_members').insert(rows);
    if (insertError) {
      throw wrapError(insertError, 'Ошибка сохранения состава команды');
    }
  }

  return activeTeamId;
}

export { toApiError };
