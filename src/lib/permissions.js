/** Email суперюзера для удаления записей Notion (из .env). */
function parseEmailList(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

const ENV_SUPERUSER_EMAILS = parseEmailList(import.meta.env.VITE_SUPERUSER_EMAILS);

/** Email из Supabase user (JWT / getUser). */
export function getSessionEmail(session) {
  const user = session?.user;
  if (!user) return null;

  const candidates = [
    user.email,
    user.user_metadata?.email,
    user.identities?.[0]?.identity_data?.email,
  ];

  for (const value of candidates) {
    const email = String(value || '').trim().toLowerCase();
    if (email) return email;
  }

  return null;
}

function resolveDeleteEmail(session, authPermissions = null) {
  return getSessionEmail(session) ?? authPermissions?.email?.trim().toLowerCase() ?? null;
}

/** Может ли пользователь удалять записи Notion (только email из SUPERUSER_EMAILS). */
export function isNotionDeleteSuperuser(session, authPermissions = null) {
  if (!session?.user?.id) return false;
  const email = resolveDeleteEmail(session, authPermissions);
  if (!email || ENV_SUPERUSER_EMAILS.length === 0) return false;
  return ENV_SUPERUSER_EMAILS.includes(email);
}

export function canDeleteAnyNotionResult(session, authPermissions = null) {
  return isNotionDeleteSuperuser(session, authPermissions);
}

/** Можно ли удалить запись Notion — только суперюзер из .env. */
export function canDeleteNotionResult(session, item, authPermissions = null) {
  if (!item) return false;
  return isNotionDeleteSuperuser(session, authPermissions);
}
