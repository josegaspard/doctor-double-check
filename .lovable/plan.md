

# Plan: Fix Doctor Profile Buttons Layout + Recording Scroll Bug

## Issue 1: Doctor Profile Action Buttons — Broken Layout

**Problem:** The `grid-cols-3` layout (line 614) crams the `SubscribeButton` and `BlockUserButton` into narrow 1/3-width cells. The `SubscribeButton` renders TWO buttons side-by-side when subscribed ("Suscrito" + "Suscripción Pro"), which overflows the cell. The result looks broken and cluttered (visible in the screenshot).

**Solution:** Replace the cramped 3-column grid with a cleaner stacked layout:
- **Row 1:** Full-width "Iniciar Orientación" (already done)
- **Row 2:** SubscribeButton at full width (it handles its own internal layout with popover + upgrade CTA)
- **Row 3:** Two equal buttons side-by-side: "Ver Lives" and "Bloquear"

This gives each action proper breathing room and clear visual hierarchy.

**File:** `src/pages/DoctorProfile.tsx` lines 614-633

```text
Before (broken):
┌──────────┬──────────┬──────────┐
│Suscrito + │ Ver Lives│ Bloquear │  ← overflow
│Suscrip P..│          │          │
└──────────┴──────────┴──────────┘

After (clean):
┌────────────────────────────────┐
│      Iniciar Orientación       │
├────────────────────────────────┤
│    ✓ Suscrito  👑 Suscripción  │  ← full width
├───────────────┬────────────────┤
│   Ver Lives   │   Bloquear     │  ← 2-col grid
└───────────────┴────────────────┘
```

## Issue 2: Recording Page Scrolls Down When Chat Has Messages

**Problem:** In `RecordingChatReplay.tsx` line 49, `scrollIntoView({ behavior: 'smooth' })` is called when `visibleMessages.length` changes. On initial load, this scrolls the ENTIRE PAGE down to the chat panel in the sidebar, jumping past the video player.

**Solution:** Replace `scrollIntoView` with `scrollTop` on the chat's own scroll container. The `bottomRef` should scroll only within the chat's `ScrollArea`, not the page. Use the parent container's `scrollTop` instead of `scrollIntoView`.

**File:** `src/components/recordings/RecordingChatReplay.tsx` line 49

Change:
```tsx
bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
```
To:
```tsx
// Scroll within chat container only, never the page
const parent = bottomRef.current?.closest('[data-radix-scroll-area-viewport]');
if (parent) {
  parent.scrollTop = parent.scrollHeight;
}
```

## Files to Modify
1. `src/pages/DoctorProfile.tsx` — Restructure action buttons from 3-col grid to stacked layout
2. `src/components/recordings/RecordingChatReplay.tsx` — Fix scrollIntoView to container-scoped scroll

