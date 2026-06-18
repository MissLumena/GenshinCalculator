-- =============================================================================
-- Migration 004 — публичный список результатов по display_name
-- Запуск: Supabase SQL Editor → Run, затем Settings → API → Reload schema
-- =============================================================================

CREATE OR REPLACE FUNCTION public.list_public_results()
RETURNS TABLE (
    user_id UUID,
    display_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT
        p.id AS user_id,
        COALESCE(NULLIF(TRIM(p.display_name), ''), 'Игрок') AS display_name
    FROM public.profiles p
    WHERE EXISTS (
        SELECT 1
        FROM public.teams t
        INNER JOIN public.team_members tm ON tm.team_id = t.id
        WHERE t.user_id = p.id
    )
    ORDER BY display_name;
$$;

CREATE OR REPLACE FUNCTION public.get_public_user_results(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_team_id UUID;
    v_display_name TEXT;
BEGIN
    SELECT COALESCE(NULLIF(TRIM(display_name), ''), 'Игрок')
    INTO v_display_name
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_display_name IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT t.id
    INTO v_team_id
    FROM public.teams t
    LEFT JOIN public.profiles p ON p.id = p_user_id
    WHERE t.user_id = p_user_id
    ORDER BY
        (p.active_team_id IS NOT NULL AND t.id = p.active_team_id) DESC,
        t.is_default DESC NULLS LAST,
        t.created_at ASC
    LIMIT 1;

    IF v_team_id IS NULL THEN
        RETURN jsonb_build_object(
            'displayName', v_display_name,
            'rotationSeconds', 20,
            'team', '[]'::JSONB,
            'configs', '[]'::JSONB
        );
    END IF;

    RETURN jsonb_build_object(
        'displayName', v_display_name,
        'rotationSeconds', COALESCE((
            SELECT rotation_seconds FROM public.teams WHERE id = v_team_id
        ), 20),
        'team', COALESCE((
            SELECT jsonb_agg(uc.game_character_id ORDER BY tm.slot_index)
            FROM public.team_members tm
            INNER JOIN public.user_characters uc ON uc.id = tm.user_character_id
            WHERE tm.team_id = v_team_id
        ), '[]'::JSONB),
        'configs', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'characterId', uc.game_character_id,
                    'level', uc.level,
                    'atk', jsonb_build_object(
                        'base', uc.atk_base,
                        'bonus', uc.atk_bonus
                    ),
                    'hp', uc.hp,
                    'def', uc.defense,
                    'em', uc.em,
                    'critRate', uc.crit_rate,
                    'critDmg', uc.crit_dmg,
                    'energyRecharge', uc.energy_recharge,
                    'constellation', uc.constellation,
                    'artifacts', uc.artifacts_summary
                )
                ORDER BY tm.slot_index
            )
            FROM public.team_members tm
            INNER JOIN public.user_characters uc ON uc.id = tm.user_character_id
            WHERE tm.team_id = v_team_id
        ), '[]'::JSONB)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_my_display_name(p_display_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_name TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_name := NULLIF(TRIM(p_display_name), '');
    IF v_name IS NULL OR char_length(v_name) > 100 THEN
        RAISE EXCEPTION 'Invalid display name';
    END IF;

    UPDATE public.profiles
    SET display_name = v_name
    WHERE id = auth.uid();

    RETURN v_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_public_results() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_user_results(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_display_name(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
