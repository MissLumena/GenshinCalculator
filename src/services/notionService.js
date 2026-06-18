/**
 * Клиент Notion API (через backend FastAPI).
 */
import { getWeaponLabel } from '../weapons';

const API_BASE = import.meta.env.VITE_API_URL || '';

function buildUrl(path) {
  return `${API_BASE}${path}`;
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
    if (response.status === 500 || response.status === 502 || response.status === 503) {
      throw new Error(
        'API недоступен. Запустите backend: npm run dev:full (или npm run dev:api в отдельном терминале)',
      );
    }
    const message = data?.detail || data?.message || `HTTP ${response.status}`;
    throw new Error(typeof message === 'string' ? message : 'Ошибка Notion API');
  }

  return data;
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
    return `${name} C${constellation} | АТК ${Math.round(atk)}${weaponPart}`;
  });

  const levelsLabel = ids
    .map((characterId) => getConfig(characterId)?.level ?? 90)
    .join(', ');

  const teamLabel = ids
    .map((characterId) => findCharacter(characterId)?.nameRu || characterId)
    .join(', ');

  return {
    team_label: teamLabel,
    total_dps: Number(totalDps),
    members,
    levels_label: levelsLabel,
    display_name: displayName || null,
  };
}

export async function saveResultToNotion(payload, accessToken) {
  const response = await fetch(buildUrl('/api/notion/save-result'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(response);
}

export async function fetchNotionResults() {
  try {
    const response = await fetch(buildUrl('/api/notion/results'));
    return parseJsonResponse(response);
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(
        'API недоступен. Запустите backend: npm run dev:full (или npm run dev:api в отдельном терминале)',
      );
    }
    throw err;
  }
}

export async function deleteNotionResult(pageId, accessToken) {
  const response = await fetch(buildUrl(`/api/notion/result/${encodeURIComponent(pageId)}`), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return parseJsonResponse(response);
}

export async function getSupabaseAccessToken() {
  const { getSupabaseClient } = await import('../lib/supabase');
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}
