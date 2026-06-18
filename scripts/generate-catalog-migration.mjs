import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CHARACTERS } from '../src/characters.js';

const ARTIFACT_SETS = [
  { id: 'crimson', name: 'Crimson Witch of Flames', bonus2: 'Pyro DMG +15%', bonus4: 'Increases Overloaded, Burning, and Pyro DMG by 40%' },
  { id: 'shimenawa', name: "Shimenawa's Reminiscence", bonus2: 'ATK +18%', bonus4: 'Normal/Charged/Plunging DMG +50% when off-field' },
  { id: 'emblem', name: 'Emblem of Severed Fate', bonus2: 'ER +20%', bonus4: 'Burst DMG +25% of ER (max 75%)' },
  { id: 'gladiator', name: "Gladiator's Finale", bonus2: 'ATK +18%', bonus4: 'Normal ATK DMG +35% (Sword/Claymore/Polearm)' },
  { id: 'wanderer', name: "Wanderer's Troupe", bonus2: 'Elemental Mastery +80', bonus4: 'Charged ATK DMG +35% (Catalyst/Bow)' },
  { id: 'noblesse', name: 'Noblesse Oblige', bonus2: 'Burst DMG +20%', bonus4: 'Using Burst increases party ATK by 20% for 12s' },
  { id: 'heart-of-depth', name: 'Heart of Depth', bonus2: 'Hydro DMG +15%', bonus4: 'Normal/Charged ATK DMG +30% for 15s after Skill' },
  { id: 'viridescent', name: 'Viridescent Venerer', bonus2: 'Anemo DMG +15%', bonus4: 'Swirl reduces enemy RES by 40% for 10s' },
];

const root = dirname(fileURLToPath(import.meta.url));

function esc(value) {
  return String(value).replace(/'/g, "''");
}

const charValues = CHARACTERS.map(
  (c) => `    ('${esc(c.id)}', '${esc(c.nameEn)}', '${esc(c.nameRu)}', '${esc(c.element)}', '${esc(c.weapon)}', ${c.rarity}, '${esc(c.region)}', '${esc(c.iconId || c.id)}')`,
).join(',\n');

const setValues = ARTIFACT_SETS.map(
  (s) => `    ('${esc(s.id)}', '${esc(s.name)}', '${esc(s.bonus2)}', '${esc(s.bonus4)}')`,
).join(',\n');

const sql = `-- =============================================================================
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
${charValues}
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
${setValues}
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    bonus_2pc = EXCLUDED.bonus_2pc,
    bonus_4pc = EXCLUDED.bonus_4pc;
`;

const outPath = join(root, '..', 'backend', 'supabase', 'migrations', '005_game_catalog_sync.sql');
writeFileSync(outPath, sql, 'utf8');
console.log(`Wrote ${CHARACTERS.length} characters and ${ARTIFACT_SETS.length} artifact sets to ${outPath}`);
