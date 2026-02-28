
# Plan: Fix Critical Bugs and UX/UI Improvements

## 1. Fix "nav.doctors" Translation Key Missing

The `nav.doctors` key doesn't exist in either `es.ts` or `en.ts`, causing "Nav.doctors" to display in the bottom navigation bar.

**Files:** `src/lib/i18n/es.ts`, `src/lib/i18n/en.ts`
- Add `doctors: 'Doctores'` to `nav` section in `es.ts`
- Add `doctors: 'Doctors'` to `nav` section in `en.ts`

## 2. Fix Notifications Page Infinite Loading

The `useNotifications` hook initializes `isLoading = true` but only sets it to `false` inside `fetchNotifications()`, which requires `supabaseUser?.id`. If auth hasn't resolved yet or user is a visitor, the page stays loading forever.

**File:** `src/hooks/useNotifications.ts`
- Add early return in `useEffect`: if `!supabaseUser?.id`, set `isLoading(false)` immediately
- This ensures visitors and unauthenticated users see the empty state instead of infinite spinner

## 3. Fix Logout Not Working

The `logout` function calls `window.location.replace('/lives')` before `supabase.auth.signOut()` completes. The page redirect triggers `onAuthStateChange` which sees the still-active session and re-authenticates. 

**File:** `src/hooks/auth/useAuthActions.ts`
- Change logout to `await supabase.auth.signOut()` FIRST, then redirect
- Remove the "fire and forget" pattern -- sign out must complete before navigation

## 4. Video Call Hang-Up Button Size

The end-call button is currently `w-13 h-13 sm:w-16 sm:h-16` while other buttons are `w-11 h-11 sm:w-14 sm:h-14`. This makes it visually inconsistent.

**File:** `src/components/videocall/VideoCallControls.tsx`
- Change end-call button from `w-13 h-13 sm:w-16 sm:h-16` to `w-11 h-11 sm:w-14 sm:h-14` to match all other control buttons

## 5. Chat Mobile UX/UI Improvements

The chat page has layout issues on mobile -- the grid doesn't adapt well and elements can overflow.

**File:** `src/pages/Chat.tsx`
- Improve the height calculation for the chat container on mobile
- Ensure the sessions list and messages panel don't overflow horizontally

**File:** `src/components/chat/ChatMessagesPanel.tsx`
- Add `overflow-hidden` to prevent horizontal overflow on mobile
- Ensure input area respects safe-area insets properly

## 6. Improve Mobile Menu Sizes (Profile Dropdown & Language Switcher)

The dropdown menus for profile and language are too small for older adult users.

**File:** `src/components/layout/MainLayout.tsx`
- Increase `DropdownMenuContent` width from `w-56` to `w-64`
- Increase dropdown menu item padding and font sizes for touch friendliness
- Increase the profile avatar button touch target

**File:** `src/components/settings/LanguageSwitcher.tsx`
- Increase dropdown item sizes and touch targets (min 44px height per item)

## 7. Notifications Page Hardcoded Spanish Strings

Several strings in `Notifications.tsx` are hardcoded in Spanish.

**File:** `src/pages/Notifications.tsx`
- Replace "Cancelar" / "Seleccionar" / "Leidas" / "Seleccionar todas" / "Eliminar" with `t()` calls
- Add corresponding keys to both i18n files

## 8. Admin Panel UX - Back Navigation

Ensure all admin sub-pages have clear back arrows to return to the admin dashboard. Most already have them (like `AdminUsers.tsx`), but verify consistency.

**File:** `src/pages/AdminDashboard.tsx`
- Verify module cards are clearly clickable with visual affordance
- Add descriptive headers

## Technical Summary

| File | Changes |
|------|---------|
| `src/lib/i18n/es.ts` | Add `nav.doctors` + notification page keys |
| `src/lib/i18n/en.ts` | Add `nav.doctors` + notification page keys |
| `src/hooks/useNotifications.ts` | Fix infinite loading for visitors/unauthenticated users |
| `src/hooks/auth/useAuthActions.ts` | Fix logout: await signOut before redirect |
| `src/components/videocall/VideoCallControls.tsx` | Normalize hang-up button size |
| `src/pages/Chat.tsx` | Mobile layout improvements |
| `src/components/chat/ChatMessagesPanel.tsx` | Prevent horizontal overflow on mobile |
| `src/components/layout/MainLayout.tsx` | Increase dropdown menu sizes for accessibility |
| `src/components/settings/LanguageSwitcher.tsx` | Increase touch targets |
| `src/pages/Notifications.tsx` | Replace hardcoded Spanish with i18n keys |
