-- Decisiones de Jose (2-oct-2026) sobre pagos y alta de médicos. Idempotente.
--  1. Aviso de «cambio de estado del pago» conectado UNA sola vez (fuera trg_notify_wallet_status;
--     queda wallet_status_change_notify, AFTER UPDATE OF status). notify_wallet_status_change
--     comparaba el enum con 'pending' (no existe) y rompía todo cambio de estado: se compara como texto.
--  2. Compras con SALDO acreditan al médico el NETO con la comisión por tipo (fn_commission_rate,
--     payout_settings), igual que Stripe: consulta y segunda opinión -> 'consultation'. El libro
--     contable registra la comisión de la plataforma también en segunda opinión, orientación desde
--     live, libros/cursos y mensaje destacado. El reembolso de consulta no atendida descuenta el neto.
--  3. Mensaje destacado de un live pagado con saldo (process_wallet_purchase con metadata
--     type=live_chat_highlight + live_id): ganancia neta al médico del live + earning con
--     buyer_id/concepto -> doctor_sales por el trigger existente.
--     credit_doctor_earnings salta el candado protect_doctor_profile_cols: hasta hoy, cuando la
--     compra la hacía el paciente, el trigger revertía pending_earnings y el médico recibía 0.
--  4. Aprobar la cédula (cedula_status -> 'approved') da de alta al médico (status = 'approved').
--     COFEPRIS no interviene.
-- Las funciones parten de su definición VIVA en producción del 2-oct-2026.

-- 1 -------------------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_notify_wallet_status ON public.wallet_transactions;
DROP TRIGGER IF EXISTS wallet_status_change_notify ON public.wallet_transactions;
CREATE TRIGGER wallet_status_change_notify AFTER UPDATE OF status ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_wallet_status_change();

-- El enum transaction_status no tiene 'pending': sin ::text la función fallaba en cualquier
-- cambio de estado (initiated -> paid/failed) y abortaba la actualización.
CREATE OR REPLACE FUNCTION public.notify_wallet_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'paid' AND OLD.status::text IN ('initiated','pending') THEN
      INSERT INTO public.notifications(user_id, type, title, message, data)
      VALUES (NEW.user_id, 'system', 'Pago confirmado',
              COALESCE(NEW.description, 'Tu pago ha sido confirmado.'),
              jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount, 'status', 'paid'));
    ELSIF NEW.status = 'failed' AND OLD.status::text IN ('initiated','pending') THEN
      INSERT INTO public.notifications(user_id, type, title, message, data)
      VALUES (NEW.user_id, 'system', 'Pago rechazado',
              COALESCE(NEW.description, 'Tu pago no se pudo procesar') || ' — intenta de nuevo o contacta soporte.',
              jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount, 'status', 'failed'));
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

-- 2 -------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credit_doctor_earnings(p_doctor_id uuid, p_amount numeric, p_sale_type text DEFAULT NULL::text, p_apply_commission boolean DEFAULT true)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_new_pending numeric;
  v_credit numeric;
  v_bypass text := current_setting('app.bypass_protect', true);
