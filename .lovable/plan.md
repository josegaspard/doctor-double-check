
# Plan: Optimizacion de Rendimiento y Velocidad de Carga

## Problemas Identificados

### 1. Doble carga de perfil en login
Cuando un usuario inicia sesion, `useAuthActions.login()` llama a `fetchUserProfile()`, y luego `onAuthStateChange` dispara el evento `SIGNED_IN` que ejecuta `validateAuthSession()` (otra llamada de red) + `fetchUserProfile()` de nuevo. Resultado: **2 cargas de perfil + 1 validacion innecesaria** en cada login.

### 2. Carga secuencial de perfil de doctor
En `fetchUserProfile`, las 4 consultas iniciales (profiles, user_roles, wallets, entitlements) se ejecutan en paralelo, pero despues la consulta de `doctor_profiles` o `resident_profiles` se ejecuta **secuencialmente**. Esto agrega 200-400ms extra.

### 3. Canales de realtime duplicados para notificaciones
- `useNotifications` crea canal `notifications-list-{userId}`
- `useNotificationsRealtime` crea canal `notifications-{userId}`
- Ambos escuchan los mismos eventos INSERT en la misma tabla, duplicando el procesamiento.

### 4. LivesContext fuera de AuthenticatedProviders
`LivesProvider` esta montado en `App.tsx` fuera de `AuthenticatedProviders`, lo que significa que hace fetch de lives/recordings incluso para usuarios no autenticados en la landing page.

### 5. validateAuthSession innecesario en INITIAL_SESSION
En cada carga de pagina, `onAuthStateChange` con `INITIAL_SESSION` ejecuta `validateAuthSession()` que llama a `supabase.auth.getUser()` -- una llamada de red redundante ya que Supabase ya valido la sesion.

### 6. setTimeout(0) innecesario en onAuthStateChange
El `setTimeout` en el listener agrega un tick extra al event loop, retrasando la carga del perfil.

---

## Solucion

### Archivo 1: `src/hooks/auth/fetchUserProfile.ts`
- Incluir `doctor_profiles` y `resident_profiles` en el `Promise.all` inicial
- Pasar de 4 queries paralelas + 1 secuencial a **6 queries paralelas**
- Esto elimina 200-400ms del tiempo de carga del perfil

### Archivo 2: `src/hooks/auth/useAuthState.ts`
- Eliminar la llamada a `validateAuthSession()` dentro de `onAuthStateChange` para eventos `INITIAL_SESSION` y `SIGNED_IN` (la sesion ya fue validada por Supabase al disparar el evento)
- Eliminar el `setTimeout(0)` wrapper -- ejecutar directamente para reducir latencia
- En `INITIAL_SESSION`, si ya tenemos un cached user, solo actualizar el `supabaseUser` y refrescar el perfil en background sin bloquear
- Mantener `validateAuthSession` solo para el evento `focus` (re-validacion al volver a la pestana)

### Archivo 3: `src/hooks/auth/useAuthActions.ts`
- En `login()`, NO llamar a `fetchUserProfile` -- dejar que `onAuthStateChange` lo haga (evitar la doble carga)
- Solo hacer `signInWithPassword` y dejar que el listener maneje el resto
- Esto elimina 1 llamada completa de fetchUserProfile (~400-600ms)

### Archivo 4: `src/hooks/useNotifications.ts`
- Eliminar el canal de realtime duplicado de este hook
- Dejar que `useNotificationsRealtime` sea el unico que escuche eventos INSERT
- Este hook solo se encarga de fetch inicial y operaciones CRUD

### Archivo 5: `src/App.tsx`
- Mover `LivesProvider` dentro de `AuthenticatedProviders` para que no cargue datos innecesariamente en la landing
- Las paginas publicas que necesiten lives (como LivesGrid para visitantes) usaran un fetch local

### Archivo 6: `src/contexts/LivesContext.tsx`
- Agregar safe defaults cuando se usa fuera del provider (patron similar a WalletContext/ChatContext)
- Para que las paginas publicas no se rompan al no tener el provider

---

## Impacto Esperado

| Mejora | Ahorro estimado |
|--------|----------------|
| Eliminar doble fetchUserProfile en login | ~400-600ms |
| Paralelizar doctor_profiles query | ~200-400ms |
| Eliminar validateAuthSession en INITIAL_SESSION | ~200-300ms |
| Eliminar setTimeout(0) | ~16ms (1 frame) |
| Eliminar canal realtime duplicado | Menos uso de memoria/red |
| LivesProvider lazy | Menos queries en landing |

**Total estimado: 800ms-1.3s mas rapido en login y carga inicial**

---

## Detalles Tecnicos

### fetchUserProfile optimizado
```typescript
// ANTES: 4 paralelas + 1 secuencial
const [profile, role, wallet, entitlements] = await Promise.all([...]);
// luego: const doctorProfile = await supabase.from('doctor_profiles')...

// DESPUES: 6 paralelas
const [profile, role, wallet, entitlements, doctorProfile, residentProfile] = await Promise.all([
  supabase.from('profiles')...,
  supabase.from('user_roles')...,
  supabase.from('wallets')...,
  supabase.from('entitlements')...,
  supabase.from('doctor_profiles').select('*').eq('user_id', userId).maybeSingle(),
  supabase.from('resident_profiles').select('*').eq('user_id', userId).maybeSingle(),
]);
```

### Login simplificado
```typescript
// ANTES:
const { data } = await supabase.auth.signInWithPassword({...});
const profile = await fetchUserProfile(data.user.id); // REDUNDANTE
setUser(profile);

// DESPUES:
const { error } = await supabase.auth.signInWithPassword({...});
if (error) return { success: false, error: error.message };
// onAuthStateChange se encarga del resto
return { success: true };
```

### Archivos a modificar (6)

1. `src/hooks/auth/fetchUserProfile.ts` -- Paralelizar todas las queries
2. `src/hooks/auth/useAuthState.ts` -- Eliminar validacion redundante
3. `src/hooks/auth/useAuthActions.ts` -- Simplificar login
4. `src/hooks/useNotifications.ts` -- Eliminar canal duplicado
5. `src/App.tsx` -- Mover LivesProvider
6. `src/contexts/LivesContext.tsx` -- Agregar safe defaults
