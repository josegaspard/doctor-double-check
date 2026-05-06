
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'handle_new_user()',
    'notify_wallet_status_change()',
    'sync_clinical_case_comments_count()',
    'trg_vault_access_audit()',
    'update_chat_priority_on_subscription_change()',
    'update_doctor_rating()',
    'update_live_likes_count()',
    'update_total_consultations()',
    'update_followers_count()',
    'update_followers_count_on_subscription()',
    'update_group_member_count()',
    'update_site_settings_timestamp()',
    'update_updated_at_column()',
    'validate_chat_message_content()',
    'validate_refund_request_status()',
    'credit_doctor_earnings(uuid,numeric)',
    'credit_wallet_balance(uuid,numeric)',
    'decrement_storage_used(uuid,bigint)',
    'increment_storage_used(uuid,bigint)',
    'log_vault_action(uuid,uuid,text,jsonb)',
    'notify_subscribers(uuid,notification_type,text,text,jsonb)',
    'process_doctor_payout(uuid,numeric,numeric)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
  END LOOP;
END $$;

DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'get_chat_session_details(uuid)',
    'get_chat_sessions_details_bulk(uuid[])',
    'get_doctor_accessible_files(uuid)',
    'get_doctor_signature(uuid)',
    'get_my_subscribers()',
    'increment_paid_chats_count(uuid)',
    'increment_viewer_count(uuid)',
    'decrement_viewer_count(uuid)',
    'process_consultation_purchase(uuid,numeric,text)',
    'process_wallet_purchase(numeric,text,jsonb)',
    'process_wallet_topup(numeric)',
    'redeem_referral_code(text)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Anyone can submit ARCO request" ON public.arco_requests;
CREATE POLICY "Anyone can submit ARCO request"
ON public.arco_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  email IS NOT NULL
  AND length(trim(email)) BETWEEN 5 AND 255
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
);

DROP POLICY IF EXISTS "Anyone can insert events" ON public.ad_events;
CREATE POLICY "Anyone can insert events"
ON public.ad_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (creative_id IS NOT NULL OR campaign_id IS NOT NULL)
  AND event_type IS NOT NULL
  AND length(event_type) BETWEEN 1 AND 32
);
