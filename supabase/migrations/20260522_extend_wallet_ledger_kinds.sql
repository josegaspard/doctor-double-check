-- =========================================================================
-- Extiende fn_ledger_wallet_txn para clasificar TODOS los tipos de venta.
-- =========================================================================
-- Antes: solo 'consultation' y 'recording' obtenían comisión por-tipo. Si en
-- el futuro alguna compra de live/chat/content pasara por wallet_transactions
-- (en lugar de Stripe webhook directo), caería a 'other' = 100% plataforma.
--
-- Ahora detecta consultation, recording, live, chat, content desde:
--   - metadata->>'type'   (clave canónica en producción para 'consultation')
--   - metadata->>'kind'   (clave usada internamente por fn_post_service_sale)
--   - metadata->>'source' (clave usada en algunas filas viejas)
--   - presencia de *_id (recording_id, live_id, chat_id, content_id)
--   - heurística de descripción
-- =========================================================================

create or replace function public.fn_ledger_wallet_txn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_gross numeric;
  v_meta jsonb;
  v_type_hint text;
begin
  if new.status is distinct from 'paid' then return new; end if;
  if exists (select 1 from public.accounting_ledger where transaction_group = new.id) then
    return new;
  end if;

  v_meta := jsonb_build_object('source', 'wallet_transaction', 'wallet_txn', new.id);

  if new.type = 'topup' then
    insert into public.accounting_ledger (transaction_group, entry_type, account, amount, currency, description, metadata) values
      (new.id, 'debit',  'cash_in',               abs(new.amount), 'MXN', 'Recarga de wallet', v_meta),
      (new.id, 'credit', 'liability_user_wallet', abs(new.amount), 'MXN', 'Saldo a favor del usuario', v_meta);
    return new;

  elsif new.type = 'purchase' then
    v_gross := abs(new.amount);
    -- El marketplace tiene su propio libro: no duplicar.
    if (new.metadata ? 'order_id') or coalesce(new.description,'') ilike '%marketplace%' then
      return new;
    end if;

    -- Clasificar usando metadata.type / kind / source y luego *_id / descripción.
    v_type_hint := lower(coalesce(
      new.metadata->>'type',
      new.metadata->>'kind',
      new.metadata->>'source',
      ''
    ));

    if v_type_hint in ('consultation','live','chat','content','recording') then
      v_kind := v_type_hint;
    elsif (new.metadata ? 'recording_id') or coalesce(new.description,'') ilike 'grabaci%' or coalesce(new.description,'') ilike 'recording%' then
      v_kind := 'recording';
    elsif (new.metadata ? 'live_id') or coalesce(new.description,'') ilike '%en vivo%' or coalesce(new.description,'') ilike '%live%' then
      v_kind := 'live';
    elsif (new.metadata ? 'chat_id') or coalesce(new.description,'') ilike '%chat%' then
      v_kind := 'chat';
    elsif (new.metadata ? 'content_id') or coalesce(new.description,'') ilike '%contenido premium%' then
      v_kind := 'content';
    elsif (new.metadata ? 'consultation_id') or coalesce(new.description,'') ilike '%consulta%' or coalesce(new.description,'') ilike '%orientaci%' then
      v_kind := 'consultation';
    else
      -- Servicios no-médicos (storage_upgrade, etc.) — plataforma 100%.
      v_kind := 'other';
    end if;

    perform public.fn_post_service_sale(
      new.id, v_kind, v_gross, 'MXN',
      coalesce(new.description, 'Venta de servicio'),
      v_meta || jsonb_build_object('kind', v_kind)
    );
    return new;
  end if;

  return new;
exception when others then
  return new;
end;
$$;
