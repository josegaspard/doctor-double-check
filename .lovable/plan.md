

# Plan: Complete E-Commerce Flow Overhaul — MyOrders, Admin Sales Dashboard, Quantity Selector, Thank You Page, Status Emails, Navigation

## Current State
- Basic purchase flow exists: MedicalSupplies → shipping dialog → Stripe → webhook updates order to "paid"
- MyOrders page exists but is minimal (expandable cards, basic timeline)
- AdminMarketplace OrdersTab is bare (list with status dropdown, no analytics/tracking/export)
- Quantity is hardcoded to 1 in `startPurchase`
- No Thank You page — Stripe redirects to `/my-orders?success=true` but nothing handles the query param
- Emails exist (purchase, shipped, delivered) but admin status change doesn't trigger them
- No sales analytics/accounting dashboard for admin
- MyOrders not accessible from mobile nav or sidebar — only from MedicalSupplies page

---

## Changes

### 1. Quantity Selector in Product Detail + Shipping Dialog
**File:** `src/pages/MedicalSupplies.tsx`

- Add `quantity` state, initialized to 1
- In product detail dialog: add +/- stepper with stock limit
- In shipping dialog: show quantity × price subtotal + delivery fee line
- Pass quantity to `create-marketplace-checkout`
- Update `create-marketplace-checkout/index.ts` — already accepts quantity, just verify stock check uses it

### 2. Thank You Page
**New file:** `src/pages/OrderSuccess.tsx`

- Beautiful full-page confirmation with green checkmark animation
- Shows order summary (pulled from `?session_id` query param or latest order)
- "Ver mis pedidos" and "Seguir comprando" buttons
- Confetti/celebration animation on mount
- Add route `/order-success` to `App.tsx`
- Update `create-marketplace-checkout` success_url to `/order-success?session_id={CHECKOUT_SESSION_ID}`

### 3. MyOrders Page — Full Redesign (Shopify/WooCommerce style)
**File:** `src/pages/MyOrders.tsx` (rewrite)

- **Header**: Summary stats (total orders, total spent, active orders count)
- **Filters**: Status tabs (Todos, Pendiente, Pagado, Enviado, Entregado), search by product name, date sort
- **Order cards**: Larger product images, clear order number (#ORD-XXXX), quantity, unit price × qty, subtotal + delivery, order date, status badge with color
- **Expanded view**: Visual step timeline (connected dots with lines, filled/unfilled), shipping address card, tracking with copy button, timestamps, "Contactar soporte" link
- **Empty state**: Illustration + CTA to marketplace
- **Mobile-first**: Full-width cards, touch-friendly expand, sticky filter tabs

### 4. Admin Sales Dashboard & Order Management
**File:** `src/pages/AdminMarketplace.tsx` — Enhance OrdersTab + add new SalesTab

**OrdersTab enhancements:**
- Top summary cards: Total Revenue, Orders Today, Pending Orders, Average Order Value
- Filters: status dropdown, date range (from/to), search by buyer/product, vendor filter
- Order detail expansion: buyer info (name, email, phone), shipping address, product details, status timeline
- Tracking number input + estimated delivery date picker
- Status change button that also triggers email notification to buyer
- CSV export button (all orders or filtered)
- Bulk status update for selected orders

**New "Ventas" (Sales/Accounting) tab:**
- Revenue summary cards: Total sales (MXN), units sold, unique buyers, avg order value
- Sales by vendor breakdown table
- Sales by product ranking (top 10)
- Sales by status (pie/donut chart or simple table)
- Monthly/weekly revenue trend (simple bar chart using recharts)
- Date range filter for all analytics
- Export full accounting report as CSV

### 5. Status Change Emails — Wire admin actions to email triggers
**File:** `src/pages/AdminMarketplace.tsx`

- When admin changes order status to "shipped": call `send-purchase-email` with `type: 'shipped'`, include tracking number
- When admin changes to "delivered": call `send-purchase-email` with `type: 'delivered'`
- Add toast confirmation after email sent
- The edge function `send-purchase-email` already handles these email types

### 6. Navigation — Add MyOrders access point
**Files:** `src/components/layout/MainLayout.tsx`

- Add "Mis Compras" to the sidebar nav items for roles `['doctor', 'resident']` (same roles that see medical supplies)
- On mobile: add it as an item in the "More" menu/drawer
- Also keep the existing button in MedicalSupplies hero

### 7. Edge Function Updates
**File:** `supabase/functions/create-marketplace-checkout/index.ts`
- Update `success_url` to `/order-success?session_id={CHECKOUT_SESSION_ID}`

---

## Technical Summary

| # | What | Files |
|---|------|-------|
| 1 | Quantity selector in product detail + shipping | `MedicalSupplies.tsx` |
| 2 | Thank You page with order confirmation | New `OrderSuccess.tsx` + `App.tsx` route |
| 3 | MyOrders full redesign (Shopify-style) | `MyOrders.tsx` (rewrite) |
| 4 | Admin sales dashboard + enhanced order mgmt | `AdminMarketplace.tsx` |
| 5 | Status change triggers email | `AdminMarketplace.tsx` (invoke send-purchase-email) |
| 6 | Nav: add MyOrders to sidebar | `MainLayout.tsx` |
| 7 | Update checkout success_url | `create-marketplace-checkout/index.ts` |

