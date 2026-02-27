
# Plan: Fix Critical Live Stream Display and Navigation Issues

## Root Cause Analysis

Two distinct bugs are causing the problems:

**Bug 1 - Lives not showing on /lives page:**
The console logs reveal `"useLives called outside LivesProvider - returning defaults"`. This happens during Vite's Hot Module Replacement (HMR): when modules are re-evaluated, the `LivesContext` object gets a new reference, but the existing `LivesProvider` in the DOM still holds the old one. The `useContext` call with the new reference returns `undefined`, triggering the fallback with `isLoading: true` permanently. The skeleton loading state never ends.

**Bug 2 - Clicking notification doesn't load the live:**
The `LivePlayer` page depends entirely on `getLive(id)` from context to find the live. If the context hasn't finished loading or returns defaults (due to Bug 1), `getLive()` returns `undefined`. The page then shows either an infinite skeleton or "Transmision no encontrada". There is no direct database fallback fetch.

## Fix 1: Make `useLives` resilient to HMR context loss

Instead of returning static defaults when context is undefined, the `useLives` hook should throw an error (standard React pattern) OR better yet, use `React.createContext` with a non-undefined default. However, since HMR is the issue, the simplest fix is to **not use `initialLoadDone` ref** and instead let the effect re-run when needed, plus add a safety timeout.

**File: `src/contexts/LivesContext.tsx`**
- Remove the `initialLoadDone` ref guard. Instead, use a state flag `hasLoaded` that resets properly.
- Change the initial load `useEffect` to NOT have an empty dependency array -- instead depend on a stable identity. This ensures HMR re-runs the fetch.
- Add a safety timeout: if `isLoading` is still true after 8 seconds, force `setIsLoading(false)` so the page doesn't hang forever.

## Fix 2: LivePlayer direct DB fetch fallback

**File: `src/pages/LivePlayer.tsx`**
- Add a `directLive` state that fetches the live directly from the database when `getLive(id)` returns undefined AND `isLoading` is false (context loaded but live not in list).
- Also fetch directly if `isLoading` has been true for more than 5 seconds (timeout fallback).
- This ensures clicking a notification ALWAYS loads the live, regardless of context state.

Changes:
- Add `useState` for `directLive` and `directLoading`
- Add `useEffect` that triggers when `!live && !isLoading && id` -- fetches from `supabase.from('lives').select('*').eq('id', id).single()` and maps to a `Live` object
- Also add a timeout: if `isLoading` remains true for 5s, trigger the direct fetch
- Use `directLive` as fallback: `const activeLive = live || directLive`

## Fix 3: Safety timeout in LivesProvider

**File: `src/contexts/LivesContext.tsx`**
- Add a `setTimeout` in the initial load effect: after 10 seconds, if `isLoading` is still true, force it to false. This prevents infinite loading in any edge case.

## Technical Summary

| File | Changes |
|------|---------|
| `src/contexts/LivesContext.tsx` | Remove `initialLoadDone` ref guard; add safety timeout for `isLoading`; ensure effect re-runs on HMR |
| `src/pages/LivePlayer.tsx` | Add direct DB fetch fallback when context can't find the live; add loading timeout |
