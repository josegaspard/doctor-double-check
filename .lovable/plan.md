

# Plan: Sistema Completo de Reembolsos con Stripe, Cuenta Bancaria y Herramientas Contables

## Resumen

Actualmente el sistema solo acredita reembolsos a la billetera interna del usuario. Este plan implementa un flujo completo donde:
- Si el usuario pago con Stripe, el reembolso va directo a su tarjeta/cuenta de Stripe
- Si no tiene Stripe, se le notifica por email que el reembolso tarda 15 dias y debe registrar su cuenta bancaria (CLABE)
- El admin tiene visibilidad total del tipo de reembolso (Stripe vs Bancario) con exportacion profesional
- El usuario puede registrar su cuenta bancaria desde su perfil/wallet

---

## Cambios en Base de Datos (2 migraciones)

### Migracion 1: Tabla `user_bank_accounts` para que los usuarios registren su cuenta bancaria

```sql
CREATE TABLE public.user_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  bank_name TEXT NOT NULL,
  clabe VARCHAR(18) NOT NULL,
  clabe_last4 VARCHAR(4) NOT NULL,
  account_holder_name TEXT NOT NULL,
  rfc VARCHAR(13),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bank account"
  ON public.user_bank_accounts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all bank accounts"
  ON public.user_bank_accounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

### Migracion 2: Expandir `refund_requests` con campos de metodo y seguimiento

```sql
ALTER TABLE public.refund_requests
  ADD COLUMN refund_method TEXT DEFAULT 'wallet',
  ADD COLUMN stripe_refund_id TEXT,
  ADD COLUMN bank_transfer_reference TEXT,
  ADD COLUMN bank_transfer_date TIMESTAMPTZ,
  ADD COLUMN estimated_completion_date TIMESTAMPTZ,
  ADD COLUMN user_has_stripe BOOLEAN DEFAULT false,
  ADD COLUMN user_has_bank_account BOOLEAN DEFAULT false;
