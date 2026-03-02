

# Plan: Mobile Navigation "More" Menu + Back/Close Buttons + OTP SMS Options

## 1. Replace last bottom tab with "More" menu (all roles)

Currently the bottom nav shows only 5 fixed tabs per role, losing access to many features. The fix: replace the last tab with a "More" (Mas) button that opens a bottom Sheet/Drawer containing ALL remaining menu items for each role.

### Bottom tab layout per role (4 fixed + 1 "More"):

**Doctor:**
- En Vivo | Chat | Doctores | Dashboard | **Mas**

**Patient:**
- En Vivo | Chat | Doctores | Notificaciones | **Mas**

**Resident:**
- En Vivo | Doctores | Notificaciones | Perfil | **Mas**

**Admin:**
- En Vivo | Doctores | Notificaciones | Admin | **Mas**

### "More" Sheet contents (role-filtered):
A full-screen bottom Sheet styled like social media apps (Instagram/TikTok "more" menu) containing:
- All nav items not in the bottom bar (Recordings, Content, News, Vault, Prescriptions, Upload, Availability, etc.)
- Profile, Wallet, Settings, Logout
- Close button (X) at top-right corner
- User info card at top (name, email, role badge)

### Changes to `src/components/layout/MainLayout.tsx`:
- Modify `getBottomTabs()` to return only 4 items (remove last item)
- Add a 5th "More" button with `MoreHorizontal` icon that opens a Sheet
- Sheet contains all `filteredNavItems` not in bottom tabs, plus Profile/Wallet/Settings/Logout
- Sheet has prominent X close button at top-right

## 2. Add back arrow / close button to all internal pages

Add a reusable back navigation header to the MainLayout or as a pattern across pages. On mobile, every internal page should show:
- A left-aligned back arrow (ChevronLeft or ArrowLeft) that calls `navigate(-1)`
- Pages that are modals/overlays show an X instead

### Implementation:
- Create a `MobileBackHeader` component that renders only on mobile (`sm:hidden`)
- It shows: Back arrow + page title
- Add it to MainLayout as an optional element based on route depth (not on root tabs like /lives, /chat, /doctors)
- Use `useLocation` to determine if current page is a "detail" page (contains /:id, or is a sub-route like /doctor/dashboard)

### Changes:
- New component: `src/components/layout/MobileBackHeader.tsx`
- Update `MainLayout.tsx` to include it above `{children}` on non-root routes

## 3. OTP / SMS Delivery Options

The current OTP system works via email (Resend) + in-app notification. For SMS delivery, here are the options:

### Option A: Twilio (most popular, has free trial)
- Free trial gives $15 USD credit (~500 SMS)
- Requires: Account SID, Auth Token, and a Twilio phone number
- Cost after trial: ~$0.0079/SMS to Mexico

### Option B: Keep current system (email + in-app notification)
- Already working with Resend
- No additional cost
- Patient sees OTP in their notification bell and email

### Recommendation:
Since the OTP is already delivered via email AND in-app notification (which the patient can see immediately in their app), SMS may not be necessary. However, if you want SMS, Twilio is the best option. I will ask which approach you prefer.

## Summary of code changes

| File | Change |
|------|--------|
| `src/components/layout/MainLayout.tsx` | Replace 5th bottom tab with "More" Sheet containing all menu items; add close X button |
| `src/components/layout/MobileBackHeader.tsx` | New component: back arrow for internal pages on mobile |
| `src/components/layout/MainLayout.tsx` | Integrate MobileBackHeader above children |

## Technical details

### MobileBackHeader component:
```text
+------------------------------------------+
| <-- Back          Page Title          (X) |
+------------------------------------------+
```
- Uses `useNavigate(-1)` for back
- Only renders on mobile (hidden sm:)
- Detects "root" routes (/lives, /chat, /doctors, /notifications, /profile, /admin) to hide itself

### "More" Sheet:
```text
+------------------------------------------+
|  Medical Masters               [X Close] |
|  ----------------------------------------|
|  [Avatar] Dr. Juan Perez                 |
|  doctor@email.com        Badge: Doctor   |
|  ----------------------------------------|
|  Grabaciones                             |
|  Contenido                               |
|  Noticias                                |
|  Recetas                                 |
|  Vault                                   |
|  Disponibilidad                          |
|  Subir contenido                         |
|  ----------------------------------------|
|  Mi Perfil                               |
|  Wallet ($150)                           |
|  Configuracion                           |
|  ----------------------------------------|
|  [Cerrar sesion]                         |
+------------------------------------------+
```

