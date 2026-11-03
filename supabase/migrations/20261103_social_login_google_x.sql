-- Login y registro con Google y X (2026-11-03, petición del cliente).
-- Registro de cada alta/acceso por proveedor social, aviso a los admins en cada
-- alta y lectura del proveedor de cada usuario para el panel de Usuarios.

create table if not exists public.auth_provider_events (
  id bigserial primary key,
  user_id uuid not null,
  email text,
  name text,
  provider text not null,
  event text not null check (event in ('signup', 'login', 'link')),
  created_at timestamptz not null default now()
);
create index if not exists auth_provider_events_created_idx on public.auth_provider_events (created_at desc);
create index if not exists auth_provider_events_user_idx on public.auth_provider_events (user_id);

alter table public.auth_provider_events enable row level security;
drop policy if exists "admins leen accesos sociales" on public.auth_provider_events;
create policy "admins leen accesos sociales" on public.auth_provider_events
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create or replace function public.log_social_identity_event()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_event text;
  v_email text := coalesce(new.email, new.identity_data->>'email');
  v_name text := coalesce(new.identity_data->>'full_name', new.identity_data->>'name', new.identity_data->>'user_name');
  v_label text := case new.provider when 'google' then 'Google' when 'x' then 'X' when 'twitter' then 'X' else initcap(new.provider) end;
begin
  if new.provider = 'email' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_event := case when exists (
      select 1 from auth.identities i where i.user_id = new.user_id and i.id <> new.id
    ) then 'link' else 'signup' end;
  elsif new.last_sign_in_at is distinct from old.last_sign_in_at then
    v_event := 'login';
  else
    return new;
  end if;

  insert into public.auth_provider_events (user_id, email, name, provider, event)
  values (new.user_id, v_email, v_name, new.provider, v_event);

  if v_event = 'signup' then
    insert into public.notifications (user_id, type, title, message, data)
    select ur.user_id, 'system',
           'Nuevo registro con ' || v_label,
           coalesce(v_name || ' · ', '') || coalesce(v_email, 'sin correo') || ' se registró con ' || v_label || '.',
           jsonb_build_object('url', '/admin/users', 'provider', new.provider, 'new_user_id', new.user_id)
    from public.user_roles ur
    where ur.role = 'admin';
  end if;

  return new;
exception when others then
  -- Nunca bloquear un alta o un acceso por un fallo del registro.
  raise warning 'log_social_identity_event: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_social_identity_event on auth.identities;
create trigger on_social_identity_event
  after insert or update of last_sign_in_at on auth.identities
  for each row execute function public.log_social_identity_event();

-- Proveedores de acceso de cada usuario (solo admins).
create or replace function public.admin_user_providers()
returns table (user_id uuid, providers text[])
language sql
stable
security definer
set search_path = public, auth
as $$
  select i.user_id, array_agg(distinct i.provider order by i.provider)
  from auth.identities i
  where public.has_role(auth.uid(), 'admin')
  group by i.user_id;
$$;
revoke all on function public.admin_user_providers() from public, anon;
grant execute on function public.admin_user_providers() to authenticated;

-- Interruptores del panel: botones de Google y X encendidos por defecto.
update public.site_settings
set value = coalesce(value, '{}'::jsonb) || '{"enable_google_login": true, "enable_x_login": true}'::jsonb
where id = 'feature_toggles'
  and not (coalesce(value, '{}'::jsonb) ? 'enable_google_login');

-- Alta con Google/X sin rol → 'visitor' (elige rol en el Onboarding).
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    _role public.app_role;
    _name TEXT;
    _ced_esp TEXT;
    _signup_code TEXT;
    _code RECORD;
    _campaign_id uuid := NULL;
