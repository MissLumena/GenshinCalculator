/**
 * Права текущего пользователя с backend (/api/me).
 */
export async function fetchSessionPermissions(accessToken) {
  if (!accessToken) return null;

  try {
    const response = await fetch('/api/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}
