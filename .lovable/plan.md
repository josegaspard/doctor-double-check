

# Fix: Live player stuck on "Conectando a la transmision..." for the owner

## Root Cause

In `LivePlayer.tsx`, the effect that resolves the Daily room (lines 195-251) has this guard:

```typescript
if (!live || !isLiveActive || isOwner) return;
```

When the logged-in user is the doctor who started the live, `isOwner = true` and the effect exits immediately. As a result, `roomUrl` and `viewerToken` are never set, and the UI stays stuck on the "Conectando a la transmision..." spinner forever.

## Solution

Resolve the Daily room for the owner too, but request an **owner token** instead of a viewer token. The owner should be able to see their own stream from the LivePlayer page (e.g., if they navigate there from the lives grid).

### Changes to `src/pages/LivePlayer.tsx`

1. **Remove `isOwner` from the guard** in the resolve viewer effect (line 196), so it runs for both owners and viewers.

2. **Pass `isOwner` when fetching the token**: Update the `getViewerToken` call to request an owner token when `isOwner` is true. Since the edge function already supports `isOwner` as a body parameter, we need to pass it through.

3. **Update `useDaily` hook** (`src/hooks/useDaily.ts`): Modify `getViewerToken` to accept an optional `isOwner` parameter and pass it to the edge function.

### File 1: `src/hooks/useDaily.ts`

- Change `getViewerToken(roomName: string)` signature to `getViewerToken(roomName: string, isOwner?: boolean)`
- Pass `isOwner` in the body: `{ roomName, isOwner: isOwner || false }`

### File 2: `src/pages/LivePlayer.tsx`

- Remove `isOwner` from the guard on line 196: change to `if (!live || !isLiveActive) return;`
- On line 228, pass `isOwner` to `getViewerToken`: `token = await getViewerToken(roomName, isOwner);`
- Update the `useEffect` dependency array (line 251) to include `isOwner` (it references `getViewerToken` which now depends on isOwner)

This ensures both doctors and viewers can watch the live stream from the LivePlayer page.

