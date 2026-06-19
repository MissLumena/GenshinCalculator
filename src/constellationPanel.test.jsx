import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { highlightConstellationText, ConstellationPanel, ConstellationShapeFallback, TravelerDuoConstellationPortrait, getConstellationShapeImgClassName } from './components';
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
    expect(html).toContain('data-constellation-element="anemo"');
  });

  it('applies pyro theme for Pyro characters', () => {
    const character = findCharacterById('hu-tao');
    const html = renderToString(
      <ConstellationPanel character={character} />,
    );
    expect(html).toContain('data-constellation-element="pyro"');
  });

  it('applies enhanced glow for all elements', () => {
    expect(getConstellationShapeImgClassName('venti', 'Anemo')).toContain('constellation-shape-img--enhanced');
    expect(getConstellationShapeImgClassName('hu-tao', 'Pyro')).toContain('constellation-shape-img--enhanced');
    expect(getConstellationShapeImgClassName('raiden-shogun', 'Electro')).toContain('constellation-shape-img--enhanced');
  });

  it('uses extra-bright class for Ororon', () => {
    expect(getConstellationShapeImgClassName('ororon', 'Electro')).toContain('constellation-shape-img--extra-bright');
    expect(getConstellationShapeImgClassName('ororon', 'Electro')).toContain('constellation-shape-img--enhanced');
  });

  it('renders traveler element tabs', () => {
    const traveler = findCharacterById('traveler');
    const html = renderToString(
      <ConstellationPanel character={traveler} />,
    );
    expect(html).toContain('constellation-element-tabs');
    expect(html).toContain('constellation-element-tab--anemo');
    expect(html).toContain('constellation-element-tab--hydro');
    expect(html).toContain('constellation-element-tab--pyro');
    expect(html).toContain('Анемо');
    expect(html).toContain('Пиро');
  });
});

describe('TravelerDuoConstellationPortrait', () => {
  it('renders Aether and Lumine together', () => {
    const html = renderToString(<TravelerDuoConstellationPortrait />);
    expect(html).toContain('constellation-character--traveler-duo');
    expect(html).toContain('alt="Эттер"');
    expect(html).toContain('alt="Люмин"');
    expect(html).toContain('PlayerBoy');
    expect(html).toContain('PlayerGirl');
  });
});

describe('ConstellationShapeFallback', () => {
  it('renders decorative SVG with constellation name', () => {
    const html = renderToString(
      <ConstellationShapeFallback constellationName="Turris Venefica" activeLevel={3} />,
    );
    expect(html).toContain('constellation-shape-fallback');
    expect(html).toContain('Turris Venefica');
    expect(html).toContain('constellation-shape-fallback__star');
  });
});
