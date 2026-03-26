# Plan: Fix "Subir" visibility, News in /lives toggle, y balance médico

## Análisis

1. **"Subir" en la nav** — Línea 91 de MainLayout: `{ labelKey: 'nav.upload', href: '/doctor/upload', icon: Upload, roles: ['doctor'] }`. Si `show_content_medical` está OFF (Contenido Premium oculto), "Subir" sigue visible. Tienes razón: si el contenido está oculto, subir contenido no tiene sentido. Debe vincularse al mismo toggle.
2. **Noticias en /lives** — Línea 345 de LivesGrid: `<NewsFeed />` se renderiza siempre al fondo de la página de Lives. No consulta el toggle `show_news_section`. Debe condicionarse.
3. **Balance médico del usuario** — El wallet/balance existe en `Wallet.tsx` pero el cliente pidió quitar historial de transacciones (toggle `show_transaction_history`). Para el **balance visible del usuario**, está en el header de MainLayout como `AnimatedBalance`. No hay una vista dedicada de "balance médico" para residentes (cuánto gastaron/vendieron). Esto es parte de la **Fase 6 pendiente**.

## Cambios concretos

### 1. `src/components/layout/MainLayout.tsx`

- Línea 91: Añadir `toggleKey: 'show_content_medical'` al item de Upload, para que se oculte junto con Contenido Premium

### 2. `src/pages/LivesGrid.tsx`

- Importar `useSiteToggles`
- Condicionar `<NewsFeed />` (línea 345) con `toggles.show_news_section`

### 3. `src/components/doctor/DoctorQuickActions.tsx`

- El action "Subir Contenido" también debería respetar el toggle. Importar `useSiteToggles` y ocultar/deshabilitar ese action cuando `show_content_medical` está OFF.

### 4. No se necesitan cambios de DB ni migraciones.

## Sobre el "balance médico"

El balance (wallet) ya existe para todos los roles en el header y en `/wallet`. Lo que **no existe aún** es la vista para residentes de "cuánto gastaron y cuánto vendieron" (desglose). Eso requiere la Fase 6 (Funciones de Residentes) que está pendiente — no es un bug sino un feature no implementado.

Donde veo lo de la situación medica del cliente, eso que te pedí que el cliente ponga toda su información para que salga un resultado, donde lo veo? te pedí eso

&nbsp;