import { describe, it, expect } from 'vitest';
import {
  dbCharacterToFrontend,
  dbArtifactSetToFrontend,
  dbRowToConfig,
  configToDbRow,
  mergeCharacters,
} from './mappers';

describe('mappers', () => {
  it('dbCharacterToFrontend maps database row', () => {
    const result = dbCharacterToFrontend({
      id: 'hu-tao',
      name_en: 'Hu Tao',
      name_ru: 'Ху Тао',
      element: 'Pyro',
      weapon: 'Polearm',
      rarity: 5,
      region: 'liyue',
      icon_id: 'hu-tao',
    });

    expect(result.id).toBe('hu-tao');
    expect(result.nameRu).toBe('Ху Тао');
    expect(result.nameEn).toBe('Hu Tao');
    expect(result.iconId).toBe('hu-tao');
  });

  it('dbCharacterToFrontend applies Russian name override when DB name_ru is English', () => {
    const result = dbCharacterToFrontend({
      id: 'furina',
      name_en: 'Furina',
      name_ru: 'Furina',
      element: 'Hydro',
      weapon: 'Sword',
      rarity: 5,
      region: 'fontaine',
      icon_id: 'furina',
    });

    expect(result.nameRu).toBe('Фурина');
    expect(result.nameEn).toBe('Furina');
  });

  it('dbArtifactSetToFrontend maps artifact set row', () => {
    const result = dbArtifactSetToFrontend({
      id: 'crimson',
      name: 'Crimson Witch',
      bonus_2pc: 'Pyro +15%',
      bonus_4pc: 'Pyro +40%',
    });

    expect(result.id).toBe('crimson-witch-of-flames');
    expect(result.bonus2).toBe('Pyro +15%');
    expect(result.bonus4).toBe('Pyro +40%');
  });

  it('dbRowToConfig prefers artifacts_summary when present', () => {
    const config = dbRowToConfig(
      {
        id: 'uuid-1',
        game_character_id: 'alhaitham',
        level: 90,
        atk_base: 300,
        atk_bonus: 100,
        hp: 18000,
        defense: 800,
        em: 100,
        energy_recharge: 120,
        crit_rate: 50,
        crit_dmg: 120,
        constellation: 2,
        artifacts_summary: {
          set: 'emblem',
          set2: 'noblesse-oblige',
          hp: 100,
          critRate: 60,
          critDmg: 140,
          atkPercent: 50,
          em: 80,
        },
      },
      [],
    );

    expect(config.artifacts.set).toBe('emblem-of-severed-fate');
    expect(config.artifacts.set2).toBe('noblesse-oblige');
    expect(config.artifacts.critRate).toBe(60);
  });

  it('dbRowToConfig converts user character with artifacts', () => {
    const config = dbRowToConfig(
      {
        id: 'uuid-1',
        game_character_id: 'ganyu',
        level: 80,
        atk_base: 200,
        atk_bonus: 50,
        hp: 15000,
        defense: 700,
        em: 80,
        energy_recharge: 120,
        crit_rate: 60,
        crit_dmg: 140,
        constellation: 2,
      },
      [
        {
          slot: 'flower',
          set_id: 'emblem',
          main_stat: 'HP',
          substats: [{ stat: 'CRIT Rate', value: 3.5 }],
        },
        { slot: 'plume', set_id: 'emblem', main_stat: 'ATK', substats: [] },
        { slot: 'sands', set_id: 'emblem', main_stat: 'ATK%', substats: [] },
        { slot: 'goblet', set_id: 'emblem', main_stat: 'ATK%', substats: [] },
        { slot: 'circlet', set_id: 'emblem', main_stat: 'CRIT Rate', substats: [] },
      ],
    );

    expect(config.characterId).toBe('ganyu');
    expect(config.atk.base).toBe(200);
    expect(config.artifacts.set).toBe('emblem-of-severed-fate');
    expect(config.artifacts.em).toBe(0);
  });

  it('configToDbRow converts config for insert', () => {
    const row = configToDbRow(
      {
        characterId: 'bennett',
        level: 90,
        atk: { base: 300, bonus: 100 },
        hp: 18000,
        def: 800,
        em: 100,
        critRate: 50,
        critDmg: 120,
        energyRecharge: 120,
        constellation: 0,
        equippedWeaponId: 'staff-of-homa',
        artifacts: {
          set: 'crimson-witch-of-flames',
          set2: 'emblem-of-severed-fate',
          hp: 0,
          critRate: 0,
          critDmg: 0,
          atkPercent: 0,
          em: 0,
        },
      },
      'user-uuid',
    );

    expect(row.user_id).toBe('user-uuid');
    expect(row.game_character_id).toBe('bennett');
    expect(row.artifacts_summary._equippedWeaponId).toBe('staff-of-homa');
    expect(row.artifacts_summary.set).toBe('crimson-witch-of-flames');
    expect(row.artifacts_summary.set2).toBe('emblem-of-severed-fate');
  });

  it('dbRowToConfig restores equipped weapon from artifacts_summary', () => {
    const config = dbRowToConfig({
      id: 'uuid-1',
      game_character_id: 'zhongli',
      level: 90,
      atk_base: 300,
      atk_bonus: 100,
      hp: 18000,
      defense: 800,
      em: 100,
      energy_recharge: 120,
      crit_rate: 50,
      crit_dmg: 120,
      constellation: 0,
      artifacts_summary: {
        set: 'emblem',
        hp: 0,
        critRate: 0,
        critDmg: 0,
        atkPercent: 0,
        em: 0,
        _equippedWeaponId: 'vortex-vanquisher',
      },
    });

    expect(config.equippedWeaponId).toBe('vortex-vanquisher');
    expect(config.artifacts.set).toBe('emblem-of-severed-fate');
  });

  it('mergeCharacters prefers database entries and keeps local-only chars', () => {
    const db = [
      {
        id: 'hu-tao',
        name: 'Hu Tao DB',
        nameRu: 'Ху Тао DB',
        element: 'Pyro',
        weapon: 'Polearm',
        rarity: 5,
        region: 'liyue',
        iconId: 'hu-tao',
      },
    ];
    const local = [
      {
        id: 'hu-tao',
        name: 'Hu Tao',
        nameRu: 'Ху Тао',
        element: 'Pyro',
        weapon: 'Polearm',
        rarity: 5,
        region: 'liyue',
        iconId: 'hu-tao',
      },
      {
        id: 'ganyu',
        name: 'Ganyu',
        nameRu: 'Гань Юй',
        element: 'Cryo',
        weapon: 'Bow',
        rarity: 5,
        region: 'liyue',
        iconId: 'ganyu',
      },
    ];

    const merged = mergeCharacters(db, local);
    expect(merged).toHaveLength(2);
    expect(merged[0].name).toBe('Hu Tao DB');
    expect(merged[1].id).toBe('ganyu');
  });
});
