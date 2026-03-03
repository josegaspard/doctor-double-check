
# Plan: Corregir remitente en funciones de email restantes

## Problema
Dos funciones de email aún usan el remitente antiguo `Dr Double Check <onboarding@resend.dev>` en lugar de `Medical Masters <no-reply@cirugiaesteticauribe.com>`. Las demás 9 funciones ya están correctas.

## Cambios

| Archivo | Línea | Antes | Después |
|---------|-------|-------|---------|
| `supabase/functions/send-payout-email/index.ts` | 69 | `"Dr Double Check <onboarding@resend.dev>"` | `"Medical Masters <no-reply@cirugiaesteticauribe.com>"` |
| `supabase/functions/send-purchase-email/index.ts` | 33 | `"Dr Double Check <onboarding@resend.dev>"` | `"Medical Masters <no-reply@cirugiaesteticauribe.com>"` |

Solo son dos líneas de cambio. El resto de las funciones ya están correctas.
