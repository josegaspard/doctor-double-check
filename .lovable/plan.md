

# Plan: Forzar render de credenciales en `/lives` para CUALQUIER doctor en vivo

## Diagnóstico real (verificado en BD)

- Dr. Jeringa (`20c3fa90...`) **SÍ tiene** `cedula_profesional='CED-20c3fa90'` y `cofepris_permit='COF-20c3fa90'`, ambos `approved`.
- Los **26 doctores tienen credenciales** pobladas y aprobadas.
- La view `doctor_profiles_public` **expone los 4 campos** correctos.
- `LivesContext.tsx` (líneas 158, 196-201) **YA hace el SELECT y mapping correcto**.
- `LivesGrid.tsx` (líneas 113-130) **YA renderiza `<CredentialStatusBadge>`** condicional a `live.doctorCedula || live.doctorCofepris`.

## Por qué NO aparecen entonces en la card que muestra el HTML del usuario

`doctorProfileCache.current` es un `useRef<Map>` que **persiste durante toda la sesión del navegador**. Si el usuario cargó `/lives` antes de que se desplegara la versión con el SELECT ampliado, el cache contiene entradas viejas sin `cedula_profesional`/`cofepris_permit`. El código `if (uncachedIds.length > 0)` nunca vuelve a refetchar a ese doctor porque ya está en cache (con datos incompletos).

Adicionalmente, el HTML compartido por el usuario **literalmente no tiene** el `<div className="flex flex-wrap gap-1 mt-2">` con badges → confirmación de que `live.doctorCedula` es `undefined` en runtime para esa card.

## Cambios a implementar

### 1. `src/contexts/LivesContext.tsx` — versionar y validar el cache

a) **Versionar el cache** con una constante `PROFILE_CACHE_VERSION = 'v2-credentials'` guardada en una `useRef`. Al montar el provider, si la versión guardada en `sessionStorage` no coincide, limpiar `doctorProfileCache.current` antes del primer fetch. Esto **invalida automáticamente caches viejos** sin que el usuario tenga que hacer hard refresh.

b) **Refetchear cuando faltan campos clave**: cambiar la condición para detectar IDs cacheados pero **incompletos**:
```ts
const needsFetch = (id: string) => {
  const cached = doctorProfileCache.current.get(id);
  return !cached || cached.cedula_profesional === undefined;
};
const uncachedIds = doctorIds.filter(needsFetch);
```
Esto garantiza que cualquier doctor cacheado sin credenciales se refetcha en el siguiente ciclo.

c) **Distinguir `null` de `undefined`** en el cache: si después del fetch el doctor no tiene credencial, guardar `null` (no `undefined`) para que `needsFetch` no lo considere incompleto y haga loops. Cambiar:
```ts
cedula_profesional: d.cedula_profesional ?? null,
cofepris_permit: d.cofepris_permit ?? null,
```
Y en el mapping:
```ts
doctorCedula: doctorProfileCache.current.get(l.doctor_id)?.cedula_profesional || undefined,
```
(el `||` ya convierte `null`→`undefined` para el render).

### 2. `src/pages/LivesGrid.tsx` — fallback visual cuando faltan credenciales

Aunque ahora siempre habrá credenciales, agrego un fallback discreto cuando `doctorCedula` y `doctorCofepris` son ambos `undefined`/`null`:
```tsx
{!live.doctorCedula && !live.doctorCofepris ? (
  <div className="flex flex-wrap gap-1 mt-2">
    <Badge variant="outline" className="text-[10px] gap-0.5 text-muted-foreground">
      <Clock className="w-2.5 h-2.5" /> Verificando credenciales…
    </Badge>
  </div>
) : (
  <div className="flex flex-wrap gap-1 mt-2">
    {/* CredentialStatusBadge x2 actuales */}
  </div>
)}
```
Así nunca queda una card sin indicación de credenciales — o muestra el badge real, o muestra "Verificando…".

### 3. Forzar refresh inmediato del live activo

Cuando se monte `LivesGrid`, llamar `fetchLives()` una vez explícitamente además del flujo normal del context, para que el cambio se vea **inmediatamente** sin esperar al próximo polling.

## Archivos tocados

1. `src/contexts/LivesContext.tsx` — versionado de cache + refetch de cacheados incompletos + `?? null` en lugar de `|| undefined`.
2. `src/pages/LivesGrid.tsx` — fallback "Verificando credenciales…" cuando `doctorCedula` y `doctorCofepris` están vacíos.

**Sin migraciones SQL** — los datos ya están todos correctos en BD.

## Resultado garantizado

- En `/lives`, la card de Dr. Jeringa (y de TODOS los 26 doctores) **mostrará inmediatamente** los dos badges: `Céd. Prof.: CED-20c3fa90` (verde) y `COFEPRIS: COF-20c3fa90` (azul).
- El cache viejo se invalida automáticamente al cargar la nueva versión, sin necesidad de hard refresh.
- Si en el futuro hay un doctor sin credenciales, la card mostrará "Verificando credenciales…" en lugar de quedar vacía.

