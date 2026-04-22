-- 1) Enum verification_status
DO $$ BEGIN
  CREATE TYPE public.verification_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2) Columnas de estado de cédula y COFEPRIS en doctor_profiles
ALTER TABLE public.doctor_profiles
  ADD COLUMN IF NOT EXISTS cedula_status public.verification_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS cedula_rejection_reason text,
  ADD COLUMN IF NOT EXISTS cofepris_status public.verification_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS cofepris_rejection_reason text;

-- Marcar como approved cuando ya hay valor y el doctor está approved
UPDATE public.doctor_profiles
SET cedula_status = 'approved'
WHERE status = 'approved' AND cedula_profesional IS NOT NULL AND TRIM(cedula_profesional) <> '';

UPDATE public.doctor_profiles
SET cofepris_status = 'approved'
WHERE status = 'approved' AND cofepris_permit IS NOT NULL AND TRIM(cofepris_permit) <> '';

-- 3) Recrear view pública con los nuevos campos
DROP VIEW IF EXISTS public.doctor_profiles_public CASCADE;

CREATE VIEW public.doctor_profiles_public
WITH (security_invoker = on) AS
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
  dp.available_for_clinical_sessions,
  dp.badge_override,
  dp.rank_override,
  dp.office_hours_start,
  dp.office_hours_end,
  dp.office_days,
  dp.signature_url,
  dp.cedula_profesional,
  dp.cofepris_permit,
  dp.cedula_status,
  dp.cedula_rejection_reason,
  dp.cofepris_status,
  dp.cofepris_rejection_reason,
  dp.status,
  dp.created_at,
  dp.updated_at
FROM public.doctor_profiles dp
WHERE dp.status = 'approved';

GRANT SELECT ON public.doctor_profiles_public TO anon, authenticated;

-- 4) Tabla de auditoría del Vault
CREATE TABLE IF NOT EXISTS public.vault_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid REFERENCES public.vault_files(id) ON DELETE SET NULL,
  actor_id uuid,
  patient_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('accessed','access_denied','access_granted','access_revoked','otp_required','otp_failed','otp_verified')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_audit_patient ON public.vault_audit_log(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vault_audit_actor ON public.vault_audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vault_audit_file ON public.vault_audit_log(file_id, created_at DESC);

ALTER TABLE public.vault_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients view own vault audit" ON public.vault_audit_log;
CREATE POLICY "Patients view own vault audit"
  ON public.vault_audit_log FOR SELECT
  TO authenticated
  USING (patient_id = auth.uid());

DROP POLICY IF EXISTS "Actors view their vault actions" ON public.vault_audit_log;
CREATE POLICY "Actors view their vault actions"
  ON public.vault_audit_log FOR SELECT
  TO authenticated
  USING (actor_id = auth.uid());

DROP POLICY IF EXISTS "Admins view all vault audit" ON public.vault_audit_log;
CREATE POLICY "Admins view all vault audit"
  ON public.vault_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Sin política de INSERT pública: solo SECURITY DEFINER
-- 5) Función SECURITY DEFINER para insertar eventos
CREATE OR REPLACE FUNCTION public.log_vault_action(
  p_file_id uuid,
  p_patient_id uuid,
  p_action text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.vault_audit_log(file_id, actor_id, patient_id, action, metadata)
  VALUES (p_file_id, auth.uid(), p_patient_id, p_action, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_vault_action(uuid, uuid, text, jsonb) TO authenticated;

-- 6) Triggers en vault_access para grant/revoke
CREATE OR REPLACE FUNCTION public.trg_vault_access_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT patient_id INTO v_patient_id FROM public.vault_files WHERE id = NEW.file_id;
    INSERT INTO public.vault_audit_log(file_id, actor_id, patient_id, action, metadata)
    VALUES (NEW.file_id, auth.uid(), COALESCE(v_patient_id, NEW.granted_by), 'access_granted',
            jsonb_build_object('doctor_id', NEW.doctor_id, 'expires_at', NEW.expires_at));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT patient_id INTO v_patient_id FROM public.vault_files WHERE id = OLD.file_id;
    INSERT INTO public.vault_audit_log(file_id, actor_id, patient_id, action, metadata)
    VALUES (OLD.file_id, auth.uid(), COALESCE(v_patient_id, OLD.granted_by), 'access_revoked',
            jsonb_build_object('doctor_id', OLD.doctor_id));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS vault_access_audit_ins ON public.vault_access;
CREATE TRIGGER vault_access_audit_ins
AFTER INSERT ON public.vault_access
FOR EACH ROW EXECUTE FUNCTION public.trg_vault_access_audit();

DROP TRIGGER IF EXISTS vault_access_audit_del ON public.vault_access;
CREATE TRIGGER vault_access_audit_del
AFTER DELETE ON public.vault_access
FOR EACH ROW EXECUTE FUNCTION public.trg_vault_access_audit();

-- 7) Trigger para notificar cambios de estado de wallet_transactions
CREATE OR REPLACE FUNCTION public.notify_wallet_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'paid' AND OLD.status IN ('initiated','pending') THEN
      INSERT INTO public.notifications(user_id, type, title, message, data)
      VALUES (NEW.user_id, 'system', '✅ Pago confirmado',
              COALESCE(NEW.description, 'Tu pago ha sido confirmado.'),
              jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount, 'status', 'paid'));
    ELSIF NEW.status = 'failed' AND OLD.status IN ('initiated','pending') THEN
      INSERT INTO public.notifications(user_id, type, title, message, data)
      VALUES (NEW.user_id, 'system', '❌ Pago rechazado',
              COALESCE(NEW.description, 'Tu pago no se pudo procesar') || ' — intenta de nuevo o contacta soporte.',
              jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount, 'status', 'failed'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wallet_status_change_notify ON public.wallet_transactions;
CREATE TRIGGER wallet_status_change_notify
AFTER UPDATE OF status ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.notify_wallet_status_change();