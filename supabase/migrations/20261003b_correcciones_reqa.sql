-- Correcciones del re-QA del 3-oct-2026 (base de datos). Idempotente.
--  1. Compras con saldo: el precio sale del servidor (doctor_profiles.consultation_fee y
--     lives.chat_price); si el navegador manda otro importe, la compra se rechaza ('Price changed').
--  2. Citas: el paciente no puede crear una cita como si se la propusiera el médico (created_by) ni
--     escribir columnas reservadas (sala de vídeo, notas, motivo de cancelación).
--  3. El médico ve el nombre del paciente con el que tiene una consulta pagada (activa o completada).
--  4. Datos: ganancias y compras que siguen en 'paid' aunque su venta se reembolsó → 'refunded'.
--  5. doctor_sales (base de la factura al comprador) toma el bruto de metadata.gross_amount si la
--     ganancia se guarda en neto; sin ese dato, como hasta ahora.

-- 1a ------------------------------------------------------------------------------------------
-- Segunda opinión con saldo: antes cobraba get_price_for_user(p_amount) con p_amount del navegador
-- (500 MXN se pagaban con 1). Misma firma.
CREATE OR REPLACE FUNCTION public.process_double_check_purchase(p_doctor_id uuid, p_amount numeric, p_description text, p_idempotency_key text DEFAULT NULL::text, p_notes text DEFAULT 'Segunda Opinión médica'::text)
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
  v_fee numeric;
  v_prev numeric;
  v_prev_meta jsonb;
  v_consultation_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then return jsonb_build_object('success', false, 'error', 'No authenticated user'); end if;
  if p_amount <= 0 or p_amount > 50000 then return jsonb_build_object('success', false, 'error', 'Invalid amount'); end if;
  if p_doctor_id = v_user_id then return jsonb_build_object('success', false, 'error', 'Doctor not available'); end if;

  select status, consultation_fee into v_doctor_status, v_fee from doctor_profiles where user_id = p_doctor_id;
  if v_doctor_status is distinct from 'approved' then return jsonb_build_object('success', false, 'error', 'Doctor not available'); end if;

  select balance into v_current_balance from wallets where user_id = v_user_id for update;
  if not found then return jsonb_build_object('success', false, 'error', 'Wallet not found'); end if;

  if p_idempotency_key is not null then
    select abs(amount), metadata into v_prev, v_prev_meta from wallet_transactions
      where user_id = v_user_id and type = 'purchase'
        and metadata->>'idempotency_key' = p_idempotency_key
      limit 1;
    if found then
      return jsonb_build_object('success', true, 'amount_charged', v_prev,
                                'new_balance', v_current_balance, 'idempotent_replay', true)
             || case when v_prev_meta ? 'consultation_id'
                     then jsonb_build_object('consultation_id', v_prev_meta->>'consultation_id')
                     else '{}'::jsonb end;
    end if;
  end if;

  -- El precio es el del médico, no el que manda el navegador.
  if coalesce(v_fee, 0) <= 0 then return jsonb_build_object('success', false, 'error', 'Invalid amount'); end if;
  if round(p_amount, 2) <> round(v_fee, 2) then
    return jsonb_build_object('success', false, 'error', 'Price changed', 'price', v_fee);
  end if;

  v_final_amount := get_price_for_user(v_fee, v_user_id);
  if v_current_balance < v_final_amount then return jsonb_build_object('success', false, 'error', 'Insufficient balance'); end if;

  insert into consultations (patient_id, doctor_id, status, notes)
  values (v_user_id, p_doctor_id, 'active', coalesce(nullif(left(btrim(p_notes), 500), ''), 'Segunda Opinión médica'))
  returning id into v_consultation_id;

  insert into wallet_transactions (user_id, type, amount, description, status, metadata)
  values (v_user_id, 'purchase', -v_final_amount, p_description, 'paid',
    jsonb_build_object('type','double_check','doctor_id',p_doctor_id,'consultation_id',v_consultation_id)
      || case when p_idempotency_key is null then '{}'::jsonb else jsonb_build_object('idempotency_key', p_idempotency_key) end);

  update wallets set balance = balance - v_final_amount, updated_at = now() where user_id = v_user_id;

  -- Neto tras la comisión por tipo, igual que el pago con tarjeta (stripe-webhook usa 'consultation').
  perform public.credit_doctor_earnings(p_doctor_id, v_final_amount, 'consultation');

  insert into wallet_transactions (user_id, type, amount, description, status, metadata)
  values (p_doctor_id, 'earning', v_final_amount, 'Ganancia por Segunda Opinión', 'paid',
    jsonb_build_object('source','double_check','patient_id',v_user_id,'concept','Segunda opinión médica',
                       'consultation_id',v_consultation_id));

  return jsonb_build_object('success', true, 'amount_charged', v_final_amount,
                            'new_balance', v_current_balance - v_final_amount,
                            'consultation_id', v_consultation_id);
