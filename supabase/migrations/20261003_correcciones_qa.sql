-- Correcciones del QA E2E en producción (3-oct-2026). Idempotente.
-- Las funciones parten de su definición VIVA en producción del 3-oct-2026 (no de git).
--   1. Enums: 'refunded' en transaction_status y 'missed_call' en notification_type.
--   2. Moderación de doctor_content: el admin puede actualizar (antes 0 filas sin error); el
--      creador ya no toca moderation_* y, si cambia precio o archivo de algo aprobado, vuelve a
--      'pending'; lo pendiente deja de salir por la API (política RESTRICTIVE).
--   3. doctor_invoices: el médico solo crea/edita facturas en 'pending' (aprobar es del admin).
--   4. Candado de pacientes: la marca admin_created se lee de raw_app_meta_data (el usuario no la
--      controla). Las altas ya hechas no cambian: la marca solo se lee al crear la cuenta.
--   5. appointments: el paciente solo pide citas 'requested', futuras, dentro del horario del
--      médico y sin solape; después solo puede cancelarlas (o aceptar la que le propuso el médico).
--      Aviso al médico cuando el paciente cancela.
--   6. Bloqueos privados: get_doctor_busy_slots (solo horas) y el paciente ya no lee las filas
--      type='blocked' ajenas.
--   7. El médico ve el nombre del paciente que tiene una cita requested/confirmed con él.
--   8. Reembolsos: la venta reembolsada marca 'refunded' su earning; una sola solicitud abierta
--      por movimiento; solo sobre movimientos propios y por un importe que no supere el pago;
--      request_consultation_refund no reembolsa dos veces.
--   9. Segunda opinión con saldo: process_double_check_purchase crea la consulta en la misma
--      transacción y devuelve consultation_id.
--  10. Bóveda: la cuota (storage_used_bytes) la mantiene un trigger sobre vault_files.
--  11. forum-files: el autor puede borrar sus adjuntos.

-- 1 -------------------------------------------------------------------------------------------
-- Ojo: un valor nuevo de enum no se puede USAR en la misma transacción que lo crea. Las
-- funciones de abajo solo lo nombran; se usa de verdad a partir del COMMIT.
ALTER TYPE public.transaction_status ADD VALUE IF NOT EXISTS 'refunded';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'missed_call';

-- 2 -------------------------------------------------------------------------------------------
-- El admin modera con UPDATE directo (AdminContentModeration). Antes solo había un SELECT para él.
DROP POLICY IF EXISTS "Admins can moderate content" ON public.doctor_content;
CREATE POLICY "Admins can moderate content" ON public.doctor_content
  FOR UPDATE
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

-- Al volverse RESTRICTIVE la de abajo, el admin necesita su propio SELECT permisivo para ver
-- el contenido privado (is_public=false) de otros médicos.
DROP POLICY IF EXISTS "Admins can view all content" ON public.doctor_content;
CREATE POLICY "Admins can view all content" ON public.doctor_content
  FOR SELECT
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

-- Se creó PERMISSIVE y se sumaba con OR a «Public content filtered by audience»: no filtraba
-- nada. RESTRICTIVE: lo no aprobado solo lo ven el creador, el admin y quien ya lo compró
-- (si el médico cambia el precio y vuelve a revisión, el comprador no pierde su libro).
DROP POLICY IF EXISTS doctor_content_public_approved_only ON public.doctor_content;
CREATE POLICY doctor_content_public_approved_only ON public.doctor_content
  AS RESTRICTIVE
  FOR SELECT
  USING (
    moderation_status = 'approved'::public.content_moderation_status
    OR creator_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.purchases pu
                WHERE pu.content_id = doctor_content.id AND pu.user_id = (SELECT auth.uid()))
  );

