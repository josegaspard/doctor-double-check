
# Plan: Cambiar "Mi Wallet" a "Saldo" para doctores en menu movil

## Problema
En el menu "Mas" de la navegacion movil, los doctores ven "Mi Wallet" con el saldo de su billetera de consumo (`wallets.balance`). Lo correcto es mostrar **"Saldo"** con el monto de ganancias pendientes (`doctor_profiles.pending_earnings`) y que al hacer clic los lleve a `/doctor/earnings` en vez de `/wallet`.

## Cambios

### 1. `src/components/layout/MainLayout.tsx` (lineas 598-609)
- Cuando `role === 'doctor'`:
  - Cambiar el texto de "Mi Wallet" a "Saldo"
  - Cambiar la ruta de `/wallet` a `/doctor/earnings`
  - Mostrar el monto de `pending_earnings` del doctor en vez del `balance` del wallet
  - Usar icono `DollarSign` o `TrendingUp` en vez de `Wallet` para diferenciar visualmente
- Para `patient` y `resident` mantener el comportamiento actual ("Mi Wallet", `/wallet`, saldo del wallet)

### 2. Obtener `pending_earnings` del doctor
- En el componente `MainLayout`, agregar un query ligero a `doctor_profiles` para obtener `pending_earnings` cuando el rol es `doctor`
- Usar `useState` + `useEffect` con el `user.id` como dependencia
- Formatear el monto como moneda MXN (`$X,XXX`)

### 3. Traducciones (`src/lib/i18n/es.ts` y `en.ts`)
- Agregar clave `nav.earnings` con valor "Saldo" (es) / "Balance" (en) para doctores

## Resultado
- Doctores ven "Saldo $X,XXX" en el menu movil que refleja sus ganancias pendientes
- Al hacer clic van directo a la pagina de Ganancias (`/doctor/earnings`)
- Pacientes y residentes siguen viendo "Mi Wallet" con su saldo de consumo
