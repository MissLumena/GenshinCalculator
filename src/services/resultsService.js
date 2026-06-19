/**
 * Публичный список результатов и загрузка расчёта пользователя.
 */
import { getSupabaseClient } from '../lib/supabase';
import { formatDisplayName, buildLocalResultsEntry, LOCAL_USER_ID } from '../lib/displayName';
import { normalizeArtifacts } from '../mockData';

const RPC_MISSING_HINT =
  'Выполните миграцию backend/supabase/migrations/004_public_results_display_names.sql '
  + 'в Supabase SQL Editor и перезагрузите схему (Settings → API → Reload schema).';

function wrapSupabaseError(error, context) {
  const message = error?.message || 'Неизвестная ошибка Supabase';
  return new Error(`${context}: ${message}`);
}

function isRpcMissingError(error) {
  const message = error?.message || '';
  return message.includes('list_public_results')
    || message.includes('get_public_user_results')
    || message.includes('schema cache');
}

export function mapPublicResultsPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      displayName: formatDisplayName(null),
      rotationSeconds: 20,
      team: [],
      configs: [],
    };
  }

  const configs = Array.isArray(payload.configs)
    ? payload.configs.map((config) => ({
      ...config,
      artifacts: normalizeArtifacts(config.artifacts),
    }))
    : [];

  return {
    displayName: formatDisplayName(payload.displayName),
    rotationSeconds: Number(payload.rotationSeconds) || 20,
    team: Array.isArray(payload.team) ? payload.team.filter(Boolean) : [],
    configs,
  };
}

export async function fetchResultsUsers({ includeLocal = false } = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase не настроен');
  }

  const { data, error } = await supabase.rpc('list_public_results');

  if (error) {
    if (isRpcMissingError(error)) {
      const fallback = includeLocal ? [buildLocalResultsEntry()] : [];
      return {
        users: fallback,
        rpcMissing: true,
        hint: RPC_MISSING_HINT,
      };
    }
    throw wrapSupabaseError(error, 'Ошибка загрузки списка результатов');
  }

  const users = (data || []).map((row) => ({
    userId: row.user_id,
    displayName: formatDisplayName(row.display_name),
  }));

  if (includeLocal) {
    users.unshift(buildLocalResultsEntry());
  }

  return { users, rpcMissing: false, hint: null };
}

export async function fetchUserResults(userId) {
  if (userId === LOCAL_USER_ID) {
    return null;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase не настроен');
  }

  const { data, error } = await supabase.rpc('get_public_user_results', {
    p_user_id: userId,
  });

  if (error) {
    if (isRpcMissingError(error)) {
      const rpcError = new Error(RPC_MISSING_HINT);
      rpcError.code = 'RPC_MISSING';
      throw rpcError;
    }
    throw wrapSupabaseError(error, 'Ошибка загрузки результатов пользователя');
  }

  if (!data) {
    return null;
  }

  return mapPublicResultsPayload(data);
}

export async function updateMyDisplayName(displayName) {
  const trimmed = typeof displayName === 'string' ? displayName.trim() : '';
  if (!trimmed) {
    const err = new Error('Укажите имя');
    err.field = 'displayName';
    throw err;
  }
  if (trimmed.length > 100) {
    const err = new Error('Имя не должно быть длиннее 100 символов');
    err.field = 'displayName';
    throw err;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase не настроен');
  }

  const { data, error } = await supabase.rpc('update_my_display_name', {
    p_display_name: trimmed,
  });

  if (error) {
    if (isRpcMissingError(error)) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Не авторизован');

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ display_name: trimmed })
        .eq('id', user.id);

      if (updateError) {
        throw wrapSupabaseError(updateError, 'Ошибка обновления имени');
      }
      return trimmed;
    }
    throw wrapSupabaseError(error, 'Ошибка обновления имени');
  }

  return formatDisplayName(data);
}

/** Оставляет только расчёт текущего аккаунта (или локальный для гостя). */
export function filterMyResultsUsers(users, { session, isAuthenticated, profileDisplayName }) {
  const list = Array.isArray(users) ? users : [];

  if (isAuthenticated && session?.user?.id) {
    const own = list.find((user) => user.userId === session.user.id);
    if (own) return [own];
    return [{
      userId: session.user.id,
      displayName: formatDisplayName(profileDisplayName),
    }];
  }

  return list.filter((user) => user.userId === LOCAL_USER_ID);
}

/** Для своего расчёта используем команду из приложения, а не RPC Supabase. */
export function shouldUseLocalResultsSummary(userId, { session, isAuthenticated }) {
  if (userId === LOCAL_USER_ID) return true;
  return Boolean(isAuthenticated && session?.user?.id && session.user.id === userId);
}
