

# Plan: Marketplace Administrable + Hospital Locator Administrable + UX/UI Fixes

## Scope Summary

This is a large feature set with 3 main areas:
1. **Medical Supplies Marketplace** — Full e-commerce with admin CRUD, brand/vendor accounts, purchase flow
2. **Hospital Locator** — Admin CRUD, enhanced UX/UI with reviews/ratings/details
3. **UX/UI fixes** — Missing i18n keys, broken button styles, mobile bottom bar improvements

---

## Phase 1: Database Tables (Migrations)

### New tables needed:

**`hospitals`** — Admin-managed hospital directory
- `id`, `name`, `address`, `phone`, `website`, `type` (public/private/clinic), `level`, `specialties` (jsonb), `hours`, `zone`, `image_url`, `lat`, `lng`, `description`, `is_active`, `created_at`, `updated_at`
- RLS: Public SELECT where `is_active = true`, Admin ALL

**`hospital_reviews`** — User reviews for hospitals
- `id`, `hospital_id`, `user_id`, `rating` (1-5), `comment`, `created_at`
- RLS: Authenticated INSERT (own), Public SELECT

**`marketplace_vendors`** — Brands/companies selling products
- `id`, `user_id` (nullable, for self-service vendor accounts), `name`, `description`, `logo_url`, `website`, `phone`, `location`, `status` (pending/approved/rejected), `created_at`, `updated_at`
- RLS: Public SELECT where approved, vendor owner ALL on own, Admin ALL

**`marketplace_products`** — Products listed by vendors or admin
- `id`, `vendor_id`, `name`, `description`, `category`, `price` (numeric), `currency` (default MXN), `image_url`, `images` (jsonb array), `stock` (integer), `is_active`, `created_at`, `updated_at`
- RLS: Public SELECT where `is_active`, vendor owner CRUD on own products, Admin ALL

**`marketplace_orders`** — Purchase orders
- `id`, `buyer_id`, `product_id`, `vendor_id`, `quantity`, `total_amount`, `status` (pending/paid/shipped/delivered/cancelled), `shipping_address` (jsonb), `stripe_session_id`, `created_at`, `updated_at`
- RLS: Buyer SELECT own, Vendor SELECT for own products, Admin ALL

**`marketplace_categories`** — Admin-managed categories
- `id`, `name_es`, `name_en`, `icon`, `sort_order`, `is_active`
- RLS: Public SELECT, Admin ALL

### Seed data
- Migrate existing hardcoded hospitals (20) into the `hospitals` table
- Migrate existing hardcoded products/suppliers into `marketplace_vendors` and `marketplace_products`

---

## Phase 2: Admin Pages

### `src/pages/AdminHospitals.tsx` (NEW)
- Table listing all hospitals with search/filter
- Add/Edit modal with all fields (name, address, phone, website, type, level, specialties, zone, lat/lng, image upload, description)
- Toggle active/inactive
- Delete with confirmation
- View reviews per hospital

### `src/pages/AdminMarketplace.tsx` (NEW)
- Tabs: Products | Vendors | Categories | Orders
- **Products tab**: Table with product listing, add/edit/delete, image upload, category/vendor assignment
- **Vendors tab**: Approve/reject vendor applications, view vendor details
- **Categories tab**: CRUD for product categories with icon picker and sort order
- **Orders tab**: View all orders, update status (paid → shipped → delivered)

### Update `AdminDashboard.tsx`
- Add two new module cards under a new "Directorio y Marketplace" category:
  - "Hospitales y Clínicas" → `/admin/hospitals`
  - "Marketplace Material Médico" → `/admin/marketplace`

---

## Phase 3: Vendor Dashboard (NEW)

### `src/pages/VendorDashboard.tsx` (NEW)
- For brand accounts (role or flag-based), accessible after admin approval
- My Products: CRUD their own products with images, pricing, stock
- My Orders: See orders for their products, update shipping status
- Analytics: Sales count, revenue summary

### Vendor Registration Flow
- New "vendor" option accessible from the marketplace page for companies
- Registration form: company name, description, logo, website, contact
- Status: pending → admin approves → vendor can manage products

---

## Phase 4: Medical Supplies Marketplace UX/UI Rewrite

### `src/pages/MedicalSupplies.tsx` — Complete rewrite
**Current problems**: Hardcoded data, white-on-white button text, no purchase flow, basic layout

