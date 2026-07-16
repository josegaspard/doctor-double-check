-- =========================================================================
-- 2026-07-16 · Versionado de funciones en DRIFT (existían en prod, NO en
-- migraciones). Sin esto un rebuild las perdería y el rate-limit fallaría
-- abierto. Capturadas EXACTAS desde producción. Idempotentes.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.check_and_record_rate_limit(p_bucket text, p_key text, p_max integer, p_window_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM rate_limits
  WHERE bucket = p_bucket
    AND key = p_key
    AND created_at > now() - (p_window_seconds || ' seconds')::interval;
  IF v_count >= p_max THEN
    RETURN false;
  END IF;
  INSERT INTO rate_limits (bucket, key) VALUES (p_bucket, p_key);
  RETURN true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.restore_marketplace_stock(p_product_id uuid, p_quantity integer)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE marketplace_products SET stock = stock + p_quantity WHERE id = p_product_id;
$function$
;

