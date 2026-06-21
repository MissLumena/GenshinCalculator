import { describe, expect, it } from 'vitest';
import {
  RESULTS_TAB_MINE,
  RESULTS_TAB_PLAYERS,
  resolveResultsTabFromHash,
  resultsPageHref,
  resultsTabHash,
} from './resultsTabs';

describe('resultsTabs', () => {
  it('opens Notion journal for authenticated users by default', () => {
    expect(resolveResultsTabFromHash('', { isAuthenticated: true })).toBe(RESULTS_TAB_PLAYERS);
    expect(resolveResultsTabFromHash('#notion-results', { isAuthenticated: true })).toBe(RESULTS_TAB_PLAYERS);
  });

  it('opens mine tab for guests by default', () => {
    expect(resolveResultsTabFromHash('')).toBe(RESULTS_TAB_MINE);
    expect(resolveResultsTabFromHash('#notion-results')).toBe(RESULTS_TAB_MINE);
  });

  it('supports explicit mine tab hash', () => {
    expect(resolveResultsTabFromHash('#mine')).toBe(RESULTS_TAB_MINE);
    expect(resolveResultsTabFromHash('#mine', { isAuthenticated: true })).toBe(RESULTS_TAB_MINE);
  });

  it('maps tab ids to hash anchors', () => {
    expect(resultsTabHash(RESULTS_TAB_PLAYERS)).toBe('#notion-results');
    expect(resultsTabHash(RESULTS_TAB_MINE)).toBe('#mine');
  });

  it('builds results page href from auth state', () => {
    expect(resultsPageHref(true)).toBe('/results#notion-results');
    expect(resultsPageHref(false)).toBe('/results#mine');
  });
});
