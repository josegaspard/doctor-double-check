-- =====================================================================
-- Solicitudes de retiro del médico («Retirar saldo» de verdad)
-- 13-sep-2026 · medical-masters.com (proyecto ouawwfqexfwuptlgoksr)
--
-- Migración ADITIVA e IDEMPOTENTE: se puede correr varias veces.
-- No borra ni reescribe ningún dato real, no toca ningún importe.
--
-- REGLA DE DINERO (la importante):
--   · Solicitar un retiro NO descuenta saldo. `doctor_profiles.pending_earnings`
--     solo lo sigue descontando el pago real del admin
--     (`process_doctor_payout`, llamado por `process-doctor-payouts` y
--     `admin-record-manual-payout`). Nada de este archivo escribe saldos.
--   · Enlace solicitud → pago: un TRIGGER sobre `doctor_payouts`. Cuando un
--     pago del médico queda en `paid` (sea manual, Stripe individual, Stripe
--     por lotes, webhook `transfer.updated` o el reconciliador), las
--     solicitudes abiertas de ese médico creadas ANTES del pago pasan a
--     `paid` con su `payout_id`. Se eligió el trigger y no la pantalla del
--     admin porque cubre todos los caminos de pago, incluidos los que no
--     pasan por la UI, y va en la misma transacción que el cambio de estado.
--     El trigger nunca bloquea un pago: si falla, avisa (WARNING) y el pago
--     sigue su curso.
--   · Si un pago `paid` se revierte (`failed`), la solicitud vuelve a estar
--     abierta para que el admin la pague otra vez. El saldo lo re-acredita
--     quien revierte el pago (webhook/reconciliador), nunca este archivo.
--
-- Bloques:
--   1. Tabla payout_requests (+ RLS: lectura propia y admin; escrituras solo por RPC)
--   2. get_payout_minimum()                         — mínimo para retirar (médico)
--   3. request_doctor_payout(p_amount, p_note)      — el médico solicita
--   4. cancel_payout_request(p_request_id)          — el médico cancela la suya pendiente
--   5. admin_review_payout_request(id, decision, note) — el admin aprueba o rechaza
--   6. Trigger doctor_payouts → payout_requests (pagada / revertida)
--   7. Permisos y recarga del esquema
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. TABLA payout_requests
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.payout_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount          numeric NOT NULL,
  status          text NOT NULL DEFAULT 'pending',
  bank_account_id uuid REFERENCES public.doctor_bank_accounts(id) ON DELETE SET NULL,
  doctor_note     text,
  admin_note      text,
  reviewed_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at     timestamptz,
  payout_id       uuid REFERENCES public.doctor_payouts(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_requests_amount_check') THEN
    ALTER TABLE public.payout_requests
      ADD CONSTRAINT payout_requests_amount_check CHECK (amount > 0 AND amount = round(amount, 2));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_requests_status_check') THEN
    ALTER TABLE public.payout_requests
      ADD CONSTRAINT payout_requests_status_check
      CHECK (status IN ('pending', 'approved', 'rejected', 'paid', 'cancelled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_requests_doctor_note_check') THEN
    ALTER TABLE public.payout_requests
      ADD CONSTRAINT payout_requests_doctor_note_check
      CHECK (doctor_note IS NULL OR char_length(doctor_note) <= 500);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_requests_admin_note_check') THEN
    ALTER TABLE public.payout_requests
      ADD CONSTRAINT payout_requests_admin_note_check
      CHECK (admin_note IS NULL OR char_length(admin_note) <= 500);
  END IF;
END $$;

-- Una sola solicitud PENDIENTE por médico.
CREATE UNIQUE INDEX IF NOT EXISTS payout_requests_one_pending
  ON public.payout_requests (doctor_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS payout_requests_doctor_idx
  ON public.payout_requests (doctor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payout_requests_status_idx
  ON public.payout_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS payout_requests_payout_idx
  ON public.payout_requests (payout_id) WHERE payout_id IS NOT NULL;

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- Lectura: el médico las suyas; el admin todas. Sin policies de escritura:
-- se crean, cancelan y revisan SOLO por las RPC de abajo.
DROP POLICY IF EXISTS payout_requests_doctor_read ON public.payout_requests;
CREATE POLICY payout_requests_doctor_read ON public.payout_requests
  FOR SELECT USING (doctor_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS payout_requests_admin_read ON public.payout_requests;
CREATE POLICY payout_requests_admin_read ON public.payout_requests
  FOR SELECT USING (public.has_role((SELECT auth.uid()), 'admin'));

DROP TRIGGER IF EXISTS trg_payout_requests_updated_at ON public.payout_requests;
CREATE TRIGGER trg_payout_requests_updated_at
  BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 2. MÍNIMO PARA RETIRAR
--    `payout_settings` solo lo lee el admin y la vista pública no trae el
--    mínimo: el médico lo necesita para saber cuánto puede pedir.
--    Mismo valor por defecto que process-doctor-payouts (100).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_payout_minimum()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT COALESCE(ps.minimum_payout_amount, 100) FROM public.payout_settings ps WHERE ps.id = 'default'),
    100
  );
$$;

-- =====================================================================
-- 3. EL MÉDICO SOLICITA UN RETIRO
--    Médico aprobado · cuenta para retiros verificada · importe entre el
--    mínimo y su saldo · sin otra solicitud abierta (pendiente o aprobada).
--    NO descuenta saldo. Avisa a los admins.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.request_doctor_payout(
  p_amount numeric,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor  uuid := (SELECT auth.uid());
  v_note    text;
  v_min     numeric;
  v_pending numeric;
  v_bank_id uuid;
  v_bank_ok boolean;
  v_id      uuid;
  v_name    text;
  v_amount_txt text;
BEGIN
  IF v_doctor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_approved_doctor(v_doctor) THEN
    RAISE EXCEPTION 'not_approved_doctor' USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;
  IF p_amount <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'invalid_amount_decimals' USING ERRCODE = '22023';
  END IF;

  v_note := NULLIF(btrim(COALESCE(p_note, '')), '');
  IF v_note IS NOT NULL AND char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'invalid_note_too_long' USING ERRCODE = '22023';
  END IF;

  -- Serializa las solicitudes de ESTE médico (doble clic, dos pestañas).
  PERFORM pg_advisory_xact_lock(hashtext('payout_request_' || v_doctor::text));

  SELECT b.id, COALESCE(b.is_verified, false)
    INTO v_bank_id, v_bank_ok
    FROM public.doctor_bank_accounts b
   WHERE b.doctor_id = v_doctor;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'no_bank_account' USING ERRCODE = '42501';
  END IF;
  IF NOT v_bank_ok THEN
    RAISE EXCEPTION 'bank_account_not_verified' USING ERRCODE = '42501';
  END IF;

  v_min := public.get_payout_minimum();
  IF p_amount < v_min THEN
    RAISE EXCEPTION 'below_minimum' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(dp.pending_earnings, 0)
    INTO v_pending
    FROM public.doctor_profiles dp
   WHERE dp.user_id = v_doctor;

  IF p_amount > COALESCE(v_pending, 0) THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payout_requests r
     WHERE r.doctor_id = v_doctor AND r.status IN ('pending', 'approved')
  ) THEN
    RAISE EXCEPTION 'request_already_open' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.payout_requests (doctor_id, amount, status, bank_account_id, doctor_note)
  VALUES (v_doctor, p_amount, 'pending', v_bank_id, v_note)
  RETURNING id INTO v_id;

  -- Aviso a los admins. Si el aviso falla, la solicitud queda igual (la ven
  -- en /admin/payouts): un aviso no puede tumbar la solicitud.
  BEGIN
    SELECT NULLIF(name, '') INTO v_name FROM public.profiles WHERE id = v_doctor;
    v_amount_txt := to_char(p_amount, 'FM999,999,999,990.00');

    INSERT INTO public.notifications (user_id, type, title, message, data)
    SELECT a.user_id,
           'system',
           'Nueva solicitud de retiro',
           COALESCE(v_name, 'Un médico') || ' solicita retirar $' || v_amount_txt || ' MXN de su saldo.',
           jsonb_build_object(
             'kind', 'payout_request_created',
             'request_id', v_id,
             'doctor_id', v_doctor,
             'amount', p_amount,
             'url', '/admin/payouts',
             'deeplink', '/admin/payouts',
             'i18n', jsonb_build_object(
               'title', 'mm2.retiros.notif.requested.title',
               'message', 'mm2.retiros.notif.requested.message',
               'params', jsonb_build_object('doctor', COALESCE(v_name, ''), 'amount', v_amount_txt)
             )
           )
      FROM (SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin') a;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'request_doctor_payout: aviso a admins no enviado: %', SQLERRM;
  END;

  RETURN v_id;
END;
$$;

-- =====================================================================
-- 4. EL MÉDICO CANCELA SU SOLICITUD (solo la suya y solo pendiente)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.cancel_payout_request(p_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor uuid := (SELECT auth.uid());
  v_status text;
BEGIN
  IF v_doctor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT r.status INTO v_status
    FROM public.payout_requests r
   WHERE r.id = p_request_id AND r.doctor_id = v_doctor
   FOR UPDATE;

  -- La de otro médico responde igual que una inexistente: no se puede sondear.
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'request_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending' USING ERRCODE = '22023';
  END IF;

  UPDATE public.payout_requests
     SET status = 'cancelled'
   WHERE id = p_request_id;

  RETURN p_request_id;
END;
$$;

-- =====================================================================
-- 5. EL ADMIN APRUEBA O RECHAZA
--    Aprobar no mueve dinero: deja la solicitud lista para el pago que el
--    admin lanza con el flujo de siempre. Rechazar exige un motivo (el
--    médico lo ve). Avisa al médico.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.admin_review_payout_request(
  p_request_id uuid,
  p_decision text,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin    uuid := (SELECT auth.uid());
  v_decision text := lower(btrim(COALESCE(p_decision, '')));
  v_note     text := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_req      record;
  v_pending  numeric;
  v_amount_txt text;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;
  IF v_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid_decision' USING ERRCODE = '22023';
  END IF;
  IF v_note IS NOT NULL AND char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'invalid_note_too_long' USING ERRCODE = '22023';
  END IF;
  IF v_decision = 'rejected' AND v_note IS NULL THEN
    RAISE EXCEPTION 'note_required_for_rejection' USING ERRCODE = '22023';
  END IF;

  SELECT r.id, r.doctor_id, r.amount, r.status
    INTO v_req
    FROM public.payout_requests r
   WHERE r.id = p_request_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending' USING ERRCODE = '22023';
  END IF;

  -- Aprobar con menos saldo del pedido dejaría una promesa que el pago no
  -- puede cumplir (el pago entrega el saldo completo, no el importe pedido).
  IF v_decision = 'approved' THEN
    SELECT COALESCE(dp.pending_earnings, 0) INTO v_pending
      FROM public.doctor_profiles dp WHERE dp.user_id = v_req.doctor_id;
    IF COALESCE(v_pending, 0) < v_req.amount THEN
      RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.payout_requests
     SET status = v_decision,
         admin_note = v_note,
         reviewed_by = v_admin,
         reviewed_at = now()
   WHERE id = v_req.id;

  BEGIN
    v_amount_txt := to_char(v_req.amount, 'FM999,999,999,990.00');
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      v_req.doctor_id,
      'system',
      CASE WHEN v_decision = 'approved' THEN 'Solicitud de retiro aprobada' ELSE 'Solicitud de retiro rechazada' END,
      CASE WHEN v_decision = 'approved'
        THEN 'Tu solicitud de retiro de $' || v_amount_txt || ' MXN fue aprobada. Te avisaremos cuando se realice el pago.'
        ELSE 'Tu solicitud de retiro de $' || v_amount_txt || ' MXN fue rechazada. Motivo: ' || COALESCE(v_note, '')
      END,
      jsonb_build_object(
        'kind', CASE WHEN v_decision = 'approved' THEN 'payout_request_approved' ELSE 'payout_request_rejected' END,
        'request_id', v_req.id,
        'amount', v_req.amount,
        'url', '/settings?s=finanzas&f=pendientes',
        'deeplink', '/settings?s=finanzas&f=pendientes',
        'i18n', jsonb_build_object(
          'title', CASE WHEN v_decision = 'approved' THEN 'mm2.retiros.notif.approved.title' ELSE 'mm2.retiros.notif.rejected.title' END,
          'message', CASE WHEN v_decision = 'approved' THEN 'mm2.retiros.notif.approved.message' ELSE 'mm2.retiros.notif.rejected.message' END,
          'params', jsonb_build_object('amount', v_amount_txt, 'note', COALESCE(v_note, ''))
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'admin_review_payout_request: aviso al médico no enviado: %', SQLERRM;
  END;

  RETURN v_req.id;
END;
$$;

-- =====================================================================
-- 6. PAGO REAL → SOLICITUD PAGADA (y vuelta atrás si el pago se revierte)
--    Solo cambia estados de payout_requests. Jamás toca saldos.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.payout_requests_sync_with_payout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_became_paid boolean := false;
  v_left_paid   boolean := false;
BEGIN
  -- OLD solo se lee en UPDATE.
  IF TG_OP = 'INSERT' THEN
    v_became_paid := (NEW.status = 'paid');
  ELSIF TG_OP = 'UPDATE' THEN
    v_became_paid := (NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid');
    v_left_paid   := (OLD.status = 'paid' AND NEW.status IS DISTINCT FROM 'paid');
  END IF;

  BEGIN
    IF v_became_paid THEN
      -- El pago entrega el saldo completo: cierra las solicitudes abiertas
      -- creadas hasta el momento en que se creó el pago. Las posteriores se
      -- validaron contra el saldo ya descontado y siguen abiertas.
      UPDATE public.payout_requests r
         SET status = 'paid',
             payout_id = NEW.id,
             reviewed_at = COALESCE(r.reviewed_at, now())
       WHERE r.doctor_id = NEW.doctor_id
         AND r.status IN ('pending', 'approved')
         AND r.payout_id IS NULL
         AND r.created_at <= NEW.created_at;

    ELSIF v_left_paid THEN
      -- Pago revertido: la solicitud vuelve a abrirse (aprobada si la había
      -- revisado un admin; pendiente si no). El saldo lo re-acredita quien
      -- revierte el pago, no este trigger.
      UPDATE public.payout_requests r
         SET status = CASE WHEN r.reviewed_by IS NOT NULL THEN 'approved' ELSE 'pending' END,
             reviewed_at = CASE WHEN r.reviewed_by IS NOT NULL THEN r.reviewed_at ELSE NULL END,
             payout_id = NULL
       WHERE r.payout_id = NEW.id
         AND r.status = 'paid';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Nunca bloquear un pago por culpa de las solicitudes.
    RAISE WARNING 'payout_requests_sync_with_payout (%): %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payout_requests_on_payout_insert ON public.doctor_payouts;
CREATE TRIGGER trg_payout_requests_on_payout_insert
  AFTER INSERT ON public.doctor_payouts
  FOR EACH ROW
  WHEN (NEW.status = 'paid')
  EXECUTE FUNCTION public.payout_requests_sync_with_payout();

DROP TRIGGER IF EXISTS trg_payout_requests_on_payout_status ON public.doctor_payouts;
CREATE TRIGGER trg_payout_requests_on_payout_status
  AFTER UPDATE OF status ON public.doctor_payouts
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.payout_requests_sync_with_payout();

-- =====================================================================
-- 7. PERMISOS
-- =====================================================================

REVOKE ALL ON public.payout_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.payout_requests TO authenticated;

REVOKE ALL ON FUNCTION public.get_payout_minimum() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_payout_minimum() TO authenticated;

REVOKE ALL ON FUNCTION public.request_doctor_payout(numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_doctor_payout(numeric, text) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_payout_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_payout_request(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_review_payout_request(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_payout_request(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.payout_requests_sync_with_payout() FROM PUBLIC, anon, authenticated;

COMMIT;

-- PostgREST tiene que ver los objetos nuevos en su caché de esquema.
NOTIFY pgrst, 'reload schema';
