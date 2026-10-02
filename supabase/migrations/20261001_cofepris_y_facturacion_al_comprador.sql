-- 2026-10-01 · Cliente: COFEPRIS en la verificación del médico + facturas a nombre del comprador
--
-- 1) COFEPRIS: el médico declara si tiene registro/permiso COFEPRIS. Si lo tiene,
--    tipo + número/folio + documento (foto o PDF) → revisión del admin. Hasta hoy
--    cofepris_status valía 'pending' por defecto para TODOS (aunque nadie hubiera
--    puesto número) y el trigger de protección revertía en silencio el «reenviar».
-- 2) Facturación: las facturas de los médicos van a nombre y RFC de quien les compra,
--    no de la plataforma. Cada comprador guarda sus datos fiscales (CFDI 4.0) antes de
--    comprar a un médico; cada venta queda en doctor_sales con la foto de esos datos y
--    el médico sube ahí su CFDI (PDF + XML), que ve el comprador.
--
-- Idempotente. Se aplica con APLICAR-2026-10-01.sh.

-- ══════════════════════════ 1. COFEPRIS ══════════════════════════

alter table public.doctor_profiles
  add column if not exists cofepris_has boolean,
  add column if not exists cofepris_doc_type text,
  add column if not exists cofepris_doc_url text,
  add column if not exists cofepris_submitted_at timestamptz;

alter table public.doctor_profiles alter column cofepris_status drop default;

-- Sin número no hay nada que revisar: fuera el 'pending' de fábrica.
update public.doctor_profiles
   set cofepris_status = null, cofepris_rejection_reason = null
 where coalesce(trim(cofepris_permit), '') = ''
   and cofepris_doc_url is null;

alter table public.onboarding_progress add column if not exists cofepris jsonb;

-- El dueño ya no toca a mano los campos de credenciales: pasa por submit_cofepris /
-- resubmit_credential (que validan y dejan el estado en 'pending').
create or replace function public.protect_doctor_profile_cols()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if public.is_privileged_writer() then return new; end if;
  new.status               := old.status;
  new.cedula_status        := old.cedula_status;
  new.cofepris_status      := old.cofepris_status;
  new.payouts_enabled      := old.payouts_enabled;
  new.pending_earnings     := old.pending_earnings;
  new.total_earnings       := old.total_earnings;
  new.stripe_account_id    := old.stripe_account_id;
  new.manual_badge         := old.manual_badge;
  new.badge_override       := old.badge_override;
  new.rating               := old.rating;              -- reputacion: solo el sistema/admin
  new.total_consultations  := old.total_consultations; -- reputacion: solo el sistema/admin
  new.followers_count      := old.followers_count;     -- reputacion: solo el sistema/admin
  -- COFEPRIS: solo vía submit_cofepris (si no, un permiso aprobado podría cambiar de número)
  new.cofepris_permit           := old.cofepris_permit;
  new.cofepris_has              := old.cofepris_has;
  new.cofepris_doc_type         := old.cofepris_doc_type;
  new.cofepris_doc_url          := old.cofepris_doc_url;
  new.cofepris_submitted_at     := old.cofepris_submitted_at;
  new.cofepris_rejection_reason := old.cofepris_rejection_reason;
  new.cedula_rejection_reason   := old.cedula_rejection_reason;
  return new;
end;
$$;

