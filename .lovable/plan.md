
# Fix: Chat Not Opening After Paying for Consultation

## Problems Found

### Problem 1: Wallet Payment (DoctorProfile.tsx)
When patient pays via wallet, `process_consultation_purchase` RPC creates the chat session in the database and returns `session_id`. But the code on line 269 just does `navigate('/chat')` without passing the session ID. The Chat page has no way to know which session to auto-select.

### Problem 2: Stripe Payment (Chat.tsx)  
When Stripe redirects to `/chat?consultation=success&doctor=X`, the useEffect on line 57-91 calls `refreshSessions()` then immediately reads `allSessions` — but `allSessions` is a stale closure from the current render. The refreshed data hasn't propagated to the component yet, so `existingSession` is always `undefined`. Then `createSession` tries to create a duplicate, which either fails or creates an unwanted second session.

Also line 71 shows `toast.success(t('chat.sessionClosed'))` which is the wrong message — should be payment success.

## Solution

### File 1: `src/pages/DoctorProfile.tsx`
After wallet payment succeeds (line 266-269), navigate with the session_id:
```js
navigate(`/chat?session=${result.session_id}`);
```

### File 2: `src/pages/Chat.tsx`
Two changes:

**a) Handle `?session=` param** (wallet flow): Add logic to read `session` param and auto-select it.

**b) Fix Stripe redirect flow**: Instead of relying on stale `allSessions`, query the database directly for the session created by the webhook:
```js
const { data: sessionData } = await supabase
  .from('chat_sessions')
  .select('id')
  .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${doctorId}),and(participant1_id.eq.${doctorId},participant2_id.eq.${user.id})`)
  .eq('status', 'active')
  .eq('is_double_check', false)
  .maybeSingle();
```
If found, select it. If not (webhook hasn't processed yet), create it via `createSession`.

Also fix the wrong toast message on line 71.

## Files to modify
- `src/pages/DoctorProfile.tsx` — pass session_id in navigation after wallet payment
- `src/pages/Chat.tsx` — handle `?session=` param; fix Stripe redirect to query DB directly instead of using stale state
