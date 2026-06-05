-- =============================================================================
-- Migration 001 — улучшения схемы (запуск в Supabase SQL Editor)
-- Безопасно для уже существующего проекта: IF NOT EXISTS / проверки.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Новые поля
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS active_team_id UUID;

ALTER TABLE public.user_characters
    ADD COLUMN IF NOT EXISTS artifacts_summary JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE public.teams
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.builds
    ADD COLUMN IF NOT EXISTS team_id UUID,
    ADD COLUMN IF NOT EXISTS rotation_seconds NUMERIC;

-- FK добавляем отдельно (IF NOT EXISTS для constraint в PG нет)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_active_team_id_fkey'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_active_team_id_fkey
            FOREIGN KEY (active_team_id) REFERENCES public.teams (id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'builds_team_id_fkey'
    ) THEN
        ALTER TABLE public.builds
            ADD CONSTRAINT builds_team_id_fkey
            FOREIGN KEY (team_id) REFERENCES public.teams (id) ON DELETE SET NULL;
    END IF;
END $$;

ALTER TABLE public.builds
    DROP CONSTRAINT IF EXISTS builds_rotation_seconds_check;

ALTER TABLE public.builds
    ADD CONSTRAINT builds_rotation_seconds_check
    CHECK (rotation_seconds IS NULL OR rotation_seconds > 0);

-- ---------------------------------------------------------------------------
-- 2. Заполнить artifacts_summary (пустые останутся — фронт читает character_artifacts)
-- ---------------------------------------------------------------------------

-- При следующем сохранении персонажа фронт запишет artifacts_summary автоматически.

-- ---------------------------------------------------------------------------
-- 3. Удалить дубликаты user_characters перед UNIQUE (оставить самый новый)
-- ---------------------------------------------------------------------------

DELETE FROM public.user_characters uc
WHERE uc.id IN (
    SELECT id
    FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY user_id, game_character_id
                ORDER BY updated_at DESC, created_at DESC
            ) AS rn
        FROM public.user_characters
    ) ranked
    WHERE rn > 1
);

-- ---------------------------------------------------------------------------
-- 4. Уникальные ограничения (если ещё не созданы)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'character_artifacts_user_slot_unique'
    ) THEN
        ALTER TABLE public.character_artifacts
            ADD CONSTRAINT character_artifacts_user_slot_unique
            UNIQUE (user_character_id, slot);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'team_members_team_slot_unique'
    ) THEN
        ALTER TABLE public.team_members
            ADD CONSTRAINT team_members_team_slot_unique
            UNIQUE (team_id, slot_index);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'team_members_team_character_unique'
    ) THEN
        ALTER TABLE public.team_members
            ADD CONSTRAINT team_members_team_character_unique
            UNIQUE (team_id, user_character_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_characters_one_per_game_char'
    ) THEN
        ALTER TABLE public.user_characters
            ADD CONSTRAINT user_characters_one_per_game_char
            UNIQUE (user_id, game_character_id);
    END IF;
END $$;

-- Одна команда «по умолчанию» на пользователя
CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_one_default_per_user
    ON public.teams (user_id)
    WHERE is_default = TRUE;

-- ---------------------------------------------------------------------------
-- 5. ON DELETE для FK (если в дампе не было)
-- ---------------------------------------------------------------------------

ALTER TABLE public.character_artifacts
    DROP CONSTRAINT IF EXISTS character_artifacts_user_character_id_fkey;

ALTER TABLE public.character_artifacts
    ADD CONSTRAINT character_artifacts_user_character_id_fkey
    FOREIGN KEY (user_character_id) REFERENCES public.user_characters (id) ON DELETE CASCADE;

ALTER TABLE public.team_members
    DROP CONSTRAINT IF EXISTS team_members_user_character_id_fkey;

ALTER TABLE public.team_members
    ADD CONSTRAINT team_members_user_character_id_fkey
    FOREIGN KEY (user_character_id) REFERENCES public.user_characters (id) ON DELETE RESTRICT;

ALTER TABLE public.team_members
    DROP CONSTRAINT IF EXISTS team_members_team_id_fkey;

ALTER TABLE public.team_members
    ADD CONSTRAINT team_members_team_id_fkey
    FOREIGN KEY (team_id) REFERENCES public.teams (id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 6. Первую команду пометить default + записать в profiles.active_team_id
-- ---------------------------------------------------------------------------

UPDATE public.teams t
SET is_default = TRUE
WHERE t.id IN (
    SELECT DISTINCT ON (user_id) id
    FROM public.teams
    ORDER BY user_id, created_at ASC
)
AND NOT EXISTS (
    SELECT 1 FROM public.teams t2
    WHERE t2.user_id = t.user_id AND t2.is_default = TRUE
);

UPDATE public.profiles p
SET active_team_id = t.id
FROM public.teams t
WHERE t.user_id = p.id
  AND t.is_default = TRUE
  AND p.active_team_id IS NULL;

-- ---------------------------------------------------------------------------
-- 7. Индексы
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_builds_team_id ON public.builds (team_id);
CREATE INDEX IF NOT EXISTS idx_profiles_active_team ON public.profiles (active_team_id);
