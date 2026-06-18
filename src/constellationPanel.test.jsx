import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { highlightConstellationText, ConstellationPanel, getConstellationShapeImgClassName } from './components';
import { findCharacterById } from './characters';

vi.mock('./services/constellationService', () => ({
  fetchCharacterConstellationData: vi.fn(),
  getCharacterPortraitUrl: vi.fn(() => 'https://example.com/portrait'),
  getConstellationShapeUrl: vi.fn(() => 'https://example.com/shape'),
  getConstellationLevelIconUrl: vi.fn(() => 'https://example.com/c1'),
}));

import { fetchCharacterConstellationData } from './services/constellationService';

describe('highlightConstellationText', () => {
  it('wraps game terms in highlight spans', () => {
    const html = renderToString(
      <p>{highlightConstellationText('Улучшает Elemental Skill и CRIT Rate.')}</p>,
    );
    expect(html).toContain('constellation-highlight');
    expect(html).toContain('Elemental Skill');
  });
});

describe('ConstellationPanel', () => {
  beforeEach(() => {
    fetchCharacterConstellationData.mockResolvedValue({
      constellationName: 'Carmen Dei',
      shapeUrl: 'https://example.com/shape',
      items: [
        { level: 0, title: 'Carmen Dei', description: 'Base kit.', iconUrl: 'https://example.com/shape' },
        { level: 1, title: 'Splitting Gale', description: 'Extra arrows.', iconUrl: 'https://example.com/c1' },
      ],
      fromApi: true,
    });
  });

  it('renders constellation panel shell', () => {
    const character = findCharacterById('venti');
    const html = renderToString(
      <ConstellationPanel character={character} />,
    );
    expect(html).toContain('constellation-panel');
    expect(html).toContain('constellation-badge');
    expect(html).toContain('Созвездие');
  });

  it('uses bright constellation class for Ororon', () => {
    expect(getConstellationShapeImgClassName('ororon')).toContain('constellation-shape-img--bright');
    expect(getConstellationShapeImgClassName('venti')).toBe('constellation-shape-img');
  });
});