**New design**:
- Hero banner with marketplace branding
- Category navigation bar (horizontal scroll on mobile) with icons — data from `marketplace_categories`
- Product grid with improved cards:
  - Large product image with hover zoom
  - Price displayed prominently with currency
  - Vendor badge/logo
  - "Add to Cart" / "Buy Now" buttons with proper contrast (primary variant)
  - Stock indicator
- Product detail modal/page with:
  - Image gallery (multiple images)
  - Full description
  - Vendor info card
  - "Comprar" button → Stripe checkout or wallet
- Vendor directory tab with proper cards
- Search with debounce
- All data from Supabase (not hardcoded)

### Purchase Flow
- User clicks "Comprar" → Stripe Checkout session via edge function
- Edge function `create-marketplace-checkout` handles payment
- On success → creates order record
- Vendor sees order in their dashboard
- Admin can oversee all orders

---

## Phase 5: Hospital Locator UX/UI Rewrite

### `src/pages/HospitalLocator.tsx` — Data from DB
**Current problems**: Hardcoded data, "backHeader.medicalRecord" showing raw key, generic stock images

**New design**:
- Fetch hospitals from `hospitals` table
- Improved card design:
  - Larger images with gradient overlays
  - Star rating from reviews (average)
  - Review count badge
  - Specialties as colored chips
  - "Ver detalles" expandable section with description, doctors associated, full specialty list
  - Navigation buttons with proper styling (no white-on-white)
- Hospital detail view (modal or inline expand):
  - Photo gallery
  - Full description
  - All specialties listed
  - Reviews section with star display
  - "Write a review" for authenticated users
  - Direct links to Waze/Google Maps
- Admin can add/edit/delete from AdminHospitals page

---

## Phase 6: UX/UI Fixes

### Missing i18n keys
- Add `backHeader.medicalRecord` to es.ts → "Expediente Médico"
- Add `backHeader.medicalRecord` to en.ts → "Medical Record"
- Add `backHeader.hospitalLocator` → "Localiza un Hospital" / "Find a Hospital"
- Add `backHeader.medicalSupplies` → "Material Médico" / "Medical Supplies"
- Add entries for `/hospital-locator` and `/medical-supplies` in `MobileBackHeader.tsx` `PAGE_TITLE_KEYS`

### Button contrast fix
- In MedicalSupplies, ensure all buttons use `variant="default"` or explicit bg colors — no white text on white background

### Mobile bottom bar
- Review bottom tab bar rendering at 390px width — ensure icons are evenly spaced, text doesn't overflow, active state is clear

---

## Phase 7: Routing & Navigation

### New routes in `App.tsx`:
- `/admin/hospitals` → `AdminHospitals`
- `/admin/marketplace` → `AdminMarketplace`
- `/vendor/dashboard` → `VendorDashboard` (protected by vendor role/flag)

### Nav updates in `MainLayout.tsx`:
- Already has medical supplies for doctor/resident — no change needed
- Hospital locator already in nav — no change needed

---

## Files to create:
| File | Purpose |
|------|---------|
| `src/pages/AdminHospitals.tsx` | Admin CRUD for hospitals |
| `src/pages/AdminMarketplace.tsx` | Admin CRUD for products, vendors, categories, orders |
| `src/pages/VendorDashboard.tsx` | Vendor self-service product management |
| `supabase/functions/create-marketplace-checkout/index.ts` | Stripe checkout for product purchases |
| Migration SQL | 6 new tables + seed data |

## Files to modify:
| File | Change |
|------|--------|
| `src/pages/MedicalSupplies.tsx` | Full rewrite — DB-driven marketplace with purchase flow |
| `src/pages/HospitalLocator.tsx` | Full rewrite — DB-driven with reviews |
| `src/pages/AdminDashboard.tsx` | Add Hospital + Marketplace admin modules |
| `src/App.tsx` | New routes |
| `src/components/layout/MobileBackHeader.tsx` | Add missing page title keys |
| `src/lib/i18n/es.ts` | Add missing backHeader keys + marketplace/hospital i18n |
| `src/lib/i18n/en.ts` | Same |

---

## Implementation order:
1. DB migration (tables + seed)
2. i18n fixes + MobileBackHeader fixes (quick wins)
3. AdminHospitals + AdminMarketplace pages
4. HospitalLocator rewrite (DB-driven + reviews)
5. MedicalSupplies rewrite (DB-driven + purchase flow)
6. VendorDashboard + checkout edge function
7. Routing + AdminDashboard updates

