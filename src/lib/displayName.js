/**
 * Отображаемое имя пользователя (без email).
 */
const DEFAULT_NAME = 'Игрок';
const LOCAL_USER_ID = 'local';

/** Отображаемое имя суперюзера (единственное с зелёным акцентом). */
export const SUPERUSER_DISPLAY_NAME = 'Мира';

export { LOCAL_USER_ID };

export function formatDisplayName(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed || DEFAULT_NAME;
}

export function isSuperuserDisplayName(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed === SUPERUSER_DISPLAY_NAME;
}

export function validateDisplayName(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) return 'Укажите имя';
  if (trimmed.length > 100) return 'Имя не должно быть длиннее 100 символов';
  return null;
}

export function buildLocalResultsEntry() {
  return {
    userId: LOCAL_USER_ID,
    displayName: 'Вы (локально)',
  };
}
