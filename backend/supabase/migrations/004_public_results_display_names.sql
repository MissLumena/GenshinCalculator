-- Migration 004 — публичные результаты по имени (без email) и смена display_name
-- Запуск: Supabase → SQL Editor → Run целиком
-- После Run: Dashboard → Settings → API → Reload schema (если ошибка schema cache)

CREATE OR REPLACE FUNCTION public.validate_display_name(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    trimmed TEXT;
BEGIN
    trimmed := trim(p_name);
    IF trimmed IS NULL OR trimmed = '' THEN
        RAISE EXCEPTION 'Имя не может быть пустым' USING ERRCODE = '22023';
    END IF;
    IF char_length(trimmed) < 2 OR char_length(trimmed) > 30 THEN
        RAISE EXCEPTION 'Имя должно быть от 2 до 30 символов' USING ERRCODE = '22023';
    END IF;
    IF trimmed ~ '@' THEN
        RAISE EXCEPTION 'Имя не должно содержать @' USING ERRCODE = '22023';
    END IF;
    RETURN trimmed;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_my_display_name(p_display_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    clean_name TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Требуется авторизация' USING ERRCODE = '42501';
    END IF;

    clean_name := public.validate_display_name(p_display_name);

    UPDATE public.profiles
    SET display_name = clean_name
    WHERE id = auth.uid();

    RETURN clean_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_public_results()
RETURNS TABLE (
    user_id       UUID,
    display_name  TEXT,
    member_count  INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        p.id,
        COALESCE(NULLIF(trim(p.display_name), ''), 'Игрок') AS display_name,
        COALESCE((
            SELECT COUNT(*)::INT
            FROM public.team_members tm
            JOIN public.teams t ON t.id = tm.team_id
            WHERE t.user_id = p.id
        ), 0) AS member_count
    FROM public.profiles p
    WHERE auth.uid() IS NOT NULL
      AND EXISTS (
          SELECT 1 FROM public.user_characters uc WHERE uc.user_id = p.id
      )
    ORDER BY 2;
$$;

CREATE OR REPLACE FUNCTION public.get_public_user_results(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
    v_team_id UUID;
    v_display_name TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Требуется авторизация' USING ERRCODE = '42501';
    END IF;

    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Не указан пользователь' USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(NULLIF(trim(p.display_name), ''), 'Игрок')
    INTO v_display_name
    FROM public.profiles p
    WHERE p.id = p_user_id;

    IF v_display_name IS NULL THEN
        RAISE EXCEPTION 'Пользователь не найден' USING ERRCODE = '22023';
    END IF;

    SELECT t.id INTO v_team_id
    FROM public.teams t
    WHERE t.user_id = p_user_id
    ORDER BY t.is_default DESC, t.created_at ASC
    LIMIT 1;

    SELECT jsonb_build_object(
        'userId', p_user_id,
        'displayName', v_display_name,
        'teamId', v_team_id,
        'team', COALESCE((
            SELECT jsonb_agg(uc.game_character_id ORDER BY tm.slot_index)
            FROM public.team_members tm
            JOIN public.user_characters uc ON uc.id = tm.user_character_id
            WHERE tm.team_id = v_team_id
        ), '[]'::JSONB),
        'configs', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'characterId', uc.game_character_id,
                    'level', uc.level,
                    'atk', jsonb_build_object('base', uc.atk_base, 'bonus', uc.atk_bonus),
                    'hp', uc.hp,
                    'def', uc.defense,
                    'em', uc.em,
                    'critRate', uc.crit_rate,
                    'critDmg', uc.crit_dmg,
                    'energyRecharge', uc.energy_recharge,
                    'constellation', uc.constellation,
                    'artifacts', uc.artifacts_summary
                )
            )
            FROM public.team_members tm
            JOIN public.user_characters uc ON uc.id = tm.user_character_id
            WHERE tm.team_id = v_team_id
        ), '[]'::JSONB)
    ) INTO result;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_display_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_display_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_results() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_user_results(UUID) TO authenticated;

-- Обновить кэш PostgREST (Supabase API)
NOTIFY pgrst, 'reload schema';
