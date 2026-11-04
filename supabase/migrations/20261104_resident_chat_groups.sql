-- Grupos de chat entre residentes (cliente 4-nov-2026).
-- Sustituye en el chat del residente la sección «Proveedores»: los residentes
-- crean grupos con otros residentes y conversan ahí. Solo residentes pueden
-- crear grupos, ser agregados y escribir. Todo cambio de membresía pasa por
-- funciones SECURITY DEFINER; las tablas solo se leen por RLS.

create table if not exists public.resident_chat_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz
);

create table if not exists public.resident_chat_group_members (
  group_id uuid not null references public.resident_chat_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists idx_rcgm_user on public.resident_chat_group_members(user_id);

create table if not exists public.resident_chat_group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.resident_chat_groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists idx_rcgmsg_group_created on public.resident_chat_group_messages(group_id, created_at);

-- ¿El usuario actual pertenece al grupo? (SECURITY DEFINER evita la recursión de RLS)
create or replace function public.is_resident_group_member(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.resident_chat_group_members
    where group_id = p_group and user_id = auth.uid()
  );
$$;

alter table public.resident_chat_groups enable row level security;
alter table public.resident_chat_group_members enable row level security;
alter table public.resident_chat_group_messages enable row level security;

drop policy if exists "members read group" on public.resident_chat_groups;
create policy "members read group" on public.resident_chat_groups
  for select to authenticated using (public.is_resident_group_member(id));

drop policy if exists "members read members" on public.resident_chat_group_members;
create policy "members read members" on public.resident_chat_group_members
  for select to authenticated using (public.is_resident_group_member(group_id));

drop policy if exists "members read messages" on public.resident_chat_group_messages;
create policy "members read messages" on public.resident_chat_group_messages
  for select to authenticated using (public.is_resident_group_member(group_id));

drop policy if exists "resident members write messages" on public.resident_chat_group_messages;
create policy "resident members write messages" on public.resident_chat_group_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_resident_group_member(group_id)
    and public.has_role(auth.uid(), 'resident'::app_role)
  );

-- Al llegar un mensaje: fecha del último mensaje + el emisor lo da por leído.
create or replace function public.trg_resident_group_message_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.resident_chat_groups set last_message_at = new.created_at where id = new.group_id;
  update public.resident_chat_group_members set last_read_at = new.created_at
    where group_id = new.group_id and user_id = new.sender_id;
  return new;
end;
$$;
drop trigger if exists trg_resident_group_message_after on public.resident_chat_group_messages;
create trigger trg_resident_group_message_after
  after insert on public.resident_chat_group_messages
  for each row execute function public.trg_resident_group_message_after();

-- Directorio de residentes para armar grupos (solo lo ve un residente).
create or replace function public.resident_directory(p_query text default '')
returns table (id uuid, name text, avatar_url text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'resident'::app_role) then
    raise exception 'ONLY_RESIDENTS';
  end if;
  return query
    select p.id, p.name, p.avatar_url
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.role = 'resident'::app_role
      and ur.user_id <> auth.uid()
      and (coalesce(btrim(p_query), '') = '' or p.name ilike '%' || btrim(p_query) || '%')
    order by p.name
    limit 200;
end;
$$;