-- «Creators can manage own content» (FOR ALL) deja al creador escribir cualquier columna.
CREATE OR REPLACE FUNCTION public.fn_guard_content_moderation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Admin, service_role y procesos internos moderan libremente.
  if public.is_privileged_writer() then return new; end if;

  if tg_op = 'INSERT' then
    new.moderation_status := 'pending';
    new.moderation_note   := null;
    new.moderated_by      := null;
    new.moderated_at      := null;
    return new;
  end if;

  new.moderation_status := old.moderation_status;
  new.moderation_note   := old.moderation_note;
  new.moderated_by      := old.moderated_by;
  new.moderated_at      := old.moderated_at;

  -- Lo aprobado que cambia de precio o de archivo vuelve a revisión.
  if old.moderation_status = 'approved'
     and (new.price is distinct from old.price or new.file_url is distinct from old.file_url) then
    new.moderation_status := 'pending';
    new.moderated_by      := null;
    new.moderated_at      := null;
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_guard_content_moderation ON public.doctor_content;
CREATE TRIGGER trg_guard_content_moderation
  BEFORE INSERT OR UPDATE ON public.doctor_content
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_content_moderation();

-- 3 -------------------------------------------------------------------------------------------
-- Una factura 'approved' es lo que exige el pago a médicos (process-doctor-payouts, AdminPayouts):
-- el médico no puede crearla ni dejarla aprobada él mismo.
DROP POLICY IF EXISTS "Doctors can upload invoices" ON public.doctor_invoices;
CREATE POLICY "Doctors can upload invoices" ON public.doctor_invoices
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = doctor_id
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

DROP POLICY IF EXISTS "Doctors can update pending invoices" ON public.doctor_invoices;
CREATE POLICY "Doctors can update pending invoices" ON public.doctor_invoices
  FOR UPDATE
  USING (((SELECT auth.uid()) = doctor_id) AND (status = 'pending'))
  WITH CHECK (
    (SELECT auth.uid()) = doctor_id
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

-- 4 -------------------------------------------------------------------------------------------
-- raw_user_meta_data lo escribe el propio usuario en /auth/v1/signup ({data:{admin_created:'true'}})
-- y se saltaba el candado. raw_app_meta_data solo lo escribe el servidor (auth.admin.createUser
-- con app_metadata). Única diferencia con la versión viva: esa línea.
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
    _role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'patient');
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

    IF _role IN ('patient', 'resident', 'doctor') THEN
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

-- 5 -------------------------------------------------------------------------------------------
-- Zona horaria del horario del médico (doctor_schedule_ranges.timezone; por defecto CDMX).
CREATE OR REPLACE FUNCTION public.fn_doctor_timezone(p_doctor_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT r.timezone FROM public.doctor_schedule_ranges r
      WHERE r.doctor_id = p_doctor_id AND NULLIF(r.timezone, '') IS NOT NULL
      ORDER BY r.is_active DESC, r.updated_at DESC NULLS LAST
      LIMIT 1),
    'America/Mexico_City');
$function$;

-- La política appointments_patient_insert solo miraba patient_id y appointments_update dejaba al
-- paciente cambiar cualquier columna (confirmarse la cita, moverla de hora, reservar encima de
-- otra o de un bloqueo). Mismas comprobaciones que doctor_create_appointment + horario.
-- Nombre con «zz»: corre DESPUÉS de trg_appointments_service_snapshot (que fija la duración del
-- servicio) y de trg_appointments_updated_at.
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
  new.created_by := coalesce(new.created_by, v_uid);
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

DROP TRIGGER IF EXISTS trg_appointments_zz_patient_guard ON public.appointments;
CREATE TRIGGER trg_appointments_zz_patient_guard
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_patient_appointment();

