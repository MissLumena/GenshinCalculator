import { describe, expect, it } from 'vitest';
import { findCharacterById } from '../characters';
import {
  canReachTalentLevel13,
  formatTalentLevelsLabel,
  getTalentConstellationBoosts,
  getTalentLevelLimits,
  normalizeTalentLevels,
  resolveTalentLevelsForDps,
  TALENT_LEVEL_CAP_10_ONLY,
} from './talentLevelLimits';

describe('talentLevelLimits', () => {
  it('allows level 13 for skill at C3 and burst at C5 on Bennett', () => {
    const bennett = findCharacterById('bennett');
    expect(getTalentLevelLimits(bennett, 0)).toEqual({ auto: 10, skill: 10, burst: 10 });
    expect(getTalentLevelLimits(bennett, 3)).toEqual({ auto: 10, skill: 13, burst: 10 });
    expect(getTalentLevelLimits(bennett, 5)).toEqual({ auto: 10, skill: 13, burst: 13 });
  });

  it('uses swapped constellation boosts for Traveler', () => {
    const traveler = findCharacterById('traveler');
    const boosts = getTalentConstellationBoosts(traveler);
    expect(boosts).toEqual({ auto: null, skill: 5, burst: 3 });
    expect(getTalentLevelLimits(traveler, 3)).toEqual({ auto: 10, skill: 10, burst: 13 });
    expect(getTalentLevelLimits(traveler, 5)).toEqual({ auto: 10, skill: 13, burst: 13 });
  });

  it('allows level 13 for normal attack on Arlecchino at C3', () => {
    const arlecchino = findCharacterById('arlecchino');
    expect(getTalentLevelLimits(arlecchino, 3)).toEqual({ auto: 13, skill: 10, burst: 10 });
  });

  it('caps Aloy and mannequin at level 10', () => {
    for (const id of TALENT_LEVEL_CAP_10_ONLY) {
      const character = findCharacterById(id);
      expect(canReachTalentLevel13(character)).toBe(false);
      expect(getTalentLevelLimits(character, 6)).toEqual({ auto: 10, skill: 10, burst: 10 });
    }
  });

  it('keeps unset talent levels empty', () => {
    const venti = findCharacterById('venti');
    expect(normalizeTalentLevels({ constellation: 6 }, venti)).toEqual({
      auto: null,
      skill: null,
      burst: null,
    });
  });

  it('clamps stored levels to current constellation limits', () => {
    const venti = findCharacterById('venti');
    expect(normalizeTalentLevels({
      constellation: 2,
      talentLevels: { auto: 10, skill: 13, burst: 13 },
    }, venti)).toEqual({
      auto: 10,
      skill: 10,
      burst: 10,
    });
  });

  it('defaults missing talent levels to 10 for DPS calculation', () => {
    const venti = findCharacterById('venti');
    expect(resolveTalentLevelsForDps({ constellation: 0 }, venti)).toEqual({
      auto: 10,
      skill: 10,
      burst: 10,
    });
    expect(resolveTalentLevelsForDps({
      constellation: 6,
      talentLevels: { auto: 10, skill: null, burst: 13 },
    }, venti)).toEqual({
      auto: 10,
      skill: 10,
      burst: 13,
    });
  });

  it('formats empty talent labels', () => {
    expect(formatTalentLevelsLabel({ auto: 10, skill: null, burst: 13 })).toBe('10/—/13');
  });
});
