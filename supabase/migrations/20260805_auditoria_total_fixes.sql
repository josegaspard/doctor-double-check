-- ============================================================================
-- AUDITORÍA TOTAL 2026-08-05 — cierre de hallazgos críticos/altos/medios
-- Idempotente: se puede re-aplicar sin efectos secundarios.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- C3 · MONEDERO ROTO (crítico) ------------------------------------------------
-- 20260610_money_robustness.sql añadió p_idempotency_key con `create or replace`.
-- Al cambiar la FIRMA, Postgres creó una SEGUNDA función en vez de reemplazar la
-- de 3 args, y la vieja nunca se borró. PostgREST no puede desambiguar entre las
-- dos sobrecargas => PGRST203 en TODA llamada que no pase los 4 parámetros.
-- Efecto real: el chat destacado de pago en Lives (LiveChat.tsx) lleva sin
-- funcionar desde el 10-jun-2026. Se elimina la sobrecarga vieja de 3 args.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.process_wallet_purchase(numeric, text, jsonb);

-- ----------------------------------------------------------------------------
-- C2 · CREDENCIALES Y FIRMA DEL MÉDICO (crítico) ------------------------------
-- get_doctor_prescription_credentials y get_doctor_signature son SECURITY
-- DEFINER, tenían EXECUTE para `anon` y su cuerpo NO comprobaba nada. Un
-- anónimo con la anon key (que va en el bundle JS) podía volcar cédula
-- profesional, licencia, número de consejo, universidad, permiso COFEPRIS Y la
-- URL firmada de la FIRMA del médico de los 103 doctores — todo lo necesario
-- para falsificar una receta.
--
-- No basta con revocar de anon: la RPC existe precisamente para que un PACIENTE
-- (que por RLS no puede leer doctor_profiles) obtenga el membrete al descargar
-- SU receta. Guarda correcta = tiene que haber relación real médico↔paciente.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_doctor_credentials(p_doctor_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      -- el propio médico
      auth.uid() = p_doctor_user_id
      -- un administrador
      OR public.has_role(auth.uid(), 'admin'::app_role)
      -- un paciente con receta de ese médico
      OR EXISTS (SELECT 1 FROM public.prescriptions pr
                  WHERE pr.doctor_id = p_doctor_user_id AND pr.patient_id = auth.uid())
      -- un paciente con consulta con ese médico
      OR EXISTS (SELECT 1 FROM public.consultations c
                  WHERE c.doctor_id = p_doctor_user_id AND c.patient_id = auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION public.get_doctor_prescription_credentials(p_doctor_user_id uuid)
RETURNS TABLE(specialty text, secondary_specialties jsonb, license text,
              cedula_profesional text, cedula_especialidad text, numero_consejo text,
              university text, workplaces jsonb, practice_hospital text, cofepris_permit text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT dp.specialty, to_jsonb(dp.secondary_specialties), dp.license,
         dp.cedula_profesional, dp.cedula_especialidad, dp.numero_consejo,
         dp.university, to_jsonb(dp.workplaces), dp.practice_hospital, dp.cofepris_permit
  FROM public.doctor_profiles dp
  WHERE dp.user_id = p_doctor_user_id
    AND public.can_view_doctor_credentials(p_doctor_user_id)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_doctor_signature(p_doctor_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT dp.signature_url
  FROM public.doctor_profiles dp
  WHERE dp.user_id = p_doctor_user_id
    AND public.can_view_doctor_credentials(p_doctor_user_id)
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_doctor_prescription_credentials(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_doctor_signature(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_doctor_credentials(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_doctor_prescription_credentials(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_doctor_signature(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.can_view_doctor_credentials(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- A1 · EMAIL DEL MÉDICO EN LIVES (alto) ---------------------------------------
-- get_live_doctor_email hace JOIN a auth.users y estaba abierta a `anon`:
-- recorriendo las 60 lives públicas se cosechaban los emails de los médicos.
-- El cliente pidió (2026-06-16) que el email sea visible para los espectadores,
-- así que NO se elimina: se exige sesión iniciada. Un espectador logueado lo
-- sigue viendo; un scraper anónimo, no.
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_live_doctor_email(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_live_doctor_email(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- A2 · STOCK DEL MARKETPLACE (alto) -------------------------------------------
-- increment/decrement_product_stock son SECURITY DEFINER y SIN guarda: un
-- anónimo podía inflar el stock de los 30 productos con track_stock=true o
-- vaciarlo y matar las ventas del vendedor. El frontend NO las llama: solo las
-- usan Edge Functions con service_role.
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.increment_product_stock(uuid, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_product_stock(uuid, integer) FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- M7 · FUNCIONES DE MANTENIMIENTO (medio) -------------------------------------
-- Las corre pg_cron cada 20-30 min. No deben ser invocables por clientes.
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.reconcile_stuck_lives() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconcile_stuck_consultations() FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- BAJO · search_path mutable (4 funciones) ------------------------------------
-- Aviso `function_search_path_mutable` de Supabase.
-- ----------------------------------------------------------------------------
ALTER FUNCTION public.update_updated_at_column()        SET search_path TO 'public';
ALTER FUNCTION public.touch_appointments_updated_at()   SET search_path TO 'public';
ALTER FUNCTION public.touch_foro_events_updated_at()    SET search_path TO 'public';
ALTER FUNCTION public.marketplace_fee_for_price(numeric) SET search_path TO 'public';

-- ----------------------------------------------------------------------------
-- GOTCHA CRÍTICO (descubierto al VERIFICAR los revokes de arriba) -------------
-- `REVOKE ... FROM anon` NO basta: en Postgres toda función nace con EXECUTE
-- para PUBLIC, y anon/authenticated lo HEREDAN. En el ACL se ve como una
-- entrada sin grantee: `=X/postgres`. Tras el primer REVOKE, estas seguían
-- respondiendo a un anónimo. Hay que revocar de PUBLIC explícitamente.
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_doctor_signature(uuid)              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_view_doctor_credentials(uuid)       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_product_stock(uuid, integer)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrement_product_stock(uuid, integer)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reconcile_stuck_lives()                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reconcile_stuck_consultations()         FROM PUBLIC;

-- re-conceder a quien SÍ debe poder llamarlas
GRANT EXECUTE ON FUNCTION public.get_doctor_signature(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_doctor_credentials(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- RENDIMIENTO · 55 claves foráneas sin índice (aviso unindexed_foreign_keys)
-- Sin índice, cada DELETE/UPDATE en la tabla padre hace scan completo del hijo,
-- y los JOIN por la FK no pueden usar índice.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_accounting_ledger_dispute_id ON public.accounting_ledger (dispute_id);
CREATE INDEX IF NOT EXISTS idx_accounting_ledger_payout_id ON public.accounting_ledger (payout_id);
CREATE INDEX IF NOT EXISTS idx_accounting_ledger_refund_id ON public.accounting_ledger (refund_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_advertiser_id ON public.ad_campaigns (advertiser_id);
CREATE INDEX IF NOT EXISTS idx_ad_creatives_campaign_id ON public.ad_creatives (campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_creatives_placement_id ON public.ad_creatives (placement_id);
CREATE INDEX IF NOT EXISTS idx_ad_payments_campaign_id ON public.ad_payments (campaign_id);
CREATE INDEX IF NOT EXISTS idx_badge_chat_messages_sender_id ON public.badge_chat_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON public.chat_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_participant2_id ON public.chat_sessions (participant2_id);
CREATE INDEX IF NOT EXISTS idx_clinical_session_invitations_doctor_id ON public.clinical_session_invitations (doctor_id);
CREATE INDEX IF NOT EXISTS idx_congresses_organizer_id ON public.congresses (organizer_id);
CREATE INDEX IF NOT EXISTS idx_consultations_chat_session_id ON public.consultations (chat_session_id);
CREATE INDEX IF NOT EXISTS idx_doctor_notes_patient_id ON public.doctor_notes (patient_id);
CREATE INDEX IF NOT EXISTS idx_doctor_payouts_invoice_id ON public.doctor_payouts (invoice_id);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_cedula_verification_id ON public.doctor_profiles (cedula_verification_id);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_rank_override ON public.doctor_profiles (rank_override);
CREATE INDEX IF NOT EXISTS idx_forum_comments_author_id ON public.forum_comments (author_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_author_id ON public.forum_posts (author_id);
CREATE INDEX IF NOT EXISTS idx_hospital_reviews_hospital_id ON public.hospital_reviews (hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_reviews_user_id ON public.hospital_reviews (user_id);
CREATE INDEX IF NOT EXISTS idx_live_consultation_requests_chat_session_id ON public.live_consultation_requests (chat_session_id);
CREATE INDEX IF NOT EXISTS idx_live_consultation_requests_consultation_id ON public.live_consultation_requests (consultation_id);
CREATE INDEX IF NOT EXISTS idx_live_consultation_requests_live_id ON public.live_consultation_requests (live_id);
CREATE INDEX IF NOT EXISTS idx_live_doctor_chat_reply_to_id ON public.live_doctor_chat (reply_to_id);
CREATE INDEX IF NOT EXISTS idx_live_likes_user_id ON public.live_likes (user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_config_updated_by ON public.marketplace_config (updated_by);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer_id ON public.marketplace_orders (buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_cancelled_by ON public.marketplace_orders (cancelled_by);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_product_id ON public.marketplace_orders (product_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_shipped_by ON public.marketplace_orders (shipped_by);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_vendor_id ON public.marketplace_orders (vendor_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_category_id ON public.marketplace_products (category_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_reserved_by ON public.marketplace_products (reserved_by);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_reserved_interest_id ON public.marketplace_products (reserved_interest_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_vendor_id ON public.marketplace_products (vendor_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_vendors_user_id ON public.marketplace_vendors (user_id);
CREATE INDEX IF NOT EXISTS idx_news_comment_likes_comment_id ON public.news_comment_likes (comment_id);
CREATE INDEX IF NOT EXISTS idx_order_disputes_order_id ON public.order_disputes (order_id);
CREATE INDEX IF NOT EXISTS idx_order_refunds_approved_by ON public.order_refunds (approved_by);
CREATE INDEX IF NOT EXISTS idx_order_refunds_requested_by ON public.order_refunds (requested_by);
CREATE INDEX IF NOT EXISTS idx_prescriptions_consultation_id ON public.prescriptions (consultation_id);
CREATE INDEX IF NOT EXISTS idx_product_interests_chat_session_id ON public.product_interests (chat_session_id);
CREATE INDEX IF NOT EXISTS idx_purchases_recording_id ON public.purchases (recording_id);
CREATE INDEX IF NOT EXISTS idx_recordings_live_id ON public.recordings (live_id);
CREATE INDEX IF NOT EXISTS idx_referral_redemptions_referral_code_id ON public.referral_redemptions (referral_code_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_user_id ON public.refund_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_resident_group_activity_group_id ON public.resident_group_activity (group_id);
CREATE INDEX IF NOT EXISTS idx_resident_group_activity_user_id ON public.resident_group_activity (user_id);
CREATE INDEX IF NOT EXISTS idx_resident_group_members_user_id ON public.resident_group_members (user_id);
CREATE INDEX IF NOT EXISTS idx_resident_groups_created_by ON public.resident_groups (created_by);
CREATE INDEX IF NOT EXISTS idx_site_settings_updated_by ON public.site_settings (updated_by);
CREATE INDEX IF NOT EXISTS idx_vault_files_medical_history_id ON public.vault_files (medical_history_id);
CREATE INDEX IF NOT EXISTS idx_vault_files_patient_id ON public.vault_files (patient_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payouts_initiated_by ON public.vendor_payouts (initiated_by);
