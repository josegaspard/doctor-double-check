

# Plan: Mobile Optimization, Live Audio Fix, and UX/UI Overhaul

## Critical Bug Fix: Doctor Audio Not Heard in Lives

**Root cause found in `src/components/live/DailyVideoPlayer.tsx`**, line 187:
```typescript
const stream = new MediaStream([participant.videoTrack]);
```
Only the **video track** is attached to the MediaStream. The **audio track** is completely ignored. Viewers never hear the doctor because the audio is never played through any element.

**Fix**: Include `participant.audioTrack` in the MediaStream when available:
```typescript
const tracks = [participant.videoTrack];
if (!participant.local && participant.audioTrack) {
  tracks.push(participant.audioTrack);
}
const stream = new MediaStream(tracks);
```
Also add a dedicated audio element fallback for participants who have audio but no video (e.g., camera off).

---

## Phase 1: Mobile-First Layout Overhaul

### 1.1 Bottom Navigation Bar for Mobile
Replace the hamburger menu with a fixed bottom tab bar (like Instagram/TikTok) for the 4-5 most important routes. This is the single biggest mobile UX improvement.

**File**: `src/components/layout/MainLayout.tsx`
- Add a `<nav>` fixed at the bottom with icons for: Lives, Chat, Doctores, Notificaciones, Perfil
- Hide the hamburger menu on mobile, keep it for tablet
- Adjust main content padding-bottom to account for the tab bar
- Use `safe-area-inset-bottom` for notch devices

### 1.2 Chat Page Mobile Polish
**File**: `src/pages/Chat.tsx` and `src/components/chat/*`
- Make the session list full-width on mobile with larger touch targets (min 48px height per item)
- When a session is selected, slide the message panel in from the right (full screen)
- Add a sticky input bar at the bottom with proper keyboard-aware spacing
- Enlarge send button and file upload icon for touch

### 1.3 Video Call Mobile Improvements
**File**: `src/pages/VideoCall.tsx`
- The current mobile fullscreen layout is good but the PiP local video overlaps controls; move it to top-right
- Add swipe-down gesture hint to dismiss chat overlay
- Make control buttons larger (min 48x48px touch targets)

### 1.4 Lives Grid Mobile
**File**: `src/pages/LivesGrid.tsx`
- Single column on small phones (< 380px), 2 columns on larger phones
- Reduce card padding, use compact typography
- Make the "Ir en vivo" button floating (FAB style) for doctors on mobile

### 1.5 Live Player Mobile
**File**: `src/pages/LivePlayer.tsx`
- Force landscape-friendly layout for the video
- Make the chat panel a bottom sheet (swipe up to open) instead of taking sidebar space
- Collapse doctor info card into a mini bar below the video

### 1.6 Notifications Mobile
**File**: `src/pages/Notifications.tsx`
- Swipe-to-dismiss individual notifications
- Larger touch targets for mark-as-read and delete buttons
- Group notifications by date

### 1.7 Doctor Profile Mobile
**File**: `src/pages/DoctorProfile.tsx`
- Sticky CTA bar at the bottom with "Consultar" and "Seguir/Suscribir" buttons always visible
- Collapse bio/credentials into expandable sections
- Full-width action buttons

---

## Phase 2: UX/UI Usability Improvements

### 2.1 Doctor Discovery & Subscription Flow
**Problem**: Users don't understand how to subscribe or what "Seguir" vs "Suscripcion Pro" means.

**File**: `src/pages/Doctors.tsx`
- Add a brief onboarding tooltip/banner at the top: "Sigue gratis para recibir notificaciones. Suscribete Pro para chat y contenido exclusivo."
- Change card footer: Show a single prominent "Ver Perfil" button + a small heart icon for follow (instead of confusing dual-button layout)
- Add visual indicator of subscription benefits directly on the card

**File**: `src/pages/DoctorProfile.tsx`
- Add a clear benefits comparison section: Free (follow) vs Basic vs Premium
- Make the "Consultar por Chat" flow more prominent with a price tag visible
- Add a "How it works" mini-guide section

### 2.2 Navigation Clarity
**File**: `src/components/layout/MainLayout.tsx`
- Add labels under mobile bottom nav icons (always visible, not tooltip)
- Use distinct colors for active state
- Show unread badge count on Chat and Notifications icons

### 2.3 Chat UX Improvements
**Files**: `src/components/chat/ChatMessagesPanel.tsx`, `src/components/chat/ChatHeader.tsx`
- Add message status indicators (sent, delivered, read)
- Show "online now" / "last seen" status for the other participant
- Add quick-action buttons in chat header: Video Call, View Profile, Close Session
- Improve empty state with clear CTA: "Busca un doctor para iniciar una consulta"

### 2.4 Prescriptions UX
**File**: `src/pages/Prescriptions.tsx`
- Add visual status pills (active, expired, pending)
- Quick-view modal instead of navigating to a separate page
- Download/share button prominently placed

### 2.5 Dashboard UX for Doctors
**File**: `src/pages/DoctorDashboard.tsx`
- Reorganize quick actions into a 2x2 grid with larger icons and descriptions
- Add "Today's summary" card at the top showing pending chats, upcoming availability, earnings
- Highlight actionable items with notification dots

### 2.6 Global UX Patterns
- All interactive elements: minimum 44x44px touch targets on mobile
- Add loading skeletons to all pages that fetch data
- Consistent back-button placement (top-left)
- Toast notifications positioned at the top on mobile (not bottom where they overlap with nav)

---

## Phase 3: CSS & Animation Polish

### 3.1 Global Mobile Styles
**File**: `src/index.css`
- Add bottom navigation safe area variables
- Add slide-in-from-right animation for chat panel transitions
- Add haptic feedback CSS (active states with scale transform)
- Improve focus-visible styles for accessibility

### 3.2 Touch Feedback
- Add `active:scale-95` to all buttons on mobile
- Add subtle press animations to cards
- Smooth transitions between views (300ms ease)

---

## Technical File Changes Summary

| File | Changes |
|------|---------|
| `src/components/live/DailyVideoPlayer.tsx` | **CRITICAL**: Add audioTrack to MediaStream for remote participants |
| `src/components/layout/MainLayout.tsx` | Add fixed bottom tab bar for mobile; unread badges on Chat/Notifications |
| `src/pages/Chat.tsx` | Full-screen message panel on mobile; larger touch targets |
| `src/pages/VideoCall.tsx` | Reposition PiP video; larger control buttons |
| `src/pages/LivesGrid.tsx` | Responsive grid improvements; FAB for doctors |
| `src/pages/LivePlayer.tsx` | Bottom sheet chat; compact doctor info |
| `src/pages/Notifications.tsx` | Larger touch targets; date grouping |
| `src/pages/Doctors.tsx` | Onboarding banner; simplified card actions |
| `src/pages/DoctorProfile.tsx` | Sticky CTA bar; benefits comparison; clearer subscription flow |
| `src/pages/DoctorDashboard.tsx` | Reorganized quick actions; today's summary |
| `src/pages/Prescriptions.tsx` | Status pills; quick-view |
| `src/components/chat/ChatMessagesPanel.tsx` | Quick-action header buttons; improved empty state |
| `src/index.css` | Bottom nav styles; slide animations; touch feedback; safe areas |

**Implementation order**: Audio fix first (critical), then bottom nav (highest UX impact), then remaining mobile optimizations, then UX/UI improvements.

