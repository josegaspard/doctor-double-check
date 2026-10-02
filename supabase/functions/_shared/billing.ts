// El médico factura a nombre y RFC de quien le compra, no de la plataforma.
// Sin datos fiscales del comprador no se abre ningún cobro a un médico.
// (Los cargos por monedero los frena además el trigger fn_require_billing_profile.)

export const BILLING_REQUIRED_MESSAGE =
  "Antes de comprar captura tu RFC y nombre fiscal: el médico te factura a ti.";

/** Devuelve una respuesta 409 lista para enviar si el usuario no tiene datos fiscales; si los tiene, null. */
export async function requireBillingProfile(
  // deno-lint-ignore no-explicit-any
  db: any,
  userId: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const { data, error } = await db
    .from("billing_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  // Si la consulta falla (p. ej. migración aún sin aplicar) no se frena la venta.
  if (error || data) return null;
  return new Response(
    JSON.stringify({ error: BILLING_REQUIRED_MESSAGE, code: "billing_profile_required" }),
    { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
