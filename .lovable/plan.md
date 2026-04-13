

# Plan: Final Polish — Missing "Mis Compras" Link + Minor UX Gaps

## Audit Summary

After a thorough review, the system is **95% complete**. All core flows are implemented:

- ✅ E-commerce: quantity selector, shipping dialog, Stripe checkout, webhook handler, email notifications
- ✅ Thank You page (`/order-success`) with confetti
- ✅ MyOrders page with timeline, filters, search
- ✅ Admin OrdersTab with tracking, status change, CSV export, email triggers
- ✅ Admin SalesTab with revenue analytics, vendor breakdown, charts
- ✅ Hospital Locator with filters, sort, Waze/Maps buttons (hover fixed)
- ✅ Medical Supplies with filters sidebar, price range, vendor filter
- ✅ Security: All scan findings reviewed and resolved/ignored
- ✅ Capacitor config for native app export
- ✅ i18n keys present
- ✅ canvas-confetti installed
- ✅ Routes registered in App.tsx

## Issues Found (3 items)

### 1. "Mis Compras" NOT accessible from mobile "More" sheet
The user explicitly asked for this to be accessible from the mobile menu. Currently it's **only** accessible from the MedicalSupplies hero button. It needs to appear in the "More" sheet for doctor/resident roles.

**File:** `src/components/layout/MainLayout.tsx` (~line 666)
- Add a `<Link to="/my-orders">` with `ShoppingBag` icon in the "Cuenta" section of the More sheet, for `role === 'doctor' || role === 'resident'`

### 2. "Mis Compras" NOT in DoctorDashboard quick actions
The user said it should be accessible from the doctor's panel. Add a quick action link.

**File:** `src/components/doctor/DoctorQuickActions.tsx`
- Add a "Mis Compras" quick action button that navigates to `/my-orders`

### 3. Admin OrdersTab: email trigger on status change needs buyer email lookup
Currently in `AdminMarketplace.tsx`, the status change function calls `send-purchase-email` but needs to fetch the buyer's email and name from profiles. Let me verify this is handled.

**File:** `src/pages/AdminMarketplace.tsx` — verify the `handleStatusChange` function fetches buyer profile data before sending email.

---

## Technical Summary

| # | What | File |
|---|------|------|
| 1 | Add "Mis Compras" to mobile More sheet | `MainLayout.tsx` |
| 2 | Add "Mis Compras" to DoctorQuickActions | `DoctorQuickActions.tsx` |
| 3 | Verify admin email trigger has buyer data | `AdminMarketplace.tsx` |

These are 3 small surgical fixes. Everything else is complete and production-ready.

