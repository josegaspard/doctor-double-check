// Trabajo en segundo plano (prefetch de rutas, pre-warm de edge functions):
// solo con sesión iniciada y nunca con ahorro de datos o red 2g/3g. Un
// visitante anónimo en la portada o el login no lo necesita y en móvil le
// quitaba ancho de banda a la primera pintura.
export function canDoBackgroundWork(): boolean {
  if (typeof window === 'undefined') return false;
  const conn = (navigator as any).connection;
  if (conn && (conn.saveData || /(^|slow-)(2g|3g)$/.test(String(conn.effectiveType ?? '')))) return false;
  try {
    // supabase-js guarda la sesión en localStorage como sb-<proyecto>-auth-token.
    return Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
  } catch {
    return false;
  }
}