-- Avisar a los recién agregados (campana + enlace directo al grupo).
create or replace function public.resident_group_notify_added(p_group uuid, p_user_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_name text; v_by text;
begin
  select name into v_name from public.resident_chat_groups where id = p_group;
  select coalesce(name, 'Un residente') into v_by from public.profiles where id = auth.uid();
  insert into public.notifications (user_id, type, title, message, data)
  select u, 'system'::notification_type,
         'Te agregaron a un grupo',
         v_by || ' te agregó al grupo «' || v_name || '»',
         jsonb_build_object('url', '/chat?group=' || p_group::text, 'group_id', p_group)
  from unnest(p_user_ids) as u
  where u <> auth.uid();
end;
$$;
revoke all on function public.resident_group_notify_added(uuid, uuid[]) from public, anon, authenticated;

-- Crear grupo: el creador queda como administrador; solo se agregan residentes.
create or replace function public.resident_group_create(p_name text, p_member_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare v_group uuid; v_members uuid[];
begin
  if not public.has_role(auth.uid(), 'resident'::app_role) then
    raise exception 'ONLY_RESIDENTS';
  end if;
  if coalesce(char_length(btrim(p_name)), 0) = 0 then
    raise exception 'NAME_REQUIRED';
  end if;
  select coalesce(array_agg(distinct ur.user_id), '{}') into v_members
    from public.user_roles ur
    where ur.user_id = any(coalesce(p_member_ids, '{}'))
      and ur.role = 'resident'::app_role
      and ur.user_id <> auth.uid();
  if cardinality(v_members) = 0 then
    raise exception 'MEMBERS_REQUIRED';
  end if;

  insert into public.resident_chat_groups (name, created_by)
    values (left(btrim(p_name), 80), auth.uid()) returning id into v_group;
  insert into public.resident_chat_group_members (group_id, user_id, is_admin)
    values (v_group, auth.uid(), true);
  insert into public.resident_chat_group_members (group_id, user_id)
    select v_group, u from unnest(v_members) u;
  perform public.resident_group_notify_added(v_group, v_members);
  return v_group;
end;
$$;

-- Agregar residentes a un grupo (cualquier miembro puede invitar, como en WhatsApp con «todos pueden agregar»).
create or replace function public.resident_group_add_members(p_group uuid, p_member_ids uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare v_new uuid[];
begin
  if not public.is_resident_group_member(p_group) then
    raise exception 'NOT_A_MEMBER';
  end if;
  select coalesce(array_agg(distinct ur.user_id), '{}') into v_new
    from public.user_roles ur
    where ur.user_id = any(coalesce(p_member_ids, '{}'))
      and ur.role = 'resident'::app_role
      and not exists (select 1 from public.resident_chat_group_members m
                      where m.group_id = p_group and m.user_id = ur.user_id);
  if cardinality(v_new) = 0 then return 0; end if;
  insert into public.resident_chat_group_members (group_id, user_id)
    select p_group, u from unnest(v_new) u;
  perform public.resident_group_notify_added(p_group, v_new);
  return cardinality(v_new);
end;
$$;

-- Renombrar (solo administradores del grupo).
create or replace function public.resident_group_rename(p_group uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.resident_chat_group_members
                 where group_id = p_group and user_id = auth.uid() and is_admin) then
    raise exception 'ONLY_ADMINS';
  end if;
  if coalesce(char_length(btrim(p_name)), 0) = 0 then
    raise exception 'NAME_REQUIRED';
  end if;
  update public.resident_chat_groups set name = left(btrim(p_name), 80) where id = p_group;
end;
$$;

-- Salir del grupo. Si sale el último administrador, pasa a serlo el miembro más antiguo;
-- si no queda nadie, el grupo se borra.
create or replace function public.resident_group_leave(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.resident_chat_group_members where group_id = p_group and user_id = auth.uid();
  if not found then return; end if;
  if not exists (select 1 from public.resident_chat_group_members where group_id = p_group) then
    delete from public.resident_chat_groups where id = p_group;
    return;
  end if;
  if not exists (select 1 from public.resident_chat_group_members where group_id = p_group and is_admin) then
    update public.resident_chat_group_members set is_admin = true
      where group_id = p_group
        and user_id = (select user_id from public.resident_chat_group_members
                       where group_id = p_group order by joined_at, user_id limit 1);
  end if;
end;
$$;

-- Marcar como leído.
create or replace function public.resident_group_mark_read(p_group uuid)
returns void language sql security definer set search_path = public as $$
  update public.resident_chat_group_members set last_read_at = now()
    where group_id = p_group and user_id = auth.uid();
$$;

-- Mis grupos con último mensaje, sin leer y número de miembros.
create or replace function public.resident_groups_mine()
returns table (
  id uuid, name text, created_by uuid, created_at timestamptz, last_message_at timestamptz,
  is_admin boolean, member_count integer, unread_count integer,
  last_message text, last_sender_name text
)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.created_by, g.created_at, g.last_message_at,
         me.is_admin,
         (select count(*)::int from public.resident_chat_group_members m where m.group_id = g.id),
         (select count(*)::int from public.resident_chat_group_messages x
            where x.group_id = g.id and x.created_at > me.last_read_at and x.sender_id <> auth.uid()),
         lm.content, lp.name
  from public.resident_chat_group_members me
  join public.resident_chat_groups g on g.id = me.group_id
  left join lateral (
    select x.content, x.sender_id from public.resident_chat_group_messages x
    where x.group_id = g.id order by x.created_at desc limit 1
  ) lm on true
  left join public.profiles lp on lp.id = lm.sender_id
  where me.user_id = auth.uid()
  order by coalesce(g.last_message_at, g.created_at) desc;
$$;

revoke all on function public.resident_directory(text) from public, anon;
revoke all on function public.resident_group_create(text, uuid[]) from public, anon;
revoke all on function public.resident_group_add_members(uuid, uuid[]) from public, anon;
revoke all on function public.resident_group_rename(uuid, text) from public, anon;
revoke all on function public.resident_group_leave(uuid) from public, anon;
revoke all on function public.resident_group_mark_read(uuid) from public, anon;
revoke all on function public.resident_groups_mine() from public, anon;
grant execute on function public.resident_directory(text) to authenticated;
grant execute on function public.resident_group_create(text, uuid[]) to authenticated;
grant execute on function public.resident_group_add_members(uuid, uuid[]) to authenticated;
grant execute on function public.resident_group_rename(uuid, text) to authenticated;
grant execute on function public.resident_group_leave(uuid) to authenticated;
grant execute on function public.resident_group_mark_read(uuid) to authenticated;
grant execute on function public.resident_groups_mine() to authenticated;
grant execute on function public.is_resident_group_member(uuid) to authenticated;

grant select on public.resident_chat_groups to authenticated;
grant select on public.resident_chat_group_members to authenticated;
grant select, insert on public.resident_chat_group_messages to authenticated;

-- Tiempo real para los mensajes del grupo (RLS filtra por miembro).
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'resident_chat_group_messages') then
    alter publication supabase_realtime add table public.resident_chat_group_messages;
  end if;
end $$;
