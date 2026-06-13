-- Migration 003 — валидация RPC и уточнённые права (owner / admin / user)

-- ---------------------------------------------------------------------------
-- 1. Ошибки API: 403 (42501) и 400 (22023)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.err_forbidden(p_message TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION '%', p_message USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION public.err_bad_request(p_message TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION '%', p_message USING ERRCODE = '22023';
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_authenticated()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID;
BEGIN
    uid := auth.uid();
    IF uid IS NULL THEN
        PERFORM public.err_forbidden('Требуется авторизация');
    END IF;
    RETURN uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_own_or_staff(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin_or_owner() THEN
        PERFORM public.err_forbidden('Нет доступа к чужим данным');
    END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Валидация статов персонажа
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_character_stats(
    p_level SMALLINT,
    p_atk_base NUMERIC,
    p_atk_bonus NUMERIC,
    p_hp NUMERIC,
    p_defense NUMERIC,
    p_em NUMERIC,
    p_energy_recharge NUMERIC,
    p_crit_rate NUMERIC,
    p_crit_dmg NUMERIC,
    p_constellation SMALLINT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_level IS NOT NULL AND (p_level < 1 OR p_level > 90) THEN
        PERFORM public.err_bad_request('Уровень должен быть от 1 до 90');
    END IF;
    IF p_atk_base IS NOT NULL AND (p_atk_base < 0 OR p_atk_base > 50000) THEN
        PERFORM public.err_bad_request('Базовая ATK должна быть от 0 до 50000');
    END IF;
    IF p_atk_bonus IS NOT NULL AND (p_atk_bonus < 0 OR p_atk_bonus > 50000) THEN
        PERFORM public.err_bad_request('Бонус ATK должен быть от 0 до 50000');
    END IF;
    IF p_hp IS NOT NULL AND (p_hp < 0 OR p_hp > 50000) THEN
        PERFORM public.err_bad_request('HP должно быть от 0 до 50000');
    END IF;
    IF p_defense IS NOT NULL AND (p_defense < 0 OR p_defense > 50000) THEN
        PERFORM public.err_bad_request('DEF должно быть от 0 до 50000');
    END IF;
    IF p_em IS NOT NULL AND (p_em < 0 OR p_em > 50000) THEN
        PERFORM public.err_bad_request('Мастерство стихий должно быть от 0 до 50000');
    END IF;
    IF p_energy_recharge IS NOT NULL AND (p_energy_recharge < 0 OR p_energy_recharge > 500) THEN
        PERFORM public.err_bad_request('Восстановление энергии должно быть от 0 до 500');
    END IF;
    IF p_crit_rate IS NOT NULL AND (p_crit_rate < 0 OR p_crit_rate > 100) THEN
        PERFORM public.err_bad_request('CRIT Rate должен быть от 0 до 100');
    END IF;
    IF p_crit_dmg IS NOT NULL AND (p_crit_dmg < 0 OR p_crit_dmg > 500) THEN
        PERFORM public.err_bad_request('CRIT DMG должен быть от 0 до 500');
    END IF;
    IF p_constellation IS NOT NULL AND (p_constellation < 0 OR p_constellation > 6) THEN
        PERFORM public.err_bad_request('Созвездие должно быть от 0 до 6');
    END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. RPC: сохранение персонажа с валидацией
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_user_character(p_payload JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID;
    char_id UUID;
    game_id TEXT;
    existing_owner UUID;
BEGIN
    uid := public.assert_authenticated();

    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
        PERFORM public.err_bad_request('Некорректный формат данных персонажа');
    END IF;

    game_id := p_payload ->> 'game_character_id';
    IF game_id IS NULL OR game_id = '' THEN
        PERFORM public.err_bad_request('Не указан game_character_id');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.game_characters WHERE id = game_id) THEN
        PERFORM public.err_bad_request('Неизвестный персонаж: ' || game_id);
    END IF;

    PERFORM public.validate_character_stats(
        COALESCE((p_payload ->> 'level')::SMALLINT, 90),
        COALESCE((p_payload ->> 'atk_base')::NUMERIC, 0),
        COALESCE((p_payload ->> 'atk_bonus')::NUMERIC, 0),
        COALESCE((p_payload ->> 'hp')::NUMERIC, 0),
        COALESCE((p_payload ->> 'defense')::NUMERIC, 0),
        COALESCE((p_payload ->> 'em')::NUMERIC, 0),
        COALESCE((p_payload ->> 'energy_recharge')::NUMERIC, 100),
        COALESCE((p_payload ->> 'crit_rate')::NUMERIC, 5),
        COALESCE((p_payload ->> 'crit_dmg')::NUMERIC, 50),
        COALESCE((p_payload ->> 'constellation')::SMALLINT, 0)
    );

    IF p_payload ? 'id' AND p_payload ->> 'id' IS NOT NULL AND p_payload ->> 'id' <> '' THEN
        char_id := (p_payload ->> 'id')::UUID;

        SELECT user_id INTO existing_owner
        FROM public.user_characters
        WHERE id = char_id;

        IF existing_owner IS NULL THEN
            PERFORM public.err_bad_request('Персонаж не найден');
        END IF;

        PERFORM public.assert_own_or_staff(existing_owner);

        UPDATE public.user_characters SET
            level            = COALESCE((p_payload ->> 'level')::SMALLINT, level),
            atk_base         = COALESCE((p_payload ->> 'atk_base')::NUMERIC, atk_base),
            atk_bonus        = COALESCE((p_payload ->> 'atk_bonus')::NUMERIC, atk_bonus),
            hp               = COALESCE((p_payload ->> 'hp')::NUMERIC, hp),
            defense          = COALESCE((p_payload ->> 'defense')::NUMERIC, defense),
            em               = COALESCE((p_payload ->> 'em')::NUMERIC, em),
            energy_recharge  = COALESCE((p_payload ->> 'energy_recharge')::NUMERIC, energy_recharge),
            crit_rate        = COALESCE((p_payload ->> 'crit_rate')::NUMERIC, crit_rate),
            crit_dmg         = COALESCE((p_payload ->> 'crit_dmg')::NUMERIC, crit_dmg),
            constellation    = COALESCE((p_payload ->> 'constellation')::SMALLINT, constellation),
            artifacts_summary = COALESCE(p_payload -> 'artifacts_summary', artifacts_summary)
        WHERE id = char_id;

        RETURN char_id;
    END IF;

    INSERT INTO public.user_characters (
        user_id,
        game_character_id,
        level,
        atk_base,
        atk_bonus,
        hp,
        defense,
        em,
        energy_recharge,
        crit_rate,
        crit_dmg,
        constellation,
        artifacts_summary
    ) VALUES (
        uid,
        game_id,
        COALESCE((p_payload ->> 'level')::SMALLINT, 90),
        COALESCE((p_payload ->> 'atk_base')::NUMERIC, 0),
        COALESCE((p_payload ->> 'atk_bonus')::NUMERIC, 0),
        COALESCE((p_payload ->> 'hp')::NUMERIC, 0),
        COALESCE((p_payload ->> 'defense')::NUMERIC, 0),
        COALESCE((p_payload ->> 'em')::NUMERIC, 0),
        COALESCE((p_payload ->> 'energy_recharge')::NUMERIC, 100),
        COALESCE((p_payload ->> 'crit_rate')::NUMERIC, 5),
        COALESCE((p_payload ->> 'crit_dmg')::NUMERIC, 50),
        COALESCE((p_payload ->> 'constellation')::SMALLINT, 0),
        COALESCE(p_payload -> 'artifacts_summary', '{}'::JSONB)
    )
    RETURNING id INTO char_id;

    RETURN char_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. RPC: синхронизация состава команды
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_team_members(
    p_team_id UUID,
    p_members JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID;
    team_owner UUID;
    member JSONB;
    char_owner UUID;
    slot_idx INT;
    char_uuid UUID;
    member_count INT := 0;
BEGIN
    uid := public.assert_authenticated();

    IF p_team_id IS NULL THEN
        PERFORM public.err_bad_request('Не указан team_id');
    END IF;

    SELECT user_id INTO team_owner FROM public.teams WHERE id = p_team_id;
    IF team_owner IS NULL THEN
        PERFORM public.err_bad_request('Команда не найдена');
    END IF;

    PERFORM public.assert_own_or_staff(team_owner);

    IF p_members IS NULL THEN
        p_members := '[]'::JSONB;
    END IF;

    IF jsonb_typeof(p_members) <> 'array' THEN
        PERFORM public.err_bad_request('members должен быть массивом');
    END IF;

    IF jsonb_array_length(p_members) > 4 THEN
        PERFORM public.err_bad_request('В команде не более 4 персонажей');
    END IF;

    FOR member IN SELECT * FROM jsonb_array_elements(p_members)
    LOOP
        member_count := member_count + 1;
        slot_idx := (member ->> 'slot_index')::INT;
        char_uuid := (member ->> 'user_character_id')::UUID;

        IF slot_idx IS NULL OR slot_idx < 0 OR slot_idx > 3 THEN
            PERFORM public.err_bad_request('slot_index должен быть от 0 до 3');
        END IF;

        IF char_uuid IS NULL THEN
            PERFORM public.err_bad_request('Не указан user_character_id');
        END IF;

        SELECT user_id INTO char_owner
        FROM public.user_characters
        WHERE id = char_uuid;

        IF char_owner IS NULL THEN
            PERFORM public.err_bad_request('Персонаж не найден');
        END IF;

        IF char_owner IS DISTINCT FROM team_owner THEN
            PERFORM public.err_forbidden('Нельзя добавить чужого персонажа в команду');
        END IF;
    END LOOP;

    DELETE FROM public.team_members WHERE team_id = p_team_id;

    FOR member IN SELECT * FROM jsonb_array_elements(p_members)
    LOOP
        INSERT INTO public.team_members (
            team_id,
            user_character_id,
            slot_index,
            rotation_order
        ) VALUES (
            p_team_id,
            (member ->> 'user_character_id')::UUID,
            (member ->> 'slot_index')::INT,
            COALESCE((member ->> 'rotation_order')::INT, (member ->> 'slot_index')::INT + 1)
        );
    END LOOP;

    RETURN p_team_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Права: admin может менять роли user/admin, но не owner; удаление — только owner
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id UUID, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_role TEXT;
BEGIN
    caller_role := public.current_user_role();

    IF caller_role NOT IN ('owner', 'admin') THEN
        PERFORM public.err_forbidden('Недостаточно прав для смены ролей');
    END IF;

    IF p_role NOT IN ('owner', 'admin', 'user') THEN
        PERFORM public.err_bad_request('Некорректная роль: ' || p_role);
    END IF;

    IF p_role = 'owner' AND caller_role <> 'owner' THEN
        PERFORM public.err_forbidden('Только владелец может назначать роль owner');
    END IF;

    IF caller_role = 'owner' AND p_user_id = auth.uid() AND p_role <> 'owner' THEN
        PERFORM public.err_bad_request('Владелец не может понизить собственную роль');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
        PERFORM public.err_bad_request('Пользователь не найден');
    END IF;

    UPDATE public.profiles SET role = p_role WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF NOT public.is_owner() THEN
        PERFORM public.err_forbidden('Только владелец может удалять учётные записи');
    END IF;

    IF p_user_id = auth.uid() THEN
        PERFORM public.err_bad_request('Нельзя удалить собственную учётную запись');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
        PERFORM public.err_bad_request('Пользователь не найден');
    END IF;

    DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        IF public.current_user_role() = 'user' THEN
            NEW.role := OLD.role;
        ELSIF NEW.role = 'owner' AND NOT public.is_owner() THEN
            NEW.role := OLD.role;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- user не видит чужие данные: убираем OR is_admin_or_owner из SELECT для user_characters
-- (admin/owner по-прежнему видят через отдельные политики)

DROP POLICY IF EXISTS "user_characters_select" ON public.user_characters;

CREATE POLICY "user_characters_select_own"
    ON public.user_characters FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "user_characters_select_staff"
    ON public.user_characters FOR SELECT
    TO authenticated
    USING (public.is_admin_or_owner());

DROP POLICY IF EXISTS "teams_select" ON public.teams;

CREATE POLICY "teams_select_own"
    ON public.teams FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "teams_select_staff"
    ON public.teams FOR SELECT
    TO authenticated
    USING (public.is_admin_or_owner());

DROP POLICY IF EXISTS "builds_select" ON public.builds;

CREATE POLICY "builds_select_own"
    ON public.builds FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "builds_select_staff"
    ON public.builds FOR SELECT
    TO authenticated
    USING (public.is_admin_or_owner());

GRANT EXECUTE ON FUNCTION public.upsert_user_character(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_team_members(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
