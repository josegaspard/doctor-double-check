// Template compartido para correos transaccionales de Medical Masters.
//
// Diseñado para máxima compatibilidad: layout 100% tablas (Outlook, Gmail
// móvil, iOS Mail), sin display:flex, sin emoji-en-círculo (rompe el
// centrado en clientes que ignoran flex), inline-styles, dark-mode friendly.
//
// Uso:
//   import { renderEmail, brand } from "../_shared/email-template.ts";
//   const html = renderEmail({
//     preheader: "Tu cuenta ha sido aprobada",
//     accent: "success",            // success | info | warning | danger | neutral
//     eyebrow: "CUENTA APROBADA",   // pill arriba del título (opcional)
//     title: "Bienvenido al equipo",
//     greeting: "Hola Dr. Martínez,",
//     bodyHtml: "<p>...</p>",
//     ctaText: "Ir a mi panel",
//     ctaUrl: "https://medical-masters.com/doctor",
//   });

export const brand = {
  navy: "#163a83",
  teal: "#00768b",
  light: "#9fdfde",
  ink: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  bgLight: "#f1f5f9",
  surface: "#ffffff",
} as const;

const ACCENTS = {
  success: { bg: "#dcfce7", fg: "#166534", solid: "#10b981" },
  info:    { bg: "#dbeafe", fg: "#1e3a8a", solid: brand.navy },
  warning: { bg: "#fef3c7", fg: "#92400e", solid: "#f59e0b" },
  danger:  { bg: "#fee2e2", fg: "#991b1b", solid: "#ef4444" },
  neutral: { bg: "#f1f5f9", fg: "#475569", solid: brand.navy },
} as const;

export type EmailAccent = keyof typeof ACCENTS;

export interface RenderEmailOptions {
  preheader: string;
  accent?: EmailAccent;
  eyebrow?: string;        // pill arriba del título: "CUENTA APROBADA"
  title: string;           // título grande en el hero
  subtitle?: string;       // subtítulo opcional bajo el título
  greeting?: string;       // "Hola Dr. X,"
  bodyHtml: string;        // contenido principal en HTML
  ctaText?: string;
  ctaUrl?: string;
  secondaryNote?: string;  // texto pequeño debajo del CTA
  appUrl?: string;
  showFooter?: boolean;
}

const APP_URL_DEFAULT = "https://medical-masters.com";
const LOGO_URL = `${APP_URL_DEFAULT}/email-logo-white.png`;

// ── Admin-editable email branding (site_settings.email_branding) ──
// Loaded ONCE per isolate at module init (top-level await). Any failure or
// timeout falls back to the historical values, so emails always render.
interface EmailBranding {
  brand_name: string;
  tagline: string;
  primary_color: string;
  support_url: string;
  support_label: string;
}
const EMAIL_BRANDING: EmailBranding = await (async () => {
  const fb: EmailBranding = {
    brand_name: "Medical Masters",
    tagline: "Plataforma de telemedicina",
    primary_color: brand.teal,
    support_url: `${APP_URL_DEFAULT}/contact`,
    support_label: "Contáctanos",
  };
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !key) return fb;
    const ctrl = new AbortController();
    const tmo = setTimeout(() => ctrl.abort(), 2500);
    const resp = await fetch(`${url}/rest/v1/site_settings?id=eq.email_branding&select=value`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: ctrl.signal,
    });
    clearTimeout(tmo);
    if (!resp.ok) return fb;
    const rows = await resp.json();
    const v = (rows && rows[0] && rows[0].value) || {};
    const str = (x: unknown, d: string) => (typeof x === "string" && x.trim() ? x : d);
    return {
      brand_name: str(v.brand_name, fb.brand_name),
      tagline: str(v.tagline, fb.tagline),
      primary_color: (typeof v.primary_color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v.primary_color)) ? v.primary_color : fb.primary_color,
      support_url: str(v.support_url, fb.support_url),
      support_label: str(v.support_label, fb.support_label),
    };
  } catch {
    return fb;
  }
})();

