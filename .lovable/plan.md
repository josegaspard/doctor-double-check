

# Plan: Refinamientos finales de credenciales en `/lives`

## 1. `LivesContext.tsx` — loading state + detección de error real

**Agregar estado `credentialsRetrying: boolean`** al context para exponer cuándo se está recargando credenciales tras un retry.

**Refactorizar `retryCredentials`** para envolver el fetch en `setCredentialsRetrying(true/false)`:
```ts
const retryCredentials = useCallback(async () => {
  setCredentialsRetrying(true);
  try {
    doctorProfileCache.current.clear();
    setCredentialsLoadError(false);
    await fetchLives(true);
  } finally {
    setCredentialsRetrying(false);
  }
}, [fetchLives]);
```

**Mejorar detección error real vs vacío** en `fetchLives`:
- Distinguir explícitamente: solo marcar `credentialsLoadError=true` si `error` está presente Y no es null/undefined.
- Resultado vacío (`data: []`) NO es error — limpiar flag.
- Cambiar bloque (líneas 203-209) a:
```ts
if (uncachedIds.length > 0) {
  const credErr = (doctorProfilesResult as any).error;
  if (credErr && credErr.message) {
    console.error('Error fetching doctor credentials:', credErr);
    setCredentialsLoadError(true);
  } else {
    // Either success with data, or success with empty array — both are valid
    setCredentialsLoadError(false);
  }
}
```

Exponer `credentialsRetrying` en `LivesContextType` y en el `value` del provider.

## 2. `LivesGrid.tsx` — banner con loading skeleton + botón con spinner

Reemplazar el banner actual (líneas 332-342) por uno que respete el estado `credentialsRetrying`:

```tsx
{(credentialsLoadError || credentialsRetrying) && filteredLives.length > 0 && (
  <div className="mb-3 p-2 rounded-md bg-destructive/10 border border-destructive/30 flex items-center justify-between gap-2">
    {credentialsRetrying ? (
      <div className="flex items-center gap-2 flex-1">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
        <div className="flex-1 space-y-1">
          <div className="h-2 bg-muted/60 rounded animate-pulse w-1/2" />
          <div className="h-2 bg-muted/40 rounded animate-pulse w-1/3" />
        </div>
      </div>
    ) : (
      <>
        <span className="text-xs text-destructive flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          No se pudieron cargar todas las credenciales
        </span>
        <Button size="sm" variant="outline" onClick={retryCredentials} disabled={credentialsRetrying} className="h-7 text-xs">
          <RefreshCw className={`w-3 h-3 mr-1 ${credentialsRetrying ? 'animate-spin' : ''}`} />
          {credentialsRetrying ? 'Recargando…' : 'Reintentar'}
        </Button>
      </>
    )}
  </div>
)}
```

Destructurar `credentialsRetrying` del `useLives()` hook.

## 3. Texto inline de motivo de rechazo — robustecer cuando solo uno esté rejected

Sustituir el IIFE actual (líneas 134-150) por un patrón más limpio que NO dependa del join:

```tsx
{(() => {
  const parts: string[] = [];
  if (live.doctorCedulaStatus === 'rejected' && live.doctorCedulaRejectionReason) {
    parts.push(`Cédula: ${live.doctorCedulaRejectionReason}`);
  }
  if (live.doctorCofeprisStatus === 'rejected' && live.doctorCofeprisRejectionReason) {
    parts.push(`COFEPRIS: ${live.doctorCofeprisRejectionReason}`);
  }
  // Fallback genérico cuando hay rejection pero sin razón específica
  if (parts.length === 0 && (live.doctorCedulaStatus === 'rejected' || live.doctorCofeprisStatus === 'rejected')) {
    parts.push('Credencial rechazada (sin motivo registrado)');
  }
  if (parts.length === 0) return null;
  return (
    <p className="text-[10px] text-destructive mt-1 line-clamp-2 flex items-start gap-1">
      <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
      <span>{parts.join(' · ')}</span>
    </p>
  );
})()}
```

Cambios clave:
- Usa array push en lugar de filter+join (más explícito, no falla si ambas razones son `null`).
- Fallback de texto genérico si hay rechazo sin razón (caso edge).
- Funciona correctamente cuando solo una de las dos está rejected.

## 4. `LivesDebugPanel.tsx` — persistir open/hidden en localStorage

Reemplazar `useState` por estado persistido en `localStorage`:

```ts
const STORAGE_KEY_OPEN = 'lives_debug_panel_open';
const STORAGE_KEY_HIDDEN = 'lives_debug_panel_hidden';

const [open, setOpen] = useState<boolean>(() => {
  try { return localStorage.getItem(STORAGE_KEY_OPEN) === 'true'; } catch { return false; }
});
const [hidden, setHidden] = useState<boolean>(() => {
  try { return localStorage.getItem(STORAGE_KEY_HIDDEN) === 'true'; } catch { return false; }
});

useEffect(() => {
  try { localStorage.setItem(STORAGE_KEY_OPEN, String(open)); } catch {}
}, [open]);

useEffect(() => {
  try { localStorage.setItem(STORAGE_KEY_HIDDEN, String(hidden)); } catch {}
}, [hidden]);
```

Agregar también un atajo: si el admin oculta el panel, dejarlo guardado pero exponer en consola un comando rápido `window.__showLivesDebug = () => { localStorage.removeItem('lives_debug_panel_hidden'); location.reload(); }` para reabrirlo sin perder el estado.

## 5. Test nuevo — rejection reason aparece inline sin click

Crear `src/pages/__tests__/LivesGrid.rejection.test.tsx`:

- Setup similar al test existente `LivesGrid.credentials.test.tsx` pero con el doctor configurado:
```ts
cedula_status: 'rejected',
cedula_rejection_reason: 'Documento ilegible, vuelva a subirlo',
cofepris_status: 'approved',
cofepris_rejection_reason: null,
```
- Mockear `doctor_profiles_public` con esos valores.
- Renderizar `<LivesProvider><LivesGrid /></LivesProvider>`.
- Esperar con `waitFor` que aparezca el texto `"Cédula: Documento ilegible, vuelva a subirlo"` directamente en el DOM (sin abrir popover ni hacer click).
- Verificar que NO aparezca el texto del COFEPRIS (porque está aprobada).
- Caso adicional: con ambas rechazadas y solo razón en una, verificar que solo aparezca el texto de la que tiene razón.

## Archivos tocados

1. `src/contexts/LivesContext.tsx` — agregar `credentialsRetrying` al tipo y al state, refactorizar `retryCredentials`, mejorar lógica de detección de error real.
2. `src/pages/LivesGrid.tsx` — banner con skeleton + spinner durante retry, refactorizar el bloque de motivo de rechazo inline a patrón explícito con fallback.
3. `src/components/live/LivesDebugPanel.tsx` — persistir `open` y `hidden` en `localStorage`.
4. `src/pages/__tests__/LivesGrid.rejection.test.tsx` — nuevo test que valida render inline del motivo de rechazo sin click.

## Resultado garantizado

- El motivo de rechazo aparece correctamente inline cuando solo una credencial está rejected (no se oculta por join vacío).
- El botón "Reintentar" muestra spinner y se deshabilita durante recarga; un skeleton minimal aparece en el banner mientras se refrescan credenciales.
- `credentialsLoadError` no se activa con queries exitosas que devuelven array vacío — solo con errores reales del cliente Supabase.
- El admin no pierde el estado del panel de debug entre navegaciones (open/hidden persistidos en `localStorage`).
- Test automatizado verifica que el motivo de rechazo de cédula aparece sin necesidad de interacción.

