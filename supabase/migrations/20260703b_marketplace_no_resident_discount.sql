-- Fix dinero (2026-07-03): el descuento de residente (50%) NO debe aplicarse a compras
-- del MARKETPLACE. Antes se cobraba la mitad al residente pero al vendor se le acreditaba
-- el total → la plataforma absorbía el 50%. Las compras de contenido propio (grabaciones,
-- suscripciones) SÍ conservan el descuento (ahí no hay tercero, la plataforma absorbe lo suyo).
-- Sólo se modifica el overload de 4 args (el que usa purchase-marketplace-wallet).

CREATE OR REPLACE FUNCTION public.process_wallet_purchase(
  p_amount numeric,
  p_description text,
  p_metadata jsonb DEFAULT NULL::jsonb,
  p_idempotency_key text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;
  v_current_balance numeric;
  v_final_amount numeric;
  v_prev numeric;
begin
  v_user_id := auth.uid();
  if v_user_id is null then return jsonb_build_object('success', false, 'error', 'No authenticated user'); end if;
  if p_amount <= 0 then return jsonb_build_object('success', false, 'error', 'Invalid amount'); end if;

  -- Lock primero (serializa por usuario).
  select balance into v_current_balance from wallets where user_id = v_user_id for update;
  if not found then return jsonb_build_object('success', false, 'error', 'Wallet not found'); end if;

  -- Replay idempotente: misma key ya cobrada → devolver sin volver a cobrar.
  if p_idempotency_key is not null then
    select abs(amount) into v_prev from wallet_transactions
      where user_id = v_user_id and type = 'purchase'
        and metadata->>'idempotency_key' = p_idempotency_key
      limit 1;
    if found then
      return jsonb_build_object('success', true, 'amount_charged', v_prev,
                                'new_balance', v_current_balance, 'idempotent_replay', true);
    end if;
  end if;

  -- El marketplace (vendor externo) se cobra al precio REAL: sin descuento de residente,
  -- así lo cobrado == lo acreditado al vendor. El resto de compras conserva el descuento.
  if coalesce(p_metadata->>'source', '') = 'marketplace' then
    v_final_amount := p_amount;
  else
    v_final_amount := get_price_for_user(p_amount, v_user_id);
  end if;

  if v_current_balance < v_final_amount then return jsonb_build_object('success', false, 'error', 'Insufficient balance'); end if;

  insert into wallet_transactions (user_id, type, amount, description, status, metadata)
  values (v_user_id, 'purchase', -v_final_amount, p_description, 'paid',
          case when p_idempotency_key is null then p_metadata
               else coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('idempotency_key', p_idempotency_key) end);

  update wallets set balance = balance - v_final_amount, updated_at = now() where user_id = v_user_id;
  return jsonb_build_object('success', true, 'amount_charged', v_final_amount, 'new_balance', v_current_balance - v_final_amount);
end;
$function$;
