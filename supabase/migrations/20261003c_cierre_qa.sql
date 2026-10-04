-- Cierre QA 2026-10-03 (módulos de dinero).
-- process_wallet_purchase aceptaba un cargo genérico con metadata.type
-- 'double_check' o 'consultation' por cualquier importe; esos tipos tienen RPC
-- propia con precio del servidor. Se redefine desde la versión VIVA en
-- producción (pg_get_functiondef del 3-oct) cambiando solo ese rechazo.
-- La web y las funciones no llaman a process_wallet_purchase con esos tipos.
-- Idempotente (CREATE OR REPLACE).

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
  v_live_status text;
  v_live_txt text;
  v_purchase_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then return jsonb_build_object('success', false, 'error', 'No authenticated user'); end if;
  if p_amount <= 0 then return jsonb_build_object('success', false, 'error', 'Invalid amount'); end if;

  -- Segunda opinión y consultas tienen RPC propia que toma el precio del servidor
  -- (process_double_check_purchase / process_consultation_purchase). Por aquí se
  -- podían cobrar con cualquier importe: se rechazan (2026-10-03, cierre QA).
  if coalesce(p_metadata->>'type', '') in ('double_check', 'consultation', 'live_consultation') then
    return jsonb_build_object('success', false, 'error', 'Use the dedicated purchase flow');
  end if;

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
      select doctor_id, chat_price, status::text into v_live_doctor, v_live_price, v_live_status from lives where id = v_live_txt::uuid;
      if found and v_live_status is distinct from 'live' then
        return jsonb_build_object('success', false, 'error', 'Live is not active');
      end if;
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

-- ---------------------------------------------------------------------------
-- 2. Aviso a seguidores (notify_subscribers). Solo tenía EXECUTE para postgres y
-- service_role, así que el aviso al iniciar o programar un live (DoctorGoLive,
-- LivesContext, useDoctorAvailability, Eventos) daba 403. Antes de abrirla a
-- authenticated se endurece la guarda de la versión viva: «p_doctor_id != auth.uid()»
-- no frenaba con uid NULL, y aceptaba cualquier tipo de aviso (pago recibido,
-- sistema…) y cualquier contenido. Ahora un usuario solo avisa a SUS seguidores, con
-- los tipos de seguidores (doctor_live, doctor_availability, new_content), textos
-- acotados y deeplink solo interno. Admin y service_role (uid NULL, sin EXECUTE
-- para anon) conservan el comportamiento anterior.
CREATE OR REPLACE FUNCTION public.notify_subscribers(p_doctor_id uuid, p_notification_type notification_type, p_title text, p_message text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER := 0;
  v_uid uuid := auth.uid();
BEGIN
  -- Validate caller is the doctor or admin (uid NULL = service_role / postgres).
  IF v_uid IS NOT NULL AND NOT public.has_role(v_uid, 'admin') THEN
    IF p_doctor_id IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'Unauthorized: can only notify own subscribers' USING errcode = '42501';
    END IF;
    IF p_notification_type NOT IN ('doctor_live', 'doctor_availability', 'new_content') THEN
      RAISE EXCEPTION 'notification_type_not_allowed' USING errcode = '42501';
    END IF;
    IF coalesce(length(p_title), 0) = 0 OR length(p_title) > 200
       OR length(coalesce(p_message, '')) > 1000
       OR (p_data IS NOT NULL AND (jsonb_typeof(p_data) <> 'object' OR length(p_data::text) > 2000))
       OR (p_data ? 'deeplink' AND coalesce(p_data->>'deeplink', '') !~ '^/[^/\\]') THEN
      RAISE EXCEPTION 'notification_content_invalid' USING errcode = '22023';
    END IF;
  END IF;

  -- Insert notifications for all active subscribers of the doctor
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT
    s.subscriber_id,
    p_notification_type,
    p_title,
    p_message,
    p_data
  FROM public.subscriptions s
  WHERE s.creator_id = p_doctor_id
    AND s.is_active = true
    AND (
      (p_notification_type = 'doctor_live' AND s.notify_on_live = true) OR
      (p_notification_type = 'new_content' AND s.notify_on_content = true) OR
      (p_notification_type = 'doctor_availability' AND s.notify_on_availability = true) OR
      p_notification_type NOT IN ('doctor_live', 'new_content', 'doctor_availability')
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_subscribers(uuid, notification_type, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_subscribers(uuid, notification_type, text, text, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Bóveda: el bucket vault-files no tenía límite por archivo y la política de
-- subida solo miraba la carpeta, así que se podía llenar el almacenamiento sin
-- pasar por la cuota (profiles.storage_limit_bytes). Límite por archivo 20 MB (el
-- mismo que vault-upload-validate; el mayor archivo actual pesa 1,1 MB) y la subida
-- exige que lo ya guardado en su carpeta del bucket esté por debajo de su cuota.
UPDATE storage.buckets SET file_size_limit = 20971520 WHERE id = 'vault-files';

CREATE OR REPLACE FUNCTION public.vault_storage_within_quota()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null
     and coalesce((select sum(coalesce((o.metadata->>'size')::bigint, 0))
                     from storage.objects o
                    where o.bucket_id = 'vault-files'
                      and (storage.foldername(o.name))[1] = auth.uid()::text), 0)
       < coalesce((select p.storage_limit_bytes from public.profiles p where p.id = auth.uid()), 1073741824);
$function$;

REVOKE ALL ON FUNCTION public.vault_storage_within_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vault_storage_within_quota() TO authenticated, service_role;

DROP POLICY IF EXISTS "Patients can upload vault files" ON storage.objects;
CREATE POLICY "Patients can upload vault files" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'vault-files'
              AND (auth.uid())::text = (storage.foldername(name))[1]
              AND public.vault_storage_within_quota());

-- ---------------------------------------------------------------------------
-- 4. Cancelar con 2 h de anticipación (lo dice el correo de confirmación de cita).
-- El paciente no puede cancelar una cita CONFIRMADA si faltan menos de 2 h; las
-- 'requested' se cancelan siempre y el médico siempre. Copia de la versión viva
-- (20261003b) cambiando solo la rama de cancelación del paciente.
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
      if new.status = 'cancelled' and old.status = 'requested' then
        return new;
      end if;
      if new.status = 'cancelled' and old.status = 'confirmed' then
        if old.scheduled_at < now() + interval '2 hours' then
          raise exception 'appointment_cancel_too_late' using errcode = '42501',
            hint = 'Las citas confirmadas se cancelan con al menos 2 horas de anticipación.';
        end if;
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
