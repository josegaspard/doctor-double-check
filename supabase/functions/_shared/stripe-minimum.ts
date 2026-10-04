// Stripe rechaza los cobros por debajo de su mínimo por divisa (MXN: $10.00) y la función
// acababa en 500. Se valida antes de crear la sesión y se responde 400 con un mensaje claro.
// https://docs.stripe.com/currencies#minimum-and-maximum-charge-amounts

const STRIPE_MIN_CENTS: Record<string, number> = { mxn: 1000, usd: 50, eur: 50 }

/** Lanza un Error con status 400 si el importe (en centavos) queda bajo el mínimo de Stripe. */
export function assertStripeMinimum(unitAmountCents: number, currency: string): void {
  const cur = (currency || 'mxn').toLowerCase()
  const min = STRIPE_MIN_CENTS[cur]
  if (min && unitAmountCents < min) {
    throw Object.assign(
      new Error(
        `El importe mínimo para pagar con tarjeta es de $${(min / 100).toFixed(2)} ${cur.toUpperCase()}.`,
      ),
      { status: 400 },
    )
  }
}