-- Aviso al médico cuando el paciente cancela (antes no se enteraba).
CREATE OR REPLACE FUNCTION public.fn_notify_doctor_appointment_cancelled()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_name text;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled'
     and (select auth.uid()) = new.patient_id and new.patient_id <> new.doctor_id then
    begin
      select nullif(name, '') into v_name from public.profiles where id = new.patient_id;
      insert into public.notifications (user_id, type, title, message, data)
      values (
        new.doctor_id,
        'system',
        'Cita cancelada',
        coalesce(v_name, 'Tu paciente') || ' canceló la cita del '
          || to_char(new.scheduled_at at time zone public.fn_doctor_timezone(new.doctor_id), 'DD/MM/YYYY HH24:MI') || '.',
        jsonb_build_object(
          'kind', 'appointment_cancelled',
          'appointment_id', new.id,
          'patient_id', new.patient_id,
          'starts_at', new.scheduled_at,
          'url', '/my-appointments',
          'deeplink', '/my-appointments'
        )
      );
    exception when others then
      -- La cancelación no depende del aviso.
      raise warning 'fn_notify_doctor_appointment_cancelled: %', sqlerrm;
    end;
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_appointments_notify_cancelled ON public.appointments;
CREATE TRIGGER trg_appointments_notify_cancelled
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_doctor_appointment_cancelled();

-- 6 -------------------------------------------------------------------------------------------
-- Tramos ocupados del médico para reservar: bloqueos y citas requested/confirmed de cualquier
-- paciente. Solo horas: ni títulos ni motivos ni pacientes.
CREATE OR REPLACE FUNCTION public.get_doctor_busy_slots(p_doctor_id uuid, p_from timestamptz, p_to timestamptz)
 RETURNS TABLE(starts_at timestamptz, ends_at timestamptz)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH b AS (
    SELECT p_from AS f, LEAST(p_to, p_from + interval '120 days') AS t
  )
  SELECT x.s, x.e FROM (
    SELECT d.scheduled_at AS s, d.scheduled_at + make_interval(mins => COALESCE(d.duration_minutes, 60)) AS e
      FROM public.doctor_availability d
     WHERE d.doctor_id = p_doctor_id
       AND d.type = 'blocked'
       AND d.status <> 'cancelled'
    UNION ALL
    SELECT a.scheduled_at, a.scheduled_at + make_interval(mins => COALESCE(a.duration_minutes, 30))
      FROM public.appointments a
     WHERE a.doctor_id = p_doctor_id
       AND a.status IN ('requested', 'confirmed')
  ) x, b
  WHERE p_doctor_id IS NOT NULL AND p_from IS NOT NULL AND p_to IS NOT NULL
    AND x.s < b.t AND x.e > b.f
  ORDER BY 1;
$function$;

REVOKE ALL ON FUNCTION public.get_doctor_busy_slots(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_doctor_busy_slots(uuid, timestamptz, timestamptz) TO authenticated, service_role;

-- Antes cualquiera (también anónimo) leía los bloqueos con título y motivo.
DROP POLICY IF EXISTS "Anyone can view confirmed availability" ON public.doctor_availability;
CREATE POLICY "Anyone can view confirmed availability" ON public.doctor_availability
  FOR SELECT
  USING (
    status = ANY (ARRAY['scheduled'::public.availability_status, 'confirmed'::public.availability_status])
    AND (type IS DISTINCT FROM 'blocked'
         OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  );

-- 7 -------------------------------------------------------------------------------------------
-- doctor_has_patient_relation ya cuenta las citas, pero la RLS de profiles solo dejaba ver la
-- identidad con acceso a la bóveda: el médico veía «Paciente sin nombre visible».
DROP POLICY IF EXISTS "Doctors read identity of patients with appointments" ON public.profiles;
CREATE POLICY "Doctors read identity of patients with appointments" ON public.profiles
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.appointments a
     WHERE a.doctor_id = (SELECT auth.uid())
       AND a.patient_id = profiles.id
       AND a.status IN ('requested', 'confirmed')
  ));

