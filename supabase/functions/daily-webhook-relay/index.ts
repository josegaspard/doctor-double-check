// Daily solo admite UN webhook por dominio y la cuenta "doctores" la comparten
// Medical Masters y Flou. Este relé recibe el evento y lo reenvía SIN tocar
// (mismo cuerpo y cabeceras de firma) a los dos destinos; cada uno verifica
// la firma de Daily por su cuenta.
const TARGETS = [
  "https://flou.com.mx/api/webhooks/daily",
  "https://api.medical-masters.com/functions/v1/daily-webhook",
];

const FORWARD_HEADERS = ["content-type", "x-webhook-signature", "x-webhook-timestamp"];

const logStep = (step: string, details?: unknown) => {
  console.log(`[DAILY-WEBHOOK-RELAY] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

Deno.serve(async (req) => {
  // Daily verifica el endpoint con un POST de prueba (o un GET): siempre 200.
  if (req.method !== "POST") return new Response("ok", { status: 200 });

  const rawBody = await req.text();
  const headers: Record<string, string> = {};
  for (const h of FORWARD_HEADERS) {
    const v = req.headers.get(h);
    if (v) headers[h] = v;
  }

  const results = await Promise.allSettled(
    TARGETS.map((url) =>
      fetch(url, { method: "POST", headers, body: rawBody, signal: AbortSignal.timeout(8000) })
        .then(async (r) => {
          await r.body?.cancel();
          return r.status;
        }),
    ),
  );
  logStep("Forwarded", Object.fromEntries(
    TARGETS.map((url, i) => [url, results[i].status === "fulfilled" ? results[i].value : String(results[i].reason)]),
  ));

  // 200 siempre: Daily desactiva el webhook si recibe errores seguidos.
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
