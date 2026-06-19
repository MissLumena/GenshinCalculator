import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { WeaponPicker, WeaponIcon } from './components';
import { getWeaponCatalogTotal } from './weapons';

describe('WeaponPicker', () => {
  it('renders full catalog grouped by type', () => {
    const total = getWeaponCatalogTotal();
    const html = renderToString(
      <WeaponPicker
        characterWeaponType="Sword"
        value={null}
        onChange={() => {}}
      />,
    );
    expect(html).toContain('Каталог оружия');
    expect(html).toMatch(new RegExp(`Весь каталог[^0-9]*${total}`));
    expect(html).toContain('Freedom-Sworn');
    expect(html).toMatch(/Revolutionary Chorale|Песнь восстания/);
    expect(html).toContain('Не выбрано');
    expect(html).toContain('text-white');
  });

  it('shows signature weapon first with badge for hu-tao', () => {
    const html = renderToString(
      <WeaponPicker
        characterWeaponType="Polearm"
        characterId="hu-tao"
        value={null}
        onChange={() => {}}
      />,
    );

    expect(html).toContain('сигна');
    expect(html).toContain('Посох Хомы');
    const homaIndex = html.indexOf('Посох Хомы');
    const engulfingIndex = html.indexOf('Сияющая жатва');
    expect(homaIndex).toBeGreaterThan(-1);
    expect(engulfingIndex).toBeGreaterThan(-1);
    expect(homaIndex).toBeLessThan(engulfingIndex);
  });
});

describe('WeaponIcon', () => {
  it('renders icon img with jmp.blue url', () => {
    const html = renderToString(<WeaponIcon weaponId="polar-star" rarity={5} />);
    expect(html).toContain('https://genshin.jmp.blue/weapons/polar-star/icon');
  });
});
