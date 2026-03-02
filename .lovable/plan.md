

# Plan: Faster Lives Loading + Fix Visitor Token Auth Error

## Problem 1: Lives appear with a few seconds delay
The initial `fetchLives(true)` runs inside the `LivesProvider` `useEffect`, which depends on auth context initialization. Even though realtime is working, the first data load waits for auth to settle.

**Fix**: Reduce the polling interval from 15s to 8s, AND more importantly, trigger an immediate `fetchLives` as soon as the realtime channel successfully subscribes (subscription callback). Also reduce `MIN_FETCH_INTERVAL` from 5s to 3s so the polling fallback kicks in faster.

## Problem 2: "User not authenticated" error on get-daily-token (500)
The `get-daily-token` edge function requires a valid user auth token (line 37: `getUser(token)`). But lives are publicly accessible to visitors (unauthenticated users). When a visitor tries to watch a live, `supabase.functions.invoke` sends the anon key as the Authorization header, which fails `getUser()`.

**Fix**: Update the edge function to handle unauthenticated viewers gracefully. If no valid user token is provided, generate a viewer token with a generic "Visitante" name and no user_id. This aligns with the existing architecture where lives are public.

---

## Changes

### File 1: `supabase/functions/get-daily-token/index.ts`
- After extracting the auth header, attempt `getUser()` but treat failure as "visitor mode" instead of throwing an error
- If user is authenticated: use their name and ID for the token
- If not authenticated (visitor): generate a token with `user_name: "Visitante"` and no `user_id`
- This preserves security for authenticated features while allowing public live viewing

### File 2: `src/contexts/LivesContext.tsx`
- Reduce `MIN_FETCH_INTERVAL` from 5000ms to 3000ms
- Reduce polling interval from 15000ms to 8000ms
- These small tweaks ensure lives appear faster on initial load and catch missed events sooner

---

## Technical Details

### Edge function visitor handling (get-daily-token):
```typescript
// Instead of throwing on auth failure:
let userId: string | undefined;
let userName = 'Visitante';

const authHeader = req.headers.get("Authorization");
if (authHeader) {
  const token = authHeader.replace("Bearer ", "");
  const { data: userData } = await supabaseClient.auth.getUser(token);
  if (userData?.user) {
    userId = userData.user.id;
    // fetch profile name...
    userName = profile?.name || userData.user.email?.split('@')[0] || 'Usuario';
  }
}

// Generate token with or without userId
const tokenProperties = {
  room_name: roomName,
  is_owner: isOwner,
  ...(userId && { user_id: userId }),
  user_name: userName,
  exp: Math.floor(Date.now() / 1000) + 86400,
  start_video_off: !enableMedia,
  start_audio_off: !enableMedia,
};
```

### LivesContext timing:
```typescript
const MIN_FETCH_INTERVAL = 3000; // was 5000
// ...
const pollInterval = setInterval(() => {
  fetchLives(false);
}, 8000); // was 15000
```

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/get-daily-token/index.ts` | Allow unauthenticated viewers (visitors) |
| `src/contexts/LivesContext.tsx` | Faster polling (8s) and reduced throttle (3s) |

