/**
 * CRUD пользовательских данных: персонажи, команда, артефакты.
 */
import { getSupabaseClient } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';
import {
  configToArtifactRows,
  configToDbRow,
  dbRowToConfig,
} from './mappers';
import { fetchTeamComposition } from './teamService';
import { formatDisplayName, validateDisplayName } from '../lib/displayName';
import {
  assertOAuthAllowedForCountry,
  isSupportedOAuthProvider,
  OAUTH_PROVIDER_MAILRU,
} from '../lib/oauthPolicy';
import { resolveArtifactSetId, DEFAULT_ARTIFACT_SET_ID } from '../artifacts';

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
    .select('active_team_id, display_name')
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
    displayName: formatDisplayName(profileRow?.display_name),
  };
}

export async function upsertUserCharacter(userId, config) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase не настроен');
  }

  const { data: gameChar, error: gameCharError } = await supabase
    .from('game_characters')
    .select('id')
    .eq('id', config.characterId)
    .maybeSingle();

  if (gameCharError) {
    throw wrapSupabaseError(gameCharError, 'Ошибка проверки персонажа');
  }
  if (!gameChar) {
    throw new Error('Персонаж не найден в базе данных после синхронизации');
  }

  const row = configToDbRow(config, userId);
  let userCharacterId = config.id;

  if (!userCharacterId) {
    const { data: existing, error: lookupError } = await supabase
      .from('user_characters')
      .select('id')
      .eq('user_id', userId)
      .eq('game_character_id', config.characterId)
      .maybeSingle();

    if (lookupError) {
      throw wrapSupabaseError(lookupError, 'Ошибка поиска персонажа');
    }
    userCharacterId = existing?.id ?? null;
  }

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

  const artifactSetId = resolveArtifactSetId(config.artifacts?.set || DEFAULT_ARTIFACT_SET_ID);
  const { data: artifactSet, error: setLookupError } = await supabase
    .from('artifact_sets')
    .select('id')
    .eq('id', artifactSetId)
    .maybeSingle();

  if (setLookupError) {
    throw wrapSupabaseError(setLookupError, 'Ошибка проверки сета артефактов');
  }

  if (artifactSet) {
    const artifactRows = configToArtifactRows(userCharacterId, config.artifacts);
    const { error: deleteError } = await supabase
      .from('character_artifacts')
      .delete()
      .eq('user_character_id', userCharacterId);

    if (deleteError) {
      throw wrapSupabaseError(deleteError, 'Ошибка обновления артефактов');
    }

    if (artifactRows.length > 0) {
      const { error: insertArtifactsError } = await supabase
        .from('character_artifacts')
        .insert(artifactRows);

      if (insertArtifactsError) {
        throw wrapSupabaseError(insertArtifactsError, 'Ошибка сохранения артефактов');
      }
    }
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

const AUTH_RATE_WINDOW_MS = 60_000;
const AUTH_RATE_MAX_ATTEMPTS = 10;
const authRateStore = new Map();

function assertAuthRateLimit(action, email) {
  const key = `${action}:${email.toLowerCase()}`;
  const now = Date.now();
  const windowStart = now - AUTH_RATE_WINDOW_MS;
  const hits = (authRateStore.get(key) || []).filter((ts) => ts > windowStart);

  if (hits.length >= AUTH_RATE_MAX_ATTEMPTS) {
    const err = new Error('Слишком много попыток. Подождите минуту.');
    err.field = 'form';
    throw err;
  }

  hits.push(now);
  authRateStore.set(key, hits);
}

export function resetAuthRateLimitForTests() {
  authRateStore.clear();
}

export async function signIn(email, password) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase не настроен');

  const normalizedEmail = typeof email === 'string' ? email.trim() : '';
  if (!normalizedEmail) {
    const err = new Error('Укажите email');
    err.field = 'email';
    throw err;
  }
  if (!password) {
    const err = new Error('Укажите пароль');
    err.field = 'password';
    throw err;
  }

  assertAuthRateLimit('signIn', normalizedEmail);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error) {
    const authError = new Error(`Ошибка входа: ${error.message || 'Неизвестная ошибка Supabase'}`);
    const lower = (error.message || '').toLowerCase();
    authError.field = lower.includes('password') ? 'password' : 'email';
    throw authError;
  }
  return data.session;
}

export async function signUp(email, password, displayName) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase не настроен');

  const normalizedEmail = typeof email === 'string' ? email.trim() : '';
  if (!normalizedEmail) {
    const err = new Error('Укажите email');
    err.field = 'email';
    throw err;
  }
  if (!password || String(password).length < 6) {
    const err = new Error('Пароль должен быть не короче 6 символов');
    err.field = 'password';
    throw err;
  }

  const nameError = validateDisplayName(displayName);
  if (nameError) {
    const err = new Error(nameError);
    err.field = 'displayName';
    throw err;
  }
  const trimmedName = typeof displayName === 'string' ? displayName.trim() : '';

  assertAuthRateLimit('signUp', normalizedEmail);

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: { display_name: trimmedName },
    },
  });
  if (error) {
    const authError = new Error(`Ошибка регистрации: ${error.message || 'Неизвестная ошибка Supabase'}`);
    const lower = (error.message || '').toLowerCase();
    if (lower.includes('password')) {
      authError.field = 'password';
    } else if (lower.includes('email')) {
      authError.field = 'email';
    } else {
      authError.field = 'form';
    }
    throw authError;
  }

  if (data.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ display_name: trimmedName })
      .eq('id', data.user.id);

    if (profileError && data.session) {
      throw wrapSupabaseError(profileError, 'Ошибка сохранения имени');
    }
  }

  return data.session;
}

export async function signInWithOAuth(provider, countryCode) {
  if (!isSupportedOAuthProvider(provider)) {
    throw new Error('Неподдерживаемый способ входа');
  }

  assertOAuthAllowedForCountry(provider, countryCode);

  if (provider === OAUTH_PROVIDER_MAILRU) {
    window.location.assign('/api/auth/mailru/start');
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase не настроен');

  const redirectTo = `${window.location.origin}/auth/callback`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      queryParams: provider === 'google'
        ? { prompt: 'select_account' }
        : undefined,
    },
  });

  if (error) throw wrapSupabaseError(error, 'Ошибка OAuth');
  if (!data?.url) throw new Error('Не удалось начать OAuth-авторизацию');

  window.location.assign(data.url);
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

  const { data, error } = await withTimeout(
    supabase.auth.getSession(),
    8000,
    'Таймаут проверки сессии Supabase',
  );
  if (error) throw wrapSupabaseError(error, 'Ошибка получения сессии');
  return data.session;
}
