# Plan: Real-time Lives Grid, Doctor Fullscreen + Screen Share, Mobile Optimization, Live Ended Screen, and Peak Viewers

## 1. Real-time animated LivesGrid updates

The `LivesContext` already has Supabase Realtime subscriptions that update the `lives` array when new lives are inserted. The problem is `LivesGrid` doesn't animate new cards appearing.

**Changes to `src/pages/LivesGrid.tsx`:**

- Track previously seen live IDs using a `useRef<Set<string>>`.
- When a new live appears (ID not in the set), apply a `animate-fade-in` CSS class to the card.
- Remove the manual `refreshLives()` on mount since Realtime already handles it.
- Use `framer-motion`'s `AnimatePresence` + `motion.div` to animate cards entering/leaving the grid smoothly.

## 2. Doctor fullscreen broadcast + screen sharing

**Changes to `src/components/live/DailyVideoPlayer.tsx`:**

- Add screen sharing support: new `isScreenSharing` state and `toggleScreenShare()` using `callRef.current.startScreenShare()` / `stopScreenShare()`.
- When screen share is active, show a split layout: screen share takes the main area, camera moves to a small PiP corner.
- Add a screen share button in the controls bar (only for owner).
- Make the video container fullscreen-friendly with proper aspect ratios.

**Changes to `src/components/live/LiveStreamView.tsx`:**

- On mobile, render the broadcast in fullscreen mode (`fixed inset-0 z-50`) with controls overlaid at the bottom with safe-area padding.
- Reduce header to a compact single-line overlay on mobile.
- Make the chat panel slide up from bottom on mobile as an overlay instead of a side column.

## 3. Description text respecting layout boundaries

**Changes to `src/pages/LivePlayer.tsx`:**

- Add `break-words whitespace-pre-wrap overflow-hidden` to the description paragraph so long text doesn't overflow or break lateral spacing.

## 4. Mobile: scroll to top on live load (not footer)

**Changes to `src/pages/LivePlayer.tsx`:**

- Add `useEffect` that scrolls to top (`window.scrollTo(0, 0)`) when the component mounts or when `live?.id` changes.
- This ensures entering a live room always shows the video first, not the footer.

## 5. "Live Ended" screen with doctor info

**New component: `src/components/live/LiveEndedOverlay.tsx**`

- Shown when a viewer is watching and the live status changes to `ended`.
- Displays: "El doctor ha finalizado la transmision", doctor name, specialty, avatar/initial, and a "Ver Perfil" button linking to `/doctor/{doctorId}`.
- Also shows final stats: total likes, peak viewers, duration.
- Animate in with `animate-fade-in`.

**Changes to `src/pages/LivePlayer.tsx`:**

- Detect when `live.status` changes from `'live'` to `'ended'` while user is on the page.
- Show `LiveEndedOverlay` instead of redirecting.

## 6. Peak viewers in recordings (public metric)

**Changes to `src/contexts/LivesContext.tsx`:**

- Add `peakViewers?: number` to the `Recording` interface.
- Populate it from `r.peak_viewers` in the `fetchRecordings` mapping.

**Changes to `src/pages/RecordingsGrid.tsx`:**

- Replace `(recording as any).peakViewers` with properly typed `recording.peakViewers`.
- Display the eye icon + count badge on all recording cards that have peak viewers > 0.

## 7. Comprehensive mobile optimization

All components above will be built mobile-first:

- `LiveStreamView`: fullscreen fixed overlay on mobile with `h-[100dvh]`, controls with `pb-[env(safe-area-inset-bottom)]`.
- `LivePlayer.tsx`: tighter padding (`px-2 py-2` on mobile), compact sidebar stacking.
- `LivesGrid.tsx`: single-column cards on small screens, reduced padding.
- `LiveEndedOverlay`: centered modal with responsive sizing.

---

## Technical File Changes


| File                                       | Action                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| `src/pages/LivesGrid.tsx`                  | Add framer-motion animated card enter/exit                              |
| `src/components/live/DailyVideoPlayer.tsx` | Add screen sharing, split layout, mobile fullscreen                     |
| `src/components/live/LiveStreamView.tsx`   | Mobile fullscreen layout, compact controls                              |
| `src/pages/LivePlayer.tsx`                 | Scroll to top on mount, description text wrapping, live ended detection |
| `src/components/live/LiveEndedOverlay.tsx` | **NEW** -- end-of-live overlay with doctor info                         |
| `src/contexts/LivesContext.tsx`            | Add `peakViewers` to Recording interface and mapping                    |
| `src/pages/RecordingsGrid.tsx`             | Use typed `peakViewers` field                                           |