-- 8 -------------------------------------------------------------------------------------------
-- Al reembolsar una venta, su earning pasa a 'refunded' (antes seguía 'paid' y DoctorEarnings la
-- sumaba). El cambio de estado va en su propio bloque: si falla, la venta se marca igual.
CREATE OR REPLACE FUNCTION public.fn_refund_doctor_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_orig jsonb;
  v_ref text;
  v_earnings uuid[];
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
    with upd as (
      update doctor_sales
         set refunded_at = now(),
             invoice_status = case when invoice_status = 'pending' then 'cancelled' else invoice_status end
       where reference_id = v_ref and refunded_at is null
         and (buyer_id = new.user_id or doctor_id = new.user_id)
      returning earning_tx_id
    )
    select array_agg(earning_tx_id) into v_earnings from upd where earning_tx_id is not null;

    if v_earnings is not null then
      begin
        update wallet_transactions
           set status = 'refunded'
         where id = any(v_earnings) and type = 'earning' and status = 'paid';
      exception when others then
        raise warning 'fn_refund_doctor_sale (earning refunded): %', sqlerrm;
      end;
    end if;
  exception when others then
    raise warning 'fn_refund_doctor_sale: %', sqlerrm;
  end;
  return new;
end;
$function$;

-- Una sola solicitud ABIERTA por movimiento (el candado solo estaba en la pantalla).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_refund_requests_open_per_txn
  ON public.refund_requests (transaction_id)
  WHERE transaction_id IS NOT NULL
    AND status IN ('pending', 'approved', 'pending_transfer', 'awaiting_bank_details');

-- Solo sobre un movimiento propio, por un importe positivo que no supere el pago y en 'pending'.
DROP POLICY IF EXISTS "Users can insert own requests" ON public.refund_requests;
CREATE POLICY "Users can insert own requests" ON public.refund_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND refund_requests.amount > 0
    AND EXISTS (
      SELECT 1 FROM public.wallet_transactions wt
       WHERE wt.id = refund_requests.transaction_id
         AND wt.user_id = (SELECT auth.uid())
         AND refund_requests.amount <= abs(wt.amount)
    )
  );

-- Reembolso de consulta no atendida (72 h): antes solo miraba consultations.status, así que una
-- consulta reembolsada desde el admin (que no cambia ese estado) se podía cobrar otra vez.
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
  -- Ya reembolsada por otra vía (admin-refund, solicitud aprobada) o con una solicitud en curso.
  IF EXISTS (
       SELECT 1 FROM wallet_transactions r
        WHERE r.user_id = v_user_id AND r.type = 'refund'
          AND (r.metadata->>'consultation_id' = p_consultation_id::text
               OR r.metadata->>'original_transaction_id' IN (
                    SELECT w.id::text FROM wallet_transactions w
                     WHERE w.user_id = v_user_id AND w.type = 'purchase'
                       AND w.metadata->>'consultation_id' = p_consultation_id::text)
               OR r.metadata->>'original_txn_id' IN (
                    SELECT w.id::text FROM wallet_transactions w
                     WHERE w.user_id = v_user_id AND w.type = 'purchase'
                       AND w.metadata->>'consultation_id' = p_consultation_id::text)))
     OR EXISTS (
       SELECT 1 FROM refund_requests rr
         JOIN wallet_transactions w ON w.id = rr.transaction_id
        WHERE rr.user_id = v_user_id AND rr.status <> 'rejected'
          AND w.metadata->>'consultation_id' = p_consultation_id::text) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already refunded');
  END IF;
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
$function$;

