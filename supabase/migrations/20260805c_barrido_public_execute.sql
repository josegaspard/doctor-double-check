-- ============================================================================
-- AUDITORÍA 2026-08-05 · RONDA 3 — barrido del EXECUTE heredado de PUBLIC
--
-- CAUSA RAÍZ: en Postgres toda función nace con EXECUTE para PUBLIC, y anon lo
-- hereda. Por eso `REVOKE ... FROM anon` no cerraba nada y quedaban ~44
-- funciones invocables por cualquiera desde internet con la anon key.
--
-- REGLA (conserva el comportamiento actual de los usuarios con sesión):
--   1. Se revoca de PUBLIC, anon y authenticated.
--   2. Se vuelve a conceder a `authenticated` SOLO si ya lo tenía antes — así
--      ninguna pantalla de usuario logueado se rompe, y las que se cerraron a
--      propósito en las rondas 1 y 2 (stock, reconcile_stuck_*,
--      fn_post_service_sale, check_and_record_rate_limit...) siguen cerradas.
--   3. Se concede a `anon` SOLO la lista blanca de abajo.
--   4. Las funciones de trigger no se tocan: PostgREST no las expone y
--      llamarlas directamente falla, así que no son superficie de ataque.
--
-- LISTA BLANCA: obtenida empíricamente, no a ojo. Se cargaron con Playwright
-- las 44 rutas públicas SIN sesión + las 7 rutas con parámetro (/doctor/:id,
-- /news/:slug, /congreso/:id, /live/:id, /verificar-receta/:id, /recording/:id,
-- /book/:doctorId) grabando cada POST a /rest/v1/rpc/*. Estas son las únicas
-- que un anónimo llegó a invocar con éxito, más search_doctors_public, que usa
-- el buscador global (GlobalSearch.tsx) y devuelve lo mismo que el directorio.
-- ============================================================================

DO $$
DECLARE
  r            record;
  v_whitelist  text[] := ARRAY[
    'get_doctors_paginated',      -- directorio /doctores y /emergencia
    'get_doctor_public_profile',  -- ficha /doctor/:id y cabecera del live
    'get_doctor_badges',          -- insignias en directorio, congresos y lives
    'get_doctor_filter_fields',   -- filtros del catálogo
    'get_doctor_filter_options',  -- filtros del catálogo
    'search_doctors_public',      -- buscador global
    'increment_news_view',        -- contador de visitas de /news/:slug
    'verify_prescription'         -- verificación pública por QR de recetas
  ];
  v_had_auth   boolean;
  v_sig        text;
  n_cerradas   int := 0;
  n_anon       int := 0;
BEGIN
  FOR r IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prorettype <> 'trigger'::regtype           -- los triggers se dejan
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
    ORDER BY p.proname
  LOOP
    v_sig := format('public.%I(%s)', r.proname, r.args);
    v_had_auth := has_function_privilege('authenticated', r.oid, 'EXECUTE');

    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_sig);

    IF v_had_auth THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_sig);
    END IF;

    IF r.proname = ANY(v_whitelist) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', v_sig);
      n_anon := n_anon + 1;
    ELSE
      n_cerradas := n_cerradas + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Cerradas a anon: %  |  Mantenidas para anon (lista blanca): %', n_cerradas, n_anon;
END $$;

-- ----------------------------------------------------------------------------
-- CORRECCIÓN (detectada al verificar el barrido, no en teoría) ---------------
-- Estas 9 funciones NO se llaman desde el cliente: las invoca el propio motor
-- de RLS al evaluar las policies. Y Postgres exige que el ROL QUE CONSULTA
-- tenga EXECUTE sobre ellas, aunque sean SECURITY DEFINER.
-- Al revocarlas de anon, leer clinical_sessions pasó a devolver
-- «42501 permission denied for function user_is_clinical_session_participant»,
-- y has_role aparece en las policies de 71 tablas legibles sin sesión: sin este
-- GRANT se cae medio sitio público.
-- Devolverlas no reabre nada: no exponen datos, sólo responden sí/no sobre el
-- llamante (para un anónimo, auth.uid() es NULL y contestan false).
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role)                       TO anon;
GRANT EXECUTE ON FUNCTION public.current_user_badge()                           TO anon;
GRANT EXECUTE ON FUNCTION public.can_manage_congress(uuid, uuid)                TO anon;
GRANT EXECUTE ON FUNCTION public.is_approved_doctor(uuid)                       TO anon;
GRANT EXECUTE ON FUNCTION public.is_approved_resident(uuid)                     TO anon;
GRANT EXECUTE ON FUNCTION public.is_forum_member(uuid)                          TO anon;
GRANT EXECUTE ON FUNCTION public.user_has_vault_access(uuid, uuid)              TO anon;
GRANT EXECUTE ON FUNCTION public.user_is_clinical_session_participant(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.user_is_invitation_organizer(uuid, uuid)       TO anon;
