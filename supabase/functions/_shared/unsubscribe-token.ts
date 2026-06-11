// HMAC-signed unsubscribe token shared by every bulk-email sender.
//
// Token format: base64url(payload).base64url(hmacSha256(payload))
//   payload = `${subscriberId}:${doctorId}:${type}`
//
// MUST stay byte-for-byte compatible with the verifier in
// `unsubscribe-email/index.ts` (decodeToken). Previously each sender minted a
// plain `btoa(payload)` token with no signature, which the verifier rejected —
// so the unsubscribe link was broken in every mass email. Use this helper.

const b64urlEncode = (data: ArrayBuffer | string): string => {
  const bytes = typeof data === "string"
    ? new TextEncoder().encode(data)
    : new Uint8Array(data);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64urlEncode(sig);
}

export async function generateUnsubscribeToken(
  subscriberId: string,
  doctorId: string,
  type: string,
): Promise<string> {
  const secret = Deno.env.get("EMAIL_UNSUBSCRIBE_SECRET") || "";
  if (!secret) throw new Error("EMAIL_UNSUBSCRIBE_SECRET not configured");
  const payload = `${subscriberId}:${doctorId}:${type}`;
  const sig = await hmacSign(secret, payload);
  return `${b64urlEncode(payload)}.${sig}`;
}