-- 9 -------------------------------------------------------------------------------------------
-- La web cobraba con esta RPC y luego insertaba la consulta desde el navegador del paciente, que
-- la RLS rechaza (solo médicos aprobados crean consultas): el paciente pagaba y no recibía nada.
-- Ahora la consulta nace en la misma transacción que el cobro y se devuelve su id. La compra y
-- el earning llevan consultation_id (reembolso de 72 h y venta en doctor_sales).
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
  v_prev_meta jsonb;
  v_consultation_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then return jsonb_build_object('success', false, 'error', 'No authenticated user'); end if;
  if p_amount <= 0 or p_amount > 50000 then return jsonb_build_object('success', false, 'error', 'Invalid amount'); end if;
  if p_doctor_id = v_user_id then return jsonb_build_object('success', false, 'error', 'Doctor not available'); end if;

  select status into v_doctor_status from doctor_profiles where user_id = p_doctor_id;
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

  v_final_amount := get_price_for_user(p_amount, v_user_id);
  if v_current_balance < v_final_amount then return jsonb_build_object('success', false, 'error', 'Insufficient balance'); end if;

  insert into consultations (patient_id, doctor_id, status, notes)
  values (v_user_id, p_doctor_id, 'active', 'Segunda Opinión médica')
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

-- 10 ------------------------------------------------------------------------------------------
-- increment/decrement_storage_used no se pueden llamar desde el navegador (REVOKE de
-- 20260506154006, a propósito: cada uno se pondría la cuota que quisiera), así que la subida
-- real no movía el contador. Lo mantiene la base al crear y borrar filas de vault_files.
CREATE OR REPLACE FUNCTION public.fn_vault_files_storage_used()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    update public.profiles
       set storage_used_bytes = coalesce(storage_used_bytes, 0) + greatest(coalesce(new.file_size, 0), 0)
     where id = new.patient_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.profiles
       set storage_used_bytes = greatest(coalesce(storage_used_bytes, 0) - greatest(coalesce(old.file_size, 0), 0), 0)
     where id = old.patient_id;
    return old;
  end if;
  -- UPDATE: solo si cambia el tamaño o el dueño.
  if new.patient_id is distinct from old.patient_id or new.file_size is distinct from old.file_size then
    update public.profiles
       set storage_used_bytes = greatest(coalesce(storage_used_bytes, 0) - greatest(coalesce(old.file_size, 0), 0), 0)
     where id = old.patient_id;
    update public.profiles
       set storage_used_bytes = coalesce(storage_used_bytes, 0) + greatest(coalesce(new.file_size, 0), 0)
     where id = new.patient_id;
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_vault_files_storage_used ON public.vault_files;
CREATE TRIGGER trg_vault_files_storage_used
  AFTER INSERT OR UPDATE OF file_size, patient_id OR DELETE ON public.vault_files
  FOR EACH ROW EXECUTE FUNCTION public.fn_vault_files_storage_used();

-- 11 ------------------------------------------------------------------------------------------
-- Solo el admin podía borrar en forum-files: al borrar su post, el PDF del autor quedaba
-- huérfano. El autor (dueño del objeto) ya puede borrarlo con la API de Storage. Un trigger que
-- borrase de storage.objects no sirve: storage.protect_delete lo impide y dejaría el fichero.
DROP POLICY IF EXISTS "forum-files owner delete" ON storage.objects;
CREATE POLICY "forum-files owner delete" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'forum-files' AND owner_id = ((SELECT auth.uid()))::text);

-- 12 ------------------------------------------------------------------------------------------
-- doctor_invoices (sustituye la política UPDATE de la sección 3): exigir reviewed_by/reviewed_at
-- nulos dejaba al médico sin poder editar una factura que el admin devolviera a 'pending' sin
-- vaciarlos. La política solo limita el estado a 'pending' y un trigger (como
-- protect_doctor_profile_cols) impide que el médico cambie los campos de la revisión.
DROP POLICY IF EXISTS "Doctors can update pending invoices" ON public.doctor_invoices;
CREATE POLICY "Doctors can update pending invoices" ON public.doctor_invoices
  FOR UPDATE
  USING (((SELECT auth.uid()) = doctor_id) AND (status = 'pending'))
  WITH CHECK (((SELECT auth.uid()) = doctor_id) AND (status = 'pending'));

