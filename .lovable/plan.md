

# Plan: Fix Language Icon Visibility on Login & Fix Settings Verification Route

## Issue 1: Language switcher invisible on Login/Register header
The `LanguageSwitcher` component uses `variant="ghost"` with default text color. On the dark header background, the icon is invisible until hovered. Need to add light text styling.

### Fix in `src/pages/Login.tsx` (line 197)
- Wrap `LanguageSwitcher` or modify the component call to pass a className for light-colored icon
- Since `LanguageSwitcher` renders a `Button variant="ghost"`, the simplest fix is to wrap it in a div with `text-dark-foreground` class, or add a className prop to LanguageSwitcher's button

### Fix in `src/components/settings/LanguageSwitcher.tsx`
- Accept an optional `className` prop and pass it to the Button so the Login page can style it for dark backgrounds

## Issue 2: Settings navigates to wrong route
The Settings page navigates to `/identity-verification` but the actual route is `/verify-identity`.

### Fix in `src/pages/Settings.tsx` (line 335)
- Change `navigate('/identity-verification')` → `navigate('/verify-identity')`

## Files to Modify
1. `src/components/settings/LanguageSwitcher.tsx` — accept className prop
2. `src/pages/Login.tsx` — pass `className="text-dark-foreground"` to LanguageSwitcher
3. `src/pages/Settings.tsx` — fix route path

