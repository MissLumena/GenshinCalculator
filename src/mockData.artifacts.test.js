import { describe, expect, it } from 'vitest';
import {
  getDefaultArtifacts,
  normalizeArtifacts,
  simplifiedToSlots,
  slotsToSimplified,
} from './mockData';

describe('dual artifact sets', () => {
  it('maps simplified 4+2 config to mixed slot sets', () => {
    const slots = simplifiedToSlots({
      set: 'emblem-of-severed-fate',
      set2: 'noblesse-oblige',
      hp: 100,
      critRate: 10,
      critDmg: 20,
      atkPercent: 30,
      em: 40,
    });

    expect(slots.flower.set).toBe('emblem-of-severed-fate');
    expect(slots.plume.set).toBe('noblesse-oblige');
    expect(slots.sands.set).toBe('emblem-of-severed-fate');
    expect(slots.goblet.set).toBe('emblem-of-severed-fate');
    expect(slots.circlet.set).toBe('noblesse-oblige');
  });

  it('round-trips dual sets through slot conversion', () => {
    const original = {
      set: 'crimson-witch-of-flames',
      set2: 'emblem-of-severed-fate',
      hp: 500,
      critRate: 5,
      critDmg: 15,
      atkPercent: 25,
      em: 35,
    };

    const simplified = slotsToSimplified(simplifiedToSlots(original));
    expect(simplified.set).toBe(original.set);
    expect(simplified.set2).toBe(original.set2);
  });

  it('persists set2 in normalized simplified artifacts', () => {
    const normalized = normalizeArtifacts({
      set: 'emblem-of-severed-fate',
      set2: 'noblesse-oblige',
      hp: 0,
      critRate: 0,
      critDmg: 0,
      atkPercent: 0,
      em: 0,
    });

    expect(normalized.set2).toBe('noblesse-oblige');
  });

  it('uses single set for all slots when set2 is absent', () => {
    const slots = simplifiedToSlots(getDefaultArtifacts());
    for (const slot of Object.values(slots)) {
      expect(slot.set).toBe(getDefaultArtifacts().set);
    }
  });
});