```

---

## Edge Function: `admin-refund` (Actualizar)

### Logica nueva:

1. Recibir parametro `refund_method` del admin: `'stripe'`, `'bank_transfer'`, o `'wallet'`
2. Si `refund_method === 'stripe'`:
   - Buscar el `stripe_payment_intent_id` en los metadata de la transaccion original
   - Ejecutar `stripe.refunds.create()` como ya existe
   - Registrar `stripe_refund_id` en `refund_requests`
3. Si `refund_method === 'bank_transfer'`:
   - Verificar que el usuario tenga cuenta bancaria registrada en `user_bank_accounts`
   - Marcar status como `pending_transfer` (el admin hara la transferencia manualmente)
   - Registrar `estimated_completion_date` = now() + 15 dias
   - Enviar email automatico al usuario informando el proceso de 15 dias
4. Si `refund_method === 'wallet'` (fallback actual):
   - Comportamiento actual: acreditar a billetera

---

## Edge Function: `send-refund-email` (Nueva)

Envia correo al usuario con:
- Monto del reembolso
- Metodo: Stripe (inmediato) o Transferencia bancaria (15 dias habiles)
- Si es bancario: instrucciones para verificar su cuenta bancaria
- Si es Stripe: confirmacion de que se proceso
- Branding de Medical Masters

Usa Resend con `onboarding@resend.dev` como remitente (patron existente en el proyecto).

---

## Frontend: Pagina de Cuenta Bancaria del Usuario

### Nuevo componente: `src/components/wallet/UserBankAccountForm.tsx`

- Formulario con: Banco (select de bancos mexicanos), CLABE (18 digitos), Titular, RFC (opcional)
- Validacion de CLABE (18 digitos numericos)
- Se muestra dentro de la pagina de Wallet como una seccion colapsable o en Settings
- Banner informativo: "Registra tu cuenta bancaria para recibir reembolsos directos"

---

## Frontend: `AdminRefunds.tsx` (Refactorizar completamente)

### Nuevas pestanas (5 tabs):

1. **Solicitudes** - Pendientes del usuario (como esta)
2. **Reembolsos Stripe** - Filtro: solo refunds procesados via Stripe
3. **Reembolsos Bancarios** - Filtro: solo refunds via transferencia bancaria con estados:
   - `pending_transfer` (amarillo - admin debe transferir)
   - `transferred` (azul - admin confirmo transferencia)
   - `completed` (verde - verificado)
4. **Manuales** - Reembolsos directos a wallet (como esta)
5. **Historial Completo** - Todo consolidado con filtros avanzados

### Dialog de Aprobacion mejorado:

Cuando el admin aprueba una solicitud:

1. El sistema detecta automaticamente si el usuario pago con Stripe (revisa metadata de transaccion original)
2. Si tiene Stripe payment intent: opcion "Reembolsar a Stripe" (inmediato)
3. Si no tiene Stripe:
   - Verifica si el usuario tiene cuenta bancaria registrada
   - Si tiene: opcion "Reembolso bancario" con datos CLABE visibles
   - Si no tiene: al aprobar, envia email automatico pidiendo registrar cuenta bancaria
4. Siempre disponible: "Acreditar a billetera" como opcion rapida

### Para reembolsos bancarios - flujo del admin:

- Card especial con datos bancarios del usuario (CLABE, Banco, Titular)
- Boton "Marcar como transferido" con campo para referencia de transferencia
- Boton "Marcar como completado"
- Timeline visual del estado del reembolso

### Exportacion profesional para contabilidad:

**Boton "Exportar Excel":**
- CSV con columnas: Fecha, Usuario, Email, Monto, Metodo (Stripe/Bancario/Wallet), Referencia Stripe/Bancaria, Estado, Admin que aprobo, Notas
- Filtrable por periodo y tipo de reembolso
- Nombre de archivo con fecha: `Reembolsos_2026-03-03.csv`

**Boton "Exportar PDF Contable":**
- Resumen ejecutivo con totales por metodo
- Tabla detallada con todos los campos
- Seccion de reembolsos bancarios pendientes separada
- Usa patron de iframe oculto (ya implementado en analytics e invoices)

**Boton "Exportar Seleccion":**
- Checkboxes en cada fila
- Exporta solo los seleccionados en CSV o PDF
- Barra flotante con conteo de seleccionados (patron glassmorphism existente)

### Optimizacion movil:

- Cards apiladas en lugar de tabla
- Swipe-friendly con informacion condensada
- Barra flotante de acciones masivas `fixed bottom-20` con `backdrop-blur-lg` (patron estandar del proyecto)
- Badges de color para estado de reembolso visibles a primer vistazo
- Resumen de KPIs en grid 2x2 en movil

---

## Frontend: `TransactionHistory.tsx` (Actualizar)

- En el dialog de solicitar reembolso, agregar nota informativa:
  - "Si pagaste con tarjeta, el reembolso se procesara directamente a tu tarjeta"
  - "Si no, se te pedira registrar tu cuenta bancaria y el proceso tarda hasta 15 dias habiles"
- Mostrar estado del reembolso con timeline visual (solicitado -> aprobado -> procesado)
- Badge nuevo: "Reembolso a Stripe" (verde), "Reembolso bancario en proceso" (amarillo), "Reembolso a billetera" (azul)

---

## Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| `user_bank_accounts` table | Crear (migracion) |
| `refund_requests` columns | Alterar (migracion) |
| `supabase/functions/admin-refund/index.ts` | Modificar - agregar logica de metodo |
| `supabase/functions/send-refund-email/index.ts` | Crear - emails de reembolso |
| `src/components/wallet/UserBankAccountForm.tsx` | Crear - formulario cuenta bancaria |
| `src/pages/Wallet.tsx` | Modificar - agregar seccion cuenta bancaria |
| `src/pages/AdminRefunds.tsx` | Refactorizar - 5 tabs, exportacion, movil |
| `src/components/wallet/TransactionHistory.tsx` | Modificar - estados de reembolso |

---

## Flujo completo resumido

```text
USUARIO solicita reembolso
  |
ADMIN revisa solicitud
  |
  +-- Pago con Stripe? --> Reembolso directo a tarjeta (inmediato)
  |                        + Email de confirmacion
  |
  +-- Sin Stripe, tiene cuenta bancaria? --> Reembolso por transferencia (15 dias)
  |                                          + Email con plazo estimado
  |                                          + Admin transfiere manualmente
  |                                          + Admin marca como "transferido"
  |
  +-- Sin Stripe, sin cuenta bancaria? --> Email pidiendo registrar cuenta
  |                                        + Estado: "esperando_datos_bancarios"
  |                                        + Usuario registra cuenta
  |                                        + Admin notificado para proceder
  |
  +-- Opcion rapida --> Acreditar a billetera interna
```