end;
$function$;

-- 1b ------------------------------------------------------------------------------------------
-- Consulta con saldo (también la usa book_live_consultation): mismo problema. Además ahora exige
-- médico aprobado y que no sea uno mismo, como la segunda opinión. Misma firma.
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
  v_doctor_status TEXT;
  v_fee NUMERIC;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No authenticated user');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  IF p_doctor_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Doctor not available');
  END IF;

  -- El precio es el del médico, no el que manda el navegador.
  SELECT status, consultation_fee INTO v_doctor_status, v_fee FROM doctor_profiles WHERE user_id = p_doctor_id;
  IF v_doctor_status IS DISTINCT FROM 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Doctor not available');
  END IF;
  IF COALESCE(v_fee, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  IF round(p_amount, 2) <> round(v_fee, 2) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Price changed', 'price', v_fee);
  END IF;

  SELECT role INTO v_user_role FROM user_roles WHERE user_id = v_user_id LIMIT 1;

  SELECT balance INTO v_current_balance
  FROM wallets
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  v_final_amount := get_price_for_user(v_fee, v_user_id);

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
$function$;

-- 1c ------------------------------------------------------------------------------------------
-- Mensaje destacado de un live: el importe tiene que ser el chat_price del live (antes un mensaje
-- de 50 se pagaba con 1 y el médico recibía la parte de 1). El resto de compras genéricas no
-- cambia: contenido, grabaciones y marketplace llegan desde funciones que ya leen el precio de la BD.
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
  v_live_price numeric;
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

  -- Mensaje destacado de un live: el médico y el precio se toman del live (no del cliente).
  if coalesce(p_metadata->>'type', '') = 'live_chat_highlight' then
    v_live_txt := p_metadata->>'live_id';
    if v_live_txt ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select doctor_id, chat_price into v_live_doctor, v_live_price from lives where id = v_live_txt::uuid;
      if found and (coalesce(v_live_price, 0) <= 0 or round(p_amount, 2) <> round(v_live_price, 2)) then
        return jsonb_build_object('success', false, 'error', 'Price changed', 'price', coalesce(v_live_price, 0));
      end if;
    end if;
    if v_live_doctor = v_user_id then v_live_doctor := null; end if;
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
$function$;

-- 2 -------------------------------------------------------------------------------------------
-- Alta de cita por el paciente: created_by lo pone el servidor (antes aceptaba el del cliente y,
-- con created_by = doctor_id, el paciente se confirmaba la cita como si se la propusiera el
-- médico) y las columnas del médico nacen vacías. price/service_name ya los fija
-- appointments_service_snapshot. El resto, igual que en 20261003_correcciones_qa.sql.
CREATE OR REPLACE FUNCTION public.fn_guard_patient_appointment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid   uuid := (select auth.uid());
  v_end   timestamptz;
  v_local timestamp;
  v_av    record;
begin
  if public.is_privileged_writer() then return new; end if;

  if tg_op = 'UPDATE' then
    -- El médico de la cita la gestiona (confirmar, rechazar, completar, sala de vídeo), pero no
    -- cambia de paciente ni de médico: con la política de profiles de la sección 7 le bastaría
    -- con apuntar una cita suya a cualquier usuario para leer su perfil.
    if v_uid = old.doctor_id then
      if new.patient_id is distinct from old.patient_id or new.doctor_id is distinct from old.doctor_id then
        raise exception 'appointment_parties_immutable' using errcode = '42501';
      end if;
      return new;
    end if;
    if v_uid is distinct from old.patient_id then return new; end if;

    -- El paciente: ni fecha, ni duración, ni médico, ni nada salvo el estado y el motivo de cancelación.
    if (to_jsonb(new) - 'status' - 'cancellation_reason' - 'updated_at')
       is distinct from (to_jsonb(old) - 'status' - 'cancellation_reason' - 'updated_at') then
      raise exception 'appointment_patient_cannot_modify' using errcode = '42501',
        hint = 'El paciente solo puede cancelar su cita.';
    end if;
    if new.status is distinct from old.status then
      if new.status = 'cancelled' and old.status in ('requested', 'confirmed') then
        return new;
      end if;
      -- Aceptar la cita que le propuso el propio médico (doctor_create_appointment).
      if new.status = 'confirmed' and old.status = 'requested' and old.created_by = old.doctor_id then
        return new;
      end if;
      raise exception 'appointment_patient_status_forbidden' using errcode = '42501',
        hint = 'El paciente solo puede cancelar su cita.';
    end if;
    return new;
  end if;

  -- INSERT. Las citas que crea el médico (doctor_create_appointment) ya validan todo.
  if v_uid is distinct from new.patient_id then return new; end if;

  if new.status is distinct from 'requested' then
    raise exception 'appointment_must_be_requested' using errcode = '42501';
  end if;
  if new.doctor_id is null or new.doctor_id = new.patient_id then
    raise exception 'invalid_doctor' using errcode = '22023';
  end if;
  if new.scheduled_at is null or new.scheduled_at <= now() then
    raise exception 'invalid_datetime' using errcode = '22023';
  end if;
  if coalesce(new.duration_minutes, 0) <= 0 or new.duration_minutes > 240 then
    raise exception 'invalid_duration' using errcode = '22023';
  end if;
  -- La cita la crea el paciente: created_by es él, y sala, notas y cancelación son del médico.
  new.created_by := v_uid;
  new.daily_room_url := null;
  new.notes := null;
  new.cancellation_reason := null;
  v_end := new.scheduled_at + make_interval(mins => new.duration_minutes);

  if new.availability_id is not null then
    -- Turno publicado por el médico en doctor_availability.
    select d.doctor_id, d.type, d.status, d.scheduled_at, coalesce(d.duration_minutes, 60) as mins
      into v_av
      from public.doctor_availability d
     where d.id = new.availability_id;
    if not found
       or v_av.doctor_id <> new.doctor_id
       or coalesce(v_av.type, '') not in ('available', 'consultation')
       or v_av.status::text not in ('scheduled', 'confirmed')
       or new.scheduled_at < v_av.scheduled_at
       or new.scheduled_at >= v_av.scheduled_at + make_interval(mins => v_av.mins) then
      raise exception 'slot_unavailable' using errcode = '22023';
    end if;
  else
    -- Turno generado desde el horario de atención: tiene que caber entero en un tramo del día
    -- (hora local del médico).
    v_local := new.scheduled_at at time zone public.fn_doctor_timezone(new.doctor_id);
    if not exists (
      select 1
        from public.get_doctor_schedule(new.doctor_id, (v_local::date - 1), v_local::date) s
       where (s.day + s.start_time) <= v_local
         and (v_local + make_interval(mins => new.duration_minutes))
             <= case when s.end_time <= s.start_time then s.day + 1 + s.end_time
                     else s.day + s.end_time end
    ) then
      raise exception 'outside_schedule' using errcode = '22023';
    end if;
  end if;

  -- Mismo candado que doctor_create_appointment.
  perform pg_advisory_xact_lock(hashtext('doctor_appt_' || new.doctor_id::text));

  if exists (
    select 1 from public.appointments a
     where a.doctor_id = new.doctor_id
       and a.id <> new.id
       and a.status in ('requested', 'confirmed')
       and a.scheduled_at < v_end
       and (a.scheduled_at + make_interval(mins => a.duration_minutes)) > new.scheduled_at
  ) then
    raise exception 'slot_taken' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.doctor_availability d
     where d.doctor_id = new.doctor_id
       and d.type = 'blocked'
       and d.status <> 'cancelled'
       and d.scheduled_at < v_end
       and (d.scheduled_at + make_interval(mins => coalesce(d.duration_minutes, 60))) > new.scheduled_at
  ) then
    raise exception 'slot_blocked' using errcode = '23505';
  end if;

  return new;
