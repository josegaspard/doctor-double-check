-- ============================================================================
-- RENDIMIENTO · aviso auth_rls_initplan (296 policies)
-- Auditoria 2026-08-05. PREPARADO, NO APLICADO: el clasificador bloquea la
-- reescritura masiva de policies de control de acceso, hace falta el OK de Jose.
--
-- QUE HACE: envuelve auth.uid() / auth.role() / auth.jwt() en un subselect.
-- Sin envolver, Postgres evalua esa funcion UNA VEZ POR FILA; envuelta, una
-- sola vez por consulta (InitPlan). Es la recomendacion oficial de Supabase y
-- NO cambia la semantica: auth.uid() es STABLE. Con 8.668 consultas y 8.657
-- valoraciones ya se nota.
--
-- COMO SE GENERO: no esta escrito a mano. Sale de la expresion REAL de cada
-- policy (pg_policies.qual / with_check) con una sustitucion textual, asi que
-- la logica de cada una se conserva intacta.
--
-- COMO APLICARLO (dentro de una transaccion):
--   export PGPASSWORD="$(cat ~/.credentials/medical-masters-db-password.txt)"
--   ( echo "BEGIN;"; cat 20260805d_rls_initplan.sql; echo "COMMIT;" ) | \
--     psql "postgresql://postgres.ouawwfqexfwuptlgoksr@aws-1-us-east-1.pooler.supabase.com:5432/postgres" -v ON_ERROR_STOP=1
--
-- COMO VERIFICAR DESPUES:
--   1. select count(*) from pg_policies where schemaname='public';  -- debe seguir igual
--   2. El aviso auth_rls_initplan del advisor debe bajar de 296 a 0.
--   3. Con sesion iniciada: leer profiles, consultations, wallets, prescriptions.
-- ============================================================================

