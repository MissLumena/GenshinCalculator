import { describe, it, expect } from 'vitest';
import {
  calcCharacterAtk,
  calcTeamTotalAtk,
  buildTeamComposition,
  buildLocalTeamComposition,
  prepareTeamMemberAdd,
  mapTeamMemberRow,
} from './teamService';
describe('teamService', () => {
  it('calcCharacterAtk sums base and bonus', () => {
    expect(calcCharacterAtk(300, 100)).toBe(400);
    expect(calcCharacterAtk('250', '50')).toBe(300);
  });

  it('calcTeamTotalAtk sums filled slots', () => {
    const slots = [
      { atk: 400 },
      null,
      { atk: 350 },
      { atk: 500 },
    ];
    expect(calcTeamTotalAtk(slots)).toBe(1250);
  });

  it('mapTeamMemberRow maps join row with game_characters', () => {
    const slot = mapTeamMemberRow(
      {
        slot_index: 0,
        user_character_id: 'uc-1',
        user_characters: {
          constellation: 2,
          atk_base: 300,
          atk_bonus: 120,
          level: 90,
          game_character_id: 'hu-tao',
          game_characters: {
            id: 'hu-tao',
            name_en: 'Hu Tao',
            name_ru: 'Ху Тао',
            element: 'Pyro',
            weapon: 'Polearm',
            rarity: 5,
            region: 'liyue',
            icon_id: 'hu-tao',
          },
        },
      },
      () => null,
    );

    expect(slot.nameRu).toBe('Ху Тао');
    expect(slot.element).toBe('Pyro');
    expect(slot.constellation).toBe(2);
    expect(slot.atk).toBe(420);
  });

  it('buildTeamComposition fills slots by index', () => {
    const result = buildTeamComposition(
      [
        {
          slot_index: 1,
          user_character_id: 'uc-2',
          user_characters: {
            constellation: 0,
            atk_base: 200,
            atk_bonus: 50,
            level: 80,
            game_character_id: 'ganyu',
            game_characters: {
              id: 'ganyu',
              name_en: 'Ganyu',
              name_ru: 'Гань Юй',
              element: 'Cryo',
              weapon: 'Bow',
              rarity: 5,
              region: 'liyue',
              icon_id: 'ganyu',
            },
          },
        },
      ],
      () => null,
    );

    expect(result.slots[0]).toBeNull();
    expect(result.slots[1]?.nameRu).toBe('Гань Юй');
    expect(result.totalAtk).toBe(250);
  });

  it('buildLocalTeamComposition works from app state', () => {
    const char = {
      id: 'bennett',
      name: 'Bennett',
      nameRu: 'Беннет',
      element: 'Pyro',
      weapon: 'Sword',
      rarity: 4,
      region: 'mondstadt',
      iconId: 'bennett',
    };

    const result = buildLocalTeamComposition(
      ['bennett', null, null, null],
      [{
        characterId: 'bennett',
        level: 90,
        constellation: 6,
        atk: { base: 300, bonus: 100 },
      }],
      (id) => (id === 'bennett' ? char : null),
    );

    expect(result.slots[0]?.nameRu).toBe('Беннет');
    expect(result.slots[0]?.constellation).toBe(6);
    expect(result.slots[0]?.element).toBe('Pyro');
    expect(result.totalAtk).toBe(400);
  });

  it('buildLocalTeamComposition shows new member before server sync', () => {
    const char = {
      id: 'venti',
      name: 'Venti',
      nameRu: 'Венти',
      element: 'Anemo',
      weapon: 'Bow',
      rarity: 5,
      region: 'mondstadt',
      iconId: 'venti',
    };
    const config = {
      characterId: 'venti',
      level: 90,
      constellation: 0,
      atk: { base: 280, bonus: 90 },
    };

    const result = buildLocalTeamComposition(
      ['venti', null, null, null],
      [config],
      (id) => (id === 'venti' ? char : null),
    );

    expect(result.slots[0]?.characterId).toBe('venti');
    expect(result.slots[0]?.nameRu).toBe('Венти');
    expect(result.totalAtk).toBe(370);
  });

  it('buildLocalTeamComposition returns empty slot when config is missing', () => {
    const char = {
      id: 'venti',
      name: 'Venti',
      nameRu: 'Венти',
      element: 'Anemo',
      weapon: 'Bow',
      rarity: 5,
      region: 'mondstadt',
      iconId: 'venti',
    };

    const result = buildLocalTeamComposition(
      ['venti', null, null, null],
      [],
      (id) => (id === 'venti' ? char : null),
    );

    expect(result.slots[0]).toBeNull();
    expect(result.totalAtk).toBe(0);
  });

  it('prepareTeamMemberAdd updates team and configs immediately', () => {
    const defaultConfig = {
      characterId: 'venti',
      level: 90,
      constellation: 0,
      atk: { base: 280, bonus: 90 },
    };

    const { nextTeam, nextConfigs } = prepareTeamMemberAdd(
      [null, null, null, null],
      [],
      0,
      'venti',
      defaultConfig,
    );

    const result = buildLocalTeamComposition(
      nextTeam,
      nextConfigs,
      (id) => (id === 'venti' ? { id: 'venti', name: 'Venti', nameRu: 'Венти', element: 'Anemo' } : null),
    );

    expect(nextTeam[0]).toBe('venti');
    expect(result.slots[0]?.nameRu).toBe('Венти');
  });
});
