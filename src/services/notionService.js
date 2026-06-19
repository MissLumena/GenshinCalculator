/**
 * Клиент Notion API (через backend FastAPI).
 */
import { getWeaponLabel } from '../weapons';

const API_BASE = import.meta.env.VITE_API_URL || '';

function buildUrl(path) {
  return `${API_BASE}${path}`;
}

function formatApiError(data, status) {
  if (!data) return `HTTP ${status}`;

  const detail = data.detail ?? data.message;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();

  if (Array.isArray(detail)) {
    const messages = detail.map((item) => {
      const field = Array.isArray(item.loc)
        ? item.loc.filter((part) => part !== 'body').join('.')
        : '';
      const msg = item.msg || '';

      if (field === 'total_dps') {
        return 'Суммарный DPS должен быть больше 0';
      }
      if (field === 'team_label') {
        return 'Укажите состав команды перед сохранением';
      }
      if (field === 'levels_label') {
        return 'Слишком длинные данные уровней персонажей';
      }

      return field ? `${field}: ${msg}` : msg;
    }).filter(Boolean);

    if (messages.length > 0) return messages.join('; ');
  }

  if (detail && typeof detail === 'object') {
    return JSON.stringify(detail);
  }

  return `HTTP ${status}`;
}

async function parseJsonResponse(response) {
  let data = null;
  const contentType = response.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = text ? { detail: text.slice(0, 200) } : null;
    }
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 502 || response.status === 503) {
      throw new Error(
        'Backend перезапускается. Подождите несколько секунд и обновите страницу.',
      );
    }
    if (response.status === 401) {
      throw new Error('Сессия истекла. Выйдите из аккаунта и войдите снова.');
    }
    const message = formatApiError(data, response.status);
    throw new Error(message);
  }

  return data;
}

function waitMs(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchApi(path, options = {}, { retries = 2 } = {}) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(buildUrl(path), options);
      if ((response.status === 502 || response.status === 503) && attempt < retries) {
        await waitMs(1500 * (attempt + 1));
        continue;
      }
      return response;
    } catch (err) {
      lastError = err;
      if (err instanceof TypeError && attempt < retries) {
        await waitMs(1500 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error('Не удалось выполнить запрос к API');
}

function wrapConnectionError(err) {
  if (err instanceof TypeError) {
    throw new Error(
      'API недоступен. Запустите backend: npm run dev (или npm run dev:api в отдельном терминале).',
    );
  }
  throw err;
}

export function buildNotionSavePayload({
  team,
  getConfig,
  findCharacter,
  totalDps,
  displayName,
}) {
  const ids = (team || []).filter(Boolean);
  const members = ids.map((characterId) => {
    const char = findCharacter(characterId);
    const config = getConfig(characterId);
    const atk = Number(config?.atk?.base || 0) + Number(config?.atk?.bonus || 0);
    const name = char?.nameRu || char?.name || characterId;
    const constellation = config?.constellation ?? 0;
    const weaponPart = config?.equippedWeaponId
      ? ` | ${getWeaponLabel(config.equippedWeaponId)}`
      : '';
    return `${characterId}|${name} C${constellation} | АТК ${Math.round(atk)}${weaponPart}`;
  });

  const levelsLabel = ids
    .map((characterId) => getConfig(characterId)?.level ?? 90)
    .join(', ');

  const teamLabel = ids
    .map((characterId) => findCharacter(characterId)?.nameRu || characterId)
    .join(', ');

  return {
    team_label: teamLabel || 'Команда',
    total_dps: Number.isFinite(Number(totalDps)) ? Number(totalDps) : 0,
    members,
    levels_label: `${levelsLabel}|${ids.join(',')}`,
    display_name: displayName || null,
  };
}

export function validateNotionSavePayload(payload) {
  if (!payload?.team_label?.trim()) {
    const err = new Error('Сначала соберите команду для расчёта');
    err.field = 'team_label';
    throw err;
  }
  if (!Number.isFinite(payload.total_dps) || payload.total_dps <= 0) {
    const err = new Error('Суммарный DPS должен быть больше 0. Проверьте билды персонажей.');
    err.field = 'total_dps';
    throw err;
  }
}

export async function saveResultToNotion(payload, accessToken) {
  const response = await fetchApi('/api/notion/save-result', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  }).catch(wrapConnectionError);

  return parseJsonResponse(response);
}

export async function fetchNotionResults(accessToken) {
  if (!accessToken?.trim()) {
    throw new Error('Войдите в аккаунт, чтобы просматривать расчёты игроков');
  }

  const response = await fetchApi('/api/notion/results', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }).catch(wrapConnectionError);
  return parseJsonResponse(response);
}

export async function deleteNotionResult(pageId, accessToken) {
  const response = await fetchApi(`/api/notion/result/${encodeURIComponent(pageId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }).catch(wrapConnectionError);

  return parseJsonResponse(response);
}

export async function getSupabaseAccessToken() {
  const { getSupabaseClient } = await import('../lib/supabase');
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) return null;

  let session = data.session;
  if (!session?.access_token) return null;

  const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
  const expiresSoon = expiresAtMs > 0 && expiresAtMs - Date.now() < 60_000;

  if (expiresSoon) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshed.session?.access_token) {
      session = refreshed.session;
    }
  }

  return session.access_token ?? null;
}
