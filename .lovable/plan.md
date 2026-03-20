

# Plan: Reorganizar y mejorar UX/UI del Panel de Médico + reducir tamaños en mobile

## Problemas actuales
- En mobile, la pestaña "General" muestra todo apilado sin agrupación lógica: perfil, stats, pacientes, acciones rápidas, finanzas, emails, configuración, historial, fondos retenidos, vault — demasiadas secciones sueltas, abrumador
- Los títulos/números como "$126,749" usan `text-2xl` en mobile — demasiado grandes para pantallas de 390px
- La pestaña "Analytics" también tiene `text-2xl font-bold` en las stats cards y el header "Analytics Dashboard" se rompe en mobile (como muestra el screenshot)
- No hay agrupación visual clara entre secciones relacionadas

## Cambios

### 1. `src/pages/DoctorDashboard.tsx` — Reorganizar Overview en secciones agrupadas
- Agrupar el contenido en bloques lógicos con headers de sección claros:
  - **Mi Práctica**: ProfileCard + StatsGrid (juntos, son sobre "quién soy y mis números")
  - **Acciones Rápidas**: QuickActions (ya separado)
  - **Pacientes**: PatientsList (ya separado)
  - **Finanzas**: EarningsCard + FundHoldsCard (agrupados bajo un header "Finanzas")
  - **Comunicaciones**: EmailStatsCard + EmailHistoryCard (agrupados bajo un header "Comunicaciones")
  - **Configuración**: collapsible como está (ya funciona bien)
  - **Vault**: como está (condicional)
- Cada grupo tendrá un pequeño header de sección (`text-xs uppercase tracking-wide text-muted-foreground`) para que el usuario sepa dónde está

### 2. `src/components/doctor/DoctorAnalytics.tsx` — Fix mobile layout + reducir tamaños
- Header "Analytics Dashboard": cambiar de `text-xl` a `text-base sm:text-xl`, y poner el period selector debajo del título en mobile (stack vertical) en vez de `justify-between` que causa el quiebre
- Stats grid: reducir `text-2xl` → `text-lg sm:text-2xl` en los valores numéricos
- Cards de stats: reducir padding `p-4` → `p-3 sm:p-4`
- Icon containers: reducir `w-10 h-10` → `w-8 h-8 sm:w-10 sm:h-10`
- Charts: mantener como están (ya funcionan con ResponsiveContainer)
- Bottom stats (rating dist + content + consultas): en mobile `grid-cols-1` en vez de intentar meter 3 columnas

### 3. `src/components/doctor/DoctorStatsGrid.tsx` — Reducir tamaños mobile
- Valores: `text-xl sm:text-2xl` → `text-lg sm:text-2xl`
- Padding: ya está bien con `p-3 sm:p-4`

### 4. `src/components/doctor/EarningsCard.tsx` — Reducir tamaños mobile
- Valores de dinero: `text-lg sm:text-xl` → `text-base sm:text-xl`

### 5. `src/components/doctor/EmailStatsCard.tsx` — Reducir tamaños mobile
- Valores `text-2xl` → `text-lg sm:text-2xl`
- Valores `text-xl` → `text-base sm:text-xl`

### 6. `src/components/doctor/FundHoldsCard.tsx` — Reducir tamaños mobile (minor)
- Ya está bastante compacto, solo ajustar si hay `text-2xl` sueltos

## Archivos a modificar
1. `src/pages/DoctorDashboard.tsx` — reagrupar secciones con headers
2. `src/components/doctor/DoctorAnalytics.tsx` — fix mobile layout + reducir tamaños
3. `src/components/doctor/DoctorStatsGrid.tsx` — reducir font mobile
4. `src/components/doctor/EarningsCard.tsx` — reducir font mobile
5. `src/components/doctor/EmailStatsCard.tsx` — reducir font mobile

## Resultado
- El dashboard se sentirá organizado por categorías claras en vez de una lista interminable
- Los números no serán gigantes en celular
- Analytics no se romperá en mobile
- No se quita nada, solo se ordena y reduce proporcionalmente