BEGIN
    -- ▸ ALTA CON GOOGLE / X (2026-11-03): el proveedor no manda rol. Entra como
    --   'visitor' (no choca con el candado de pacientes) y elige médico/residente
    --   en el Onboarding con set_onboarding_role.
    _role := COALESCE(
        (NEW.raw_user_meta_data->>'role')::public.app_role,
        CASE WHEN COALESCE(NEW.raw_app_meta_data->>'provider', 'email') <> 'email' THEN 'visitor'::public.app_role END,
        'patient'
    );
    IF _role = 'admin' THEN
        _role := 'patient';
    END IF;

    -- ▸ CANDADO DE PACIENTES (2026-08-17). El súper admin puede seguir dando de
    --   alta pacientes a mano con app_metadata.admin_created=true (auth.admin.createUser).
    --   Desde el 3-oct-2026 se lee de raw_app_meta_data: user_metadata lo controla el usuario.
    IF _role = 'patient'
       AND NOT public.patient_access_enabled()
       AND COALESCE(NEW.raw_app_meta_data->>'admin_created','') <> 'true' THEN
        RAISE EXCEPTION 'PATIENT_SIGNUP_DISABLED'
            USING HINT = 'El acceso para pacientes estará disponible próximamente.';
    END IF;

    -- ▸ CÓDIGO DE CAMPAÑA (opcional). Si viene uno, tiene que ser válido: dar por
    --   bueno un código caducado dejaría a la persona creyendo que tiene la promo.
    _signup_code := UPPER(NULLIF(TRIM(NEW.raw_user_meta_data->>'signup_code'), ''));
    IF _signup_code IS NOT NULL THEN
        SELECT c.id, c.campaign_id, c.status, ca.is_active, ca.starts_at, ca.expires_at, ca.target_role
          INTO _code
          FROM public.signup_codes c
          JOIN public.signup_campaigns ca ON ca.id = c.campaign_id
         WHERE c.code = _signup_code
         FOR UPDATE OF c;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'SIGNUP_CODE_INVALID' USING HINT = 'El código de registro no existe.';
        END IF;
        IF _code.status <> 'available' THEN
            RAISE EXCEPTION 'SIGNUP_CODE_USED' USING HINT = 'Ese código de registro ya se usó.';
        END IF;
        IF NOT _code.is_active
           OR (_code.starts_at  IS NOT NULL AND now() < _code.starts_at)
           OR (_code.expires_at IS NOT NULL AND now() > _code.expires_at) THEN
            RAISE EXCEPTION 'SIGNUP_CODE_EXPIRED' USING HINT = 'Ese código de registro ya no está vigente.';
        END IF;
        IF _code.target_role <> 'any' AND _code.target_role <> _role::text THEN
            RAISE EXCEPTION 'SIGNUP_CODE_WRONG_ROLE' USING HINT = 'Ese código no es para este tipo de cuenta.';
        END IF;
        _campaign_id := _code.campaign_id;
    END IF;

    _name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
    _ced_esp := NULLIF(NEW.raw_user_meta_data->>'cedula_especialidad','');

    INSERT INTO public.profiles (id, email, name, avatar_url, referred_by_doctor_code, signup_code, signup_campaign_id)
    VALUES (
        NEW.id, NEW.email, _name,
        NEW.raw_user_meta_data->>'avatar_url',
        NULLIF(NEW.raw_user_meta_data->>'doctor_code',''),
        _signup_code,
        _campaign_id
    );

    IF _signup_code IS NOT NULL THEN
        UPDATE public.signup_codes
           SET status = 'redeemed', redeemed_by = NEW.id, redeemed_at = now()
         WHERE id = _code.id;
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, _role);

    IF _role IN ('patient', 'resident', 'doctor', 'visitor') THEN
        INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0);
    END IF;

    IF _role = 'doctor' THEN
        INSERT INTO public.doctor_profiles (
            user_id, specialty, license, status,
            cedula_profesional, cedula_especialidad, cedula_especialidad_status,
            university, practice_hospital, country
        )
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'specialty', 'General'),
            COALESCE(NEW.raw_user_meta_data->>'license', ''),
            'pending',
            NULLIF(NEW.raw_user_meta_data->>'cedula_profesional',''),
            _ced_esp,
            CASE WHEN _ced_esp IS NOT NULL THEN 'pending' ELSE NULL END,
            NULLIF(NEW.raw_user_meta_data->>'university',''),
            NULLIF(NEW.raw_user_meta_data->>'hospital',''),
            NULLIF(NEW.raw_user_meta_data->>'country','')
        );
    END IF;

    IF _role = 'resident' THEN
        INSERT INTO public.resident_profiles (
            user_id, institution, specialty, year, status, cedula_profesional
        )
        VALUES (
            NEW.id,
            COALESCE(
                NULLIF(NEW.raw_user_meta_data->>'institution',''),
                NULLIF(NEW.raw_user_meta_data->>'university',''),
                NULLIF(NEW.raw_user_meta_data->>'hospital',''),
                ''
            ),
            COALESCE(NEW.raw_user_meta_data->>'specialty', 'General'),
            COALESCE(NULLIF(NEW.raw_user_meta_data->>'year','')::INTEGER, 1),
            'pending',
            NULLIF(NEW.raw_user_meta_data->>'cedula_profesional','')
        );
    END IF;

    RETURN NEW;
END;
$function$;
