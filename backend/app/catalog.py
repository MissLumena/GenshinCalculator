"""Справочники персонажей и сетов артефактов (read-only)."""

GAME_CHARACTERS: list[dict] = [
    {
        'id': 'hu-tao',
        'name_en': 'Hu Tao',
        'name_ru': 'Ху Тао',
        'element': 'Pyro',
        'weapon': 'Polearm',
        'rarity': 5,
        'region': 'liyue',
    },
    {
        'id': 'ganyu',
        'name_en': 'Ganyu',
        'name_ru': 'Гань Юй',
        'element': 'Cryo',
        'weapon': 'Bow',
        'rarity': 5,
        'region': 'liyue',
    },
    {
        'id': 'raiden-shogun',
        'name_en': 'Raiden Shogun',
        'name_ru': 'Raiden',
        'element': 'Electro',
        'weapon': 'Polearm',
        'rarity': 5,
        'region': 'inazuma',
    },
    {
        'id': 'bennett',
        'name_en': 'Bennett',
        'name_ru': 'Беннет',
        'element': 'Pyro',
        'weapon': 'Sword',
        'rarity': 4,
        'region': 'mondstadt',
    },
    {
        'id': 'nicole',
        'name_en': 'Nicole',
        'name_ru': 'Николь',
        'element': 'Electro',
        'weapon': 'Catalyst',
        'rarity': 5,
        'region': 'celestia',
    },
]

ARTIFACT_SETS: list[dict] = [
    {
        'id': 'crimson',
        'name': 'Crimson Witch of Flames',
        'bonus_2pc': 'Pyro DMG +15%',
        'bonus_4pc': 'Pyro DMG +40% on reactions',
    },
    {
        'id': 'emblem',
        'name': 'Emblem of Severed Fate',
        'bonus_2pc': 'ER +20%',
        'bonus_4pc': 'Burst DMG +25% of ER',
    },
    {
        'id': 'gladiator',
        'name': "Gladiator's Finale",
        'bonus_2pc': 'ATK +18%',
        'bonus_4pc': 'Normal ATK DMG +35%',
    },
    {
        'id': 'noblesse',
        'name': 'Noblesse Oblige',
        'bonus_2pc': 'Burst DMG +20%',
        'bonus_4pc': 'Party ATK +20% after Burst',
    },
]


def find_game_character(character_id: str) -> dict | None:
    return next((c for c in GAME_CHARACTERS if c['id'] == character_id), None)


def find_artifact_set(set_id: str) -> dict | None:
    return next((s for s in ARTIFACT_SETS if s['id'] == set_id), None)