end;
$function$;

-- 3 -------------------------------------------------------------------------------------------
-- Nombre del paciente en el panel de la videollamada: cuenta la consulta activa o completada que
-- el PACIENTE pagó (compra suya con ese consultation_id). Solo la consulta no basta: el médico
-- puede crear consultas y cambiarles el patient_id, y así leería cualquier perfil.
-- SECURITY DEFINER porque el médico no ve las compras del paciente.
CREATE OR REPLACE FUNCTION public.fn_doctor_has_paid_consultation_with(p_patient uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
      from public.consultations c
      join public.wallet_transactions w
        on w.user_id = c.patient_id
       and w.type = 'purchase'
       and w.metadata->>'consultation_id' = c.id::text
     where c.doctor_id = (select auth.uid())
       and c.patient_id = p_patient
       and c.status in ('active', 'completed')
  );
$function$;

REVOKE ALL ON FUNCTION public.fn_doctor_has_paid_consultation_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_doctor_has_paid_consultation_with(uuid) TO authenticated;

DROP POLICY IF EXISTS "Doctors read identity of patients with consultations" ON public.profiles;
CREATE POLICY "Doctors read identity of patients with consultations" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.fn_doctor_has_paid_consultation_with(profiles.id));

-- 4 -------------------------------------------------------------------------------------------
-- Datos antiguos: ventas reembolsadas antes de 20261003 (o cuya ganancia no tenía referencia, como
-- la 859f973e del 17-ago) siguen sumando en Ingresos. Se marcan 'refunded':
--  · ganancias en 'paid' cuya venta en doctor_sales tiene refunded_at, o cuya compra original tiene
--    un reembolso pagado (por consulta, por contenido+comprador o, sin referencia, mismo médico,
--    mismo importe y creadas con menos de 60 s de diferencia);
--  · compras en 'paid' reembolsadas por completo.
-- Ningún trigger dispara avisos ni asientos por pasar a 'refunded'. Los saldos no se tocan.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    WITH rp AS (
      SELECT p.* FROM public.wallet_transactions p
       WHERE p.type = 'purchase'
         AND EXISTS (SELECT 1 FROM public.wallet_transactions x
                      WHERE x.type = 'refund' AND x.status = 'paid'
                        AND coalesce(x.metadata->>'original_transaction_id', x.metadata->>'original_txn_id') = p.id::text)
    ), objetivo AS (
      SELECT e.id FROM public.wallet_transactions e
       WHERE e.type = 'earning' AND e.status = 'paid'
         AND (EXISTS (SELECT 1 FROM public.doctor_sales ds WHERE ds.earning_tx_id = e.id AND ds.refunded_at IS NOT NULL)
              OR EXISTS (SELECT 1 FROM rp
                          WHERE (rp.metadata->>'doctor_id' = e.user_id::text
                                 AND (coalesce(e.metadata->>'consultation_id', e.metadata->>'reference_id') = rp.metadata->>'consultation_id'
                                      OR (coalesce(e.metadata->>'consultation_id', e.metadata->>'reference_id') IS NULL
                                          AND e.amount = abs(rp.amount)
                                          AND abs(extract(epoch FROM e.created_at - rp.created_at)) < 60)))
                             OR (e.metadata->>'content_id' = rp.metadata->>'content_id'
                                 AND e.metadata->>'buyer_id' = rp.user_id::text)))
      UNION
      SELECT p.id FROM public.wallet_transactions p
       WHERE p.type = 'purchase' AND p.status = 'paid'
         AND (SELECT coalesce(sum(x.amount), 0) FROM public.wallet_transactions x
               WHERE x.type = 'refund' AND x.status = 'paid'
                 AND coalesce(x.metadata->>'original_transaction_id', x.metadata->>'original_txn_id') = p.id::text) >= abs(p.amount)
    )
    UPDATE public.wallet_transactions w
       SET status = 'refunded',
           metadata = coalesce(w.metadata, '{}'::jsonb) || jsonb_build_object('refunded_backfill', '2026-10-03b')
      FROM objetivo o
     WHERE w.id = o.id
    RETURNING w.id, w.type, w.amount
  LOOP
    RAISE NOTICE 'backfill refunded: % % %', r.id, r.type, r.amount;
  END LOOP;
