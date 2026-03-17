

# Plan: Optimizar perfil móvil + corregir "Gastado" en Mis Campañas

## 1. Perfil de usuario - optimizar sección de contacto en móvil

**Archivo:** `src/pages/UserProfile.tsx`

**Problema:** En móvil, la fila de email con badge "Verificado" y botón de edición se ve apretada y desborda. Lo mismo con la fila de teléfono.

**Cambios:**
- Líneas 691-698 (email display): Cambiar de layout horizontal a vertical en móvil. Email en una línea, badge + botón en la siguiente. Usar `flex-wrap` y en móvil apilar con `flex-col` para que el badge "Verificado" no quede encimado con el email largo.
- Líneas 782-805 (phone display): Mismo tratamiento responsive. Botón "Agregar teléfono" con ancho completo en móvil.
- Reducir el badge "Verificado" para que use `shrink-0` y no se deforme.

## 2. "Gastado" total muestra $0 - lógica incorrecta

**Archivo:** `src/pages/AdvertiserDashboard.tsx`

**Problema:** Línea 249 calcula `totalSpent` sumando `c.spent` del DB, que es 0 porque nunca se actualiza. Pero en las tarjetas individuales (línea 636) sí se calcula correctamente con `(impressions/1000 * CPM) + (clicks * CPC)`.

**Solución:** Reemplazar línea 249 para calcular el total gastado igual que en las tarjetas individuales:

```typescript
// Antes (mal):
const totalSpent = campaigns.reduce((sum, c) => sum + Number(c.spent), 0);

// Después (correcto):
const totalSpent = campaigns.reduce((sum, c) => {
  const s = campaignStats[c.id] || { impressions: 0, clicks: 0 };
  return sum + (s.impressions / 1000 * config.cpm_rate) + (s.clicks * config.cpc_rate);
}, 0);
```

Esto hará que el summary card "Gastado" en la vista principal muestre el monto real (ej: $6) en vez de $0.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/UserProfile.tsx` | Layout responsive para email/phone en móvil |
| `src/pages/AdvertiserDashboard.tsx` | Calcular totalSpent desde eventos, no desde DB |

