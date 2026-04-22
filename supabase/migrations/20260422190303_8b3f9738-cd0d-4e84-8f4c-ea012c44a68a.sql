-- 1. VISTAS → SECURITY INVOKER
ALTER VIEW public.doctor_profiles_public SET (security_invoker = true);
ALTER VIEW public.resident_profiles_public SET (security_invoker = true);
ALTER VIEW public.profiles_public SET (security_invoker = true);
ALTER VIEW public.payout_settings_public SET (security_invoker = true);

-- 2. ELIMINAR POLÍTICA DUPLICADA
DROP POLICY IF EXISTS "Public can insert ad events" ON public.ad_events;

-- 3. BUCKETS PÚBLICOS
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images public read by path"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] IS NOT NULL);

DROP POLICY IF EXISTS "Thumbnails are publicly accessible" ON storage.objects;
CREATE POLICY "Thumbnails public read by path"
ON storage.objects FOR SELECT
USING (bucket_id = 'thumbnails' AND (storage.foldername(name))[1] IS NOT NULL);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Ad creatives publicly accessible') THEN
    EXECUTE 'DROP POLICY "Ad creatives publicly accessible" ON storage.objects';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Email assets publicly accessible') THEN
    EXECUTE 'DROP POLICY "Email assets publicly accessible" ON storage.objects';
  END IF;
END $$;

CREATE POLICY "Ad creatives public read by path"
ON storage.objects FOR SELECT
USING (bucket_id = 'ad-creatives' AND (storage.foldername(name))[1] IS NOT NULL);

CREATE POLICY "Email assets public read by path"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-assets' AND (storage.foldername(name))[1] IS NOT NULL);

-- 4. VIEWER COUNT REQUIERE AUTH
CREATE OR REPLACE FUNCTION public.increment_viewer_count(p_live_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to count viewers';
  END IF;
  UPDATE public.lives
  SET viewer_count = viewer_count + 1
  WHERE id = p_live_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrement_viewer_count(p_live_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to count viewers';
  END IF;
  UPDATE public.lives
  SET viewer_count = GREATEST(0, viewer_count - 1)
  WHERE id = p_live_id;
END;
$function$;

-- 5. CHECK CONSTRAINT recording_status
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lives' AND column_name='recording_status') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lives_recording_status_check') THEN
      ALTER TABLE public.lives
        ADD CONSTRAINT lives_recording_status_check
        CHECK (recording_status IS NULL OR recording_status IN ('none','live','processing_recording','recording_ready','failed'));
    END IF;
  END IF;
END $$;

-- 6. TRIGGER NOTIFICACIÓN WALLET
DROP TRIGGER IF EXISTS trg_notify_wallet_status ON public.wallet_transactions;
CREATE TRIGGER trg_notify_wallet_status
AFTER UPDATE ON public.wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION public.notify_wallet_status_change();