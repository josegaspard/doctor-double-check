

# Plan: Cerrar los 4 items pendientes en `/lives` con credenciales

## Estado verificado en código y BD

- ✅ View `doctor_profiles_public` expone los 6 campos de credenciales sin RLS adicional (verificado: `cedula_profesional, cofepris_permit, cedula_status, cedula_rejection_reason, cofepris_status, cofepris_rejection_reason`).
- ✅ `LivesContext.tsx` (líneas 122-140) ya invalida cache viejo via `PROFILE_CACHE_VERSION='v2-credentials'` en `sessionStorage`.
- ✅ `LivesContext.tsx` (líneas 167-172) ya hace refetch selectivo de doctores con credenciales `undefined`.
- ✅ `LivesGrid.tsx` (líneas 157-160) ya fuerza `refreshLives()` al montar.
- ✅ `LivesGrid.tsx` (líneas 130-137) ya muestra fallback "Verificando credenciales…".
- ✅ `LivesContext` ya hace fetch desde `doctor_profiles_public` (no de la tabla privada).

## Lo que falta cerrar (este pase)

### Item 6 — Test que verifica badges en `/lives` con cache previo

Crear `src/pages/__tests__/LivesGrid.credentials.test.tsx`:
- Pre-popular `sessionStorage` con un valor de versión vieja (`v1-old`) para simular cache previo.
- Mockear `supabase.from('lives')` y `supabase.from('doctor_profiles_public')` con un live activo y un doctor con cédula+COFEPRIS aprobadas.
- Mockear `LivePreviewPlayer` para evitar Daily.co en el test.
- Renderizar `<LivesGrid />` envuelto en mocks de contexts (Auth, Language, Lives, Subscriptions, SiteToggles).
- Esperar con `waitFor` que aparezcan textos `"Céd. Prof."` y `"COFEPRIS"` en el DOM.
- Validar que `sessionStorage.getItem('lives_profile_cache_version') === 'v2-credentials'` después del render (cache invalidado correctamente).

### Item 8 — Motivo de rechazo discreto inline (no solo en popover)

Hoy el motivo de rechazo solo aparece al hacer click en el badge (popover). Mejora: cuando una credencial está `rejected`, mostrar debajo de los badges en la card del live un texto rojo discreto:
```tsx
{(live.doctorCedulaStatus === 'rejected' || live.doctorCofeprisStatus === 'rejected') && (
  <p className="text-[10px] text-destructive mt-1 line-clamp-2 flex items-start gap-1">
    <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
    {[
      live.doctorCedulaStatus === 'rejected' && live.doctorCedulaRejectionReason && `Cédula: ${live.doctorCedulaRejectionReason}`,
      live.doctorCofeprisStatus === 'rejected' && live.doctorCofeprisRejectionReason && `COFEPRIS: ${live.doctorCofeprisRejectionReason}`,
    ].filter(Boolean).join(' · ')}
  </p>
)}
```
Solo se muestra si efectivamente hay rechazo + razón. No interfiere con el caso normal (todos aprobados).

### Item 9 — Botón "Reintentar" si falla la carga de credenciales en grid

Agregar en `LivesContext.tsx`:
- Estado `credentialsLoadError: boolean` expuesto en el context.
- Si `doctorProfilesResult` falla o devuelve `error`, marcar `setCredentialsLoadError(true)`.
- Función `retryCredentials()` en context que limpia `doctorProfileCache` y vuelve a llamar `fetchLives(true)`.

En `LivesGrid.tsx`:
- Si `credentialsLoadError && filteredLives.length > 0`, mostrar banner discreto encima del grid:
```tsx
{credentialsLoadError && (
  <div className="mb-3 p-2 rounded-md bg-destructive/10 border border-destructive/30 flex items-center justify-between gap-2">
    <span className="text-xs text-destructive flex items-center gap-1.5">
      <AlertCircle className="w-3.5 h-3.5" />
      No se pudieron cargar todas las credenciales
    </span>
    <Button size="sm" variant="outline" onClick={retryCredentials} className="h-7 text-xs">
      <RefreshCw className="w-3 h-3 mr-1" /> Reintentar
    </Button>
  </div>
)}
```

### Item 10 — Panel de debug solo para admin (cache de doctores en Lives)

Agregar en `LivesContext.tsx`:
- Función `getDebugCacheSnapshot()` que devuelve un array con `{ doctorId, name, cedulaState, cofeprisState }` donde state es `'value'|'null'|'undefined'`. Expuesta en context.

Crear `src/components/live/LivesDebugPanel.tsx`:
- Solo se renderiza si `role === 'admin'`.
- Card colapsable fixed bottom-right con título "🔧 Lives Cache Debug".
- Tabla con columnas: Doctor ID (truncado), Nombre, Cédula state, COFEPRIS state.
- Color-codes: verde si `value`, gris si `null` (fetched empty), rojo si `undefined` (pending refetch).
- Botón "Limpiar cache & refetch" que llama `retryCredentials()`.
- Botón "Cerrar" para ocultar.

Renderizarlo dentro de `LivesGrid.tsx` después del grid principal (queda fuera del flow visual normal por ser `fixed`).

## Archivos tocados

1. `src/contexts/LivesContext.tsx` — agregar `credentialsLoadError`, `retryCredentials`, `getDebugCacheSnapshot` al context y manejar error de fetch de credenciales.
2. `src/pages/LivesGrid.tsx` — banner de error con botón Reintentar, motivo de rechazo inline en card, render condicional de `<LivesDebugPanel />` para admins.
3. `src/components/live/LivesDebugPanel.tsx` — nuevo componente de depuración solo admin.
4. `src/pages/__tests__/LivesGrid.credentials.test.tsx` — nuevo test que valida render de badges con cache previo invalidado.

**Sin migraciones SQL** — todo está en BD y la view ya expone los campos correctamente.

## Resultado garantizado

- En `/lives`, cuando un doctor tenga credencial **rechazada con motivo**, aparece un texto rojo pequeño debajo del badge con la razón visible (sin necesidad de abrir popover).
- Si la carga de credenciales falla (network error en query a `doctor_profiles_public`), aparece un banner con botón "Reintentar" que limpia cache y refetchea.
- Los administradores ven un panel flotante con el estado del cache de cada doctor en lives, útil para debugging en producción.
- Test automatizado garantiza que los badges aparecen incluso con cache viejo en `sessionStorage`, sin necesidad de hard refresh.

