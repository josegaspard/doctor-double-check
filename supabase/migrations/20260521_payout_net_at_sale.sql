-- =========================================================================
-- COMISIÓN POR-TIPO AL CONCRETARSE LA VENTA — el pago al doctor sale del neto
-- =========================================================================
-- Antes: pending_earnings acumulaba el BRUTO y la comisión (plana) se aplicaba
-- al pagar. Eso hace imposible la comisión por-tipo sobre un monto agregado.
--
-- Ahora: credit_doctor_earnings acredita el NETO (bruto − comisión por-tipo)
-- al concretarse cada venta. El pago simplemente entrega pending_earnings.
-- Esto alinea el pago con el libro contable (que ya registra la comisión
-- por-tipo) y permite que el superadmin defina % global o por tipo.
-- =========================================================================

-- fn_commission_rate: reconoce los 'source' que usan las edge functions.
create or replace function public.fn_commission_rate(p_kind text)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.payout_settings%rowtype;
  v numeric;
begin
  select * into s from public.payout_settings where id = 'default';
  if not found then return 0.20; end if;
  v := case
         when p_kind in ('consultation') then s.commission_consultation
         when p_kind in ('recording') then s.commission_recording
         when p_kind in ('live', 'live_chat_highlight') then s.commission_live
         when p_kind in ('chat') then s.commission_chat
         when p_kind in ('content', 'subscription', 'subscription_renewal') then s.commission_content
         else null
       end;
  v := coalesce(v, s.commission_percentage, 20);
  return round(v / 100.0, 4);
end;
$$;

-- Reemplaza credit_doctor_earnings: acredita NETO (comisión por-tipo aplicada).
-- p_apply_commission=false re-acredita en crudo (reversos de payouts).
-- Se elimina la versión vieja de 2 args para que TODA llamada (incluso las de
-- 2 args por defecto) acredite neto y nunca se sobrepague.
drop function if exists public.credit_doctor_earnings(uuid, numeric);

create or replace function public.credit_doctor_earnings(
  p_doctor_id uuid,
  p_amount numeric,
  p_sale_type text default null,
  p_apply_commission boolean default true
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_pending numeric;
  v_credit numeric;
begin
  if p_apply_commission then
    v_credit := round(p_amount * (1 - public.fn_commission_rate(p_sale_type)), 2);
  else
    v_credit := p_amount;
  end if;

  update doctor_profiles
    set pending_earnings = coalesce(pending_earnings, 0) + v_credit
    where user_id = p_doctor_id
    returning pending_earnings into v_new_pending;

  if not found then
    return -1;
  end if;
  return v_new_pending;
end;
$$;

-- Seguridad (igual que la versión revocada): sólo el service-role / definer.
revoke all on function public.credit_doctor_earnings(uuid, numeric, text, boolean) from public, anon, authenticated;
grant execute on function public.credit_doctor_earnings(uuid, numeric, text, boolean) to service_role;
