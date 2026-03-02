

# Plan: Proximity Filter, Blog UX, Admin Reports Link, Password Reset, Google Branding, Mobile Live Fixes

## 1. Auto-filter doctors by proximity using real distance calculation

**Current issue**: When the user taps the map icon and grants location, doctors are only sorted by "has location vs doesn't" -- no actual distance calculation happens. Doctors in the same city appear in the same order as those far away.

**Fix in `src/pages/Doctors.tsx`**:
- Add a `haversineDistance(lat1, lng1, lat2, lng2)` utility function that calculates real km distance between two coordinates
- Create a simple geocoding map for known Mexican cities (e.g., "Ciudad de Mexico" -> lat/lng, "Guadalajara, Jalisco" -> lat/lng, etc.) to estimate doctor coordinates from their `location` text field
- When `nearbyMode` is active and `userLocation` is set, sort doctors by distance (nearest first)
- Add a "~X km" badge next to each doctor's location when in nearby mode
- Doctors without a recognizable location go to the bottom of the list

## 2. Improve blog article text styling + working share buttons

**Current issue**: The blog content uses `prose prose-sm sm:prose` which can look cramped. Share buttons exist for Facebook and X but WhatsApp is missing.

**Fix in `src/pages/NewsArticle.tsx`**:
- Upgrade prose classes to `prose prose-base sm:prose-lg` for better readability with more generous spacing
- Add custom prose overrides: `prose-headings:font-heading prose-headings:text-foreground prose-p:text-foreground/85 prose-p:leading-relaxed prose-li:text-foreground/85`
- Add WhatsApp share button: `https://wa.me/?text={encodedTitle}%20{encodedUrl}`
- Ensure Facebook opens: `https://www.facebook.com/sharer/sharer.php?u={url}` (already works)
- Ensure X/Twitter opens: `https://twitter.com/intent/tweet?url={url}&text={title}` (already works)

## 3. Add Reports module to Admin Dashboard

**Current issue**: The route `/admin/reports` exists and `AdminReports.tsx` works, but it is NOT listed in the `adminModules` array in `AdminDashboard.tsx`, so there's no card to click on from the admin panel.

**Fix in `src/pages/AdminDashboard.tsx`**:
- Add a `reports` entry to the `adminModules` array with icon `Flag`, href `/admin/reports`, color `text-destructive`
- Add localized labels: ES "Reportes y Reclamos" / "Gestiona reportes de usuarios y abuso", EN "Reports & Claims" / "Manage user reports and abuse"
- Import the `Flag` icon from lucide-react

**Where to find it**: After this change, the "Reportes y Reclamos" card will appear in the Admin Dashboard grid. Click it to go to `/admin/reports` where you can filter by status (Pendientes, Revisados, Resueltos, Descartados), review each report, add internal notes, and respond to the user via notification.

## 4. Resident test user

I cannot create database records directly, but I will provide you with a clear path:
- Go to the app's registration page (`/login`), switch to "Crear cuenta" tab
- Select role "Residente", fill in name, email, password, institution, specialty
- After email confirmation, go to Admin Dashboard -> "Validacion de Residentes" and approve the resident
- Alternatively, I can add a seed function or you can use the existing `seed-demo-users` edge function if it includes residents

## 5. Password reset flow verification

**Finding**: The flow is complete and should work:
- `handleForgotPassword` in Login.tsx calls `resetPasswordForEmail` with `redirectTo: origin/reset-password`
- `/reset-password` page exists, checks for session, and calls `updateUser({ password })`
- No missing pieces detected. The flow is: enter email -> receive email -> click link -> redirected to `/reset-password` -> enter new password -> success

No code changes needed here.

## 6. Google OAuth branding (Lovable logo)

**Finding**: The Google consent screen showing the Lovable logo is controlled by the managed Google OAuth credentials provided by Lovable Cloud. To show YOUR logo instead:

1. Go to [Google Cloud Console](https://console.cloud.google.com) and create a project
2. Configure the OAuth Consent Screen:
   - Set your app name ("Medical Masters")
   - Upload YOUR logo
   - Add authorized domains: `lovable.app` and your custom domain if any
   - Add scopes: `userinfo.email`, `userinfo.profile`, `openid`
3. Create OAuth 2.0 credentials (Web application type):
   - Add Authorized redirect URL from your Lovable Cloud Auth settings
4. In Lovable: Go to **Settings -> Connectors -> Lovable Cloud -> Authentication Settings -> Google** and enter your own Client ID and Client Secret

This is a configuration change, not a code change. The code already uses `lovable.auth.signInWithOAuth('google', ...)` which will automatically use your custom credentials once configured.

## 7. Mobile live streaming fullscreen + screen share on iPad + end live error

### 7a. Screen share: show on iPad/tablet, hide on phone

**Fix in `src/components/live/DailyVideoPlayer.tsx`**:
- The screen share button currently always shows for owners
- Add a check: detect if device is a phone (not tablet) using `navigator.maxTouchPoints` + screen width
- On phones (width < 768 and not iPad), hide the screen share button
- On iPads/tablets (width >= 768 or iPad user agent), keep the button visible

### 7b. Mobile live fullscreen already handled

The `LiveStreamView.tsx` mobile layout already uses `fixed inset-0 z-50 bg-black` with `height: 100dvh` and `DoctorGoLive.tsx` renders without MainLayout on mobile. The `DailyVideoPlayer` video element uses `object-cover` on mobile (from previous fix). This should already work correctly.

### 7c. "Error de conexion" when ending live from mobile

This was already addressed in the previous iteration with `isLeavingRef`. The `endRoom` call is wrapped in try-catch. However, there may be a remaining issue: the `LiveStreamView` mobile controls have a separate "Finalizar" button that calls `onEndClick` which sets `showEndDialog(true)`. The user confirms in the dialog, then `handleEndLive` runs. During this flow, Daily fires error events.

**Additional fix in `src/components/live/DailyVideoPlayer.tsx`**:
- Expose a method to set `isLeavingRef.current = true` before the parent calls endRoom
- Or: in `handleError`, also suppress errors when the `call` is in `leaving` state (`callRef.current?.meetingState() === 'leaving'`)

## Summary of code changes

| File | Change |
|------|--------|
| `src/pages/Doctors.tsx` | Add haversine distance calculation, city coordinate map, sort by real distance, show km badges |
| `src/pages/NewsArticle.tsx` | Improve prose typography, add WhatsApp share button |
| `src/pages/AdminDashboard.tsx` | Add "Reportes y Reclamos" module card with Flag icon |
| `src/components/live/DailyVideoPlayer.tsx` | Hide screen share on phones, show on tablets; suppress errors during leaving state |

