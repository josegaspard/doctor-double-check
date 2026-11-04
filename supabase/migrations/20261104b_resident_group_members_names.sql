-- Grupos de residentes: nombres de los miembros.
-- profiles_public es security_invoker y hereda la RLS de profiles, así que un
-- residente no ve el nombre de otro residente: los miembros (y los autores de
-- los mensajes) salían como «Residente». Esta función solo responde a quien
-- pertenece al grupo y devuelve nombre y foto de sus miembros.
create or replace function public.resident_group_members(p_group uuid)
returns table (user_id uuid, name text, avatar_url text, is_admin boolean, joined_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_resident_group_member(p_group) then
    raise exception 'NOT_A_MEMBER';
  end if;
  return query
    select m.user_id, p.name, p.avatar_url, m.is_admin, m.joined_at
    from public.resident_chat_group_members m
    left join public.profiles p on p.id = m.user_id
    where m.group_id = p_group
    order by m.joined_at, m.user_id;
end;
$$;
revoke all on function public.resident_group_members(uuid) from public, anon;
grant execute on function public.resident_group_members(uuid) to authenticated;
