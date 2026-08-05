-- ============================================================================
-- AUDITORÍA TOTAL 2026-08-05 · RONDA 2
-- Hallazgos de la re-auditoría, verificados uno a uno contra producción.
-- Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- R2-1 · fn_post_service_sale: escritura ANÓNIMA en el libro contable ---------
-- SECURITY DEFINER (dueño postgres), sin una sola comprobación de sesión, e
-- inserta 3-4 asientos en accounting_ledger. Probado como anónimo: devuelve 204
-- (o sea, EJECUTA; con p_gross=0 sale por el return temprano y no escribe).
-- accounting_ledger no tiene FK sobre transaction_group ni CHECK sobre
-- entry_type/account, así que un desconocido podía inyectar asientos con
-- importes y cuentas arbitrarias — incluida tax_iva_payable, que alimenta el
-- CSV fiscal de export-accounting-csv.
-- No la llama NADIE desde el frontend ni desde las edge functions: es un helper
-- invocado con `perform` desde otras funciones SECURITY DEFINER, así que
-- revocarla no rompe ninguna ruta.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.fn_post_service_sale(uuid, text, numeric, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- R2-2 · check_and_record_rate_limit: bloqueo del "olvidé mi contraseña" ------
-- El bucket y la clave son parámetros del CLIENTE y la función no comprueba
-- sesión. Un anónimo podía insertar 3 filas en el bucket auth_email_recovery
-- con el correo de otra persona; a partir de ahí auth-email-hook ve el cupo
-- agotado y devuelve 200 EN SILENCIO sin mandar el correo, dejando a esa
-- persona sin poder recuperar su cuenta. Especialmente grave desde hoy, que la
-- verificación por correo es obligatoria.
-- La llaman 5 edge functions (auth-email-hook, create-wallet-checkout,
-- submit-report, submit-contact, verify-cedula-sep) y las CINCO usan
-- SUPABASE_SERVICE_ROLE_KEY, nunca la anon key.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.check_and_record_rate_limit(text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- R2-3 · La otra función duplicada -------------------------------------------
-- Mismo origen que process_wallet_purchase: la migración del 10-jun añadió
-- p_idempotency_key con `create or replace` y dejó viva la firma de 3 args.
-- Hoy NO rompe nada porque DoubleCheckFlow.tsx llama con los 4 argumentos,
-- pero cualquier llamada de 3 moriría con PGRST203. Se elimina la vieja.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.process_double_check_purchase(uuid, numeric, text);

-- ----------------------------------------------------------------------------
-- R2-4 · pg_net: SSRF latente -------------------------------------------------
-- net.http_get/http_post/http_delete tenían EXECUTE para anon y authenticated.
-- Hoy no hay camino para invocarlo (PostgREST solo expone public y
-- graphql_public, y ninguna función de public envuelve net.http_*), pero es un
-- pie armado: el día que alguien exponga el esquema o escriba un envoltorio,
-- se convierte en SSRF hacia la red interna. Solo el cron (postgres) y
-- service_role deben poder emitir HTTP desde la base.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'net') THEN
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA net FROM anon, authenticated';
    EXECUTE 'REVOKE USAGE ON SCHEMA net FROM anon, authenticated';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- R2-5 · Que las funciones NUEVAS no nazcan abiertas --------------------------
-- Causa raíz de todo lo anterior: en Postgres toda función nace con EXECUTE
-- para PUBLIC, y anon/authenticated lo heredan. Por eso `REVOKE ... FROM anon`
-- no cerraba nada. Esto hace que las próximas migraciones no repitan el patrón.
-- Solo afecta a lo que se cree A PARTIR DE AHORA; lo ya existente hay que
-- revocarlo a mano, función por función.
-- ----------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
