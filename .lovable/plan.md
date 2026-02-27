
# Plan: Live Interactions, UX/UI Polish, Translations, and Chat Navigation

## Overview
This plan addresses 5 major areas: (1) Like & Share buttons in lives, (2) "Start Private Chat" navigation logic, (3) Bottom nav & LivePlayer i18n, (4) LivePlayer UX/UI improvements, and (5) remaining hardcoded strings translation.

---

## 1. Make "Like" Button Functional with Real-Time Feedback

The like/unlike logic already exists in `LivesContext` (`likeLive`, `unlikeLive`, `hasLiked`), and the DB trigger (`update_live_likes_count`) increments/decrements `likes_count` on the `lives` table automatically. The button in `LivePlayer.tsx` (line 435) already calls `handleLike`. 

**What needs fixing:**
- The `likeLive` function (line 475 of LivesContext) doesn't update local `lives` state optimistically -- the count only updates after a full refetch. 
- Add optimistic update: after inserting/deleting from `live_likes`, immediately update the local `lives` state count.
- The realtime subscription on `lives` table already handles `UPDATE` events, so the count will also sync from the DB trigger.

**File: `src/contexts/LivesContext.tsx`**
- In `likeLive()`: After inserting, also update `setLives()` to increment the matching live's `likesCount` by 1.
- In `unlikeLive()`: After deleting, decrement the matching live's `likesCount` by 1.

## 2. Make "Share" Button Functional

**File: `src/pages/LivePlayer.tsx`**
- Add an `onClick` handler to the Share button (line 439) that uses the Web Share API (`navigator.share`) if available, otherwise falls back to copying the URL to clipboard.
- Share data: title = live title, url = current page URL.
- Show a toast on success ("Link copied" / "Shared").

## 3. Fix "Start Private Chat" Button Logic

Currently (line 496) the button just navigates to `/chat` without context. The correct behavior:

**File: `src/pages/LivePlayer.tsx`**
- When clicked, check if the user has an active chat session with this doctor (using `ChatContext.getSessionsByUser()` filtered by `doctorId`).
- If an active session exists: navigate to `/chat` with that session selected (e.g., `/chat?session=SESSION_ID`).
- If no active session: navigate to the doctor's profile (`/doctor/${live.doctorId}`) so the user can initiate a consultation/orientation.
- Show a brief toast explaining: "Inicia una orientacion con este doctor para chatear" (translated).

## 4. Bottom Navigation Translation Fix

**File: `src/components/layout/MainLayout.tsx`**
- The `getBottomTabs` function (line 80) has hardcoded labels: `'Lives'`, `'Chat'`, `'Doctores'`, `'Perfil'`, `'Panel'`. These don't change when language switches to English.
- Replace all hardcoded labels with `t()` calls:
  - `'Lives'` -> `t('nav.lives')`
  - `'Chat'` -> `t('nav.chat')`
  - `'Doctores'` -> `t('nav.doctors')` (already partially done for one case)
  - `'Perfil'` -> `t('nav.profile')`
  - `'Panel'` -> `t('nav.dashboard')`
  - `'Avisos'` -> `t('nav.notifications')`
  - `'Admin'` -> `t('nav.admin')`

**Files: `src/lib/i18n/en.ts` and `es.ts`**
- Add `nav.doctors: 'Doctors'` / `'Doctores'` if not already present.

## 5. LivePlayer Page Full i18n

**File: `src/pages/LivePlayer.tsx`**
All hardcoded Spanish strings need `t()` calls. Key strings to translate:
- "Volver a Lives", "Transmision no encontrada", "Acceso anticipado Premium"
- "Me gusta", "Compartir", "Ver Perfil", "Iniciar Chat Privado"
- "Verificado", "Likes", "Seguidores", "Grabacion Premium"
- "Panel del Doctor", "Terminar Live", "Crear Cuenta"
- Dialog: "Terminar transmision", "Guardar como grabacion"
- Status messages: "Conectando a la transmision...", "Este live ya no esta activo"

**Files: `src/lib/i18n/en.ts` and `es.ts`**
- Add a `livePlayer` section with ~25 new keys covering all the above strings.

## 6. LivePlayer UX/UI Responsive Improvements

**File: `src/pages/LivePlayer.tsx`**
- **Mobile**: On small screens, stack the sidebar (doctor card + chat) below the video instead of a 3-column grid. Chat should be collapsible with a toggle button overlay on the video.
- **Tablet**: Use 2-column layout (video takes 2/3, sidebar 1/3).
- **Desktop**: Keep current 3-column layout.
- Make the action buttons (Like, Share, Chat toggle) sticky at the bottom on mobile for easy thumb access.
- Doctor info card: show avatar image if available (currently only shows Stethoscope icon).
- Increase touch targets to min 44px on mobile.

## 7. LivesGrid Page i18n Completion

**File: `src/pages/LivesGrid.tsx`**
- "Ir en vivo" button -> `t('lives.goLive')` 
- Add `lives.goLive` key to both language files.

## 8. LiveChat Component i18n

**File: `src/components/live/LiveChat.tsx`**
- "Chat en vivo" -> `t('livePlayer.liveChat')`
- "mensajes" -> `t('livePlayer.messages')`
- "Se el primero en enviar un mensaje" -> `t('livePlayer.firstMessage')`
- "Escribe un mensaje..." -> `t('livePlayer.writeMessage')`
- "Inicia sesion para participar en el chat" -> `t('livePlayer.loginToChat')`
- "Iniciar sesion" -> `t('nav.login')`

## 9. Translation Keys Summary

**New keys to add to both `es.ts` and `en.ts`:**

```text
livePlayer:
  backToLives, streamNotFound, premiumEarlyAccess, like, share,
  verified, likes, followers, viewProfile, startPrivateChat,
  premiumRecording, premiumRecordingDescription, doctorPanel,
  endLive, endLiveTitle, endLiveDescription, saveAsRecording,
  saveAsRecordingDescription, ending, createAccount, registerToChat,
  connecting, streamInitializing, notActive, refreshList,
  liveChat, messages, firstMessage, writeMessage, loginToChat,
  noActiveSession, goToProfile, minutes, sharedSuccessfully,
  linkCopied

lives:
  goLive

nav:
  doctors (if missing)
```

---

## Technical Summary

| File | Changes |
|------|---------|
| `src/contexts/LivesContext.tsx` | Optimistic like count update in `likeLive()` and `unlikeLive()` |
| `src/pages/LivePlayer.tsx` | Share button handler, private chat navigation logic, full i18n, responsive UX improvements |
| `src/components/live/LiveChat.tsx` | i18n for all hardcoded strings |
| `src/pages/LivesGrid.tsx` | i18n for "Ir en vivo" button |
| `src/components/layout/MainLayout.tsx` | Fix bottom nav hardcoded labels to use `t()` |
| `src/lib/i18n/es.ts` | Add ~30 new translation keys (livePlayer section) |
| `src/lib/i18n/en.ts` | Add matching English translations |

No database changes needed -- the likes trigger and RLS policies are already in place.
