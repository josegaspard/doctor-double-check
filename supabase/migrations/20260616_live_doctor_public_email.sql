-- Email público del doctor en vivo (decisión explícita del cliente 2026-06-16).
--
-- El cliente pidió que el correo del doctor que transmite sea visible para
-- TODOS los espectadores del live. El dev anterior lo dejó fuera a propósito
-- por privacidad/anti-spam; el cliente acepta el riesgo.
--
-- Para minimizar la exposición NO abrimos la tabla profiles ni auth.users:
-- esta función SECURITY DEFINER devuelve ÚNICAMENTE el email del doctor de UN
-- live concreto (por id). No permite enumerar emails de otros usuarios.
create or replace function public.get_live_doctor_email(p_live_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.email::text
  from public.lives l
  join auth.users u on u.id = l.doctor_id
  where l.id = p_live_id
  limit 1
$$;

revoke all on function public.get_live_doctor_email(uuid) from public;
grant execute on function public.get_live_doctor_email(uuid) to anon, authenticated;
