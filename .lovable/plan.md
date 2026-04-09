

# Plan: Hospital Locator Filter UX + Marketplace Full Purchase Flow + Medical Supplies Filters

## 1. Hospital Locator — Filter Sidebar UX/UI Polish

**File:** `src/pages/HospitalLocator.tsx`

**Changes to FilterPanel:**
- **Rating buttons**: Add proper grid layout (`grid grid-cols-5 gap-1.5`) so all 5 buttons (Todo, 3+, 3.5+, 4+, 4.5+) are evenly spaced and aligned
- **Sort buttons**: Use `grid grid-cols-3 gap-2` instead of `flex gap-2` so Cercanía/Calificación/Nombre are uniform width and don't squish text
- **Spacing**: Increase `space-y-5` to `space-y-6` between sections; add subtle dividers (`<hr>`) between filter groups
- **Visual hierarchy**: Use slightly larger section labels (text-[11px] instead of text-xs), add bottom border separators
- **Selected state**: Make selected buttons more prominent with a ring/border effect instead of just background color change
- **Distance slider**: Add tick marks at 10, 25, 50, 75, 100km
- **Overall sidebar**: Slightly wider (w-60 instead of w-56), more padding (p-5)

---

## 2. Marketplace Full Purchase Flow — End-to-End

This is the biggest piece. Currently: checkout creates a Stripe session + pending order, but after payment **nothing happens** (webhook doesn't handle marketplace). We need:

### 2a. DB Migration — Add shipping/tracking fields + notifications table

- Add columns to `marketplace_orders`: `shipping_name`, `shipping_phone`, `shipping_city`, `shipping_notes`, `tracking_number`, `estimated_delivery`, `delivery_fee`, `paid_at`, `shipped_at`, `delivered_at`
- Create `marketplace_notifications` table for order status change emails/notifications

### 2b. Stripe Webhook — Handle marketplace purchase completion

**File:** `supabase/functions/stripe-webhook/index.ts`

- Add handler in `checkout.session.completed` for marketplace orders (detect by `metadata.product_id` presence and no `type` field, or add `type: 'marketplace_purchase'` to the checkout metadata)
- Update `create-marketplace-checkout` to add `type: 'marketplace_purchase'` to metadata
- On payment: update order status to `paid`, set `paid_at`, send purchase confirmation email, notify admin

### 2c. Shipping Address Collection — Pre-purchase dialog

**File:** `src/pages/MedicalSupplies.tsx`

- Before calling checkout, show a shipping address dialog: name, phone, address, city, state, zip, delivery notes
- Calculate delivery fee based on city (simple table: same city = free or $X, different city = $Y)
- Pass shipping info to the checkout edge function, which stores it in the order

### 2d. User Orders Page — `/my-orders`

**New file:** `src/pages/MyOrders.tsx`

- List all user's marketplace orders with status badges (Pendiente, Pagado, Enviado, Entregado, Cancelado)
- Each order shows: product image/name, quantity, total, date, status timeline
- Expandable details: shipping address, tracking number (if available)
- Route added to App.tsx

### 2e. Admin Orders Panel Enhancement

**File:** `src/pages/AdminMarketplace.tsx` (OrdersTab)

- Add filters: by status, date range, product, vendor
- Add order detail view: buyer info, shipping address, product details
- Add tracking number input, estimated delivery date
- Add export to CSV
- Show totals/revenue summary at top
- Status change triggers email notification to buyer

### 2f. Purchase Confirmation Email

**File:** `supabase/functions/send-purchase-email/index.ts` (already exists)

- Update to accept marketplace-specific data (product name, shipping address, order ID)
- Add status update email templates (shipped, delivered)

### 2g. Admin Notifications

- When a new order is placed, create a notification for admin users
- Show order count badge in AdminDashboard marketplace card

---

## 3. Medical Supplies — Advanced Filters

**File:** `src/pages/MedicalSupplies.tsx`

**Add filter sidebar (desktop) + Sheet (mobile) matching Hospital Locator pattern:**
- **Price range**: Min/Max inputs or a dual-thumb slider
- **Vendor/Brand**: Multi-select or dropdown of all vendors
- **Category**: Already exists but move to sidebar for consistency
- **Sort by**: Price (low→high, high→low), Name, Newest, Featured
- **In stock only**: Toggle
- **Active filter chips**: Show removable badges for each active filter (mobile)
- **Filter button with count badge** on mobile (Sheet trigger)

---

## Technical Summary

| # | What | Files |
|---|------|-------|
| 1 | Hospital filter sidebar UX polish | `HospitalLocator.tsx` |
| 2a | DB: order shipping fields + notifications | New migration |
| 2b | Stripe webhook: marketplace handler + update checkout metadata | `stripe-webhook/index.ts`, `create-marketplace-checkout/index.ts` |
| 2c | Shipping address dialog before purchase | `MedicalSupplies.tsx` |
| 2d | User orders page `/my-orders` | New `MyOrders.tsx` + `App.tsx` route |
| 2e | Admin orders panel with filters, tracking, export | `AdminMarketplace.tsx` |
| 2f | Purchase + status email updates | `send-purchase-email/index.ts` |
| 2g | Admin notification on new order | `AdminDashboard.tsx` stats |
| 3 | Medical Supplies filter sidebar + sort | `MedicalSupplies.tsx` |

