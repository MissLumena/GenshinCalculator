import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ArtifactSetPicker, DualArtifactSetPicker } from './components';
import { getArtifactCatalogTotal } from './artifacts';

describe('ArtifactSetPicker', () => {
  it('renders full artifact catalog with icons and bonuses', () => {
    const total = getArtifactCatalogTotal();
    const html = renderToString(
      <ArtifactSetPicker
        value="emblem-of-severed-fate"
        onChange={() => {}}
      />,
    );
    expect(html).toContain('Каталог артефактов');
    expect(html).toMatch(new RegExp(`всего[^0-9]*${total}`));
    expect(html).toMatch(/2pc:|4pc:/);
    expect(html).toContain('text-white');
  });
});

describe('DualArtifactSetPicker', () => {
  it('renders 4+2 loadout controls', () => {
    const html = renderToString(
      <DualArtifactSetPicker
        set="emblem-of-severed-fate"
        set2="noblesse-oblige"
        onChange={() => {}}
      />,
    );
    expect(html).toContain('Тип сборки артефактов');
    expect(html).toContain('Два сета · 4 + 2');
    expect(html).toContain('Один сет · 5 шт.');
    expect(html).toContain('Редактировать сет 2 (2pc)');
    expect(html).toContain('×4');
    expect(html).toContain('×2');
  });
});
