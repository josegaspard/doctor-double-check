-- =========================================================================
-- SECURITY HARDENING 2026-05-17
-- Tabla `recordings`: el rol `anon` veía TODAS las columnas, incluyendo
-- `bunny_video_id` y `video_url` (referencias directas al asset Bunny Stream).
-- Audit forense: https://medical-masters.com/AUDIT_SECURITY_2026-05-17.md (#5)
--
-- Fix: REVOKE SELECT amplio a anon y GRANT explícito solo a columnas seguras
-- (las que el front necesita para listar/preview). Mantiene `authenticated`
-- con acceso total (sujeto a RLS row-level que ya existe).
--
-- Impacto en el front: cualquier query del cliente `anon` que use
-- `select('*')` sobre recordings empezará a fallar con permission error.
-- Las queries `select('*', { count: 'exact', head: true })` siguen
-- funcionando (no piden columnas, solo el count). LivesContext.fetchRecordings
-- se migra en el mismo PR a columnas explícitas.
-- =========================================================================

revoke all on public.recordings from anon;

grant select
  ( id
  , live_id
  , doctor_id
  , title
  , description
  , specialty
  , duration
  , price
  , thumbnail_url
  , peak_viewers
  , created_at
  , tags
  , bunny_status
  )
on public.recordings to anon;

-- authenticated mantiene acceso total a columnas (RLS row policies aplican).
grant select on public.recordings to authenticated;

-- Service-role bypassea RLS por diseño; no necesita grants explícitos.

comment on table public.recordings is
  'Grabaciones de lives. anon ve solo metadata pública (sin bunny_video_id ni video_url) — ver migración 20260517_recordings_anon_columns.sql';
