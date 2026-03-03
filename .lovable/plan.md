
# Plan: Refund Flow + Analytics PDF + Invoice Accounting + Admin UX Overhaul

## 1. User Refund Request Flow (New Feature)

Currently refunds are admin-initiated only. Users have no way to request one.

**New DB table** `refund_requests`:
- `id`, `user_id`, `transaction_id`, `amount`, `reason` (text), `status` (pending/approved/rejected/processed), `admin_notes`, `created_at`, `reviewed_at`, `reviewed_by`
- RLS: users can INSERT their own, SELECT their own; admins can SELECT/UPDATE all

**Changes in `TransactionHistory.tsx`**:
- Add a "Solicitar reembolso" button on each purchase/topup transaction (in the detail dialog)
- Opens a small form: reason text + confirm
- Inserts into `refund_requests`
- Shows badge "Reembolso solicitado" on transactions that have a pending request

**Changes in `AdminRefunds.tsx`**:
- Add a new tab "Solicitudes" showing pending refund requests from users
- Each request shows: user info, original transaction, reason, amount
- Admin can approve (which triggers the existing `admin-refund` edge function) or reject with notes
- User gets notification on approval/rejection

---

## 2. Analytics with Real Data + PDF Export (`AdminAnalytics.tsx`)

**Problem**: The period selector (Week/Month/Year) doesn't actually filter data. Charts show only last 6 months hardcoded.

**Fixes**:
- Make period selector actually filter the date range for all queries
- Add more granular breakdown: consultations revenue, content purchases, subscription revenue as separate chart series
- Add a table view below charts with month-by-month rows showing all metrics

**PDF Export**:
- Add "Descargar PDF" button
- Use browser `window.print()` with a print-optimized hidden div containing all analytics data in table format
- Include: date range, all KPIs, revenue by month table, users by role, top doctors, revenue breakdown by type
- Apply `@media print` styles for clean output

---

## 3. Invoice Review for Accounting (`AdminInvoiceReview.tsx`)

**New features for accountants**:
- Period filter: date range picker (from/to) for filtering invoices by `period_start`/`period_end`
- Quick filters: "Este mes", "Mes anterior", "Esta semana", "Trimestre"
- Summary card showing: total invoiced amount, approved count, pending count for selected period
- **Excel export**: Generate CSV/Excel with columns: Invoice #, Doctor, RFC, Period, Amount, Status, Date, File URL
- **PDF export**: Print-optimized summary report with header, period, totals, and line items
- Group by doctor option for accountant view

---

## 4. Payout Settings UX (`AdminPayoutSettings.tsx`)

**Improvements**:
- Add info banner: "Los pagos automaticos solo aplican para doctores con cuenta Stripe Connect verificada. Los doctores sin Stripe deben pagarse manualmente."
- Better card layout with visual grouping
- Add preview of what the current settings mean (e.g., "Proximo pago automatico: Lunes 10 de Marzo")
- Mobile-optimized form fields

---

## 5. Admin Dashboard Modules UX (`AdminDashboard.tsx`)

**Improvements**:
- Better visual hierarchy: group modules into categories (Financiero, Usuarios, Contenido, Configuracion)
- Add colored left border to each card matching its icon color
- Add pending counts as badges on relevant modules (pending invoices, pending refund requests, pending verifications)
- Responsive: 1 column on mobile, 2 on tablet, 3 on desktop for modules

---

## 6. Admin Payouts Mobile UX (`AdminPayouts.tsx`)

**Mobile optimization**:
- Doctor cards: stack layout on mobile (avatar+name on top, badges below, amounts + buttons on separate row)
- Summary cards: 2x2 grid on mobile instead of 4-column
- Breakdown detail: full-width on mobile with scrollable transaction list
- Action buttons (Search, Select all, Pay, Delete) in a sticky bottom bar on mobile

---

## 7. Content Gallery Fix (`ContentGallery.tsx`)

**Problem**: ContentGallery queries `doctor_content` table which is for uploaded educational content. It already filters by `is_public = true` and does NOT include recordings (those are in the `recordings` table). The issue is likely that the data hasn't been properly cleaned.

**No code change needed** -- ContentGallery already only shows `doctor_content` items. If deleted content still appears, the user needs to delete from `doctor_content` table (which was addressed in the previous plan with DoctorUpload deletion tools).

---

## Files Summary

**New migration** (1):
- Create `refund_requests` table with RLS policies

**Files to modify** (6):
1. `src/components/wallet/TransactionHistory.tsx` -- Add "Request refund" button in detail dialog
2. `src/pages/AdminRefunds.tsx` -- Add "Solicitudes" tab for user refund requests
3. `src/pages/AdminAnalytics.tsx` -- Real data filtering by period + PDF export
4. `src/pages/AdminInvoiceReview.tsx` -- Accounting features: period filter, Excel/PDF export
5. `src/pages/AdminPayoutSettings.tsx` -- UX improvements + Stripe-only auto-payout banner
6. `src/pages/AdminDashboard.tsx` -- Module categories, badges, better grid
7. `src/pages/AdminPayouts.tsx` -- Mobile-optimized layout

---

## Technical Details

### refund_requests table
```sql
CREATE TABLE public.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transaction_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','processed')),
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
-- Users can create and view their own requests
CREATE POLICY "Users can insert own requests" ON public.refund_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own requests" ON public.refund_requests FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update requests" ON public.refund_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

### Excel Export (Invoice Review)
Uses a simple CSV generation function that creates a downloadable file with proper encoding for Spanish characters. Columns include all invoice fields plus the download URL for each PDF.

### PDF Export (Analytics)
Creates a hidden printable div with `@media print` CSS. Contains all tables and KPIs formatted for A4 paper. Triggered via `window.print()` with the print div set as the only visible content.

### Admin Dashboard Module Categories
```text
FINANCIERO: Analytics, Pagos a Doctores, Facturas, Config. Pagos, Reembolsos
USUARIOS: Usuarios, Doctores, Residentes, Verificaciones, Credenciales
CONTENIDO: Noticias, Config. Sitio
SOPORTE: Reportes
```
