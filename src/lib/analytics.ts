// Eventos de GA4 (24-nov-2026). gtag ya lo cargan index.html + public/gtag-init.js
// para las dos propiedades (G-NB9CJEJYPV y G-FYNGDNQP6Y): aquí solo se envían
// eventos. Nunca se mandan datos personales (ni correo, ni nombre, ni ids de
// usuario o de médico): solo rol, tipo de compra, importes y moneda.
type Params = Record<string, string | number | boolean | undefined>;

const ALLOWED_KEYS = new Set([
  'role', 'method', 'value', 'currency', 'item_category', 'transaction_id', 'source', 'lead_type',
]);

export function track(event: string, params: Params = {}): void {
  try {
    const clean: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || !ALLOWED_KEYS.has(k)) continue;
      // Defensa extra: nada que parezca un correo sale hacia Google.
      if (typeof v === 'string' && v.includes('@')) continue;
      clean[k] = v;
    }
    const w = window as unknown as { gtag?: (...a: unknown[]) => void };
    if (typeof w.gtag === 'function') w.gtag('event', event, clean);
  } catch { /* la analítica nunca rompe la app */ }
}

// ── Compras por Stripe ──────────────────────────────────────────────────────
// El pago se cierra fuera (Stripe Checkout) y vuelve con una marca en la URL.
// Al empezar se guarda qué se compra y por cuánto; al volver se manda `purchase`
// una sola vez con ese importe.
const PENDING_KEY = 'mm_ga_pending_checkout';

export function beginCheckout(itemCategory: string, value?: number): void {
  const v = typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) / 100 : undefined;
  track('begin_checkout', { item_category: itemCategory, value: v, currency: 'MXN' });
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ c: itemCategory, v, t: Date.now() })); } catch { /* noop */ }
}

/** Compra pagada con saldo (sin salir de la app). */
export function trackPurchase(itemCategory: string, value?: number, transactionId?: string): void {
  const v = typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) / 100 : undefined;
  track('purchase', {
    item_category: itemCategory,
    value: v,
    currency: 'MXN',
    transaction_id: transactionId || `mm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
}

// Marcas que dejan las success_url de las funciones create-*-checkout.
const RETURN_MARKERS: [RegExp, string][] = [
  [/[?&]consultation=success\b/, 'consultation'],
  [/[?&]subscription=success\b/, 'subscription'],
  [/[?&]chat_paid=success\b/, 'live_chat'],
  [/[?&]recording_paid=success\b/, 'recording'],
  [/[?&]book_paid=success\b/, 'content'],
  [/[?&]storage_success=true\b/, 'storage'],
  [/[?&]payment=success\b/, 'ads'],
  [/^\/wallet\?.*\bsuccess=true\b/, 'wallet'],
  [/^\/order-success\?.*session_id=/, 'marketplace'],
];

/** Se llama en cada cambio de ruta (AnalyticsRouteListener en App.tsx). */
export function checkPurchaseReturn(pathname: string, search: string): void {
  if (!search) return;
  const url = pathname + search;
  const hit = RETURN_MARKERS.find(([re]) => re.test(re.source.startsWith('^') ? url : search));
  if (!hit) return;
  const params = new URLSearchParams(search);
  const sessionId = params.get('session_id') || undefined;
  const dedupeKey = `mm_ga_purchase_${sessionId || url}`;
  try {
    if (sessionStorage.getItem(dedupeKey)) return;
    sessionStorage.setItem(dedupeKey, '1');
  } catch { /* noop */ }
  let pending: { c?: string; v?: number; t?: number } = {};
  try { pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || '{}'); sessionStorage.removeItem(PENDING_KEY); } catch { /* noop */ }
  const urlAmount = Number(params.get('amount'));
  const value = Number.isFinite(urlAmount) && urlAmount > 0 ? urlAmount : pending.v;
  trackPurchase(hit[1], value, sessionId);
}