CREATE OR REPLACE FUNCTION public.fn_guard_doctor_invoice_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.is_privileged_writer() then return new; end if;
  new.reviewed_by := old.reviewed_by;
  new.reviewed_at := old.reviewed_at;
  new.admin_notes := old.admin_notes;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_guard_doctor_invoice_review ON public.doctor_invoices;
CREATE TRIGGER trg_guard_doctor_invoice_review
  BEFORE UPDATE ON public.doctor_invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_doctor_invoice_review();

-- 13 ------------------------------------------------------------------------------------------
-- Asiento del pago a médico (doctor_payouts). fn_record_payout_ledger es del marketplace
-- (vendor_payouts, y accounting_ledger.payout_id tiene FK a vendor_payouts), así que no sirve.
-- Mismo libro que fn_ledger_wallet_txn / fn_post_service_sale: la venta abona
-- liability_doctor_payable (neto al médico) y carga cash_in; el pago salda ese adeudo y saca la
-- caja. transaction_group = id del pago (idempotente), payout_id nulo y la referencia en metadata.
-- Vale para el pago manual (admin-record-manual-payout, nace 'paid') y para el de Stripe
-- (process-doctor-payouts, 'processing' -> 'paid'). Nunca bloquea el pago.
CREATE OR REPLACE FUNCTION public.fn_ledger_doctor_payout()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_meta jsonb;
begin
  if new.status is distinct from 'paid' or coalesce(new.amount, 0) <= 0 then return new; end if;
  if exists (select 1 from public.accounting_ledger where transaction_group = new.id) then
    return new;
  end if;

  v_meta := jsonb_strip_nulls(jsonb_build_object(
    'source', 'doctor_payout',
    'doctor_payout_id', new.id,
    'doctor_id', new.doctor_id,
    'method', case when new.stripe_transfer_id like 'manual\_%' then 'manual'
                   when new.stripe_transfer_id is not null then 'stripe' end,
    'reference', new.stripe_transfer_id,
    'invoice_id', new.invoice_id));

  insert into public.accounting_ledger (transaction_group, entry_type, account, amount, currency, description, metadata) values
    (new.id, 'debit',  'liability_doctor_payable', new.amount, 'MXN', 'Pago al médico', v_meta),
    (new.id, 'credit', 'cash_in',                  new.amount, 'MXN', 'Salida de caja por pago al médico', v_meta);
  return new;
exception when others then
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_ledger_doctor_payout ON public.doctor_payouts;
CREATE TRIGGER trg_ledger_doctor_payout
  AFTER INSERT OR UPDATE OF status ON public.doctor_payouts
  FOR EACH ROW WHEN (new.status = 'paid')
  EXECUTE FUNCTION public.fn_ledger_doctor_payout();

-- 14 ------------------------------------------------------------------------------------------
-- Directorio público: las cuentas demo (aprobadas para poder hacer demos) salían como médicos
-- verificados. No había forma de ocultar a un médico sin quitarle el 'approved' (que le cierra
-- la plataforma), así que: columna hidden_from_directory, que solo cambia el admin, y filtro en
-- los listados públicos (get_doctors_paginated, search_doctors_public, get_doctor_filter_options).
-- Su perfil sigue accesible por enlace (get_doctor_public_profile) para las demos.
-- Las demo se marcan solo al crear la columna: si el admin destapa una, no se vuelve a ocultar.
DO $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'doctor_profiles'
                    and column_name = 'hidden_from_directory') then
    alter table public.doctor_profiles add column hidden_from_directory boolean not null default false;
    update public.doctor_profiles dp
       set hidden_from_directory = true
      from public.profiles p, auth.users u
     where p.id = dp.user_id and u.id = dp.user_id
       and (u.email ilike 'elcuarteldelmetalinbox+%' or p.name ~* '\m(prueba|demo|qa)\M');
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.fn_protect_hidden_from_directory()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_privileged_writer() then
    new.hidden_from_directory := old.hidden_from_directory;
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_protect_hidden_from_directory ON public.doctor_profiles;
CREATE TRIGGER trg_protect_hidden_from_directory
  BEFORE UPDATE OF hidden_from_directory ON public.doctor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_hidden_from_directory();

