

# Plan: Fix Video Calls, Mobile Optimization, and Doctor Cards UX

## 1. Fix Video Call -- Both Participants Visible

**Root Cause Found:** In `create-daily-room/index.ts`, the room is created with `owner_only_broadcast: true` (line 63). This setting is designed for live streaming (one broadcaster, many viewers) but is also being used for 1:1 consultations. It blocks the patient from transmitting video/audio.

**Fix:**
- Modify `create-daily-room/index.ts` to accept a `mode` parameter (`"live"` or `"consultation"`).
- When `mode === "consultation"`: set `owner_only_broadcast: false`, `max_participants: 4` (doctor, patient, maybe resident + buffer).
- When `mode === "live"` (default): keep `owner_only_broadcast: true`.
- Update `VideoCall.tsx` to pass `mode: 'consultation'` when invoking `createRoom`.
- Update `useDaily.ts` `createRoom` to accept and forward the `mode` parameter.

This keeps Daily.co (no library swap needed) since the errors were caused by the broadcast restriction, not Daily itself.

## 2. Mobile-Optimized Video Call

**Changes to `VideoCall.tsx`:**
- On mobile, render the video container as fullscreen (100vh, 100vw) without MainLayout wrapper, using a fixed overlay.
- Add a `useIsMobile()` check. If mobile + connected, hide header/back button and show controls at bottom with safe-area padding.
- Set the iframe container to `h-[100dvh] w-full` on mobile instead of `aspect-video`.

**Changes to `VideoCallControls.tsx`:**
- Add `pb-[env(safe-area-inset-bottom)]` for notch-aware phones.
- Make buttons slightly smaller on very small screens (`w-10 h-10` at `xs`).
- Always show all controls on mobile (remove `hidden sm:flex` from screen share).

## 3. Mobile-Optimized Doctor Cards (`/doctors`)

**Changes to `Doctors.tsx`:**
- On mobile (< 640px), use a single-column layout with compact cards.
- Reduce avatar size to `w-12 h-12` on mobile.
- Consolidate the card footer: replace the two separate buttons with a single row.

**New card footer design:**
- If user is NOT following: single full-width button "Seguir" (heart icon).
- If user IS following but NOT paid subscriber: "Siguiendo" (outline) + "Pro" button (crown icon, gold/premium variant).
- If user IS a paid subscriber: "Siguiendo" (outline) + "Pro" badge (static, non-clickable).
- Remove the separate `SubscribeButton` from the card entirely. Instead, integrate the upgrade CTA directly in the card footer as a small "Pro" button.

**Rename:** "Suscribirse" becomes "Suscripcion Pro" everywhere in the cards context.

## 4. Mobile-Optimized Chat

**Changes to `Chat.tsx` and `ChatMessagesPanel.tsx`:**
- The chat already has mobile handling (`showMobileChat`/`showMobileList`) -- verify and tighten:
  - Ensure the session list takes full height on mobile.
  - Ensure message input sticks to bottom with `pb-[env(safe-area-inset-bottom)]`.
  - Reduce padding on mobile (`px-2 py-2` instead of `px-4 py-4`).

**Changes to `ChatSessionItem.tsx`:**
- Reduce avatar to `w-10 h-10` on mobile.
- Tighter text truncation.

## 5. General Mobile Polish

**MainLayout.tsx:**
- No structural changes needed (already has hamburger menu).

---

## Technical File Changes

| File | Change |
|------|--------|
| `supabase/functions/create-daily-room/index.ts` | Accept `mode` param; set `owner_only_broadcast: false` for consultations |
| `src/hooks/useDaily.ts` | Pass `mode` to edge function |
| `src/pages/VideoCall.tsx` | Pass `mode: 'consultation'`; fullscreen on mobile when connected |
| `src/components/videocall/VideoCallControls.tsx` | Safe-area padding; show all controls on mobile |
| `src/pages/Doctors.tsx` | Redesign card footer (Seguir + Pro CTA); responsive single-column on mobile |
| `src/components/chat/ChatMessagesPanel.tsx` | Tighter mobile padding, safe-area-aware input |
| `src/components/chat/ChatSessionItem.tsx` | Smaller avatar on mobile |

