/**
 * Публичные результаты расчётов (только имена, без email).
 */
import { getSupabaseClient } from '../lib/supabase';
import { fromSupabaseError, badRequest } from '../lib/apiErrors';
import { formatDisplayName } from '../lib/displayName';
import { normalizeArtifacts } from '../mockData';

function wrapError(error, context) {
  return fromSupabaseError(error, context);
}

function isMissingRpcError(error) {
  const message = error?.message || '';
  return (
    error?.code === 'PGRST202'
    || /schema cache/i.test(message)
    || /could not find the function/i.test(message)
  );
}

async function fetchResultsUsersFallback(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) return [];

  const { count: charCount } = await supabase
    .from('user_characters')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (!charCount) return [];

  const { data: teamRow } = await supabase
    .from('teams')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  let memberCount = 0;
  if (teamRow?.id) {
    const { count } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamRow.id);
    memberCount = count ?? 0;
  }

  return [{
    userId: profile.id,
    displayName: formatDisplayName(profile.display_name),
    memberCount,
  }];
}

/** @returns {Promise<Array<{ userId: string, displayName: string, memberCount: number }>>} */
export async function fetchResultsUsers() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw badRequest('Supabase не настроен');
  }

  const { data, error } = await supabase.rpc('list_public_results');
  if (error) {
    if (isMissingRpcError(error)) {
      const fallback = await fetchResultsUsersFallback(supabase);
      if (fallback.length > 0) {
        return fallback;
      }
      throw badRequest(
        'Функция list_public_results не найдена. Выполните миграцию '
        + '004_public_results_display_names.sql в Supabase SQL Editor, '
        + 'затем Settings → API → Reload schema.',
      );
    }
    throw wrapError(error, 'Ошибка загрузки списка результатов');
  }

  return (data || []).map((row) => ({
    userId: row.user_id,
    displayName: formatDisplayName(row.display_name),
    memberCount: row.member_count ?? 0,
  }));
}

function mapConfigFromApi(raw) {
  return {
    characterId: raw.characterId,
    level: raw.level,
    atk: raw.atk ?? { base: 0, bonus: 0 },
    hp: raw.hp,
    def: raw.def,
    em: raw.em,
    critRate: raw.critRate,
    critDmg: raw.critDmg,
    energyRecharge: raw.energyRecharge,
    constellation: raw.constellation,
    artifacts: normalizeArtifacts(raw.artifacts),
  };
}

/** @returns {Promise<{ userId: string, displayName: string, team: string[], configs: object[] }>} */
export async function fetchUserResults(userId) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw badRequest('Supabase не настроен');
  }

  const { data, error } = await supabase.rpc('get_public_user_results', {
    p_user_id: userId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      throw badRequest(
        'Функция get_public_user_results не найдена. Выполните миграцию '
        + '004_public_results_display_names.sql в Supabase SQL Editor.',
      );
    }
    throw wrapError(error, 'Ошибка загрузки расчёта');
  }

  const payload = typeof data === 'string' ? JSON.parse(data) : data;
  if (!payload) {
    throw badRequest('Расчёт не найден');
  }

  const teamList = Array.isArray(payload.team) ? payload.team : [];

  return {
    userId: payload.userId,
    displayName: formatDisplayName(payload.displayName),
    team: teamList,
    configs: (payload.configs || []).map(mapConfigFromApi),
  };
}

/** Локальный расчёт без входа. */
export function buildLocalResultsPayload(displayName, team, savedConfigs) {
  return {
    userId: 'local',
    displayName: formatDisplayName(displayName, 'Гость'),
    team: [...team],
    configs: savedConfigs.map((c) => ({
      ...c,
      artifacts: normalizeArtifacts(c.artifacts),
    })),
  };
}