-- Definiciones vivas del 3-oct; única diferencia: AND NOT dp.hidden_from_directory.
CREATE OR REPLACE FUNCTION public.get_doctors_paginated(p_page integer DEFAULT 1, p_page_size integer DEFAULT 20, p_search text DEFAULT ''::text, p_specialty text DEFAULT ''::text, p_location text DEFAULT ''::text)
 RETURNS TABLE(id uuid, user_id uuid, specialty text, bio text, rating numeric, followers_count integer, consultation_fee numeric, total_consultations integer, location text, available_for_double_check boolean, badge_override text, office_hours_start time without time zone, office_hours_end time without time zone, office_days text[], name text, avatar_url text, is_identity_verified boolean, total_count bigint, country_code text, country_flag text, manual_badge text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH filtered AS (
    SELECT
      dp.id,
      dp.user_id,
      dp.specialty,
      dp.bio,
      dp.rating,
      dp.followers_count,
      dp.consultation_fee,
      dp.total_consultations,
      dp.location,
      dp.available_for_double_check,
      dp.badge_override,
      dp.office_hours_start,
      dp.office_hours_end,
      dp.office_days,
      p.name,
      p.avatar_url,
      p.is_identity_verified,
      p.country_code,
      p.country_flag,
      dp.manual_badge
    FROM public.doctor_profiles dp
    JOIN public.profiles p ON p.id = dp.user_id
    WHERE dp.status = 'approved'
      AND NOT dp.hidden_from_directory
      AND (
        p_search = '' OR
        p.name ILIKE '%' || replace(replace(left(p_search, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
        OR dp.specialty ILIKE '%' || replace(replace(left(p_search, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
      )
      AND (
        p_specialty = '' OR p_specialty = 'Todas' OR dp.specialty = p_specialty
      )
      AND (
        p_location = '' OR dp.location ILIKE '%' || replace(replace(left(p_location, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
      )
  ),
  cnt AS (
    SELECT count(*) AS total_count FROM filtered
  )
  SELECT
    f.id, f.user_id, f.specialty, f.bio, f.rating, f.followers_count,
    f.consultation_fee, f.total_consultations, f.location,
    f.available_for_double_check, f.badge_override,
    f.office_hours_start, f.office_hours_end, f.office_days,
    f.name, f.avatar_url, f.is_identity_verified,
    cnt.total_count,
    f.country_code, f.country_flag, f.manual_badge
  FROM filtered f, cnt
  ORDER BY f.rating DESC NULLS LAST, f.followers_count DESC NULLS LAST, f.id
  LIMIT LEAST(p_page_size, 20)
  OFFSET (GREATEST(p_page, 1) - 1) * LEAST(p_page_size, 20);
$function$;

CREATE OR REPLACE FUNCTION public.search_doctors_public(p_term text, p_limit integer DEFAULT 8)
 RETURNS TABLE(user_id uuid, name text, avatar_url text, specialty text, status doctor_status, rating numeric, followers_count integer, location text, bio text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    dp.user_id,
    p.name,
    p.avatar_url,
    dp.specialty,
    dp.status,
    dp.rating,
    dp.followers_count,
    dp.location,
    dp.bio
  FROM public.doctor_profiles dp
  JOIN public.profiles p ON p.id = dp.user_id
  WHERE dp.status = 'approved'
    AND NOT dp.hidden_from_directory
    AND (
      p.name ILIKE '%' || replace(replace(left(p_term, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
      OR dp.specialty ILIKE '%' || replace(replace(left(p_term, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
    )
  ORDER BY
    CASE WHEN p.name ILIKE '%' || replace(replace(left(p_term, 100), '%', '\%'), '_', '\_') || '%' ESCAPE '\' THEN 0 ELSE 1 END,
    dp.rating DESC NULLS LAST,
    dp.followers_count DESC NULLS LAST
  LIMIT LEAST(GREATEST(p_limit, 0), 20);
$function$;

CREATE OR REPLACE FUNCTION public.get_doctor_filter_options()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'countries',    (SELECT COALESCE(jsonb_agg(v ORDER BY v), '[]'::jsonb) FROM (SELECT DISTINCT NULLIF(TRIM(country), '') AS v FROM public.doctor_profiles WHERE status='approved' AND NOT hidden_from_directory AND NULLIF(TRIM(country),'') IS NOT NULL) t),
    'specialties',  (SELECT COALESCE(jsonb_agg(v ORDER BY v), '[]'::jsonb) FROM (SELECT DISTINCT NULLIF(TRIM(specialty), '') AS v FROM public.doctor_profiles WHERE status='approved' AND NOT hidden_from_directory AND NULLIF(TRIM(specialty),'') IS NOT NULL) t),
    'universities', (SELECT COALESCE(jsonb_agg(v ORDER BY v), '[]'::jsonb) FROM (SELECT DISTINCT NULLIF(TRIM(university), '') AS v FROM public.doctor_profiles WHERE status='approved' AND NOT hidden_from_directory AND NULLIF(TRIM(university),'') IS NOT NULL) t),
    'hospitals',    (SELECT COALESCE(jsonb_agg(v ORDER BY v), '[]'::jsonb) FROM (SELECT DISTINCT NULLIF(TRIM(practice_hospital), '') AS v FROM public.doctor_profiles WHERE status='approved' AND NOT hidden_from_directory AND NULLIF(TRIM(practice_hospital),'') IS NOT NULL) t)
  );
$function$;

-- 15 ------------------------------------------------------------------------------------------
-- La valoración posterior (usePostConsultationRating y trigger-post-consultation-ratings) busca
-- por ended_at. Si una ruta marca la consulta 'completed' sin rellenarlo, nunca se pedía.
CREATE OR REPLACE FUNCTION public.fn_consultations_set_ended_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.ended_at := coalesce(new.ended_at, now());
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_consultations_set_ended_at ON public.consultations;
CREATE TRIGGER trg_consultations_set_ended_at
  BEFORE INSERT OR UPDATE OF status ON public.consultations
  FOR EACH ROW WHEN (new.status = 'completed' AND new.ended_at IS NULL)
  EXECUTE FUNCTION public.fn_consultations_set_ended_at();

-- 16 ------------------------------------------------------------------------------------------
-- process_double_check_purchase acepta p_notes (por defecto el texto de antes) para que la web
-- pueda mandar las notas traducidas. Se borra la firma de 4 argumentos: con las dos, PostgREST
-- no sabría cuál elegir. La llamada actual de la web (4 argumentos con nombre) sigue igual.
-- Cuerpo idéntico al de la sección 9 salvo las notas.
DROP FUNCTION IF EXISTS public.process_double_check_purchase(uuid, numeric, text, text);
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
  v_prev numeric;
  v_prev_meta jsonb;
  v_consultation_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then return jsonb_build_object('success', false, 'error', 'No authenticated user'); end if;
  if p_amount <= 0 or p_amount > 50000 then return jsonb_build_object('success', false, 'error', 'Invalid amount'); end if;
  if p_doctor_id = v_user_id then return jsonb_build_object('success', false, 'error', 'Doctor not available'); end if;

  select status into v_doctor_status from doctor_profiles where user_id = p_doctor_id;
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

  v_final_amount := get_price_for_user(p_amount, v_user_id);
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

-- Mismos permisos que la versión viva: sin anon ni PUBLIC.
REVOKE ALL ON FUNCTION public.process_double_check_purchase(uuid, numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_double_check_purchase(uuid, numeric, text, text, text) TO authenticated, service_role;
