-- ============================================================================
-- 2026-07-02 (b) — Blindaje del flujo de aprobación (hallazgos de auditoría):
--   1) Un usuario podía AUTO-APROBARSE como vendor vía PostgREST (las políticas
--      RLS de marketplace_vendors solo validan user_id, no la columna status).
--   2) Un vendor podía publicar productos con approval_status='approved'
--      directo por API, saltándose la revisión del super admin.
--   3) Separación de tiendas: listing_type distingue el marketplace de
--      intermediación dr↔dr ('fee') de la tienda e-commerce de pacientes
--      ('ecommerce') para que una misma unidad no se venda por dos canales.
-- Patrón: triggers BEFORE + is_privileged_writer() (igual que
-- protect_marketplace_order_cols de 20260610). Idempotente.
-- ============================================================================

begin;

-- ── 1) marketplace_vendors: sólo el admin mueve status/notes ────────────────
create or replace function public.protect_marketplace_vendor_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_privileged_writer() then
    return new;  -- admin / service role / psql
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';       -- toda postulación nace pendiente
    new.notes := null;             -- las notas son del admin
    return new;
  end if;

  -- UPDATE de no privilegiado: la única transición permitida es
  -- rejected → pending (corregir y volver a postular). Todo lo demás se congela.
  if new.status is distinct from old.status then
    if not (old.status = 'rejected' and new.status = 'pending') then
      new.status := old.status;
    end if;
  end if;
  new.notes := old.notes;
  new.commission_rate := old.commission_rate;
  return new;
end;
$$;

drop trigger if exists trg_protect_marketplace_vendor_cols on public.marketplace_vendors;
create trigger trg_protect_marketplace_vendor_cols
  before insert or update on public.marketplace_vendors
  for each row execute function public.protect_marketplace_vendor_cols();

-- ── 2) marketplace_products: sólo el admin aprueba ──────────────────────────
create or replace function public.protect_marketplace_product_approval()
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
    new.approval_status := 'pending';   -- todo producto nuevo pasa por revisión
    new.approval_note := null;
    new.approved_at := null;
    new.approved_by := null;
    return new;
  end if;

  -- UPDATE de no privilegiado: sólo se permite reenviar a revisión un
  -- producto rechazado (rejected → pending); el resto queda congelado.
  if new.approval_status is distinct from old.approval_status then
    if old.approval_status = 'rejected' and new.approval_status = 'pending' then
      new.approval_note := null;
    else
      new.approval_status := old.approval_status;
      new.approval_note := old.approval_note;
    end if;
  else
    new.approval_note := old.approval_note;
  end if;
  new.approved_at := old.approved_at;
  new.approved_by := old.approved_by;
  return new;
end;
$$;

drop trigger if exists trg_protect_marketplace_product_approval on public.marketplace_products;
create trigger trg_protect_marketplace_product_approval
  before insert or update on public.marketplace_products
  for each row execute function public.protect_marketplace_product_approval();

-- ── 3) Separación de canales de venta ───────────────────────────────────────
alter table public.marketplace_products
  add column if not exists listing_type text not null default 'fee';

do $$ begin
  alter table public.marketplace_products
    add constraint marketplace_products_listing_type_check
    check (listing_type in ('fee', 'ecommerce'));
exception when duplicate_object then null; end $$;

-- Backfill: todo lo existente pertenece al marketplace de intermediación.
update public.marketplace_products set listing_type = 'fee' where listing_type is null;

commit;
