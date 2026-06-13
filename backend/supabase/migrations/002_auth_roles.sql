-- Migration 002 — роли, RLS, триггеры ограничений для user
-- Запуск: Supabase SQL Editor → Run
-- После миграции задайте email владельца:
--   UPDATE public.app_config SET value = 'you@example.com' WHERE key = 'owner_email';

-- ---------------------------------------------------------------------------
-- 1. Роли
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
        CHECK (role IN ('owner', 'admin', 'user'));

CREATE TABLE IF NOT EXISTS public.app_config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_config (key, value)
VALUES ('owner_email', '')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Вспомогательные функции
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT role FROM public.profiles WHERE id = auth.uid()),
        'user'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.current_user_role() = 'owner';
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.current_user_role() IN ('owner', 'admin');
$$;

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE (
    id              UUID,
    display_name    TEXT,
    role            TEXT,
    active_team_id  UUID,
    email           TEXT,
    created_at      TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT
        p.id,
        p.display_name,
        p.role,
        p.active_team_id,
        u.email::TEXT,
        p.created_at
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.claim_owner_role()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    owner_email TEXT;
    user_email  TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF EXISTS (SELECT 1 FROM public.profiles WHERE role = 'owner') THEN
        RETURN FALSE;
    END IF;

    SELECT value INTO owner_email
    FROM public.app_config
    WHERE key = 'owner_email';

    SELECT email INTO user_email
    FROM auth.users
    WHERE id = auth.uid();

    IF owner_email IS NULL OR owner_email = '' THEN
        RAISE EXCEPTION 'owner_email is not configured in app_config';
    END IF;

    IF lower(trim(user_email)) IS DISTINCT FROM lower(trim(owner_email)) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    UPDATE public.profiles
    SET role = 'owner'
    WHERE id = auth.uid();

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id UUID, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_owner() THEN
        RAISE EXCEPTION 'Only owner can change roles';
    END IF;

    IF p_role NOT IN ('owner', 'admin', 'user') THEN
        RAISE EXCEPTION 'Invalid role: %', p_role;
    END IF;

    IF p_user_id = auth.uid() AND p_role <> 'owner' THEN
        RAISE EXCEPTION 'Owner cannot demote themselves';
    END IF;

    UPDATE public.profiles
    SET role = p_role
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_owner_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Триггеры: ограничения для role = user (вариант A — только свои данные)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.role IS DISTINCT FROM NEW.role AND NOT public.is_owner() THEN
        NEW.role := OLD.role;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

CREATE OR REPLACE FUNCTION public.enforce_user_character_role_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_role TEXT;
BEGIN
    user_role := public.current_user_role();

    IF user_role IN ('owner', 'admin') THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
            RAISE EXCEPTION 'Cannot create characters for other users';
        END IF;
        RETURN NEW;
    END IF;

    -- user: только поля расчёта команды
    NEW.level            := OLD.level;
    NEW.defense          := OLD.defense;
    NEW.energy_recharge  := OLD.energy_recharge;
    NEW.nickname         := OLD.nickname;
    NEW.game_character_id := OLD.game_character_id;
    NEW.user_id          := OLD.user_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_character_role_limits ON public.user_characters;
CREATE TRIGGER trg_user_character_role_limits
    BEFORE INSERT OR UPDATE ON public.user_characters
    FOR EACH ROW EXECUTE FUNCTION public.enforce_user_character_role_limits();

CREATE OR REPLACE FUNCTION public.enforce_team_role_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF public.current_user_role() = 'user' THEN
            RAISE EXCEPTION 'Users cannot delete teams';
        END IF;
        RETURN OLD;
    END IF;

    IF public.current_user_role() = 'user' AND TG_OP = 'UPDATE' THEN
        NEW.name             := OLD.name;
        NEW.rotation_seconds := OLD.rotation_seconds;
        NEW.is_default       := OLD.is_default;
        NEW.user_id          := OLD.user_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_role_limits ON public.teams;
CREATE TRIGGER trg_team_role_limits
    BEFORE UPDATE OR DELETE ON public.teams
    FOR EACH ROW EXECUTE FUNCTION public.enforce_team_role_limits();

-- ---------------------------------------------------------------------------
-- 4. RLS — замена политик
-- ---------------------------------------------------------------------------

-- profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_select"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid() OR public.is_admin_or_owner());

CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- справочники: чтение всем
DROP POLICY IF EXISTS "game_characters_select_all" ON public.game_characters;
CREATE POLICY "game_characters_select_all"
    ON public.game_characters FOR SELECT
    TO anon, authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "game_characters_write_admin" ON public.game_characters;
CREATE POLICY "game_characters_write_admin"
    ON public.game_characters FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin_or_owner());