begin
  if p_apply_commission then
    v_credit := round(p_amount * (1 - public.fn_commission_rate(p_sale_type)), 2);
  else
    v_credit := p_amount;
  end if;

  -- Lo llama una RPC de compra en nombre del PACIENTE: sin esto, trg_protect_doctor_profile_cols
  -- devuelve pending_earnings a su valor anterior y el médico no recibe nada.
  perform set_config('app.bypass_protect', 'on', true);
  update doctor_profiles
    set pending_earnings = coalesce(pending_earnings, 0) + v_credit
    where user_id = p_doctor_id
    returning pending_earnings into v_new_pending;
  perform set_config('app.bypass_protect', coalesce(v_bypass, ''), true);

  if not found then
    return -1;
  end if;
  return v_new_pending;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.process_consultation_purchase(p_doctor_id uuid, p_amount numeric, p_patient_name text DEFAULT 'Paciente'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_current_balance DECIMAL;
  v_final_amount DECIMAL;
  v_chat_session_id UUID;
  v_consultation_id UUID;
  v_user_role app_role;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No authenticated user');
  END IF;
  
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  
  SELECT role INTO v_user_role FROM user_roles WHERE user_id = v_user_id LIMIT 1;
  
  SELECT balance INTO v_current_balance 
  FROM wallets 
  WHERE user_id = v_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  v_final_amount := get_price_for_user(p_amount, v_user_id);
  
  IF v_current_balance < v_final_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  SELECT id INTO v_chat_session_id
  FROM chat_sessions
  WHERE ((participant1_id = v_user_id AND participant2_id = p_doctor_id)
     OR (participant1_id = p_doctor_id AND participant2_id = v_user_id))
    AND status = 'active'
    AND is_double_check = false
  LIMIT 1;
  
  IF v_chat_session_id IS NULL THEN
    INSERT INTO chat_sessions (
      participant1_id, participant1_type, participant2_id, participant2_type, status, is_double_check
    )
    VALUES (
      v_user_id, COALESCE(v_user_role::text, 'patient')::chat_participant_type, p_doctor_id, 'doctor', 'active', false
    )
    RETURNING id INTO v_chat_session_id;
  END IF;
  
  INSERT INTO consultations (patient_id, doctor_id, chat_session_id, status)
  VALUES (v_user_id, p_doctor_id, v_chat_session_id, 'active')
  RETURNING id INTO v_consultation_id;
  
  INSERT INTO wallet_transactions (user_id, type, amount, description, status, metadata)
  VALUES (v_user_id, 'purchase', -v_final_amount, 'Consulta médica por chat', 'paid', 
          jsonb_build_object('doctor_id', p_doctor_id, 'type', 'consultation', 'consultation_id', v_consultation_id, 'session_id', v_chat_session_id));
  
  UPDATE wallets 
  SET balance = balance - v_final_amount, updated_at = now()
  WHERE user_id = v_user_id;
  
  -- UPSERT: renew entitlement if it already exists instead of failing
  INSERT INTO entitlements (user_id, type, is_active, expires_at)
  VALUES (v_user_id, 'chat', true, now() + interval '30 days')
  ON CONFLICT (user_id, type) 
  DO UPDATE SET is_active = true, expires_at = GREATEST(entitlements.expires_at, now()) + interval '30 days';
  
  -- Neto tras la comisión por tipo, igual que el pago con tarjeta (stripe-webhook).
  PERFORM public.credit_doctor_earnings(p_doctor_id, v_final_amount, 'consultation');
  
  INSERT INTO wallet_transactions (user_id, type, amount, description, status, metadata)
  VALUES (p_doctor_id, 'earning', v_final_amount, 'Ganancia por consulta médica', 'paid',
          jsonb_build_object('patient_id', v_user_id, 'source', 'consultation', 'consultation_id', v_consultation_id));
  
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (p_doctor_id, 'chat_message', 'Nueva consulta pagada',
          p_patient_name || ' ha pagado una consulta contigo',
          jsonb_build_object('patient_id', v_user_id, 'url', '/chat', 'session_id', v_chat_session_id));
  
  RETURN jsonb_build_object(
    'success', true, 
    'amount_charged', v_final_amount, 
    'new_balance', v_current_balance - v_final_amount,
    'session_id', v_chat_session_id,
    'consultation_id', v_consultation_id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.process_double_check_purchase(p_doctor_id uuid, p_amount numeric, p_description text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;
  v_current_balance numeric;
  v_final_amount numeric;
  v_doctor_status text;
  v_prev numeric;
begin
  v_user_id := auth.uid();
  if v_user_id is null then return jsonb_build_object('success', false, 'error', 'No authenticated user'); end if;
  if p_amount <= 0 or p_amount > 50000 then return jsonb_build_object('success', false, 'error', 'Invalid amount'); end if;

  select status into v_doctor_status from doctor_profiles where user_id = p_doctor_id;
  if v_doctor_status is distinct from 'approved' then return jsonb_build_object('success', false, 'error', 'Doctor not available'); end if;

  select balance into v_current_balance from wallets where user_id = v_user_id for update;
  if not found then return jsonb_build_object('success', false, 'error', 'Wallet not found'); end if;

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

  v_final_amount := get_price_for_user(p_amount, v_user_id);
  if v_current_balance < v_final_amount then return jsonb_build_object('success', false, 'error', 'Insufficient balance'); end if;

  insert into wallet_transactions (user_id, type, amount, description, status, metadata)
  values (v_user_id, 'purchase', -v_final_amount, p_description, 'paid',
    jsonb_build_object('type','double_check','doctor_id',p_doctor_id)
      || case when p_idempotency_key is null then '{}'::jsonb else jsonb_build_object('idempotency_key', p_idempotency_key) end);

  update wallets set balance = balance - v_final_amount, updated_at = now() where user_id = v_user_id;

  -- Neto tras la comisión por tipo, igual que el pago con tarjeta (stripe-webhook usa 'consultation').
  perform public.credit_doctor_earnings(p_doctor_id, v_final_amount, 'consultation');

  insert into wallet_transactions (user_id, type, amount, description, status, metadata)
  values (p_doctor_id, 'earning', v_final_amount, 'Ganancia por Segunda Opinión', 'paid',
    jsonb_build_object('source','double_check','patient_id',v_user_id,'concept','Segunda opinión médica'));

  return jsonb_build_object('success', true, 'amount_charged', v_final_amount, 'new_balance', v_current_balance - v_final_amount);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.request_consultation_refund(p_consultation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_consult RECORD;
  v_doctor_replied boolean;
  v_purchase_txn RECORD;
  v_hours_since numeric;
  v_no_show_hours numeric := 72;
  v_doctor_net numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No authenticated user');
  END IF;
  SELECT id, patient_id, doctor_id, chat_session_id, status, started_at
  INTO v_consult FROM consultations WHERE id = p_consultation_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Consultation not found'); END IF;
  IF v_consult.patient_id <> v_user_id THEN RETURN jsonb_build_object('success', false, 'error', 'Only the patient can request a refund'); END IF;
  IF v_consult.status = 'refunded' THEN RETURN jsonb_build_object('success', false, 'error', 'Already refunded'); END IF;
  IF v_consult.status = 'completed' THEN RETURN jsonb_build_object('success', false, 'error', 'Consultation completed'); END IF;
  v_hours_since := EXTRACT(EPOCH FROM (now() - v_consult.started_at)) / 3600;
  IF v_hours_since < v_no_show_hours THEN
    RETURN jsonb_build_object('success', false, 'error', 'Refund available after ' || v_no_show_hours || 'h', 'hours_remaining', v_no_show_hours - v_hours_since);
  END IF;
  SELECT EXISTS(SELECT 1 FROM chat_messages WHERE session_id = v_consult.chat_session_id AND sender_id = v_consult.doctor_id) INTO v_doctor_replied;
  IF v_doctor_replied THEN RETURN jsonb_build_object('success', false, 'error', 'Doctor ya respondio'); END IF;
  SELECT id, amount INTO v_purchase_txn FROM wallet_transactions
  WHERE user_id = v_user_id AND type = 'purchase' AND status = 'paid' AND metadata->>'consultation_id' = p_consultation_id::text
  ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Original purchase not found'); END IF;
  UPDATE wallets SET balance = balance + ABS(v_purchase_txn.amount), updated_at = now() WHERE user_id = v_user_id;
  INSERT INTO wallet_transactions (user_id, type, amount, description, status, metadata) VALUES
    (v_user_id, 'refund', ABS(v_purchase_txn.amount), 'Reembolso por consulta no atendida', 'paid',
     jsonb_build_object('consultation_id', p_consultation_id, 'original_txn_id', v_purchase_txn.id));
  -- Al médico se le acreditó el neto (comisión por tipo): se le descuenta ese neto, no el bruto.
  v_doctor_net := round(ABS(v_purchase_txn.amount) * (1 - public.fn_commission_rate('consultation')), 2);
  PERFORM set_config('app.bypass_protect', 'on', true);
  UPDATE doctor_profiles SET pending_earnings = GREATEST(COALESCE(pending_earnings,0) - v_doctor_net, 0) WHERE user_id = v_consult.doctor_id;
  PERFORM set_config('app.bypass_protect', '', true);
  INSERT INTO wallet_transactions (user_id, type, amount, description, status, metadata) VALUES
    (v_consult.doctor_id, 'refund', -ABS(v_purchase_txn.amount), 'Reverso por consulta no atendida', 'paid',
     jsonb_build_object('patient_id', v_user_id, 'consultation_id', p_consultation_id, 'original_txn_id', v_purchase_txn.id));
  UPDATE consultations SET status = 'refunded', ended_at = now() WHERE id = p_consultation_id;
  UPDATE chat_sessions SET status = 'archived' WHERE id = v_consult.chat_session_id;
  INSERT INTO notifications (user_id, type, title, message, data) VALUES
    (v_consult.doctor_id, 'chat_message', 'Reembolso emitido', 'Paciente solicito reembolso por consulta no atendida (72h).',
     jsonb_build_object('consultation_id', p_consultation_id, 'patient_id', v_user_id));
  RETURN jsonb_build_object('success', true, 'refunded_amount', ABS(v_purchase_txn.amount));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_ledger_wallet_txn()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_kind text;
  v_gross numeric;
  v_meta jsonb;
  v_orig text;
  v_orig_total numeric;
  v_ratio numeric;
  v_iva numeric;
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

  elsif new.type = 'refund' then
    -- El marketplace tiene su propio libro; sus reembolsos se revierten allí.
    if (new.metadata->>'source') = 'marketplace' or (new.metadata ? 'order_id') then
      return new;
    end if;
    v_gross := abs(new.amount);
    v_orig := new.metadata->>'original_transaction_id';
    -- Si se conoce la venta original, revertir su asiento EXACTO (proporcional a
    -- reembolsos parciales) volteando debe/haber → siempre cuadra.
    if v_orig is not null and exists (select 1 from public.accounting_ledger where transaction_group = v_orig::uuid) then
      select sum(amount) into v_orig_total from public.accounting_ledger
        where transaction_group = v_orig::uuid and entry_type = 'debit';
      v_ratio := case when coalesce(v_orig_total, 0) > 0 then least(1.0, v_gross / v_orig_total) else 1.0 end;
      insert into public.accounting_ledger (transaction_group, entry_type, account, amount, currency, description, metadata)
        select new.id,
               case when entry_type = 'debit' then 'credit' else 'debit' end,
               account, round(amount * v_ratio, 2), currency,
               'Reverso por reembolso', v_meta || jsonb_build_object('reverses', v_orig)
        from public.accounting_ledger where transaction_group = v_orig::uuid;
      return new;
    end if;
    -- Fallback genérico: salida de caja, revertir ingreso plataforma + IVA.
    v_iva := round(v_gross * 0.16 / 1.16, 2);
    insert into public.accounting_ledger (transaction_group, entry_type, account, amount, currency, description, metadata) values
      (new.id, 'debit',  'revenue_platform', v_gross - v_iva, 'MXN', 'Reverso ingreso por reembolso', v_meta),
      (new.id, 'debit',  'tax_iva_payable',  v_iva,           'MXN', 'Reverso IVA por reembolso', v_meta),
      (new.id, 'credit', 'cash_in',          v_gross,         'MXN', 'Salida de caja por reembolso', v_meta);
    return new;

  elsif new.type = 'purchase' then
    v_gross := abs(new.amount);
    -- El marketplace tiene su propio libro (fn_record_marketplace_earning).
    if (new.metadata ? 'order_id')
       or (new.metadata->>'source' = 'marketplace')
       or coalesce(new.description,'') ilike '%marketplace%' then
      return new;
    end if;
    -- Consulta, segunda opinión y orientación desde live: comisión 'consultation' (lo que se
    -- acredita al médico con tarjeta y con saldo).
    if (new.metadata->>'type') in ('consultation', 'double_check', 'live_consultation') then
      v_kind := 'consultation';
    elsif (new.metadata->>'type') = 'live_chat_highlight' then
      v_kind := 'live_chat_highlight';
    elsif new.metadata ? 'content_id' then
      v_kind := 'content';
    elsif (new.metadata ? 'recording_id') or coalesce(new.description,'') ilike 'grabaci%' then
      v_kind := 'recording';
    else
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
$function$
;

CREATE OR REPLACE FUNCTION public.process_wallet_purchase(p_amount numeric, p_description text, p_metadata jsonb DEFAULT NULL::jsonb, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;
  v_current_balance numeric;
  v_final_amount numeric;
  v_prev numeric;
  v_live_doctor uuid;
  v_live_txt text;
  v_purchase_id uuid;
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

  -- Mensaje destacado de un live: el médico se toma del live (no del cliente).
  if coalesce(p_metadata->>'type', '') = 'live_chat_highlight' then
    v_live_txt := p_metadata->>'live_id';
    if v_live_txt ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select doctor_id into v_live_doctor from lives where id = v_live_txt::uuid;
    end if;
    if v_live_doctor = v_user_id then v_live_doctor := null; end if;
  end if;

  insert into wallet_transactions (user_id, type, amount, description, status, metadata)
  values (v_user_id, 'purchase', -v_final_amount, p_description, 'paid',
          case when p_idempotency_key is null then p_metadata
               else coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('idempotency_key', p_idempotency_key) end
          || case when v_live_doctor is not null then jsonb_build_object('doctor_id', v_live_doctor) else '{}'::jsonb end)
  returning id into v_purchase_id;

  update wallets set balance = balance - v_final_amount, updated_at = now() where user_id = v_user_id;

  -- Ganancia del médico por el mensaje destacado: neto con la comisión 'live_chat_highlight',
  -- igual que con tarjeta; el earning (bruto, con comprador y concepto) alimenta doctor_sales.
  if v_live_doctor is not null then
    perform public.credit_doctor_earnings(v_live_doctor, v_final_amount, 'live_chat_highlight');
    insert into wallet_transactions (user_id, type, amount, description, status, metadata)
    values (v_live_doctor, 'earning', v_final_amount, 'Ganancia por mensaje destacado en live', 'paid',
            jsonb_build_object('source', 'live_chat_highlight', 'reference_id', v_live_txt,
                               'buyer_id', v_user_id, 'purchase_txn_id', v_purchase_id,
                               'concept', 'Mensaje destacado en transmisión en vivo'));
  end if;
  return jsonb_build_object('success', true, 'amount_charged', v_final_amount, 'new_balance', v_current_balance - v_final_amount);
end;
$function$
;

-- 4 -------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_approve_doctor_on_cedula()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Corre después de trg_protect_doctor_profile_cols (orden alfabético): si quien actualiza no
  -- es admin, cedula_status ya volvió a su valor anterior y aquí no pasa nada.
  if new.cedula_status = 'approved'
     and old.cedula_status is distinct from 'approved'
     and new.status is distinct from 'approved' then
    new.status := 'approved';
  end if;
  return new;
end;
$function$
;

DROP TRIGGER IF EXISTS trg_zz_approve_doctor_on_cedula ON public.doctor_profiles;
CREATE TRIGGER trg_zz_approve_doctor_on_cedula BEFORE UPDATE OF cedula_status ON public.doctor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_approve_doctor_on_cedula();