export function renderEmail(opts: RenderEmailOptions): string {
  const accent = ACCENTS[opts.accent ?? "neutral"];
  const appUrl = opts.appUrl ?? APP_URL_DEFAULT;
  const showFooter = opts.showFooter ?? true;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
<meta charset="utf-8" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${escapeHtml(opts.title)}</title>
<style>
  @media (max-width: 620px) {
    .mm-container { width: 100% !important; }
    .mm-pad-x { padding-left: 24px !important; padding-right: 24px !important; }
    .mm-title { font-size: 24px !important; line-height: 32px !important; }
    .mm-eyebrow { font-size: 10px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .mm-page-bg { background: #0b1220 !important; }
    .mm-card    { background: #131c33 !important; }
    .mm-text    { color: #e2e8f0 !important; }
    .mm-muted   { color: #94a3b8 !important; }
    .mm-divider { border-color: #1f2a44 !important; }
    .mm-footer  { background: #0b1220 !important; color: #94a3b8 !important; }
    /* Override TODO el cuerpo: párrafos, listas, strong, headings.
       Necesario porque los emails refactorizados usan inline color en <p>,
       que sin !important se ve casi negro sobre fondo casi negro. */
    .mm-card p, .mm-card li, .mm-card span:not([style*="color:#"]):not([style*="color: #"]) { color: #cbd5e1 !important; }
    .mm-card strong, .mm-card b { color: #f8fafc !important; }
    .mm-card h1, .mm-card h2, .mm-card h3 { color: #f1f5f9 !important; }
    /* Las tablas detail/info-card y el bigAmount tienen su propio fondo de
       color claro: los textos dentro deben quedarse oscuros para legibilidad. */
    .mm-card .mm-keep-light p,
    .mm-card .mm-keep-light li,
    .mm-card .mm-keep-light span,
    .mm-card .mm-keep-light strong { color: inherit !important; }
  }
  a { color: ${brand.teal}; }
</style>
</head>
<body class="mm-page-bg" style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- preheader: visible en preview de inbox, oculto en el cuerpo -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#eef2f7;opacity:0;">
    ${escapeHtml(opts.preheader)}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="mm-page-bg" style="background:#eef2f7;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- card -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="mm-container mm-card" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,.08);">

          <!-- header: gradient navy → teal con logo -->
          <tr>
            <td align="center" style="background:${brand.navy};background-image:linear-gradient(135deg,${brand.navy} 0%,${brand.teal} 100%);padding:28px 24px;">
              <img src="${LOGO_URL}" alt="${EMAIL_BRANDING.brand_name}" width="180" height="36" style="display:block;border:0;outline:none;text-decoration:none;height:36px;width:180px;max-width:180px;" />
            </td>
          </tr>

          <!-- hero: eyebrow pill + título -->
          <tr>
            <td class="mm-pad-x" style="padding:36px 40px 8px 40px;">
              ${opts.eyebrow ? `
              <div style="margin:0 0 14px;">
                <span style="display:inline-block;background:${accent.bg};color:${accent.fg};font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;padding:6px 12px;border-radius:999px;">
                  ${escapeHtml(opts.eyebrow)}
                </span>
              </div>` : ""}
              <h1 class="mm-title mm-text" style="margin:0;font-size:28px;line-height:36px;font-weight:700;color:${brand.ink};letter-spacing:-0.01em;">
                ${escapeHtml(opts.title)}
              </h1>
              ${opts.subtitle ? `<p class="mm-muted" style="margin:10px 0 0;font-size:15px;line-height:22px;color:${brand.muted};">${escapeHtml(opts.subtitle)}</p>` : ""}
            </td>
          </tr>

          <!-- body -->
          <tr>
            <td class="mm-pad-x mm-text" style="padding:24px 40px 8px 40px;color:${brand.ink};font-size:15px;line-height:24px;">
              ${opts.greeting ? `<p style="margin:0 0 14px;font-size:16px;color:${brand.ink};"><strong>${escapeHtml(opts.greeting)}</strong></p>` : ""}
              ${opts.bodyHtml}
            </td>
          </tr>

          ${opts.ctaText && opts.ctaUrl ? `
          <!-- CTA bulletproof button -->
          <tr>
            <td align="center" style="padding:24px 40px 8px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="${brand.navy}" style="background:${brand.navy};background-image:linear-gradient(135deg,${brand.navy} 0%,${brand.teal} 100%);border-radius:10px;">
                    <a href="${opts.ctaUrl}" target="_blank" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:0.2px;">
                      ${escapeHtml(opts.ctaText)}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ""}

          ${opts.secondaryNote ? `
          <tr>
            <td class="mm-pad-x mm-muted" style="padding:16px 40px 0 40px;font-size:12px;line-height:18px;color:${brand.muted};text-align:center;">
              ${opts.secondaryNote}
            </td>
          </tr>` : ""}

          <!-- spacing -->
          <tr><td style="padding:24px 40px 0 40px;"><div class="mm-divider" style="border-top:1px solid ${brand.border};height:1px;line-height:1px;font-size:1px;">&nbsp;</div></td></tr>

          <!-- in-card footer (mini links) -->
          <tr>
            <td class="mm-pad-x mm-muted" style="padding:16px 40px 28px 40px;font-size:12px;line-height:18px;color:${brand.muted};text-align:center;">
              ¿Necesitas ayuda? <a href="${EMAIL_BRANDING.support_url}" style="color:${EMAIL_BRANDING.primary_color};text-decoration:none;">${EMAIL_BRANDING.support_label}</a>
              &nbsp;·&nbsp;
              <a href="${appUrl}/help" style="color:${brand.teal};text-decoration:none;">Centro de ayuda</a>
            </td>
          </tr>
        </table>

        ${showFooter ? `
        <!-- outer footer -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="mm-container" style="width:600px;max-width:600px;margin-top:16px;">
          <tr>
            <td align="center" class="mm-footer mm-muted" style="padding:12px 24px;color:${brand.muted};font-size:11px;line-height:18px;">
              © ${new Date().getFullYear()} ${EMAIL_BRANDING.brand_name} · ${EMAIL_BRANDING.tagline}<br/>
              <a href="${appUrl}/privacy" style="color:${brand.muted};text-decoration:underline;">Privacidad</a>
              &nbsp;·&nbsp;
              <a href="${appUrl}/terms" style="color:${brand.muted};text-decoration:underline;">Términos</a>
              &nbsp;·&nbsp;
              <a href="${appUrl}/arco-rights" style="color:${brand.muted};text-decoration:underline;">Derechos ARCO</a>
            </td>
          </tr>
        </table>` : ""}

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Bloque resaltado para usar dentro de bodyHtml ("info card").
// Lleva la clase mm-keep-light para que el override de dark-mode no aclare
// el texto dentro del card (el card YA tiene fondo claro de color).
export function infoCard(opts: { title?: string; html: string; accent?: EmailAccent }): string {
  const a = ACCENTS[opts.accent ?? "neutral"];
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="mm-keep-light" style="margin:8px 0 16px;background:${a.bg};border-radius:10px;">
      <tr>
        <td style="padding:16px 18px;color:${a.fg};font-size:14px;line-height:22px;">
          ${opts.title ? `<div style="font-weight:700;margin-bottom:6px;font-size:13px;letter-spacing:.3px;text-transform:uppercase;color:${a.fg};">${escapeHtml(opts.title)}</div>` : ""}
          <div style="color:${a.fg};">${opts.html}</div>
        </td>
      </tr>
    </table>`;
}

// Tabla de key/value (Recibo, comprobante, detalle de compra).
// mm-keep-light: el card tiene borde + fondo blanco/gris; el texto debe
// quedarse oscuro siempre.
export function detailTable(rows: Array<[string, string]>): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="mm-keep-light" style="margin:8px 0 16px;border:1px solid ${brand.border};border-radius:10px;background:#ffffff;">
      ${rows.map(([k, v], i) => `
        <tr>
          <td style="padding:12px 16px;font-size:13px;color:${brand.muted};${i > 0 ? `border-top:1px solid ${brand.border};` : ""}">${escapeHtml(k)}</td>
          <td style="padding:12px 16px;font-size:14px;color:${brand.ink};font-weight:600;text-align:right;${i > 0 ? `border-top:1px solid ${brand.border};` : ""}">${v}</td>
        </tr>`).join("")}
    </table>`;
}

// Monto destacado (recibo de pago). Fondo gradient navy → teal, texto blanco
// fijo en ambos modos (mm-keep-light evita que el override lo cambie).
export function bigAmount(amount: string, currency: string = "MXN"): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="mm-keep-light" style="margin:16px 0;background:linear-gradient(135deg,${brand.navy} 0%,${brand.teal} 100%);border-radius:12px;">
      <tr>
        <td align="center" style="padding:22px 16px;">
          <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.78);font-weight:600;">Monto</div>
          <div style="margin-top:4px;font-size:34px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">${escapeHtml(amount)} <span style="font-size:18px;font-weight:500;opacity:.8;">${escapeHtml(currency)}</span></div>
        </td>
      </tr>
    </table>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
