/**
 * Supabase Auth: регистрация, вход, выход, профиль с ролью.
 */
import { getSupabaseClient } from '../lib/supabase';
import { ApiError, fromSupabaseError, badRequest, forbidden } from '../lib/apiErrors';
import { validateAuthCredentials, validateAssignableRole } from '../lib/validation';
import { validateDisplayName } from '../lib/displayName';
import { normalizeRole, ROLES, canAssignRole, canDeleteUserAccounts } from '../lib/permissions';

function wrapError(error, context) {
  return fromSupabaseError(error, context);
}

export async function signIn(email, password) {
  const validated = validateAuthCredentials(email, password);
  if ('error' in validated) {
    throw badRequest(validated.error);
  }

  const supabase = getSupabaseClient();
  if (!supabase) throw badRequest('Supabase не настроен');

  const { data, error } = await supabase.auth.signInWithPassword({
    email: validated.email,
    password: validated.password,
  });
  if (error) throw wrapError(error, 'Ошибка входа');
  return data.session;
}

export async function signUp(email, password) {
  const validated = validateAuthCredentials(email, password);
  if ('error' in validated) {
    throw badRequest(validated.error);
  }

  const supabase = getSupabaseClient();
  if (!supabase) throw badRequest('Supabase не настроен');

  const { data, error } = await supabase.auth.signUp({
    email: validated.email,
    password: validated.password,
  });
  if (error) throw wrapError(error, 'Ошибка регистрации');

  if (!data.session) {
    throw badRequest(
      'Регистрация успешна. Подтвердите email, если включено подтверждение в Supabase.',
    );
  }

  return data.session;
}

export async function signOut() {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) throw wrapError(error, 'Ошибка выхода');
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
  if (error) throw wrapError(error, 'Ошибка получения сессии');
  return data.session;
}

/** @returns {Promise<{ id: string, email: string, displayName: string|null, role: string, activeTeamId: string|null }>} */
export async function fetchMyProfile() {
  const supabase = getSupabaseClient();
  if (!supabase) throw badRequest('Supabase не настроен');

  const { data, error } = await supabase.rpc('get_my_profile');
  if (error) {
    return fetchMyProfileFallback(supabase);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw badRequest('Профиль не найден');
  }

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: normalizeRole(row.role),
    activeTeamId: row.active_team_id,
  };
}

async function fetchMyProfileFallback(supabase) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw wrapError(userError, 'Ошибка загрузки пользователя');
  }

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, role, active_team_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw wrapError(profileError, 'Ошибка загрузки профиля');
  }

  return {
    id: user.id,
    email: user.email,
    displayName: profileRow?.display_name ?? null,
    role: normalizeRole(profileRow?.role),
    activeTeamId: profileRow?.active_team_id ?? null,
  };
}

/** Назначить роль owner по email из app_config (один раз). */
export async function claimOwnerRole() {
  const supabase = getSupabaseClient();
  if (!supabase) throw badRequest('Supabase не настроен');

  const { data, error } = await supabase.rpc('claim_owner_role');
  if (error) throw wrapError(error, 'Не удалось назначить владельца');
  return Boolean(data);
}

/** Смена роли: owner — любые роли; admin — только admin/user. */
export async function setUserRole(userId, role, actorRole = ROLES.USER) {
  const roleError = validateAssignableRole(role);
  if (roleError) {
    throw badRequest(roleError);
  }

  if (!canAssignRole(actorRole, role)) {
    throw forbidden('Недостаточно прав для назначения этой роли');
  }

  const supabase = getSupabaseClient();
  if (!supabase) throw badRequest('Supabase не настроен');

  const { error } = await supabase.rpc('admin_set_user_role', {
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw wrapError(error, 'Ошибка смены роли');
}

/** Только owner: удаление учётной записи. */
export async function deleteUserAccount(userId, actorRole = ROLES.USER) {
  if (!canDeleteUserAccounts(actorRole)) {
    throw forbidden('Только владелец может удалять учётные записи');
  }

  const supabase = getSupabaseClient();
  if (!supabase) throw badRequest('Supabase не настроен');

  const { error } = await supabase.rpc('admin_delete_user', {
    p_user_id: userId,
  });
  if (error) throw wrapError(error, 'Ошибка удаления пользователя');
}

/** Обновить отображаемое имя (видно другим, email не показывается). */
export async function updateDisplayName(displayName) {
  const validationError = validateDisplayName(displayName);
  if (validationError) {
    throw badRequest(validationError);
  }

  const supabase = getSupabaseClient();
  if (!supabase) throw badRequest('Supabase не настроен');

  const trimmed = String(displayName).trim();
  const { data, error } = await supabase.rpc('update_my_display_name', {
    p_display_name: trimmed,
  });

  if (error) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw wrapError(error, 'Ошибка сохранения имени');

    const { error: fallbackError } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', user.id);

    if (fallbackError) {
      throw wrapError(error, 'Ошибка сохранения имени');
    }
    return trimmed;
  }

  return data ?? trimmed;
}

export { ApiError };
