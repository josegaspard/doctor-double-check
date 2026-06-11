-- =========================================================================
-- 2026-06-10 — P0: cierre de auto-aprobación como doctor vía cédula forjada.
--
-- HUECO (verificado en vivo): la política INSERT "Users can create cedula
-- verifications" sólo exigía auth.uid()=user_id, NO forzaba is_verified=false.
-- Un atacante (paciente/doctor pendiente) insertaba en cedula_verifications su
-- propia fila con is_verified=true y luego llamaba claim_cedula_atomic() — que
-- confía únicamente en is_verified — quedando doctor_profiles.status='approved'.
-- Esto salta la validación SEP (cuya ÚNICA vía legítima es la edge function
-- service-role verify-cedula-sep) y anula los triggers anti-auto-aprobación.
--
-- FIX: un trigger BEFORE INSERT/UPDATE que, para escritores NO privilegiados,
-- fuerza los campos que prueban la verificación SEP (is_verified, verified_at,
-- raw_response) a valores seguros. Sólo is_privileged_writer() (service-role con
-- auth.uid() NULL, o admin, o el bypass GUC de las RPC controladas) puede
-- marcar is_verified=true. is_claimed/claimed_* NO se tocan aquí para no romper
-- claim_cedula_atomic (que reclama legítimamente como el doctor); reclamar una
-- cédula NO verificada es inofensivo porque claim exige is_verified primero.
-- =========================================================================

begin;

create or replace function public.protect_cedula_verification_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- Un cliente jamás inserta una cédula "ya verificada por la SEP".
    new.is_verified := false;
    new.verified_at := null;
    new.raw_response := null;
  elsif tg_op = 'UPDATE' then
    -- Un cliente no puede forjar/voltear la verificación ni su evidencia.
    new.is_verified := old.is_verified;
    new.verified_at := old.verified_at;
    new.raw_response := old.raw_response;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_cedula_verification_cols on public.cedula_verifications;
create trigger trg_protect_cedula_verification_cols
  before insert or update on public.cedula_verifications
  for each row execute function public.protect_cedula_verification_cols();

-- Defensa en profundidad: la propia política INSERT también rechaza is_verified=true.
alter policy "Users can create cedula verifications" on public.cedula_verifications
  with check (auth.uid() = user_id and coalesce(is_verified, false) = false);

commit;