ALTER POLICY ledger_admin_all ON public.accounting_ledger USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Admins can delete campaigns" ON public.ad_campaigns USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Advertisers see own campaigns" ON public.ad_campaigns USING (((advertiser_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Authenticated can create campaigns" ON public.ad_campaigns WITH CHECK ((advertiser_id = (select auth.uid())));
ALTER POLICY "Owners and admins can update campaigns" ON public.ad_campaigns USING (((advertiser_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Admins can update ad config" ON public.ad_config USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Owners and admins update creatives" ON public.ad_creatives USING ((EXISTS ( SELECT 1
   FROM ad_campaigns c
  WHERE ((c.id = ad_creatives.campaign_id) AND ((c.advertiser_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role))))));
ALTER POLICY "Owners can manage creatives" ON public.ad_creatives WITH CHECK ((EXISTS ( SELECT 1
   FROM ad_campaigns c
  WHERE ((c.id = ad_creatives.campaign_id) AND (c.advertiser_id = (select auth.uid()))))));
ALTER POLICY "Users see own creatives" ON public.ad_creatives USING ((EXISTS ( SELECT 1
   FROM ad_campaigns c
  WHERE ((c.id = ad_creatives.campaign_id) AND ((c.advertiser_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role))))));
ALTER POLICY "Owners and admins read events" ON public.ad_events USING ((EXISTS ( SELECT 1
   FROM ad_campaigns c
  WHERE ((c.id = ad_events.campaign_id) AND ((c.advertiser_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role))))));
ALTER POLICY "Owners and admins read payments" ON public.ad_payments USING ((EXISTS ( SELECT 1
   FROM ad_campaigns c
  WHERE ((c.id = ad_payments.campaign_id) AND ((c.advertiser_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role))))));
ALTER POLICY "Owners can create payments" ON public.ad_payments WITH CHECK ((EXISTS ( SELECT 1
   FROM ad_campaigns c
  WHERE ((c.id = ad_payments.campaign_id) AND (c.advertiser_id = (select auth.uid()))))));
ALTER POLICY "Admins can manage placements" ON public.ad_placements USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Admins can read audit logs" ON public.admin_audit_logs USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY appointments_patient_insert ON public.appointments WITH CHECK ((patient_id = (select auth.uid())));
ALTER POLICY appointments_read ON public.appointments USING (((patient_id = (select auth.uid())) OR (doctor_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY appointments_update ON public.appointments USING (((patient_id = (select auth.uid())) OR (doctor_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role))) WITH CHECK (((patient_id = (select auth.uid())) OR (doctor_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Admins can read ARCO requests" ON public.arco_requests USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Admins can update ARCO requests" ON public.arco_requests USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "badge members can write" ON public.badge_chat_messages WITH CHECK (((sender_id = (select auth.uid())) AND (badge = current_user_badge())));
ALTER POLICY "Admins can view all cedula verifications" ON public.cedula_verifications USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Users can create cedula verifications" ON public.cedula_verifications WITH CHECK ((((select auth.uid()) = user_id) AND (COALESCE(is_verified, false) = false)));
ALTER POLICY "Users can view own cedula verifications" ON public.cedula_verifications USING (((select auth.uid()) = user_id));
ALTER POLICY "Participants can update message read status" ON public.chat_messages USING ((EXISTS ( SELECT 1
   FROM chat_sessions
  WHERE ((chat_sessions.id = chat_messages.session_id) AND ((chat_sessions.participant1_id = (select auth.uid())) OR (chat_sessions.participant2_id = (select auth.uid())))))));
ALTER POLICY "Participants can view messages" ON public.chat_messages USING ((EXISTS ( SELECT 1
   FROM chat_sessions
  WHERE ((chat_sessions.id = chat_messages.session_id) AND ((chat_sessions.participant1_id = (select auth.uid())) OR (chat_sessions.participant2_id = (select auth.uid())))))));
ALTER POLICY "Session participants can send messages" ON public.chat_messages WITH CHECK ((((select auth.uid()) = sender_id) AND (EXISTS ( SELECT 1
   FROM chat_sessions
  WHERE ((chat_sessions.id = chat_messages.session_id) AND (chat_sessions.status = 'active'::chat_status) AND ((chat_sessions.participant1_id = (select auth.uid())) OR (chat_sessions.participant2_id = (select auth.uid()))))))));
ALTER POLICY "Authenticated users can create sessions" ON public.chat_sessions WITH CHECK ((((select auth.uid()) = participant1_id) AND (NOT ((has_role(participant1_id, 'patient'::app_role) AND (has_role(participant2_id, 'patient'::app_role) OR has_role(participant2_id, 'resident'::app_role))) OR (has_role(participant1_id, 'resident'::app_role) AND has_role(participant2_id, 'patient'::app_role))))));
ALTER POLICY "Participants can delete closed sessions" ON public.chat_sessions USING (((status = 'closed'::chat_status) AND (((select auth.uid()) = participant1_id) OR ((select auth.uid()) = participant2_id))));
ALTER POLICY "Participants can update own sessions" ON public.chat_sessions USING ((((select auth.uid()) = participant1_id) OR ((select auth.uid()) = participant2_id)));
ALTER POLICY "Participants can view own sessions" ON public.chat_sessions USING ((((select auth.uid()) = participant1_id) OR ((select auth.uid()) = participant2_id)));
ALTER POLICY "Doctors read child records of active patients" ON public.child_profiles USING ((EXISTS ( SELECT 1
   FROM consultations c
  WHERE ((c.patient_id = child_profiles.parent_id) AND (c.doctor_id = (select auth.uid())) AND (c.status = ANY (ARRAY['active'::text, 'completed'::text]))))));
ALTER POLICY "Parents manage own children records delete" ON public.child_profiles USING (((select auth.uid()) = parent_id));
ALTER POLICY "Parents manage own children records insert" ON public.child_profiles WITH CHECK (((select auth.uid()) = parent_id));
ALTER POLICY "Parents manage own children records select" ON public.child_profiles USING (((select auth.uid()) = parent_id));
ALTER POLICY "Parents manage own children records update" ON public.child_profiles USING (((select auth.uid()) = parent_id));
ALTER POLICY "Authors and admins can delete comments" ON public.clinical_case_comments USING ((((select auth.uid()) = author_id) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Authors can update own comments" ON public.clinical_case_comments USING (((select auth.uid()) = author_id));
ALTER POLICY "Doctors and residents can comment" ON public.clinical_case_comments WITH CHECK ((((select auth.uid()) = author_id) AND (has_role((select auth.uid()), 'doctor'::app_role) OR has_role((select auth.uid()), 'resident'::app_role))));
ALTER POLICY "Doctors and residents can view comments" ON public.clinical_case_comments USING ((has_role((select auth.uid()), 'doctor'::app_role) OR has_role((select auth.uid()), 'resident'::app_role) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Authors and admins can delete cases" ON public.clinical_cases USING ((((select auth.uid()) = author_id) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Authors can update own cases" ON public.clinical_cases USING (((select auth.uid()) = author_id));
ALTER POLICY "Doctors and residents can view cases" ON public.clinical_cases USING ((has_role((select auth.uid()), 'doctor'::app_role) OR has_role((select auth.uid()), 'resident'::app_role) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Doctors, residents or admins can create cases" ON public.clinical_cases WITH CHECK ((((select auth.uid()) = author_id) AND (is_approved_doctor((select auth.uid())) OR has_role((select auth.uid()), 'resident'::app_role) OR has_role((select auth.uid()), 'admin'::app_role))));
ALTER POLICY "Doctors can view relevant invitations" ON public.clinical_session_invitations USING ((((select auth.uid()) = doctor_id) OR user_is_invitation_organizer(session_id, (select auth.uid()))));
ALTER POLICY "Invited doctors can respond to invitations" ON public.clinical_session_invitations USING (((select auth.uid()) = doctor_id));
ALTER POLICY "Organizers can invite approved doctors" ON public.clinical_session_invitations WITH CHECK ((user_is_invitation_organizer(session_id, (select auth.uid())) AND is_approved_doctor(doctor_id)));
ALTER POLICY "Approved doctors can create clinical sessions" ON public.clinical_sessions WITH CHECK (is_approved_doctor((select auth.uid())));
ALTER POLICY "Doctors can view clinical sessions" ON public.clinical_sessions USING ((((select auth.uid()) = organizer_id) OR user_is_clinical_session_participant(id, (select auth.uid()))));
ALTER POLICY "Organizers can delete own sessions" ON public.clinical_sessions USING (((select auth.uid()) = organizer_id));
ALTER POLICY "Organizers can update own sessions" ON public.clinical_sessions USING (((select auth.uid()) = organizer_id));
ALTER POLICY "Managers can add speakers" ON public.congress_speakers WITH CHECK (can_manage_congress(congress_id, (select auth.uid())));
ALTER POLICY "Managers can remove speakers" ON public.congress_speakers USING ((can_manage_congress(congress_id, (select auth.uid())) OR (user_id = (select auth.uid()))));
ALTER POLICY "Managers can update speakers" ON public.congress_speakers USING (can_manage_congress(congress_id, (select auth.uid())));
ALTER POLICY "Approved doctors can create congresses" ON public.congresses WITH CHECK (((organizer_id = (select auth.uid())) AND (is_approved_doctor((select auth.uid())) OR is_approved_resident((select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role))));
ALTER POLICY "Managers can update congresses" ON public.congresses USING (can_manage_congress(id, (select auth.uid()))) WITH CHECK (can_manage_congress(id, (select auth.uid())));
ALTER POLICY "Organizers can delete congresses" ON public.congresses USING (((organizer_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Users view own consent" ON public.consent_log USING ((((select auth.uid()) = user_id) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Participants and admins view ratings" ON public.consultation_ratings USING ((((select auth.uid()) = patient_id) OR ((select auth.uid()) = doctor_id) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Patients can rate their consultations" ON public.consultation_ratings WITH CHECK ((((select auth.uid()) = patient_id) AND (EXISTS ( SELECT 1
   FROM consultations
  WHERE ((consultations.id = consultation_ratings.consultation_id) AND (consultations.patient_id = (select auth.uid())) AND (consultations.status = 'completed'::text))))));
ALTER POLICY "Patients can update own ratings" ON public.consultation_ratings USING (((select auth.uid()) = patient_id));
ALTER POLICY "Approved doctors can create consultations" ON public.consultations WITH CHECK ((((select auth.uid()) = doctor_id) AND is_approved_doctor((select auth.uid()))));
ALTER POLICY "Participants can update consultations" ON public.consultations USING ((((select auth.uid()) = patient_id) OR ((select auth.uid()) = doctor_id)));
ALTER POLICY "Participants can view consultations" ON public.consultations USING ((((select auth.uid()) = patient_id) OR ((select auth.uid()) = doctor_id)));
ALTER POLICY "Users can insert their own disclaimer acceptances" ON public.disclaimer_acceptances WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can view their own disclaimer acceptances" ON public.disclaimer_acceptances USING (((select auth.uid()) = user_id));
ALTER POLICY "Doctors can manage own availability" ON public.doctor_availability USING (((select auth.uid()) = doctor_id));
ALTER POLICY "Admins can manage all bank accounts" ON public.doctor_bank_accounts USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Doctors can insert own bank account" ON public.doctor_bank_accounts WITH CHECK (((select auth.uid()) = doctor_id));
ALTER POLICY "Doctors can update own bank account" ON public.doctor_bank_accounts USING (((select auth.uid()) = doctor_id));
ALTER POLICY "Doctors can view own bank account" ON public.doctor_bank_accounts USING (((select auth.uid()) = doctor_id));
ALTER POLICY "Admins can manage all certifications" ON public.doctor_certifications USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Doctors can manage own certifications" ON public.doctor_certifications USING (((select auth.uid()) = doctor_id));
ALTER POLICY "Creators can manage own content" ON public.doctor_content USING (((select auth.uid()) = creator_id));
ALTER POLICY "Private content viewable by creator" ON public.doctor_content USING (((select auth.uid()) = creator_id));
ALTER POLICY "Public content filtered by audience" ON public.doctor_content USING (((is_public = true) AND ((audience_type = 'all'::content_audience) OR ((audience_type = 'patients'::content_audience) AND (has_role((select auth.uid()), 'patient'::app_role) OR has_role((select auth.uid()), 'doctor'::app_role) OR has_role((select auth.uid()), 'resident'::app_role) OR has_role((select auth.uid()), 'admin'::app_role))) OR ((audience_type = 'professionals'::content_audience) AND (has_role((select auth.uid()), 'doctor'::app_role) OR has_role((select auth.uid()), 'resident'::app_role) OR has_role((select auth.uid()), 'admin'::app_role))))));
ALTER POLICY doctor_content_public_approved_only ON public.doctor_content USING (((moderation_status = 'approved'::content_moderation_status) OR (creator_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Admins can manage all education" ON public.doctor_education USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Doctors can manage own education" ON public.doctor_education USING (((select auth.uid()) = doctor_id));
ALTER POLICY "Admins can manage all experience" ON public.doctor_experience USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Doctors can manage own experience" ON public.doctor_experience USING (((select auth.uid()) = doctor_id));
ALTER POLICY "Admins can manage all invoices" ON public.doctor_invoices USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Doctors can delete pending invoices" ON public.doctor_invoices USING ((((select auth.uid()) = doctor_id) AND (status = 'pending'::text)));
ALTER POLICY "Doctors can update pending invoices" ON public.doctor_invoices USING ((((select auth.uid()) = doctor_id) AND (status = 'pending'::text)));
ALTER POLICY "Doctors can upload invoices" ON public.doctor_invoices WITH CHECK (((select auth.uid()) = doctor_id));
ALTER POLICY "Doctors can view own invoices" ON public.doctor_invoices USING (((select auth.uid()) = doctor_id));
ALTER POLICY "Doctor manages own notes" ON public.doctor_notes USING (((doctor_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role))) WITH CHECK (((doctor_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Admins can manage all payouts" ON public.doctor_payouts USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Doctors can view own payouts" ON public.doctor_payouts USING (((select auth.uid()) = doctor_id));
ALTER POLICY "Admins can manage doctor profiles" ON public.doctor_profiles USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Doctor profiles viewable by owner or admin only" ON public.doctor_profiles USING ((((select auth.uid()) = user_id) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Doctors can update own profile" ON public.doctor_profiles USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can insert own doctor profile" ON public.doctor_profiles WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Admins can manage ranks" ON public.doctor_ranks USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Doctors can respond to connections" ON public.doctor_resident_connections USING (((select auth.uid()) = doctor_id));
ALTER POLICY "Residents can cancel pending connections" ON public.doctor_resident_connections USING ((((select auth.uid()) = resident_id) AND (status = 'pending'::text)));
ALTER POLICY "Residents can request connections" ON public.doctor_resident_connections WITH CHECK (((select auth.uid()) = resident_id));
ALTER POLICY "Users can view own connections" ON public.doctor_resident_connections USING ((((select auth.uid()) = doctor_id) OR ((select auth.uid()) = resident_id)));
ALTER POLICY "Admins can view all signatures" ON public.document_signatures USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Users can create own signatures" ON public.document_signatures WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own signatures" ON public.document_signatures USING (((select auth.uid()) = user_id));
ALTER POLICY "Doctors can delete own email history" ON public.email_history USING (((select auth.uid()) = doctor_id));
ALTER POLICY "Doctors can view own email history" ON public.email_history USING (((select auth.uid()) = doctor_id));
ALTER POLICY "Doctors can view their own email history" ON public.email_history USING ((doctor_id = (select auth.uid())));
ALTER POLICY "System can manage entitlements" ON public.entitlements USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Users can view own entitlements" ON public.entitlements USING (((select auth.uid()) = user_id));
ALTER POLICY "service role writes rates" ON public.exchange_rates_cache USING (((select auth.role()) = 'service_role'::text)) WITH CHECK (((select auth.role()) = 'service_role'::text));
ALTER POLICY "Authenticated users can create OTP" ON public.expediente_otp WITH CHECK ((((select auth.uid()) = doctor_id) OR ((select auth.uid()) = patient_id)));
ALTER POLICY "Doctors can update OTP" ON public.expediente_otp USING (((select auth.uid()) = doctor_id));
ALTER POLICY "Patients can view own OTP" ON public.expediente_otp USING (((select auth.uid()) = patient_id));
ALTER POLICY "Doctor manages own external patients" ON public.external_patients USING (((doctor_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role))) WITH CHECK (((doctor_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Admins can view featured events" ON public.featured_events USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Authenticated users can insert own featured events" ON public.featured_events WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Admins can manage featured listings" ON public.featured_listings USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "admins read access log" ON public.file_access_log USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "users insert own access log" ON public.file_access_log WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY "Users can follow" ON public.followers WITH CHECK (((select auth.uid()) = follower_id));
ALTER POLICY "Users can unfollow" ON public.followers USING (((select auth.uid()) = follower_id));
ALTER POLICY "Users see only their follow edges" ON public.followers USING ((((select auth.uid()) = follower_id) OR ((select auth.uid()) = followed_id) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Admins manage events" ON public.foro_events USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Creators delete own events" ON public.foro_events USING ((((select auth.uid()) = created_by) AND (EXISTS ( SELECT 1
   FROM doctor_profiles
  WHERE ((doctor_profiles.user_id = (select auth.uid())) AND (doctor_profiles.status = 'approved'::doctor_status))))));
ALTER POLICY "Creators update own events" ON public.foro_events USING ((((select auth.uid()) = created_by) AND (EXISTS ( SELECT 1
   FROM doctor_profiles
  WHERE ((doctor_profiles.user_id = (select auth.uid())) AND (doctor_profiles.status = 'approved'::doctor_status))))));
ALTER POLICY "Creators view own events" ON public.foro_events USING (((select auth.uid()) = created_by));
ALTER POLICY "Verified doctors create events" ON public.foro_events WITH CHECK ((((select auth.uid()) = created_by) AND (EXISTS ( SELECT 1
   FROM doctor_profiles
  WHERE ((doctor_profiles.user_id = (select auth.uid())) AND (doctor_profiles.status = 'approved'::doctor_status))))));
ALTER POLICY "Authors and admins can delete comments" ON public.forum_comments USING ((((select auth.uid()) = author_id) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Forum members can create comments" ON public.forum_comments WITH CHECK ((((select auth.uid()) = author_id) AND is_forum_member((select auth.uid()))));
ALTER POLICY "Forum members can read comments" ON public.forum_comments USING (is_forum_member((select auth.uid())));
ALTER POLICY "Authors and admins can delete posts" ON public.forum_posts USING ((((select auth.uid()) = author_id) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Forum members can create posts" ON public.forum_posts WITH CHECK ((((select auth.uid()) = author_id) AND is_forum_member((select auth.uid()))));
ALTER POLICY "Forum members can read posts" ON public.forum_posts USING (is_forum_member((select auth.uid())));
ALTER POLICY "Admins can manage all holds" ON public.fund_holds USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Doctors can view own holds" ON public.fund_holds USING (((select auth.uid()) = doctor_id));
ALTER POLICY hospital_doctors_admin_write ON public.hospital_doctors USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Admins can manage reviews" ON public.hospital_reviews USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Authenticated users can create reviews" ON public.hospital_reviews WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can delete own reviews" ON public.hospital_reviews USING (((select auth.uid()) = user_id));
ALTER POLICY "Admins can manage hospitals" ON public.hospitals USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Admins can manage verifications" ON public.identity_verifications USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Admins can view all identity verifications" ON public.identity_verifications USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Users can create verification requests" ON public.identity_verifications WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can update own pending verifications" ON public.identity_verifications USING ((((select auth.uid()) = user_id) AND (status = 'pending'::identity_verification_status)));
ALTER POLICY "Users can view own verifications" ON public.identity_verifications USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can insert own chat messages" ON public.live_chat_messages WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY "Doctors can view their requests" ON public.live_consultation_requests USING ((doctor_id = (select auth.uid())));
ALTER POLICY "Patients can insert own requests" ON public.live_consultation_requests WITH CHECK ((patient_id = (select auth.uid())));
ALTER POLICY "Patients can view own requests" ON public.live_consultation_requests USING ((patient_id = (select auth.uid())));
ALTER POLICY "Doctors and residents can post side-chat" ON public.live_doctor_chat WITH CHECK (((user_id = (select auth.uid())) AND (is_approved_doctor((select auth.uid())) OR is_approved_resident((select auth.uid())))));
ALTER POLICY "Doctors and residents can read side-chat" ON public.live_doctor_chat USING ((is_approved_doctor((select auth.uid())) OR is_approved_resident((select auth.uid()))));
ALTER POLICY "Authenticated users can like" ON public.live_likes WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can unlike own likes" ON public.live_likes USING (((select auth.uid()) = user_id));
ALTER POLICY "Approved doctors can create lives" ON public.lives WITH CHECK (is_approved_doctor((select auth.uid())));
ALTER POLICY "Approved residents can create lives" ON public.lives WITH CHECK (is_approved_resident((select auth.uid())));
ALTER POLICY "Creators can delete own lives" ON public.lives USING (((select auth.uid()) = doctor_id));
ALTER POLICY "Creators can update own lives" ON public.lives USING (((select auth.uid()) = doctor_id));
ALTER POLICY audit_admin_all ON public.marketplace_audit_log USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Admins manage brands" ON public.marketplace_brands USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Anyone can view active brands" ON public.marketplace_brands USING (((is_active = true) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Admins can manage categories" ON public.marketplace_categories USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "admins manage marketplace config" ON public.marketplace_config USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Admins can manage all orders" ON public.marketplace_orders USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Admins can update orders" ON public.marketplace_orders USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Admins can view all orders" ON public.marketplace_orders USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Buyers can create orders" ON public.marketplace_orders WITH CHECK (((select auth.uid()) = buyer_id));
ALTER POLICY "Buyers can view own orders" ON public.marketplace_orders USING ((buyer_id = (select auth.uid())));
ALTER POLICY "Vendors can update order status" ON public.marketplace_orders USING ((EXISTS ( SELECT 1
   FROM marketplace_vendors v
  WHERE ((v.id = marketplace_orders.vendor_id) AND (v.user_id = (select auth.uid())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM marketplace_vendors v
  WHERE ((v.id = marketplace_orders.vendor_id) AND (v.user_id = (select auth.uid()))))));
ALTER POLICY "Vendors can view orders for their products" ON public.marketplace_orders USING ((EXISTS ( SELECT 1
   FROM marketplace_vendors v
  WHERE ((v.id = marketplace_orders.vendor_id) AND (v.user_id = (select auth.uid()))))));
ALTER POLICY "Admins can manage all products" ON public.marketplace_products USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Vendor owners can manage own products" ON public.marketplace_products USING ((EXISTS ( SELECT 1
   FROM marketplace_vendors v
  WHERE ((v.id = marketplace_products.vendor_id) AND (v.user_id = (select auth.uid())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM marketplace_vendors v
  WHERE ((v.id = marketplace_products.vendor_id) AND (v.user_id = (select auth.uid()))))));
ALTER POLICY marketplace_products_public_read ON public.marketplace_products USING ((((is_active = true) AND (approval_status = 'approved'::text)) OR (vendor_id IN ( SELECT marketplace_vendors.id
   FROM marketplace_vendors
  WHERE (marketplace_vendors.user_id = (select auth.uid())))) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY marketplace_products_vendor_delete ON public.marketplace_products USING (((vendor_id IN ( SELECT marketplace_vendors.id
   FROM marketplace_vendors
  WHERE ((marketplace_vendors.user_id = (select auth.uid())) AND (marketplace_vendors.status = 'approved'::text)))) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY marketplace_products_vendor_update ON public.marketplace_products USING (((vendor_id IN ( SELECT marketplace_vendors.id
   FROM marketplace_vendors
  WHERE ((marketplace_vendors.user_id = (select auth.uid())) AND (marketplace_vendors.status = 'approved'::text)))) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY marketplace_products_vendor_write ON public.marketplace_products WITH CHECK (((vendor_id IN ( SELECT marketplace_vendors.id
   FROM marketplace_vendors
  WHERE ((marketplace_vendors.user_id = (select auth.uid())) AND (marketplace_vendors.status = 'approved'::text)))) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Admins can manage all vendors" ON public.marketplace_vendors USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Vendor owners can manage own" ON public.marketplace_vendors USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY marketplace_vendors_self_read ON public.marketplace_vendors USING (((user_id = (select auth.uid())) OR (status = 'approved'::text) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY marketplace_vendors_self_update ON public.marketplace_vendors USING (((user_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role))) WITH CHECK (((user_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Patients can manage own medical history" ON public.medical_history USING (((select auth.uid()) = patient_id));
ALTER POLICY "Patients can view own medical history" ON public.medical_history USING (((select auth.uid()) = patient_id));
ALTER POLICY "Admins can manage all news" ON public.medical_news USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Doctors can view own news" ON public.medical_news USING (((select auth.uid()) = created_by));
ALTER POLICY "Doctors with permission can delete own news" ON public.medical_news USING ((((select auth.uid()) = created_by) AND (EXISTS ( SELECT 1
   FROM doctor_profiles
  WHERE ((doctor_profiles.user_id = (select auth.uid())) AND (doctor_profiles.can_publish_news = true) AND (doctor_profiles.status = 'approved'::doctor_status))))));
ALTER POLICY "Doctors with permission can insert news" ON public.medical_news WITH CHECK ((((select auth.uid()) = created_by) AND (EXISTS ( SELECT 1
   FROM doctor_profiles
  WHERE ((doctor_profiles.user_id = (select auth.uid())) AND (doctor_profiles.can_publish_news = true) AND (doctor_profiles.status = 'approved'::doctor_status))))));
ALTER POLICY "Doctors with permission can update own news" ON public.medical_news USING ((((select auth.uid()) = created_by) AND (EXISTS ( SELECT 1
   FROM doctor_profiles
  WHERE ((doctor_profiles.user_id = (select auth.uid())) AND (doctor_profiles.can_publish_news = true) AND (doctor_profiles.status = 'approved'::doctor_status))))));
ALTER POLICY "Users can like" ON public.news_comment_likes WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can unlike" ON public.news_comment_likes USING (((select auth.uid()) = user_id));
ALTER POLICY "Admins can manage all comments" ON public.news_comments USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Users can create own comments" ON public.news_comments WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can delete own comments" ON public.news_comments USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can update own comments" ON public.news_comments USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can manage own preferences" ON public.notification_preferences USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own preferences" ON public.notification_preferences USING (((select auth.uid()) = user_id));
ALTER POLICY "Admins can insert notifications" ON public.notifications WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) AND (type = 'system'::notification_type)));
ALTER POLICY "Doctors can send invite notifications" ON public.notifications WITH CHECK (((type = 'system'::notification_type) AND (EXISTS ( SELECT 1
   FROM doctor_profiles dp
  WHERE ((dp.user_id = (select auth.uid())) AND (dp.status = 'approved'::doctor_status))))));
ALTER POLICY "Doctors can send rating notifications to patients" ON public.notifications WITH CHECK (((type = 'rating_request'::notification_type) AND (EXISTS ( SELECT 1
   FROM chat_sessions cs
  WHERE (((cs.participant1_id = (select auth.uid())) OR (cs.participant2_id = (select auth.uid()))) AND ((cs.participant1_id = notifications.user_id) OR (cs.participant2_id = notifications.user_id)) AND ((select auth.uid()) <> notifications.user_id))))));
ALTER POLICY "Doctors can send video call notifications to consultation patie" ON public.notifications WITH CHECK (((type = 'video_call'::notification_type) AND (EXISTS ( SELECT 1
   FROM consultations c
  WHERE ((c.doctor_id = (select auth.uid())) AND (c.patient_id = notifications.user_id) AND (c.status = 'active'::text))))));
ALTER POLICY "Patients can notify doctor of their appointment" ON public.notifications WITH CHECK (((type = 'system'::notification_type) AND (EXISTS ( SELECT 1
   FROM appointments a
  WHERE ((a.doctor_id = notifications.user_id) AND (a.patient_id = (select auth.uid())))))));
ALTER POLICY "Users can create own notifications" ON public.notifications WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can delete own notifications" ON public.notifications USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can update own notifications" ON public.notifications USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own notifications" ON public.notifications USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can delete own onboarding progress" ON public.onboarding_progress USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can insert own onboarding progress" ON public.onboarding_progress WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can update own onboarding progress" ON public.onboarding_progress USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own onboarding progress" ON public.onboarding_progress USING (((select auth.uid()) = user_id));
ALTER POLICY order_disputes_admin_all ON public.order_disputes USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY order_refunds_admin_all ON public.order_refunds USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY order_refunds_buyer_insert ON public.order_refunds WITH CHECK ((order_id IN ( SELECT marketplace_orders.id
   FROM marketplace_orders
  WHERE (marketplace_orders.buyer_id = (select auth.uid())))));
ALTER POLICY order_refunds_buyer_read ON public.order_refunds USING (((order_id IN ( SELECT marketplace_orders.id
   FROM marketplace_orders
  WHERE (marketplace_orders.buyer_id = (select auth.uid())))) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Admins can view all clinical histories" ON public.patient_clinical_history USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Doctors with vault access can view clinical history" ON public.patient_clinical_history USING ((EXISTS ( SELECT 1
   FROM (vault_files vf
     JOIN vault_access va ON ((va.file_id = vf.id)))
  WHERE ((vf.patient_id = patient_clinical_history.patient_id) AND (va.doctor_id = (select auth.uid())) AND ((va.expires_at IS NULL) OR (va.expires_at > now()))))));
ALTER POLICY "Patients can manage own clinical history" ON public.patient_clinical_history USING (((select auth.uid()) = patient_id));
ALTER POLICY "Patients can view own clinical history" ON public.patient_clinical_history USING (((select auth.uid()) = patient_id));
ALTER POLICY "Doctors read vaccinations of consulted patients" ON public.patient_vaccinations USING ((EXISTS ( SELECT 1
   FROM consultations c
  WHERE ((c.patient_id = patient_vaccinations.patient_id) AND (c.doctor_id = (select auth.uid())) AND (c.status = ANY (ARRAY['active'::text, 'completed'::text]))))));
ALTER POLICY "Patients delete own vaccinations" ON public.patient_vaccinations USING (((select auth.uid()) = patient_id));
ALTER POLICY "Patients insert own vaccinations" ON public.patient_vaccinations WITH CHECK (((select auth.uid()) = patient_id));
ALTER POLICY "Patients select own vaccinations" ON public.patient_vaccinations USING (((select auth.uid()) = patient_id));
ALTER POLICY "Patients update own vaccinations" ON public.patient_vaccinations USING (((select auth.uid()) = patient_id));
ALTER POLICY "Admins can manage payout settings" ON public.payout_settings USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Admins can view payout settings" ON public.payout_settings USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Service role can manage phone verifications" ON public.phone_verifications USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own phone verifications" ON public.phone_verifications USING (((select auth.uid()) = user_id));
ALTER POLICY "Doctors can create own prescriptions" ON public.prescriptions WITH CHECK (((select auth.uid()) = doctor_id));
ALTER POLICY "Doctors can delete own prescriptions" ON public.prescriptions USING (((select auth.uid()) = doctor_id));
ALTER POLICY "Doctors can update own prescriptions" ON public.prescriptions USING (((select auth.uid()) = doctor_id)) WITH CHECK (((select auth.uid()) = doctor_id));
ALTER POLICY "Doctors can view own prescriptions" ON public.prescriptions USING (((select auth.uid()) = doctor_id));
ALTER POLICY "Patients can delete own prescriptions" ON public.prescriptions USING (((select auth.uid()) = patient_id));
ALTER POLICY "Patients can view own prescriptions" ON public.prescriptions USING (((select auth.uid()) = patient_id));
ALTER POLICY "admin updates interest" ON public.product_interests USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "buyer creates own interest" ON public.product_interests WITH CHECK (((buyer_id = (select auth.uid())) AND (status = 'pending_payment'::text)));
ALTER POLICY "interest visible to buyer vendor admin" ON public.product_interests USING (((buyer_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR (EXISTS ( SELECT 1
   FROM marketplace_vendors v
  WHERE ((v.id = product_interests.vendor_id) AND (v.user_id = (select auth.uid())))))));
ALTER POLICY product_reviews_admin_all ON public.product_reviews USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY product_reviews_self_update ON public.product_reviews USING ((reviewer_id = (select auth.uid())));
ALTER POLICY product_reviews_self_write ON public.product_reviews WITH CHECK (((reviewer_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM marketplace_orders o
  WHERE ((o.id = product_reviews.order_id) AND (o.buyer_id = (select auth.uid())) AND (o.status = ANY (ARRAY['paid'::text, 'shipped'::text, 'delivered'::text])))))));
ALTER POLICY "Admins can view all profiles" ON public.profiles USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Users can update own profile" ON public.profiles USING (((select auth.uid()) = id));
ALTER POLICY "Users can view own profile" ON public.profiles USING (((select auth.uid()) = id));
ALTER POLICY "Admins can view all purchases" ON public.purchases USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Doctors can view purchases on their recordings" ON public.purchases USING ((EXISTS ( SELECT 1
   FROM recordings r
  WHERE ((r.id = purchases.recording_id) AND (r.doctor_id = (select auth.uid()))))));
ALTER POLICY "Users can view own purchases" ON public.purchases USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can manage own subscriptions" ON public.push_subscriptions USING (((select auth.uid()) = user_id));
ALTER POLICY "Admins manage qr_campaigns" ON public.qr_campaigns USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Admins read qr_scans" ON public.qr_scans USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Creators can manage own recordings" ON public.recordings USING (((select auth.uid()) = doctor_id));
ALTER POLICY "Users can create own referral codes" ON public.referral_codes WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users can view own referral codes" ON public.referral_codes USING (((select auth.uid()) = user_id));
ALTER POLICY "System can create redemptions" ON public.referral_redemptions WITH CHECK (((select auth.uid()) = referred_user_id));
ALTER POLICY "Users can view own redemptions" ON public.referral_redemptions USING ((((select auth.uid()) = referrer_user_id) OR ((select auth.uid()) = referred_user_id)));
ALTER POLICY "Admins can update requests" ON public.refund_requests USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Users and admins can view requests" ON public.refund_requests USING ((((select auth.uid()) = user_id) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Users can insert own requests" ON public.refund_requests WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Admins can update reports" ON public.reports USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Admins can view all reports" ON public.reports USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Users can create reports" ON public.reports WITH CHECK (((select auth.uid()) = reporter_id));
ALTER POLICY "Users can view own reports" ON public.reports USING (((select auth.uid()) = reporter_id));
ALTER POLICY "Group members can post activity" ON public.resident_group_activity WITH CHECK ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM resident_group_members
  WHERE ((resident_group_members.group_id = resident_group_activity.group_id) AND (resident_group_members.user_id = (select auth.uid())))))));
ALTER POLICY "Group members can view activity" ON public.resident_group_activity USING ((EXISTS ( SELECT 1
   FROM resident_group_members
  WHERE ((resident_group_members.group_id = resident_group_activity.group_id) AND (resident_group_members.user_id = (select auth.uid()))))));
ALTER POLICY "Members can leave groups" ON public.resident_group_members USING (((select auth.uid()) = user_id));
ALTER POLICY "Residents can join groups" ON public.resident_group_members WITH CHECK ((((select auth.uid()) = user_id) AND has_role((select auth.uid()), 'resident'::app_role)));
ALTER POLICY "Admins and creators can manage groups" ON public.resident_groups USING ((((select auth.uid()) = created_by) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Admins can manage resident profiles" ON public.resident_profiles USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Resident profiles viewable by owner or admin only" ON public.resident_profiles USING ((((select auth.uid()) = user_id) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Residents can update own profile" ON public.resident_profiles USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can insert own resident profile" ON public.resident_profiles WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Users insert own search events" ON public.search_events WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY "Users read own search events" ON public.search_events USING ((user_id = (select auth.uid())));
ALTER POLICY shipment_events_buyer_read ON public.shipment_tracking_events USING (((order_id IN ( SELECT marketplace_orders.id
   FROM marketplace_orders
  WHERE (marketplace_orders.buyer_id = (select auth.uid())))) OR (order_id IN ( SELECT o.id
   FROM (marketplace_orders o
     JOIN marketplace_vendors v ON ((v.id = o.vendor_id)))
  WHERE (v.user_id = (select auth.uid())))) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY shipment_events_vendor_admin_write ON public.shipment_tracking_events WITH CHECK (((order_id IN ( SELECT o.id
   FROM (marketplace_orders o
     JOIN marketplace_vendors v ON ((v.id = o.vendor_id)))
  WHERE (v.user_id = (select auth.uid())))) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Admins can insert site settings" ON public.site_settings WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Admins can read site settings" ON public.site_settings USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Admins can update site settings" ON public.site_settings USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Users can cancel own subscriptions" ON public.subscriptions USING (((select auth.uid()) = subscriber_id));
ALTER POLICY "Users can subscribe with own subscriber_id" ON public.subscriptions WITH CHECK ((((select auth.uid()) = subscriber_id) AND (creator_id IS NOT NULL) AND (creator_id <> subscriber_id)));
ALTER POLICY "Users can view own subscriptions" ON public.subscriptions USING ((((select auth.uid()) = subscriber_id) OR ((select auth.uid()) = creator_id)));
ALTER POLICY "Admins can view all bank accounts" ON public.user_bank_accounts USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Users can manage own bank account" ON public.user_bank_accounts USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
ALTER POLICY "Users can manage own blocks" ON public.user_blocks USING (((select auth.uid()) = blocker_id));
ALTER POLICY "Users can view if they are blocked" ON public.user_blocks USING (((select auth.uid()) = blocked_id));
ALTER POLICY "Admins can manage roles" ON public.user_roles USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Users can view own role" ON public.user_roles USING (((select auth.uid()) = user_id));
ALTER POLICY "Doctors can view own access" ON public.vault_access USING (((select auth.uid()) = doctor_id));
ALTER POLICY "Patients can grant access to approved doctors" ON public.vault_access WITH CHECK (((EXISTS ( SELECT 1
   FROM vault_files
  WHERE ((vault_files.id = vault_access.file_id) AND (vault_files.patient_id = (select auth.uid()))))) AND is_approved_doctor(doctor_id)));
ALTER POLICY "Patients can revoke vault access for own files" ON public.vault_access USING ((EXISTS ( SELECT 1
   FROM vault_files
  WHERE ((vault_files.id = vault_access.file_id) AND (vault_files.patient_id = (select auth.uid()))))));
ALTER POLICY "Patients can view vault access for own files" ON public.vault_access USING ((EXISTS ( SELECT 1
   FROM vault_files
  WHERE ((vault_files.id = vault_access.file_id) AND (vault_files.patient_id = (select auth.uid()))))));
ALTER POLICY "Actors view their vault actions" ON public.vault_audit_log USING ((actor_id = (select auth.uid())));
ALTER POLICY "Admins view all vault audit" ON public.vault_audit_log USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Patients view own vault audit" ON public.vault_audit_log USING ((patient_id = (select auth.uid())));
ALTER POLICY "Doctors can view files with active access" ON public.vault_files USING (user_has_vault_access(id, (select auth.uid())));
ALTER POLICY "Patients can manage own vault files" ON public.vault_files USING (((select auth.uid()) = patient_id));
ALTER POLICY "Patients can view own vault files" ON public.vault_files USING (((select auth.uid()) = patient_id));
ALTER POLICY vendor_earnings_admin_all ON public.vendor_earnings USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY vendor_earnings_self_read ON public.vendor_earnings USING (((vendor_id IN ( SELECT marketplace_vendors.id
   FROM marketplace_vendors
  WHERE (marketplace_vendors.user_id = (select auth.uid())))) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY vendor_payouts_admin_all ON public.vendor_payouts USING (has_role((select auth.uid()), 'admin'::app_role)) WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY vendor_payouts_self_read ON public.vendor_payouts USING (((vendor_id IN ( SELECT marketplace_vendors.id
   FROM marketplace_vendors
  WHERE (marketplace_vendors.user_id = (select auth.uid())))) OR has_role((select auth.uid()), 'admin'::app_role)));
ALTER POLICY "Admins can view all wallet transactions" ON public.wallet_transactions USING (has_role((select auth.uid()), 'admin'::app_role));
ALTER POLICY "Users can view own transactions" ON public.wallet_transactions USING (((select auth.uid()) = user_id));
ALTER POLICY "Users can insert own wallet" ON public.wallets WITH CHECK ((((select auth.uid()) = user_id) AND (COALESCE(balance, (0)::numeric) = (0)::numeric)));
ALTER POLICY "Users can view own wallet" ON public.wallets USING (((select auth.uid()) = user_id));
