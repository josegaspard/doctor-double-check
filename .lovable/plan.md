

# Plan: Final Polish — Complete E-Commerce Flow, UX/UI Fixes, Navigation Cleanup

## Issues Found

1. **Missing i18n key `nav.myOrders`** — nav item shows raw key. Need to add to both `es.ts` and `en.ts`
2. **`myOrders` in top header nav** — user wants it removed from header and accessible only from doctor dashboard panel / "More" mobile menu (it's currently in `navItems` array which shows in desktop header)
3. **Waze button hover: white text on white** — the outline variant hover turns white-on-white. Need explicit hover colors
4. **Desktop nav items too many / overflow** — text-size too small and items don't fit. Need to reduce items shown in desktop nav (move less critical ones to user menu only) or further compress
5. **`canvas-confetti` may not be installed** — OrderSuccess imports it

## Changes

### 1. i18n — Add `myOrders` key
**Files:** `src/lib/i18n/es.ts`, `src/lib/i18n/en.ts`
- Add `myOrders: 'Mis Compras'` (es) and `myOrders: 'My Orders'` (en) to the `nav` section

### 2. Navigation — Remove `myOrders` and `medicalSupplies` from top header nav
**File:** `src/components/layout/MainLayout.tsx`

The `navItems` array includes both `medicalSupplies` and `myOrders` which crowd the desktop header. Remove `myOrders` from `navItems` (it stays accessible via "More" sheet on mobile and doctor dashboard). Keep `medicalSupplies` but consider hiding from desktop nav too since it's niche — or move both to the "More" drawer only.

Approach: Remove `myOrders` entry from `navItems` array entirely. Instead, add it as a direct link in the "More" sheet under the account section for doctor/resident roles. The user explicitly said "no quiero un item de compras en el header" — remove from desktop header nav.

Also reduce icon sizes and spacing in desktop nav to prevent overflow: already at `text-[10px]` and `px-1`, which is near minimum. Remove `upload` from navItems too (it's a doctor-only action accessible from dashboard). This reduces clutter.

### 3. Hospital Locator — Fix Waze button hover
**File:** `src/pages/HospitalLocator.tsx` (line 578)

Change Waze button from:
```
variant="outline" className="flex-1 text-xs gap-1.5 h-8 border-blue-200 text-blue-700 hover:bg-blue-50"
```
To add explicit hover text color:
```
className="flex-1 text-xs gap-1.5 h-8 border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 hover:text-blue-800"
```
Remove `variant="outline"` and use explicit classes to prevent theme override.

### 4. Install `canvas-confetti` if missing
Run `npm install canvas-confetti` and `npm install -D @types/canvas-confetti`

### 5. Desktop nav — shrink further
**File:** `src/components/layout/MainLayout.tsx`
- Remove `myOrders` and `upload` from `navItems`
- Keep essential items only: Lives, Contenido Premium, Doctores, Chat, Reuniones, Expediente, Hospital, Panel, Admin
- This drops 3 items and should fit comfortably

### 6. Verify all e-commerce flow pieces are complete

Already confirmed present:
- ✅ Quantity selector in MedicalSupplies (line 47: `quantity` state, +/- stepper)
- ✅ Shipping dialog before checkout
- ✅ OrderSuccess thank-you page with confetti
- ✅ MyOrders page with timeline, filters, search
- ✅ Admin OrdersTab with tracking, status change, CSV export
- ✅ Admin SalesTab with revenue analytics and charts
- ✅ Stripe webhook handles `marketplace_purchase`
- ✅ send-purchase-email handles purchase/shipped/delivered types
- ✅ Admin status change triggers email notifications
- ✅ Route `/order-success` in App.tsx
- ✅ Route `/my-orders` in App.tsx
- ✅ checkout `success_url` points to `/order-success`

---

## Technical Summary

| # | What | Files |
|---|------|-------|
| 1 | Add `myOrders` i18n key | `es.ts`, `en.ts` |
| 2 | Remove myOrders + upload from header nav | `MainLayout.tsx` |
| 3 | Fix Waze button hover colors | `HospitalLocator.tsx` |
| 4 | Install canvas-confetti | `package.json` |
| 5 | Verify e-commerce completeness | Audit only, no changes needed |

