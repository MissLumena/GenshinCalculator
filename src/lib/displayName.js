/** Отображаемое имя пользователя (без email). */

export function validateDisplayName(name) {
  const value = String(name ?? '').trim();
  if (!value) {
    return 'Введите имя';
  }
  if (value.length < 2 || value.length > 30) {
    return 'Имя должно быть от 2 до 30 символов';
  }
  if (value.includes('@')) {
    return 'Имя не должно содержать @';
  }
  return null;
}

export function formatDisplayName(displayName, fallback = 'Игрок') {
  const value = String(displayName ?? '').trim();
  return value || fallback;
}