END $$;

-- 5 -------------------------------------------------------------------------------------------
-- doctor_sales.amount es lo que el médico factura al comprador (el bruto). Si una ganancia se
-- guarda en neto (purchase-content-wallet), el bruto llega en metadata.gross_amount.
CREATE OR REPLACE FUNCTION public.fn_record_doctor_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_buyer_txt text := coalesce(nullif(new.metadata->>'buyer_id', ''), nullif(new.metadata->>'patient_id', ''));
  v_buyer uuid;
  v_concept text;
  v_amount numeric;
begin
  if new.type <> 'earning' or coalesce(new.amount, 0) <= 0 then return new; end if;
  begin
    if v_buyer_txt ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_buyer := v_buyer_txt::uuid;
    end if;
    v_amount := new.amount;
    if (new.metadata->>'gross_amount') ~ '^[0-9]+(\.[0-9]+)?$' and (new.metadata->>'gross_amount')::numeric > 0 then
      v_amount := (new.metadata->>'gross_amount')::numeric;
    end if;
    v_concept := coalesce(nullif(new.metadata->>'concept', ''),
                          regexp_replace(coalesce(new.description, 'Servicio médico'), '^Ganancia por (venta de )?', '', 'i'));
    v_concept := upper(left(v_concept, 1)) || substr(v_concept, 2);
    insert into doctor_sales (doctor_id, buyer_id, earning_tx_id, sale_type, reference_id, concept, amount, buyer_fiscal, created_at)
    values (new.user_id, v_buyer, new.id,
            coalesce(nullif(new.metadata->>'source', ''), 'venta'),
            coalesce(new.metadata->>'reference_id', new.metadata->>'consultation_id',
                     new.metadata->>'content_id', new.metadata->>'recording_id'),
            left(v_concept, 300), v_amount,
            case when v_buyer is not null then public.fn_billing_snapshot(v_buyer) end,
            new.created_at)
    on conflict (earning_tx_id) do nothing;
  exception when others then
    -- Nunca romper un cobro por esto.
    raise warning 'fn_record_doctor_sale: %', sqlerrm;
  end;
  return new;
end;
$function$;
