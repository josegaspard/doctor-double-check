// Redacción de PII/PHI para logs de edge functions.
// Cumplimiento médico: los logs de Supabase no deben contener emails, nombres
// ni teléfonos de pacientes en claro. Estos helpers enmascaran esos campos
// dejando lo justo para depurar (primer carácter + dominio, o iniciales).
//
// Uso: logStep("User authenticated", { userId: user.id, email: maskEmail(user.email) });

/** "john.doe@gmail.com" -> "j***@gmail.com"; null/invalid -> "***". */
export function maskEmail(email?: string | null): string {
  if (!email || typeof email !== "string" || !email.includes("@")) return "***";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

/** "Juan Pérez García" -> "J.P.G"; null/empty -> "***". */
export function maskName(name?: string | null): string {
  if (!name || typeof name !== "string") return "***";
  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => (w[0] ? w[0].toUpperCase() : ""))
    .filter(Boolean)
    .join(".");
  return initials || "***";
}

/** "+525512345678" -> "***5678"; null/short -> "***". */
export function maskPhone(phone?: string | null): string {
  if (!phone || typeof phone !== "string" || phone.length < 4) return "***";
  return `***${phone.slice(-4)}`;
}