CREATE POLICY "game_characters_update_admin"
    ON public.game_characters FOR UPDATE
    TO authenticated
    USING (public.is_admin_or_owner())
    WITH CHECK (public.is_admin_or_owner());

CREATE POLICY "game_characters_delete_admin"
    ON public.game_characters FOR DELETE
    TO authenticated
    USING (public.is_admin_or_owner());

DROP POLICY IF EXISTS "artifact_sets_select_all" ON public.artifact_sets;
CREATE POLICY "artifact_sets_select_all"
    ON public.artifact_sets FOR SELECT
    TO anon, authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "artifact_sets_write_admin" ON public.artifact_sets;
CREATE POLICY "artifact_sets_write_admin"
    ON public.artifact_sets FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin_or_owner());

CREATE POLICY "artifact_sets_update_admin"
    ON public.artifact_sets FOR UPDATE
    TO authenticated
    USING (public.is_admin_or_owner())
    WITH CHECK (public.is_admin_or_owner());

CREATE POLICY "artifact_sets_delete_admin"
    ON public.artifact_sets FOR DELETE
    TO authenticated
    USING (public.is_admin_or_owner());

-- user_characters
DROP POLICY IF EXISTS "user_characters_select_own" ON public.user_characters;
DROP POLICY IF EXISTS "user_characters_insert_own" ON public.user_characters;
DROP POLICY IF EXISTS "user_characters_update_own" ON public.user_characters;
DROP POLICY IF EXISTS "user_characters_delete_own" ON public.user_characters;

CREATE POLICY "user_characters_select"
    ON public.user_characters FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin_or_owner());

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

-- character_artifacts (без изменений логики — через владельца персонажа)
DROP POLICY IF EXISTS "character_artifacts_select_own" ON public.character_artifacts;
DROP POLICY IF EXISTS "character_artifacts_insert_own" ON public.character_artifacts;
DROP POLICY IF EXISTS "character_artifacts_update_own" ON public.character_artifacts;
DROP POLICY IF EXISTS "character_artifacts_delete_own" ON public.character_artifacts;

CREATE POLICY "character_artifacts_select_own"
    ON public.character_artifacts FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_characters uc
            WHERE uc.id = character_artifacts.user_character_id
              AND (uc.user_id = auth.uid() OR public.is_admin_or_owner())
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

-- teams
DROP POLICY IF EXISTS "teams_select_own" ON public.teams;
DROP POLICY IF EXISTS "teams_insert_own" ON public.teams;
DROP POLICY IF EXISTS "teams_update_own" ON public.teams;
DROP POLICY IF EXISTS "teams_delete_own" ON public.teams;

CREATE POLICY "teams_select"
    ON public.teams FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin_or_owner());

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

-- team_members
DROP POLICY IF EXISTS "team_members_select_own" ON public.team_members;
DROP POLICY IF EXISTS "team_members_insert_own" ON public.team_members;
DROP POLICY IF EXISTS "team_members_update_own" ON public.team_members;
DROP POLICY IF EXISTS "team_members_delete_own" ON public.team_members;

CREATE POLICY "team_members_select_own"
    ON public.team_members FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.teams t
            WHERE t.id = team_members.team_id
              AND (t.user_id = auth.uid() OR public.is_admin_or_owner())
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

-- builds
DROP POLICY IF EXISTS "builds_select_own" ON public.builds;
DROP POLICY IF EXISTS "builds_insert_own" ON public.builds;
DROP POLICY IF EXISTS "builds_delete_own" ON public.builds;

CREATE POLICY "builds_select"
    ON public.builds FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin_or_owner());

CREATE POLICY "builds_insert_own"
    ON public.builds FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "builds_delete_own"
    ON public.builds FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());
