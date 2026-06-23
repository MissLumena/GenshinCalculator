import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { CharacterTalentsPanel } from './components';
import { findCharacterById } from './characters';

vi.mock('./services/talentService', () => ({
  fetchCharacterTalents: vi.fn(),
}));

import { fetchCharacterTalents } from './services/talentService';

const mockFetchCharacterTalents = vi.mocked(fetchCharacterTalents);

describe('CharacterTalentsPanel', () => {
  beforeEach(() => {
    mockFetchCharacterTalents.mockResolvedValue({
      talents: [
        {
          key: 'combat1',
          label: 'Обычная атака',
          badge: 'NA',
          name: 'Божественная меткая стрельба',
          description: 'Стрельба из лука до 6 раз.',
          iconUrl: 'https://enka.network/ui/Skill_E_Venti_01.png',
        },
      ],
      unavailable: false,
      element: 'Anemo',
      fromApi: true,
    });
  });

  it('renders talent panel shell', () => {
    const character = findCharacterById('venti');
    const html = renderToString(
      <CharacterTalentsPanel character={character} />,
    );
    expect(html).toContain('talent-panel');
    expect(html).toContain('Таланты');
    expect(html).toContain('data-constellation-element="anemo"');
  });

  it('renders traveler element tabs', () => {
    const traveler = findCharacterById('traveler');
    const html = renderToString(
      <CharacterTalentsPanel character={traveler} />,
    );
    expect(html).toContain('constellation-element-tabs');
    expect(html).toContain('constellation-element-tab--pyro');
    expect(html).toContain('Пиро');
  });
});
