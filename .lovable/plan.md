

# Auditoría Final — Gaps Restantes

## Estado: ~98% completo. Un gap de terminología pendiente.

### Verificación de navegación y lógica ✅
- **Resident tiene Chat en nav** (línea 85): ✅ `roles: ['patient', 'doctor', 'resident']`
- **Resident tiene Medical Record en nav** (línea 88): ✅ `roles: ['patient', 'resident']`
- **Resident bottom tabs incluyen Chat** (línea 143): ✅
- **Resident-Doctor connection flow en DoctorProfile**: ✅ Implementado
- **Type safety (as any removido)**: ✅
- **Toda la lógica funcional (pagos, lives, chat, wallet, etc.)**: ✅

---

## Gap Único: Terminología incompleta "Consulta" → "Orientación médica"

Se hizo un reemplazo parcial en sesiones anteriores, pero quedan **~20 instancias** sin cambiar en ambos archivos i18n:

### `src/lib/i18n/es.ts` — Instancias pendientes:
| Línea | Actual | Corrección |
|-------|--------|------------|
| 1150 | `'Consultar Ahora'` | `'Orientación Ahora'` |
| 1165 | `'...para consulta'` | `'...para orientación médica'` |
| 1166 | `'...iniciar tu consulta de inmediato'` | `'...iniciar tu orientación de inmediato'` |
| 1169 | `'Consultar Ahora'` | `'Orientación Ahora'` |
| 1483 | `'...una consulta privada...'` | `'...una orientación privada...'` |
| 1487 | `'...tu consulta o pregunta...'` | `'...tu orientación o pregunta...'` |
| 1562 | `'...tienes consultas o chats...'` | `'...tienes orientaciones o chats...'` |
| 1573 | `'Consulta'` | `'Orientación'` |
| 1600 | `'consultas'` | `'orientaciones'` |
| 1602 | `'Consulta:'` | `'Orientación:'` |
| 1603 | `'Consulta gratuita'` | `'Orientación gratuita'` |
| 1671 | `'Resumen Post-Consulta'` | `'Resumen Post-Orientación'` |
| 1673 | `'Resumen de la consulta'` | `'Resumen de la orientación'` |

### `src/lib/i18n/en.ts` — Instancias pendientes:
| Línea | Actual | Corrección |
|-------|--------|------------|
| 1165 | `'...for consultation'` | `'...for guidance'` |
| 1166 | `'...your consultation immediately'` | `'...your guidance session immediately'` |
| 1482 | `'Book Consultation'` | `'Book Guidance'` |
| 1483 | `'...private consultation...'` | `'...private guidance session...'` |
| 1485 | `'...consultation limit...'` | `'...guidance limit...'` |
| 1495 | `'Consultation booked!'` | `'Guidance booked!'` |
| 1562 | `'...have consultations or...'` | `'...have guidance sessions or...'` |
| 1565 | `'...medical consultation...'` | `'...medical guidance session...'` |
| 1573 | `'Consultation'` | `'Guidance'` |
| 1600 | `'consultations'` | `'guidance sessions'` |
| 1602 | `'Consultation:'` | `'Guidance:'` |
| 1603 | `'Free consultation'` | `'Free guidance'` |
| 1671 | `'Post-Consultation Summary'` | `'Post-Guidance Summary'` |
| 1673 | `'Consultation summary'` | `'Guidance summary'` |

---

## Plan de implementación

### Archivo 1: `src/lib/i18n/es.ts`
- Reemplazar las ~13 instancias restantes de "consulta" → "orientación" en textos orientados al usuario

### Archivo 2: `src/lib/i18n/en.ts`  
- Reemplazar las ~14 instancias restantes de "consultation" → "guidance" en textos orientados al usuario

**No se requieren cambios de lógica, DB, ni otros archivos.** Solo terminología i18n.

