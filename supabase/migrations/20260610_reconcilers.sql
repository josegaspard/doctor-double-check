-- =========================================================================
-- 2026-06-10 — Reconciliadores de deadlock (consultas y lives atascadas).
-- Lógica pura de BD → pg_cron las llama directo (sin edge function).
-- (El reconciliador de payouts necesita Stripe → va como edge function aparte.)
-- =========================================================================

-- Consultas atascadas en 'active': sólo el doctor las cierra y no hay timeout,
-- así que si el chat ya está cerrado o llevan >48h, se completan (esto dispara
-- el flujo de rating y libera el entitlement de chat).
create or replace function public.reconcile_stuck_consultations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  with upd as (
    update public.consultations c
    set status = 'completed', completed_at = now()
    where c.status = 'active'
      and (
        exists (select 1 from public.chat_sessions cs where cs.id = c.chat_session_id and cs.status = 'closed')
        or coalesce(c.started_at, now()) < now() - interval '48 hours'
      )
    returning 1
  )
  select count(*) into v_n from upd;
  return v_n;
end;
$$;

-- Lives fantasma en 'live' (el doctor cerró el tab y nunca volvió): si llevan
-- >6h "en vivo" se terminan del lado del servidor.
create or replace function public.reconcile_stuck_lives()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  with upd as (
    update public.lives
    set status = 'ended', is_broadcasting = false, ended_at = now()
    where status = 'live'
      and coalesce(started_at, now()) < now() - interval '6 hours'
    returning 1
  )
  select count(*) into v_n from upd;
  return v_n;
end;
$$;

-- Programación pg_cron (idempotente por nombre).
select cron.schedule('reconcile-stuck-consultations', '*/30 * * * *',
  $$select public.reconcile_stuck_consultations();$$);
select cron.schedule('reconcile-stuck-lives', '*/20 * * * *',
  $$select public.reconcile_stuck_lives();$$);
