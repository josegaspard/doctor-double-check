
# Plan: Header UX/UI Optimization — Fix Nav Items Truncation + Search Bar Width

## Problem Analysis
From the screenshot, the header has too many nav items and the search bar (`min-w-[150px]`) takes too much space on medium screens (md breakpoint ~1024px), causing nav items like "Recetas" and "Pa..." to be cut off.

## Solution

### 1. GlobalSearch.tsx — Reduce Desktop Width + Icon-Only on md
**Current:** `hidden lg:flex ... min-w-[150px] xl:min-w-[180px]`  
**Fix:** Change to icon-only button on `md-lg` screens, only show full search bar on `xl+`

```tsx
// Current trigger (desktop)
className="hidden lg:flex items-center gap-2 h-8 px-3 ... min-w-[150px] xl:min-w-[180px]"

// Change to: Icon only on md-xl, full bar only on 2xl
- Button icon: `hidden md:flex xl:hidden` (shows search icon on md/lg)
- Full bar: `hidden xl:flex min-w-[120px] 2xl:min-w-[160px]`
```

### 2. MainLayout.tsx — Reduce Nav Item Padding + Hide More Icons
**Current:** `px-1.5 lg:px-2 xl:px-2.5` and `text-[10px] lg:text-[11px] xl:text-xs`

**Fix:**
- Reduce padding: `px-1 lg:px-1.5 xl:px-2`
- Hide icons completely on md/lg (not just xl): `hidden 2xl:block`
- Reduce gap between items: `gap-px` only

### 3. Right Side Items — Tighter Spacing
- Reduce wallet button size on md screens
- Hide user name completely on screens < xl

## Files to Modify

1. **`src/components/search/GlobalSearch.tsx`**
   - Icon-only trigger for `md` to `xl` screens
   - Full search bar only on `xl+` with reduced width (`min-w-[120px]`)

2. **`src/components/layout/MainLayout.tsx`**
   - Reduce nav item padding to `px-1 lg:px-1.5 xl:px-2`
   - Hide nav icons except on `2xl+`
   - Wallet button: compact on md, icon-only option
