-- =========================================================================
-- La COMISIÓN POR TIPO deja de ser invisible para el médico (8-sep-2026)
-- =========================================================================
-- El problema: `credit_doctor_earnings` aplica una comisión DISTINTA según el
-- tipo de venta (`fn_commission_rate`: consulta, grabación, live, chat,
-- contenido), pero la vista pública `payout_settings_public` sólo expone la
-- comisión GLOBAL. Por eso la pantalla «Ingresos y pagos» tiene que calcular la
-- comisión y el neto con el porcentaje global y avisar de que puede no cuadrar.
--
-- Esto publica las 5 comisiones por tipo — que NO son un dato sensible: es el
-- porcentaje que la plataforma le cobra al médico, y el médico tiene derecho a
-- saberlo — para que la pantalla enseñe el neto exacto de cada movimiento en
-- vez de una aproximación.
--
-- No toca ninguna fila ni ningún importe: sólo amplía una vista de lectura.
-- =========================================================================

DROP VIEW IF EXISTS public.payout_settings_public;

CREATE VIEW public.payout_settings_public
WITH (security_invoker = true)
AS
SELECT
  commission_percentage,
  payout_frequency,
  commission_consultation,
  commission_recording,
  commission_live,
  commission_chat,
  commission_content
FROM public.payout_settings
WHERE id = 'default';

GRANT SELECT ON public.payout_settings_public TO authenticated, anon;

COMMENT ON VIEW public.payout_settings_public IS
  'Comisiones y frecuencia de pago que la plataforma publica al médico. Las 5 '
  'columnas por tipo pueden venir en NULL: entonces aplica commission_percentage '
  '(mismo criterio que fn_commission_rate).';
