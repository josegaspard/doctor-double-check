

# Plan: Fix Hover Text Issue + Advertising Phase 2

## 1. Fix: White Text on Hover (Badge + Cards)

### Root Cause
The `Badge` component's `default` variant has `hover:bg-primary/80` which changes background opacity on hover, making white text less visible. This affects all cards across the app that use default badges inside `group` containers.

### Fix in `src/components/ui/badge.tsx`
- Remove `hover:bg-primary/80` from the default variant (badges inside cards shouldn't change color on card hover)
- Remove `hover:bg-secondary/80` and `hover:bg-destructive/80` from their respective variants for consistency
- These badges are informational labels, not interactive buttons -- hover effects are unnecessary

### Fix in `src/pages/ContentGallery.tsx`
- On the card element (line 538), the `group` class combined with `group-hover:scale-105` on the thumbnail image is fine, but ensure no text color changes happen on hover

## 2. Advertising Phase 2: Creative Upload Wizard, Analytics, Export

### A. Creative Upload in `AdvertiserDashboard.tsx`
- Add a "Subir Creativos" section per campaign that shows:
  - Required dimensions per placement (from `ad_placements`)
  - File upload with drag-and-drop for images/GIFs/videos
  - Upload to `ad-creatives` storage bucket
  - Insert record into `ad_creatives` table
  - Preview of uploaded creative with click URL input
  - Max file size indicator from `ad_config.max_file_size_kb`
- Add a "Pagar" button per campaign that calls `create-ad-checkout` edge function
- Add real-time performance charts using Recharts (impressions/clicks over time, grouped by day)
- Add CSV/PDF export buttons for campaign data

### B. Enhanced Analytics in `AdminAds.tsx`
- **Dashboard tab**: Add a Recharts line/bar chart showing impressions + clicks per day (last 30 days)
- Add revenue per month chart
- Add "Export" buttons for CSV and PDF on the dashboard and campaigns tabs
- Campaign detail: show per-creative performance breakdown

### C. Export Utility
- Create a shared export helper that converts table data to CSV (downloadable) and PDF (using browser print or a simple table layout)
- Used by both admin and advertiser dashboards

### D. Creative Management in `AdminAds.tsx`
- In the campaigns tab, add ability to view creatives per campaign
- Toggle creative active/inactive status

## Files to Modify
- `src/components/ui/badge.tsx` -- remove hover color changes
- `src/pages/AdvertiserDashboard.tsx` -- add creative upload, payment, charts, export
- `src/pages/AdminAds.tsx` -- add charts, export, creative management
- `src/hooks/useAds.ts` -- add helper to fetch daily event stats

