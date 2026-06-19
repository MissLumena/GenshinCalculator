-- =============================================================================
-- Migration 005 — синхронизация справочников game_characters и artifact_sets
-- Запуск: Supabase SQL Editor или supabase db push
-- =============================================================================

CREATE OR REPLACE FUNCTION public.upsert_game_character(
    p_id TEXT,
    p_name_en TEXT,
    p_name_ru TEXT,
    p_element TEXT,
    p_weapon TEXT,
    p_rarity SMALLINT,
    p_region TEXT,
    p_icon_id TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.game_characters (
        id, name_en, name_ru, element, weapon, rarity, region, icon_id
    )
    VALUES (
        p_id, p_name_en, p_name_ru, p_element, p_weapon, p_rarity, p_region,
        COALESCE(p_icon_id, p_id)
    )
    ON CONFLICT (id) DO UPDATE SET
        name_en = EXCLUDED.name_en,
        name_ru = EXCLUDED.name_ru,
        element = EXCLUDED.element,
        weapon = EXCLUDED.weapon,
        rarity = EXCLUDED.rarity,
        region = EXCLUDED.region,
        icon_id = EXCLUDED.icon_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_artifact_set(
    p_id TEXT,
    p_name TEXT,
    p_bonus_2pc TEXT,
    p_bonus_4pc TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.artifact_sets (id, name, bonus_2pc, bonus_4pc)
    VALUES (p_id, p_name, p_bonus_2pc, p_bonus_4pc)
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        bonus_2pc = EXCLUDED.bonus_2pc,
        bonus_4pc = EXCLUDED.bonus_4pc;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_game_character(
    TEXT, TEXT, TEXT, TEXT, TEXT, SMALLINT, TEXT, TEXT
) TO authenticated, anon;

GRANT EXECUTE ON FUNCTION public.upsert_artifact_set(
    TEXT, TEXT, TEXT, TEXT
) TO authenticated, anon;

INSERT INTO public.game_characters (id, name_en, name_ru, element, weapon, rarity, region, icon_id)
VALUES
    ('traveler', 'Traveler', 'Путешественник', 'Anemo', 'Sword', 5, 'special', 'traveler-anemo'),
    ('aloy', 'Aloy', 'Элой', 'Cryo', 'Bow', 5, 'special', 'aloy'),
    ('skirk', 'Skirk', 'Скирк', 'Cryo', 'Sword', 5, 'special', 'skirk'),
    ('mannequin', 'Training Dummy', 'Манекен', 'Physical', 'Polearm', 1, 'special', 'mannequin'),
    ('albedo', 'Albedo', 'Альбедо', 'Geo', 'Sword', 5, 'mondstadt', 'albedo'),
    ('barbara', 'Barbara', 'Барбара', 'Hydro', 'Catalyst', 4, 'mondstadt', 'barbara'),
    ('bennett', 'Bennett', 'Беннет', 'Pyro', 'Sword', 4, 'mondstadt', 'bennett'),
    ('venti', 'Venti', 'Венти', 'Anemo', 'Bow', 5, 'mondstadt', 'venti'),
    ('jean', 'Jean', 'Джинн', 'Anemo', 'Sword', 5, 'mondstadt', 'jean'),
    ('diluc', 'Diluc', 'Дилюк', 'Pyro', 'Claymore', 5, 'mondstadt', 'diluc'),
    ('diona', 'Diona', 'Диона', 'Cryo', 'Bow', 4, 'mondstadt', 'diona'),
    ('klee', 'Klee', 'Кли', 'Pyro', 'Catalyst', 5, 'mondstadt', 'klee'),
    ('kaeya', 'Kaeya', 'Кэйa', 'Cryo', 'Sword', 4, 'mondstadt', 'kaeya'),
    ('lisa', 'Lisa', 'Лиза', 'Electro', 'Catalyst', 4, 'mondstadt', 'lisa'),
    ('mika', 'Mika', 'Мика', 'Cryo', 'Polearm', 4, 'mondstadt', 'mika'),
    ('mona', 'Mona', 'Мона', 'Hydro', 'Catalyst', 5, 'mondstadt', 'mona'),
    ('noelle', 'Noelle', 'Ноэлль', 'Geo', 'Claymore', 4, 'mondstadt', 'noelle'),
    ('rosaria', 'Rosaria', 'Розария', 'Cryo', 'Polearm', 4, 'mondstadt', 'rosaria'),
    ('razor', 'Razor', 'Рэйзор', 'Electro', 'Claymore', 4, 'mondstadt', 'razor'),
    ('sucrose', 'Sucrose', 'Сахароза', 'Anemo', 'Catalyst', 4, 'mondstadt', 'sucrose'),
    ('fischl', 'Fischl', 'Фишль', 'Electro', 'Bow', 4, 'mondstadt', 'fischl'),
    ('amber', 'Amber', 'Эмбер', 'Pyro', 'Bow', 4, 'mondstadt', 'amber'),
    ('eula', 'Eula', 'Эола', 'Cryo', 'Claymore', 5, 'mondstadt', 'eula'),
    ('dahlia', 'Dahlia', 'Далия', 'Hydro', 'Sword', 4, 'mondstadt', 'dahlia'),
    ('durin', 'Durin', 'Дурин', 'Pyro', 'Sword', 5, 'mondstadt', 'durin'),
    ('varka', 'Varka', 'Варка', 'Anemo', 'Claymore', 5, 'mondstadt', 'varka'),
    ('pulonia', 'Pulonia', 'Прюн', 'Anemo', 'Catalyst', 4, 'mondstadt', 'pulonia'),
    ('loen', 'Loen', 'Лоэн', 'Cryo', 'Polearm', 5, 'mondstadt', 'loen'),
    ('baizhu', 'Baizhu', 'Бай Чжу', 'Dendro', 'Catalyst', 5, 'liyue', 'baizhu'),
    ('beidou', 'Beidou', 'Бэй Доу', 'Electro', 'Claymore', 4, 'liyue', 'beidou'),
    ('ganyu', 'Ganyu', 'Гань Юй', 'Cryo', 'Bow', 5, 'liyue', 'ganyu'),
    ('yelan', 'Yelan', 'Е Лань', 'Hydro', 'Bow', 5, 'liyue', 'yelan'),
    ('keqing', 'Keqing', 'Кэ Цин', 'Electro', 'Sword', 5, 'liyue', 'keqing'),
    ('ningguang', 'Ningguang', 'Нин Гуан', 'Geo', 'Catalyst', 4, 'liyue', 'ningguang'),
    ('xingqiu', 'Xingqiu', 'Син Цю', 'Hydro', 'Sword', 4, 'liyue', 'xingqiu'),
    ('xinyan', 'Xinyan', 'Синь Янь', 'Pyro', 'Claymore', 4, 'liyue', 'xinyan'),
    ('xiangling', 'Xiangling', 'Сян Лин', 'Pyro', 'Polearm', 4, 'liyue', 'xiangling'),
    ('xiao', 'Xiao', 'Сяо', 'Anemo', 'Polearm', 5, 'liyue', 'xiao'),
    ('hu-tao', 'Hu Tao', 'Ху Тао', 'Pyro', 'Polearm', 5, 'liyue', 'hu-tao'),
    ('qiqi', 'Qiqi', 'Ци Ци', 'Cryo', 'Sword', 5, 'liyue', 'qiqi'),
    ('zhongli', 'Zhongli', 'Чжун Ли', 'Geo', 'Polearm', 5, 'liyue', 'zhongli'),
    ('chongyun', 'Chongyun', 'Чун Юнь', 'Cryo', 'Claymore', 4, 'liyue', 'chongyun'),
    ('shenhe', 'Shenhe', 'Шэнь Хэ', 'Cryo', 'Polearm', 5, 'liyue', 'shenhe'),
    ('yun-jin', 'Yun Jin', 'Юнь Цзинь', 'Geo', 'Polearm', 4, 'liyue', 'yun-jin'),
    ('yanfei', 'Yanfei', 'Янь Фэй', 'Pyro', 'Catalyst', 4, 'liyue', 'yanfei'),
    ('yaoyao', 'Yaoyao', 'Яо Яо', 'Dendro', 'Polearm', 4, 'liyue', 'yaoyao'),
    ('xianyun', 'Xianyun', 'СяньЮнь', 'Anemo', 'Catalyst', 5, 'liyue', 'xianyun'),
    ('gaming', 'Gaming', 'Ка Мин', 'Pyro', 'Claymore', 4, 'liyue', 'gaming'),
    ('lan-yan', 'Lan Yan', 'Лань Янь', 'Anemo', 'Catalyst', 4, 'liyue', 'lan-yan'),
    ('zibai', 'Zibai', 'Цзы Бай', 'Geo', 'Sword', 5, 'liyue', 'zibai'),
    ('kamisato-ayaka', 'Ayaka', 'Аяка', 'Cryo', 'Sword', 5, 'inazuma', 'kamisato-ayaka'),
    ('kamisato-ayato', 'Ayato', 'Аято', 'Hydro', 'Sword', 5, 'inazuma', 'kamisato-ayato'),
    ('gorou', 'Gorou', 'Горо', 'Geo', 'Bow', 4, 'inazuma', 'gorou'),
    ('yae-miko', 'Yae Miko', 'Яэ Мико', 'Electro', 'Catalyst', 5, 'inazuma', 'yae-miko'),
    ('yoimiya', 'Yoimiya', 'Ёимия', 'Pyro', 'Bow', 5, 'inazuma', 'yoimiya'),
    ('kaedehara-kazuha', 'Kazuha', 'Кадзуха', 'Anemo', 'Sword', 5, 'inazuma', 'kaedehara-kazuha'),
    ('kuki-shinobu', 'Kuki Shinobu', 'Синобу', 'Electro', 'Sword', 4, 'inazuma', 'kuki-shinobu'),
    ('raiden-shogun', 'Raiden Shogun', 'Рейден', 'Electro', 'Polearm', 5, 'inazuma', 'raiden-shogun'),
    ('kujou-sara', 'Sara', 'Сара', 'Electro', 'Bow', 4, 'inazuma', 'kujou-sara'),
    ('sayu', 'Sayu', 'Саю', 'Anemo', 'Claymore', 4, 'inazuma', 'sayu'),
    ('thoma', 'Thoma', 'Тома', 'Pyro', 'Polearm', 4, 'inazuma', 'thoma'),
    ('shikanoin-heizou', 'Heizou', 'Хейдзо', 'Anemo', 'Catalyst', 4, 'inazuma', 'shikanoin-heizou'),
    ('kirara', 'Kirara', 'Кирара', 'Dendro', 'Sword', 4, 'inazuma', 'kirara'),
    ('sangonomiya-kokomi', 'Kokomi', 'Кокоми', 'Hydro', 'Catalyst', 5, 'inazuma', 'sangonomiya-kokomi'),
    ('alhaitham', 'Alhaitham', 'Аль-Хайтам', 'Dendro', 'Sword', 5, 'sumeru', 'alhaitham'),
    ('tighnari', 'Tighnari', 'Тигнари', 'Dendro', 'Bow', 5, 'sumeru', 'tighnari'),
    ('collei', 'Collei', 'Коллеи', 'Dendro', 'Bow', 4, 'sumeru', 'collei'),
    ('nilou', 'Nilou', 'Нилоу', 'Hydro', 'Sword', 5, 'sumeru', 'nilou'),
    ('candace', 'Candace', 'Кандак', 'Hydro', 'Polearm', 4, 'sumeru', 'candace'),
    ('layla', 'Layla', 'Лайла', 'Cryo', 'Sword', 4, 'sumeru', 'layla'),
    ('nahida', 'Nahida', 'Нахида', 'Dendro', 'Catalyst', 5, 'sumeru', 'nahida'),
    ('wanderer', 'Wanderer', 'Бродяга', 'Anemo', 'Catalyst', 5, 'sumeru', 'wanderer'),
    ('faruzan', 'Faruzan', 'Фарузан', 'Anemo', 'Bow', 4, 'sumeru', 'faruzan'),
    ('sethos', 'Sethos', 'Сефос', 'Electro', 'Bow', 4, 'sumeru', 'sethos'),
    ('lyney', 'Lyney', 'Лини', 'Pyro', 'Bow', 5, 'fontaine', 'lyney'),
    ('lynette', 'Lynette', 'Линетт', 'Anemo', 'Sword', 4, 'fontaine', 'lynette'),
    ('freminet', 'Freminet', 'Фремине', 'Cryo', 'Claymore', 4, 'fontaine', 'freminet'),
    ('neuvillette', 'Neuvillette', 'Нёвиллет', 'Hydro', 'Catalyst', 5, 'fontaine', 'neuvillette'),
    ('wriothesley', 'Wriothesley', 'Ризли', 'Cryo', 'Catalyst', 5, 'fontaine', 'wriothesley'),
    ('furina', 'Furina', 'Фурина', 'Hydro', 'Sword', 5, 'fontaine', 'furina'),
    ('charlotte', 'Charlotte', 'Шарлотта', 'Cryo', 'Catalyst', 4, 'fontaine', 'charlotte'),
    ('navia', 'Navia', 'Навия', 'Geo', 'Claymore', 5, 'fontaine', 'navia'),
    ('chevreuse', 'Chevreuse', 'Шеврёз', 'Pyro', 'Polearm', 4, 'fontaine', 'chevreuse'),
    ('clorinde', 'Clorinde', 'Клоринда', 'Electro', 'Sword', 5, 'fontaine', 'clorinde'),
    ('sigewinne', 'Sigewinne', 'Сиджвин', 'Hydro', 'Bow', 5, 'fontaine', 'sigewinne'),
    ('emilie', 'Emilie', 'Эмилия', 'Dendro', 'Polearm', 5, 'fontaine', 'emilie'),
    ('escoffier', 'Escoffier', 'Эскофье', 'Cryo', 'Polearm', 5, 'fontaine', 'escoffier'),
    ('mualani', 'Mualani', 'Муалани', 'Hydro', 'Catalyst', 5, 'natlan', 'mualani'),
    ('kachina', 'Kachina', 'Качина', 'Geo', 'Polearm', 4, 'natlan', 'kachina'),
    ('kinich', 'Kinich', 'Кинич', 'Dendro', 'Claymore', 5, 'natlan', 'kinich'),
    ('xilonen', 'Xilonen', 'Шилонен', 'Geo', 'Sword', 5, 'natlan', 'xilonen'),
    ('ororon', 'Ororon', 'Оророн', 'Electro', 'Bow', 4, 'natlan', 'ororon'),
    ('chasca', 'Chasca', 'Часка', 'Anemo', 'Bow', 5, 'natlan', 'chasca'),
    ('mavuika', 'Mavuika', 'Мавуика', 'Pyro', 'Claymore', 5, 'natlan', 'mavuika'),
    ('citlali', 'Citlali', 'Ситлали', 'Cryo', 'Catalyst', 5, 'natlan', 'citlali'),
    ('iansan', 'Iansan', 'Иансан', 'Electro', 'Polearm', 4, 'natlan', 'iansan'),
    ('ineffa', 'Ineffa', 'Инеффа', 'Electro', 'Polearm', 5, 'nodkrai', 'ineffa'),
    ('lauma', 'Lauma', 'Лаума', 'Dendro', 'Catalyst', 5, 'nodkrai', 'lauma'),
    ('aino', 'Aino', 'Айно', 'Hydro', 'Bow', 4, 'nodkrai', 'aino'),
    ('flins', 'Flins', 'Флинс', 'Electro', 'Polearm', 5, 'nodkrai', 'flins'),
    ('nefer', 'Nefer', 'Нефер', 'Dendro', 'Catalyst', 5, 'nodkrai', 'nefer'),
    ('yagoda', 'Yagoda', 'Ягода', 'Anemo', 'Catalyst', 4, 'nodkrai', 'yagoda'),
    ('columbina', 'Columbina', 'Коломбина', 'Hydro', 'Catalyst', 5, 'nodkrai', 'columbina'),
    ('illuga', 'Illuga', 'Иллуги', 'Geo', 'Polearm', 4, 'nodkrai', 'illuga'),
    ('linnea', 'Linnea', 'Линнея', 'Anemo', 'Bow', 5, 'nodkrai', 'linnea'),
    ('tartaglia', 'Tartaglia', 'Тарталья', 'Hydro', 'Bow', 5, 'snezhnaya', 'tartaglia'),
    ('arlecchino', 'Arlecchino', 'Арлекино', 'Pyro', 'Polearm', 5, 'snezhnaya', 'arlecchino'),
    ('nicole', 'Nicole', 'Николь', 'Electro', 'Catalyst', 5, 'celestia', 'nicole')
ON CONFLICT (id) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_ru = EXCLUDED.name_ru,
    element = EXCLUDED.element,
    weapon = EXCLUDED.weapon,
    rarity = EXCLUDED.rarity,
    region = EXCLUDED.region,
    icon_id = EXCLUDED.icon_id;

INSERT INTO public.artifact_sets (id, name, bonus_2pc, bonus_4pc)
VALUES
    ('crimson', 'Crimson Witch of Flames', 'Pyro DMG +15%', 'Increases Overloaded, Burning, and Pyro DMG by 40%'),
    ('shimenawa', 'Shimenawa''s Reminiscence', 'ATK +18%', 'Normal/Charged/Plunging DMG +50% when off-field'),
    ('emblem', 'Emblem of Severed Fate', 'ER +20%', 'Burst DMG +25% of ER (max 75%)'),
    ('gladiator', 'Gladiator''s Finale', 'ATK +18%', 'Normal ATK DMG +35% (Sword/Claymore/Polearm)'),
    ('wanderer', 'Wanderer''s Troupe', 'Elemental Mastery +80', 'Charged ATK DMG +35% (Catalyst/Bow)'),
    ('noblesse', 'Noblesse Oblige', 'Burst DMG +20%', 'Using Burst increases party ATK by 20% for 12s'),
    ('heart-of-depth', 'Heart of Depth', 'Hydro DMG +15%', 'Normal/Charged ATK DMG +30% for 15s after Skill'),
    ('viridescent', 'Viridescent Venerer', 'Anemo DMG +15%', 'Swirl reduces enemy RES by 40% for 10s')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    bonus_2pc = EXCLUDED.bonus_2pc,
    bonus_4pc = EXCLUDED.bonus_4pc;
