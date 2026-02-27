
# Plan: UX Improvements -- Subscriptions, Lives, Stats, Chat Delete

## 1. Clarify "Seguir" vs "Suscribirse" in UI

**Problem:** Users don't understand the difference between free follow and paid subscription, and can't easily discover the paid upgrade option.

**Changes:**
- **SubscribeButton.tsx**: When user is already following (free tier), show a split UI:
  - Main button: "Siguiendo" (with check icon) -- clicking opens notification prefs popover (current behavior)
  - Adjacent prominent button: "Suscribirse (de pago)" with Crown icon -- opens upgrade modal directly
- Add a small explainer text in the upgrade modal: "Seguir es gratis (recibes notificaciones). Suscribirte te da acceso a contenido exclusivo, chat prioritario y descuentos."
- On doctor profile page, if user is free-following, show a visible banner/card below the follow button: "Desbloquea beneficios premium" with direct upgrade CTA.

## 2. Fix Live Stream Playback for Viewers

**Problem:** Patients, residents, and visitors see perpetual loading or errors when joining a live.

**Root Cause Investigation:** The `get-cloudflare-playback` edge function already allows public live requests (no auth for `type=live`). The issue is likely:
- The `getPlaybackUrl` in `useCloudflareAPI.ts` calls `supabase.functions.invoke()` which attaches the auth header automatically. For non-authenticated users (visitors), this may send an invalid/empty token.
- The function returns `null` when state is `disconnected` -- if there's a timing gap between stream creation and Cloudflare receiving the ingest, all viewers see an error.

**Changes:**
- **useCloudflareAPI.ts**: For live type requests, bypass `supabase.functions.invoke` and use a direct `fetch()` call to the edge function URL without requiring auth headers, ensuring visitors can access.
- **LivePlayer.tsx**: Add automatic retry with exponential backoff (3s, 6s, 12s) when `playbackUrl` is null but `isLiveActive` is true, up to 5 retries. Show a proper "Conectando..." spinner with retry count.
- **DoctorGoLive.tsx**: Verify the live creation flow is intact -- review `createStream`, `startBroadcast`, and notification flow. No changes needed based on current code analysis -- the flow is solid.

## 3. Live Thumbnail on Cards and Premium Content

**Problem:** User wants custom thumbnail or screenshot for lives, and these should appear in cards.

**Current State:** `DoctorGoLive` already supports `thumbnailFile` upload to a `thumbnails` bucket and stores `thumbnail_url` in the `lives` table. The `LivesContext` maps `thumbnail_url`. The `LivesGrid` cards don't currently display thumbnails.

**Changes:**
- **LivesGrid.tsx**: In the live card thumbnail area, render `live.thumbnailUrl` as an `<img>` if available, falling back to the current gradient + Video icon.
- **RecordingsGrid.tsx**: Already renders `recording.thumbnailUrl` -- confirmed working.
- **ContentGallery.tsx**: Already renders `content.thumbnail_url` -- confirmed working.

## 4. Show Viewer Count on Premium Content and Doctor Recordings

**Problem:** User wants to see how many people watched each live in the content/recording cards.

**Changes:**
- **Database migration**: Add `peak_viewers` column (integer, default 0) to the `lives` table. Add a column `peak_viewers` to `recordings` table (integer, default 0).
- **DoctorGoLive.tsx** (end live flow): Before ending, save `viewerCount` to `lives.peak_viewers`.
- **LivesContext.tsx**: Map `peak_viewers` from lives and recordings data.
- **RecordingsGrid.tsx**: Show viewer count badge (Eye icon + count) on each card.
- **DoctorRecordings.tsx**: Show peak viewers in the recording table/stats.
- **ContentGallery.tsx**: For video content that links to a recording, show viewer count if available.

## 5. Purchased/Unpurchased Tabs in "Contenido Premium" (RecordingsGrid)

**Problem:** RecordingsGrid (premium content page at `/recordings`) doesn't have purchased/unpurchased tabs. ContentGallery already has them.

**Changes:**
- **RecordingsGrid.tsx**: Add Tabs component with "Todo", "Comprados", and "Disponibles" tabs, filtering by `ownsRecording()`.

## 6. Doctor Dashboard Stats -- Clickable Cards

**Problem:** Vault, Rating, and Subscribers cards aren't interactive.

**Changes:**
- **DoctorStatsGrid.tsx**:
  - "Acceso al Vault" card: Add `onClick: () => navigate('/doctor/vault')`
  - "Rating" card: Add `onClick: () => navigate('/doctor/profile#reviews')` (or open profile page scrolled to reviews)
  - "Suscriptores" card: Add `onClick` that opens a new `SubscribersModal` component

- **New component: `src/components/doctor/SubscribersModal.tsx`**:
  - Dialog that fetches subscribers from `subscriptions` table where `creator_id = user.id` and `is_active = true`
  - Show each subscriber's name, avatar, tier (free/basic/premium), and subscription date
  - Join with `profiles_public` for display names

## 7. Delete Chat History

**Problem:** Users can't delete chats from history.

**Changes:**
- **Database migration**: Add DELETE RLS policy on `chat_sessions` allowing participants to delete their own sessions (only closed ones).
- **ChatContext.tsx**: Add `deleteSession(sessionId)` method that deletes the session from `chat_sessions` (also deletes related `chat_messages` via cascade or manual delete).
- **ChatSessionsList.tsx / ChatSessionItem.tsx**: Add a delete button (Trash icon) on closed sessions in the history tab. Show confirmation dialog before deleting.

---

## Technical Summary of File Changes

| File | Change |
|------|--------|
| `src/components/subscriptions/SubscribeButton.tsx` | Show upgrade CTA prominently for free followers |
| `src/hooks/cloudflare/useCloudflareAPI.ts` | Direct fetch for live playback (no auth required) |
| `src/pages/LivePlayer.tsx` | Auto-retry for playback URL resolution |
| `src/pages/LivesGrid.tsx` | Show thumbnail images on live cards |
| `src/pages/RecordingsGrid.tsx` | Add purchased/available tabs + viewer count badge |
| `src/pages/ContentGallery.tsx` | Show viewer count on video content cards |
| `src/components/doctor/DoctorStatsGrid.tsx` | Make vault, rating, subscribers cards clickable |
| `src/components/doctor/SubscribersModal.tsx` | New: modal listing subscribers with tier info |
| `src/pages/DoctorGoLive.tsx` | Save peak viewers on end |
| `src/contexts/ChatContext.tsx` | Add deleteSession method |
| `src/components/chat/ChatSessionsList.tsx` | Add delete button on history items |
| `src/components/chat/ChatSessionItem.tsx` | Add delete action |
| `supabase/migrations/new.sql` | Add peak_viewers columns + chat_sessions DELETE policy |
