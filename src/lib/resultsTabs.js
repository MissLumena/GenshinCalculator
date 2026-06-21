export const RESULTS_TAB_MINE = 'mine';
export const RESULTS_TAB_PLAYERS = 'players';

/** Ссылка на страницу результатов с учётом авторизации. */
export function resultsPageHref(isAuthenticated) {
  return isAuthenticated ? '/results#notion-results' : '/results#mine';
}

/** По умолчанию: авторизованным — журнал Notion, гостям — «Мои расчёты». */
export function resolveResultsTabFromHash(hash = '', { isAuthenticated = false } = {}) {
  if (hash === '#mine') return RESULTS_TAB_MINE;
  if (!isAuthenticated) return RESULTS_TAB_MINE;
  return RESULTS_TAB_PLAYERS;
}

export function resultsTabHash(tabId) {
  if (tabId === RESULTS_TAB_MINE) return '#mine';
  return '#notion-results';
}
