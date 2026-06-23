import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { TeamPage } from './pages';

vi.mock('./context', () => ({
  useAppState: () => ({
    team: [null, null, null, null],
    teamComposition: [null, null, null, null],
    teamTotalAtk: 0,
    addToTeam: vi.fn(),
    clearTeamSlot: vi.fn(),
    characters: [],
    actionLoading: false,
    userDataLoading: false,
    isAuthenticated: false,
    session: null,
  }),
}));

describe('TeamPage', () => {
  it('uses white text instead of gray for readability', () => {
    const html = renderToString(
      <MemoryRouter>
        <TeamPage />
      </MemoryRouter>,
    );

    expect(html).toContain('team-page');
    expect(html).toContain('text-white');
    expect(html).not.toContain('text-gray-400');
    expect(html).not.toContain('text-gray-300');
  });
});
