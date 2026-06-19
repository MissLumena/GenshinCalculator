-- =============================================================================
-- Genshin DPS Calculator — схема Supabase
-- Вставьте целиком в SQL Editor → Run (новый проект)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Таблицы
-- ---------------------------------------------------------------------------

-- Профиль пользователя (расширение auth.users)
CREATE TABLE public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    display_name TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Справочник персонажей игры (общий, read-only)
CREATE TABLE public.game_characters (
    id       TEXT PRIMARY KEY,
    name_en  TEXT NOT NULL,
    name_ru  TEXT NOT NULL,
    element  TEXT NOT NULL,
    weapon   TEXT NOT NULL,
    rarity   SMALLINT NOT NULL CHECK (rarity IN (1, 4, 5)),
    region   TEXT NOT NULL,
    icon_id  TEXT
);

-- Справочник сетов артефактов (общий, read-only)
CREATE TABLE public.artifact_sets (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    bonus_2pc TEXT NOT NULL,
    bonus_4pc TEXT NOT NULL
);

-- Настроенный персонаж пользователя
CREATE TABLE public.user_characters (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    game_character_id TEXT NOT NULL REFERENCES public.game_characters (id),
    nickname         TEXT,
    level            SMALLINT NOT NULL DEFAULT 90 CHECK (level BETWEEN 1 AND 90),
    atk_base         NUMERIC NOT NULL DEFAULT 0 CHECK (atk_base >= 0),
    atk_bonus        NUMERIC NOT NULL DEFAULT 0 CHECK (atk_bonus >= 0),
    hp               NUMERIC NOT NULL DEFAULT 0 CHECK (hp >= 0),
    defense          NUMERIC NOT NULL DEFAULT 0 CHECK (defense >= 0),
    em               NUMERIC NOT NULL DEFAULT 0 CHECK (em >= 0),
    energy_recharge  NUMERIC NOT NULL DEFAULT 100 CHECK (energy_recharge >= 0),
    crit_rate        NUMERIC NOT NULL DEFAULT 5 CHECK (crit_rate >= 0 AND crit_rate <= 100),
    crit_dmg         NUMERIC NOT NULL DEFAULT 50 CHECK (crit_dmg >= 0),
    constellation    SMALLINT NOT NULL DEFAULT 0 CHECK (constellation BETWEEN 0 AND 6),
    artifacts_summary JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, game_character_id)
);

CREATE INDEX idx_user_characters_user_id ON public.user_characters (user_id);
CREATE INDEX idx_user_characters_game_id ON public.user_characters (game_character_id);

-- Артефакты персонажа (5 слотов)
CREATE TABLE public.character_artifacts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_character_id UUID NOT NULL REFERENCES public.user_characters (id) ON DELETE CASCADE,
    slot              TEXT NOT NULL CHECK (slot IN ('flower', 'plume', 'sands', 'goblet', 'circlet')),
    set_id            TEXT NOT NULL REFERENCES public.artifact_sets (id),
    main_stat         TEXT NOT NULL,
    substats          JSONB NOT NULL DEFAULT '[]'::JSONB,
    UNIQUE (user_character_id, slot)
);

CREATE INDEX idx_character_artifacts_char ON public.character_artifacts (user_character_id);

-- Команда пользователя
CREATE TABLE public.teams (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    rotation_seconds NUMERIC NOT NULL DEFAULT 20 CHECK (rotation_seconds > 0),
    is_default       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_teams_one_default_per_user
    ON public.teams (user_id)
    WHERE is_default = TRUE;

CREATE INDEX idx_teams_user_id ON public.teams (user_id);

-- Участники команды (до 4 персонажей + порядок ротации)
CREATE TABLE public.team_members (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id           UUID NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
    user_character_id UUID NOT NULL REFERENCES public.user_characters (id) ON DELETE RESTRICT,
    slot_index        SMALLINT NOT NULL CHECK (slot_index BETWEEN 0 AND 3),
    rotation_order    SMALLINT NOT NULL CHECK (rotation_order BETWEEN 1 AND 4),
    UNIQUE (team_id, slot_index),
    UNIQUE (team_id, user_character_id)
);

CREATE INDEX idx_team_members_team ON public.team_members (team_id);

ALTER TABLE public.profiles
    ADD COLUMN active_team_id UUID REFERENCES public.teams (id) ON DELETE SET NULL;

CREATE INDEX idx_profiles_active_team ON public.profiles (active_team_id);

-- Снимок билда для сравнения
CREATE TABLE public.builds (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    name                     TEXT NOT NULL,
    game_character_id        TEXT REFERENCES public.game_characters (id),
    source_user_character_id UUID REFERENCES public.user_characters (id) ON DELETE SET NULL,
    team_id                  UUID REFERENCES public.teams (id) ON DELETE SET NULL,
    snapshot                 JSONB NOT NULL,
    team_snapshot            JSONB,
    calculated_dps           JSONB,
    rotation_seconds         NUMERIC CHECK (rotation_seconds IS NULL OR rotation_seconds > 0),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_builds_user_id ON public.builds (user_id);
CREATE INDEX idx_builds_team_id ON public.builds (team_id);

-- ---------------------------------------------------------------------------
-- 2. Триггеры: updated_at + профиль при регистрации
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_characters_updated
    BEFORE UPDATE ON public.user_characters
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_teams_updated
    BEFORE UPDATE ON public.teams
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. Row Level Security (RLS)
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifact_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.builds ENABLE ROW LEVEL SECURITY;

-- profiles: только свой профиль
CREATE POLICY "profiles_select_own"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Справочники: чтение всем (в т.ч. anon — для каталога на лендинге)
CREATE POLICY "game_characters_select_all"
    ON public.game_characters FOR SELECT
    TO anon, authenticated
    USING (TRUE);

CREATE POLICY "artifact_sets_select_all"
    ON public.artifact_sets FOR SELECT
    TO anon, authenticated
    USING (TRUE);

-- user_characters: только свои записи
CREATE POLICY "user_characters_select_own"
    ON public.user_characters FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "user_characters_insert_own"
    ON public.user_characters FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_characters_update_own"
    ON public.user_characters FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_characters_delete_own"
    ON public.user_characters FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- character_artifacts: через владельца персонажа
CREATE POLICY "character_artifacts_select_own"
    ON public.character_artifacts FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_characters uc
            WHERE uc.id = character_artifacts.user_character_id
              AND uc.user_id = auth.uid()
        )
    );

