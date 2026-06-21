import { describe, expect, it } from 'vitest';
import { parseStatBonusesFromText, mergeStatBonuses } from './setBonusParser';

describe('parseStatBonusesFromText', () => {
  it('parses ATK and CRIT bonuses from Russian text', () => {
    const stats = parseStatBonusesFromText('Увеличивает силу атаки на 18%. Увеличивает шанс крит. попадания на 12%.');
    expect(stats.atkPercent).toBe(18);
    expect(stats.critRate).toBe(12);
  });

  it('parses elemental and burst bonuses', () => {
    const stats = parseStatBonusesFromText('Даёт 15% бонус Пиро урона. Урон взрыва стихии увеличивается на 20%.');
    expect(stats.elementalDmg.pyro).toBe(15);
    expect(stats.burstDmg).toBe(20);
  });

  it('merges multiple bonus objects', () => {
    const merged = mergeStatBonuses(
      parseStatBonusesFromText('ATK +18%.'),
      parseStatBonusesFromText('CRIT Rate +12%.'),
    );
    expect(merged.atkPercent).toBe(18);
    expect(merged.critRate).toBe(12);
  });
});
