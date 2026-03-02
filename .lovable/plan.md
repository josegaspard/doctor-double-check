

# Fix: Real-Time Lives Not Appearing Without Refresh

## Root Cause

The `lives` table was NOT in the `supabase_realtime` publication until the migration we just executed. The realtime code in `LivesContext.tsx` was already correctly handling INSERT events, but Supabase wasn't broadcasting changes because the table wasn't published.

Now that the migration has been applied, new lives SHOULD appear in real-time. However, Supabase Realtime can sometimes silently miss events due to network issues or transient problems.

## Solution: Add Polling Fallback

Add a lightweight polling fallback alongside the existing realtime subscription to guarantee lives always appear, even if a realtime event is missed.

### Changes to `src/contexts/LivesContext.tsx`

1. **Add a polling interval** (every 15 seconds) that calls `fetchLives(false)` as a safety net
   - This uses the existing throttle/cache logic so it won't duplicate network calls if realtime already updated the state
   - The `MIN_FETCH_INTERVAL` of 5 seconds already prevents redundant fetches

2. **Place the polling inside the realtime `useEffect`** so it shares the same lifecycle and cleanup

### Technical Detail

Inside the existing realtime `useEffect` (line 358), after `.subscribe()`, add:

```typescript
// Polling fallback: catch any missed realtime events
const pollInterval = setInterval(() => {
  fetchLives(false);
}, 15000); // Every 15 seconds

return () => {
  clearInterval(pollInterval);
  supabase.removeChannel(channel);
};
```

This is a minimal, safe change. The `fetchLives(false)` respects the 5-second throttle so it won't fire excessively. The realtime subscription handles instant updates; the poll is just a safety net.

## Files Modified

| File | Change |
|------|--------|
| `src/contexts/LivesContext.tsx` | Add 15-second polling fallback inside the realtime useEffect |