CREATE POLICY "character_artifacts_insert_own"
    ON public.character_artifacts FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_characters uc
            WHERE uc.id = character_artifacts.user_character_id
              AND uc.user_id = auth.uid()
        )
    );

CREATE POLICY "character_artifacts_update_own"
    ON public.character_artifacts FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_characters uc
            WHERE uc.id = character_artifacts.user_character_id
              AND uc.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_characters uc
            WHERE uc.id = character_artifacts.user_character_id
              AND uc.user_id = auth.uid()
        )
    );

CREATE POLICY "character_artifacts_delete_own"
    ON public.character_artifacts FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_characters uc
            WHERE uc.id = character_artifacts.user_character_id
              AND uc.user_id = auth.uid()
        )
    );

-- teams: только свои
CREATE POLICY "teams_select_own"
    ON public.teams FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "teams_insert_own"
    ON public.teams FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "teams_update_own"
    ON public.teams FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "teams_delete_own"
    ON public.teams FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- team_members: только если команда принадлежит пользователю
CREATE POLICY "team_members_select_own"
    ON public.team_members FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.teams t
            WHERE t.id = team_members.team_id
              AND t.user_id = auth.uid()
        )
    );

CREATE POLICY "team_members_insert_own"
    ON public.team_members FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.teams t
            WHERE t.id = team_members.team_id
              AND t.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM public.user_characters uc
            WHERE uc.id = team_members.user_character_id
              AND uc.user_id = auth.uid()
        )
    );

CREATE POLICY "team_members_update_own"
    ON public.team_members FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.teams t
            WHERE t.id = team_members.team_id
              AND t.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.teams t
            WHERE t.id = team_members.team_id
              AND t.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM public.user_characters uc
            WHERE uc.id = team_members.user_character_id
              AND uc.user_id = auth.uid()
        )
    );

CREATE POLICY "team_members_delete_own"
    ON public.team_members FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.teams t
            WHERE t.id = team_members.team_id
              AND t.user_id = auth.uid()
        )
    );

-- builds: только свои
CREATE POLICY "builds_select_own"
    ON public.builds FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "builds_insert_own"
    ON public.builds FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "builds_delete_own"
    ON public.builds FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. Минимальные seed-данные (справочники)
-- ---------------------------------------------------------------------------

INSERT INTO public.game_characters (id, name_en, name_ru, element, weapon, rarity, region, icon_id)
VALUES
    ('hu-tao', 'Hu Tao', 'Ху Тао', 'Pyro', 'Polearm', 5, 'liyue', 'hu-tao'),
    ('ganyu', 'Ganyu', 'Гань Юй', 'Cryo', 'Bow', 5, 'liyue', 'ganyu'),
    ('raiden-shogun', 'Raiden Shogun', 'Raiden', 'Electro', 'Polearm', 5, 'inazuma', 'raiden'),
    ('bennett', 'Bennett', 'Беннет', 'Pyro', 'Sword', 4, 'mondstadt', 'bennett'),
    ('nicole', 'Nicole', 'Николь', 'Electro', 'Catalyst', 5, 'celestia', 'nicole')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.artifact_sets (id, name, bonus_2pc, bonus_4pc)
VALUES
    ('crimson', 'Crimson Witch of Flames', 'Pyro DMG +15%', 'Pyro DMG +40% on reactions'),
    ('emblem', 'Emblem of Severed Fate', 'ER +20%', 'Burst DMG +25% of ER'),
    ('gladiator', 'Gladiator''s Finale', 'ATK +18%', 'Normal ATK DMG +35%'),
    ('noblesse', 'Noblesse Oblige', 'Burst DMG +20%', 'Party ATK +20% after Burst')
ON CONFLICT (id) DO NOTHING;