create or replace function public.submit_cofepris(
  p_has boolean,
  p_doc_type text default null,
  p_permit text default null,
  p_doc_path text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_permit text := nullif(trim(coalesce(p_permit, '')), '');
  v_name text;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;
  if not exists (select 1 from doctor_profiles where user_id = v_uid) then
    return jsonb_build_object('success', false, 'error', 'not_a_doctor');
  end if;
  if p_has is null then
    return jsonb_build_object('success', false, 'error', 'answer_required');
  end if;
  -- Validar ANTES de activar el bypass (si no, un return temprano lo dejaba encendido).
  -- Cambiar un permiso ya aprobado es válido: vuelve a 'pending' y se revisa de nuevo.
  if p_has then
    if p_doc_type is null or p_doc_type not in
       ('aviso_funcionamiento', 'licencia_sanitaria', 'permiso_controlados', 'permiso_publicidad', 'otro') then
      return jsonb_build_object('success', false, 'error', 'invalid_doc_type');
    end if;
    if v_permit is null or length(v_permit) < 4 or length(v_permit) > 50 then
      return jsonb_build_object('success', false, 'error', 'invalid_permit');
    end if;
    if p_doc_path is null or split_part(p_doc_path, '/', 1) <> v_uid::text then
      return jsonb_build_object('success', false, 'error', 'document_required');
    end if;
  end if;

  perform set_config('app.bypass_protect', 'on', true);

  if p_has = false then
    update doctor_profiles
       set cofepris_has = false, cofepris_permit = null, cofepris_doc_type = null,
           cofepris_doc_url = null, cofepris_status = null, cofepris_rejection_reason = null,
           cofepris_submitted_at = now()
     where user_id = v_uid;
    perform set_config('app.bypass_protect', 'off', true);
    return jsonb_build_object('success', true, 'status', null);
  end if;

  update doctor_profiles
     set cofepris_has = true, cofepris_doc_type = p_doc_type, cofepris_permit = v_permit,
         cofepris_doc_url = p_doc_path, cofepris_status = 'pending',
         cofepris_rejection_reason = null, cofepris_submitted_at = now()
   where user_id = v_uid;
  perform set_config('app.bypass_protect', 'off', true);

  select name into v_name from profiles where id = v_uid;
  insert into notifications (user_id, type, title, message, data)
  select ur.user_id, 'system', 'Permiso COFEPRIS por revisar',
         coalesce(v_name, 'Un médico') || ' envió su permiso COFEPRIS para verificación.',
         jsonb_build_object('url', '/admin/verifications', 'doctor_id', v_uid, 'kind', 'cofepris')
    from user_roles ur where ur.role = 'admin';

  return jsonb_build_object('success', true, 'status', 'pending');
end;
$$;

-- Reenviar una credencial rechazada (cédula o COFEPRIS) sin cambiarla.
create or replace function public.resubmit_credential(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_rows int := 0;
begin
  if v_uid is null then return jsonb_build_object('success', false, 'error', 'not_authenticated'); end if;
  if p_kind not in ('cedula', 'cofepris') then
    return jsonb_build_object('success', false, 'error', 'invalid_kind');
  end if;
  perform set_config('app.bypass_protect', 'on', true);
  if p_kind = 'cedula' then
    update doctor_profiles set cedula_status = 'pending', cedula_rejection_reason = null
     where user_id = v_uid and cedula_status = 'rejected';
  else
    update doctor_profiles set cofepris_status = 'pending', cofepris_rejection_reason = null,
           cofepris_submitted_at = now()
     where user_id = v_uid and cofepris_status = 'rejected' and cofepris_doc_url is not null;
  end if;
  -- ROW_COUNT antes del perform: PERFORM pone FOUND = true siempre.
  get diagnostics v_rows = row_count;
  perform set_config('app.bypass_protect', 'off', true);
  if v_rows = 0 then return jsonb_build_object('success', false, 'error', 'nothing_to_resubmit'); end if;
  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.submit_cofepris(boolean, text, text, text) from public, anon;
revoke all on function public.resubmit_credential(text) from public, anon;
grant execute on function public.submit_cofepris(boolean, text, text, text) to authenticated;
grant execute on function public.resubmit_credential(text) to authenticated;

-- El membrete de la receta solo lleva el permiso COFEPRIS si el equipo lo APROBÓ
-- (antes salía cualquier número escrito por el médico, sin revisar).
CREATE OR REPLACE FUNCTION public.get_doctor_prescription_credentials(p_doctor_user_id uuid)
RETURNS TABLE(specialty text, secondary_specialties jsonb, license text,
              cedula_profesional text, cedula_especialidad text, numero_consejo text,
              university text, workplaces jsonb, practice_hospital text, cofepris_permit text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT dp.specialty, to_jsonb(dp.secondary_specialties), dp.license,
         dp.cedula_profesional, dp.cedula_especialidad, dp.numero_consejo,
         dp.university, to_jsonb(dp.workplaces), dp.practice_hospital,
         CASE WHEN dp.cofepris_status = 'approved' THEN dp.cofepris_permit END
  FROM public.doctor_profiles dp
  WHERE dp.user_id = p_doctor_user_id
    AND public.can_view_doctor_credentials(p_doctor_user_id)
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_doctor_prescription_credentials(uuid) FROM anon;

-- ══════════════════════ 2. DATOS FISCALES DEL COMPRADOR ══════════════════════

create table if not exists public.billing_profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  rfc         text not null,
  legal_name  text not null,
  tax_zip     text not null,
  tax_regime  text not null,
  cfdi_use    text not null default 'D01',
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint billing_rfc_format   check (rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'),
  constraint billing_name_len     check (length(trim(legal_name)) between 3 and 254),
  constraint billing_zip_format   check (tax_zip ~ '^[0-9]{5}$'),
  constraint billing_regime_fmt   check (tax_regime ~ '^[0-9]{3}$'),
  constraint billing_use_fmt      check (cfdi_use ~ '^[A-Z]{1,2}[0-9]{2}$'),
  constraint billing_email_len    check (email is null or length(email) <= 254)
);

alter table public.billing_profiles enable row level security;

drop policy if exists billing_profiles_own_select on public.billing_profiles;
create policy billing_profiles_own_select on public.billing_profiles for select to authenticated
  using ((select auth.uid()) = user_id or public.has_role((select auth.uid()), 'admin'::app_role));
drop policy if exists billing_profiles_own_insert on public.billing_profiles;
create policy billing_profiles_own_insert on public.billing_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists billing_profiles_own_update on public.billing_profiles;
create policy billing_profiles_own_update on public.billing_profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop trigger if exists trg_billing_profiles_updated_at on public.billing_profiles;
create trigger trg_billing_profiles_updated_at before update on public.billing_profiles
  for each row execute function public.update_updated_at_column();

-- ══════════════════════ 3. VENTAS DEL MÉDICO A FACTURAR ══════════════════════

create table if not exists public.doctor_sales (
  id              uuid primary key default gen_random_uuid(),
  doctor_id       uuid not null references auth.users(id) on delete cascade,
  buyer_id        uuid references auth.users(id) on delete set null,
  earning_tx_id   uuid unique references public.wallet_transactions(id) on delete set null,
  sale_type       text not null,
  reference_id    text,
  concept         text not null,
  amount          numeric(12,2) not null check (amount > 0),
  currency        text not null default 'MXN',
  buyer_fiscal    jsonb,
  invoice_status  text not null default 'pending'
                  check (invoice_status in ('pending', 'issued', 'cancelled')),
  cfdi_uuid       text,
  invoice_pdf_path text,
  invoice_xml_path text,
  invoiced_at     timestamptz,
  refunded_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_doctor_sales_doctor on public.doctor_sales (doctor_id, created_at desc);
create index if not exists idx_doctor_sales_buyer  on public.doctor_sales (buyer_id, created_at desc);
create index if not exists idx_doctor_sales_pending on public.doctor_sales (doctor_id) where invoice_status = 'pending';

alter table public.doctor_sales enable row level security;

drop policy if exists doctor_sales_select on public.doctor_sales;
create policy doctor_sales_select on public.doctor_sales for select to authenticated
  using ((select auth.uid()) = doctor_id
      or (select auth.uid()) = buyer_id
      or public.has_role((select auth.uid()), 'admin'::app_role));
-- Sin políticas de escritura: solo el trigger y las RPC (security definer) escriben.

create or replace function public.fn_billing_snapshot(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object('rfc', b.rfc, 'legal_name', b.legal_name, 'tax_zip', b.tax_zip,
                            'tax_regime', b.tax_regime, 'cfdi_use', b.cfdi_use,
                            'email', coalesce(b.email, p.email))
    from billing_profiles b left join profiles p on p.id = b.user_id
   where b.user_id = p_user;
$$;
revoke all on function public.fn_billing_snapshot(uuid) from public, anon, authenticated;

-- Toda venta a un médico deja un 'earning' en wallet_transactions (webhook de Stripe,
-- monedero, RPC de consulta). Ese es el punto único donde nace la venta a facturar.
create or replace function public.fn_record_doctor_sale()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_buyer_txt text := coalesce(nullif(new.metadata->>'buyer_id', ''), nullif(new.metadata->>'patient_id', ''));
  v_buyer uuid;
  v_concept text;
begin
  if new.type <> 'earning' or coalesce(new.amount, 0) <= 0 then return new; end if;
  begin
    if v_buyer_txt ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_buyer := v_buyer_txt::uuid;
    end if;
    v_concept := coalesce(nullif(new.metadata->>'concept', ''),
                          regexp_replace(coalesce(new.description, 'Servicio médico'), '^Ganancia por (venta de )?', '', 'i'));
    v_concept := upper(left(v_concept, 1)) || substr(v_concept, 2);
    insert into doctor_sales (doctor_id, buyer_id, earning_tx_id, sale_type, reference_id, concept, amount, buyer_fiscal, created_at)
    values (new.user_id, v_buyer, new.id,
            coalesce(nullif(new.metadata->>'source', ''), 'venta'),
            coalesce(new.metadata->>'reference_id', new.metadata->>'consultation_id',
                     new.metadata->>'content_id', new.metadata->>'recording_id'),
            left(v_concept, 300), new.amount,
            case when v_buyer is not null then public.fn_billing_snapshot(v_buyer) end,
            new.created_at)
    on conflict (earning_tx_id) do nothing;
  exception when others then
    -- Nunca romper un cobro por esto.
    raise warning 'fn_record_doctor_sale: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_record_doctor_sale on public.wallet_transactions;
create trigger trg_record_doctor_sale after insert on public.wallet_transactions
  for each row when (new.type = 'earning') execute function public.fn_record_doctor_sale();

-- Reembolso → la venta pendiente se anula; si ya estaba facturada se marca para que el
-- médico cancele el CFDI ante el SAT.
create or replace function public.fn_refund_doctor_sale()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_orig jsonb;
  v_ref text;
begin
  if new.type <> 'refund' then return new; end if;
  begin
    if (new.metadata->>'original_transaction_id') ~* '^[0-9a-f-]{36}$' then
      select metadata into v_orig from wallet_transactions where id = (new.metadata->>'original_transaction_id')::uuid;
    elsif (new.metadata->>'original_txn_id') ~* '^[0-9a-f-]{36}$' then
      select metadata into v_orig from wallet_transactions where id = (new.metadata->>'original_txn_id')::uuid;
    end if;
    v_ref := coalesce(new.metadata->>'consultation_id', new.metadata->>'content_id', new.metadata->>'recording_id',
                      v_orig->>'consultation_id', v_orig->>'content_id', v_orig->>'recording_id');
    if v_ref is null then return new; end if;
    update doctor_sales
       set refunded_at = now(),
           invoice_status = case when invoice_status = 'pending' then 'cancelled' else invoice_status end
     where reference_id = v_ref and refunded_at is null
       and (buyer_id = new.user_id or doctor_id = new.user_id);
  exception when others then
    raise warning 'fn_refund_doctor_sale: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_refund_doctor_sale on public.wallet_transactions;
create trigger trg_refund_doctor_sale after insert on public.wallet_transactions
  for each row when (new.type = 'refund') execute function public.fn_refund_doctor_sale();

-- Si el comprador corrige sus datos, las ventas aún sin facturar toman los nuevos.
create or replace function public.fn_billing_profile_sync()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update doctor_sales set buyer_fiscal = public.fn_billing_snapshot(new.user_id)
   where buyer_id = new.user_id and invoice_status = 'pending';
  return new;
end;
$$;

drop trigger if exists trg_billing_profile_sync on public.billing_profiles;
create trigger trg_billing_profile_sync after insert or update on public.billing_profiles
  for each row execute function public.fn_billing_profile_sync();

-- Candado en el cobro por monedero: sin datos fiscales no se compra a un médico.
-- Solo para cargos que inicia el propio usuario (auth.uid() presente); los cargos con
-- tarjeta se frenan antes, al crear el checkout (edge functions), porque aquí Stripe
-- ya habría cobrado.
create or replace function public.fn_require_billing_profile()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.type = 'purchase'
     and auth.uid() is not null
     and new.user_id = auth.uid()
     and coalesce(new.metadata, '{}'::jsonb) ?| array['doctor_id', 'creator_id', 'content_id', 'recording_id', 'consultation_id', 'live_id']
     and not exists (select 1 from billing_profiles where user_id = new.user_id) then
    raise exception 'billing_profile_required' using errcode = 'P0001',
      hint = 'Captura tu RFC y nombre fiscal antes de comprar: el médico te factura a ti.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_require_billing_profile on public.wallet_transactions;
create trigger trg_require_billing_profile before insert on public.wallet_transactions
  for each row when (new.type = 'purchase') execute function public.fn_require_billing_profile();

-- El médico adjunta su CFDI (PDF + XML) a una venta.
create or replace function public.doctor_attach_sale_invoice(
  p_sale_id uuid,
  p_cfdi_uuid text,
  p_pdf_path text,
  p_xml_path text
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_sale doctor_sales%rowtype;
  v_prefix text;
begin
  if v_uid is null then return jsonb_build_object('success', false, 'error', 'not_authenticated'); end if;
  select * into v_sale from doctor_sales where id = p_sale_id for update;
  if not found or v_sale.doctor_id <> v_uid then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;
  if v_sale.invoice_status = 'cancelled' then
    return jsonb_build_object('success', false, 'error', 'sale_cancelled');
  end if;
  if p_cfdi_uuid is null or upper(trim(p_cfdi_uuid)) !~ '^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$' then
    return jsonb_build_object('success', false, 'error', 'invalid_cfdi_uuid');
  end if;
  v_prefix := v_uid::text || '/' || p_sale_id::text || '/';
  if p_pdf_path is null or left(p_pdf_path, length(v_prefix)) <> v_prefix
     or p_xml_path is null or left(p_xml_path, length(v_prefix)) <> v_prefix then
    return jsonb_build_object('success', false, 'error', 'files_required');
  end if;

  update doctor_sales
     set invoice_status = 'issued', cfdi_uuid = upper(trim(p_cfdi_uuid)),
         invoice_pdf_path = p_pdf_path, invoice_xml_path = p_xml_path, invoiced_at = now()
   where id = p_sale_id;

  if v_sale.buyer_id is not null then
    insert into notifications (user_id, type, title, message, data)
    values (v_sale.buyer_id, 'system', 'Tu factura está lista',
            'Ya puedes descargar la factura (PDF y XML) de: ' || v_sale.concept,
            jsonb_build_object('url',
              case when exists (select 1 from doctor_profiles d where d.user_id = v_sale.buyer_id)
                   then '/settings?s=finanzas&f=compras' else '/settings?s=billing' end,
              'sale_id', p_sale_id));
  end if;

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.doctor_attach_sale_invoice(uuid, text, text, text) from public, anon;
grant execute on function public.doctor_attach_sale_invoice(uuid, text, text, text) to authenticated;

-- ══════════════════════ 4. ARCHIVOS DE FACTURAS ══════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sale-invoices', 'sale-invoices', false, 5242880,
        array['application/pdf', 'application/xml', 'text/xml'])
on conflict (id) do nothing;

drop policy if exists "sale_invoices_doctor_insert" on storage.objects;
create policy "sale_invoices_doctor_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'sale-invoices'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and exists (select 1 from public.doctor_sales s
                           where s.id::text = (storage.foldername(name))[2]
                             and s.doctor_id = (select auth.uid())));

drop policy if exists "sale_invoices_doctor_update" on storage.objects;
create policy "sale_invoices_doctor_update" on storage.objects for update to authenticated
  using (bucket_id = 'sale-invoices' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "sale_invoices_select" on storage.objects;
create policy "sale_invoices_select" on storage.objects for select to authenticated
  using (bucket_id = 'sale-invoices' and (
           (storage.foldername(name))[1] = (select auth.uid())::text
        or public.has_role((select auth.uid()), 'admin'::app_role)
        or exists (select 1 from public.doctor_sales s
                    where s.buyer_id = (select auth.uid())
                      and (s.invoice_pdf_path = name or s.invoice_xml_path = name))));
