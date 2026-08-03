// País real del visitante, resuelto en el edge de Vercel a partir de la IP.
//
// Se usa para el candado de registro solo-México (toggle restrict_signup_to_mexico
// del súper admin). Antes el país se "detectaba" con navigator.language, que no es
// la ubicación: un mexicano con el celular en inglés daba US, y un extranjero con
// el navegador en español daba MX. Vercel inyecta `x-vercel-ip-country` en el edge,
// así que no hace falta ningún servicio externo ni base de datos de IPs.
//
// Se probó primero con una edge function de Supabase, pero ahí solo llega
// `cf-connecting-ip` (la IP cruda) sin el país, así que no servía.
export const config = { runtime: 'edge' };

export default function handler(request: Request): Response {
  const country = request.headers.get('x-vercel-ip-country');

  return new Response(
    JSON.stringify({
      // ISO-2 en mayúsculas, o null si el edge no lo pudo determinar.
      country: country && country.length === 2 ? country.toUpperCase() : null,
      detected: Boolean(country),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Nunca cachear: la respuesta es distinta para cada visitante.
        'Cache-Control': 'no-store, max-age=0',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
}
