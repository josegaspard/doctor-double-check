

# Live Stream Preview in Grid Cards

## Problem
Currently, live cards show a static gradient/icon placeholder or a thumbnail image. The user wants the actual live stream to be visible inside each card, like YouTube shows live previews in its grid.

## Technical Challenge
The platform uses **Daily.co** for live streaming. Daily.co requires joining a room as a participant to receive video — there's no passive HLS/thumbnail URL. Embedding a full Daily call instance per card (up to 20 simultaneous) would be extremely heavy on bandwidth, CPU, and Daily's API limits.

## Solution: Lightweight Daily Preview Player

Create a `LivePreviewPlayer` component that:
1. Uses **IntersectionObserver** to only connect when the card is visible on screen
2. Requests a viewer token from the `get-daily-token` edge function
3. Joins the Daily room in **receive-only mode** (no mic/cam) with low bandwidth settings
4. Renders the remote video track muted in the card's aspect-video area
5. Disconnects when the card scrolls out of view or on unmount
6. Limits simultaneous connections to **4 cards max** (a global counter) — remaining cards show the current placeholder until a slot frees up

### Files to Create
- **`src/components/live/LivePreviewPlayer.tsx`** — Lightweight Daily viewer component
  - Uses `Daily.createCallObject()` with `subscribeToTracksAutomatically: true`
  - Joins with `{ url, token, userName: 'preview', startVideoOff: true, startAudioOff: true }`
  - Attaches the first remote video track to a `<video>` element (muted, autoplay, playsInline)
  - Shows a fallback skeleton/icon while connecting
  - Cleans up (`.leave()` + `.destroy()`) on unmount or when not visible
  - Global `activePreviewCount` ref to cap concurrent connections at 4

### Files to Modify
- **`src/pages/LivesGrid.tsx`** — Replace the static thumbnail/placeholder in `LiveCard` with `<LivePreviewPlayer>`
  - Pass `dailyRoomName` from the `live` object
  - Keep all overlay badges (EN VIVO, viewer count, duration) on top of the video
  - Keep the hover overlay for the play button
  - Fallback to current placeholder if `dailyRoomName` is not available or connection limit reached

## Key Details
- Each preview joins as a **non-publishing participant** — the doctor won't see extra users in their participant list (Daily supports this via token permissions)
- Video is always **muted** in preview — no audio bleed
- The `get-daily-token` edge function already supports unauthenticated "Visitante" tokens, so visitors can see previews too
- On card click, navigates to `/live/${id}` as before — the full LivePlayer page creates its own connection

