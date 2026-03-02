

# Plan: Performance Optimization + Prescription Deletion for All Roles

## 1. Allow all roles to delete prescriptions (not just doctors)

**Problem**: In `PrescriptionsList.tsx` line 201, `canManage` is hardcoded to `role === 'doctor'`. Patients cannot delete their own prescriptions even though RLS already allows doctors to delete (but not patients).

**Changes needed**:

### Database Migration
Add an RLS policy so patients can delete their own prescriptions:
```sql
CREATE POLICY "Patients can delete own prescriptions"
ON public.prescriptions FOR DELETE
USING (auth.uid() = patient_id);
```

### Code Change: `src/components/prescriptions/PrescriptionsList.tsx`
- Change `const canManage = role === 'doctor';` to `const canManage = role === 'doctor' || role === 'patient' || role === 'resident';` (line 201)
- For patients, the delete query already uses `.in('id', ids)` which will work because RLS will scope it to their own prescriptions

---

## 2. Performance Optimizations

### 2a. Lazy-load Google Fonts (index.css)
**Problem**: Line 16 of `index.css` uses `@import url(...)` for Google Fonts which blocks CSS rendering.

**Fix**: Move font loading to `index.html` using `<link rel="preconnect">` and `<link rel="stylesheet">` with `display=swap` already included. Remove the `@import` from CSS.

### 2b. Defer heavy global contexts for unauthenticated users
**Problem**: `WalletProvider`, `LivesProvider`, `VaultProvider`, `ChatProvider`, `PostConsultationRatingProvider`, and `IncomingCallProvider` all mount at the root in `App.tsx`, even for unauthenticated visitors on the Landing page. Each context runs `useEffect` with database queries on mount.

**Fix**: Create a wrapper component `AuthenticatedProviders` that only renders `WalletProvider`, `VaultProvider`, `ChatProvider`, `PostConsultationRatingProvider`, and `IncomingCallProvider` when the user is authenticated. `LivesProvider` stays global since `/lives` is public.

### 2c. Optimize Landing page background blobs
**Problem**: Three large `animate-pulse` divs with `blur-3xl` filters are always rendered (lines 74-78 of `Landing.tsx`), consuming GPU resources on mobile devices.

**Fix**: Add `will-change: transform` and reduce blur on mobile via responsive classes. Use `motion.div` with `reducedMotion` or simpler CSS animation.

### 2d. Image lazy loading
**Problem**: Avatar images and thumbnails across the app don't consistently use `loading="lazy"`. LivesGrid line 46 already has it, but MainLayout logos and other components don't.

**Fix**: Add `loading="lazy"` and `decoding="async"` attributes to non-critical images throughout the app (doctor avatars, content thumbnails, etc.)

### 2e. Memoize MainLayout navigation
**Problem**: `MainLayout` recalculates `filteredNavItems`, `bottomTabs`, and `moreNavItems` on every render. The `useChat()` call inside an IIFE on lines 165-176 also runs every render.

**Fix**: Wrap these computations in `useMemo`. Move the chat unread count into a proper `useMemo` instead of an IIFE.

---

## Summary of Changes

| # | Task | Files |
|---|------|-------|
| 1 | Prescription deletion for all roles | DB migration + `PrescriptionsList.tsx` |
| 2a | Move Google Fonts to HTML preconnect | `index.html` + `src/index.css` |
| 2b | Defer contexts for unauthenticated users | `src/App.tsx` |
| 2c | Optimize Landing page blobs for mobile | `src/pages/Landing.tsx` |
| 2d | Add lazy loading to images | Multiple components |
| 2e | Memoize MainLayout computations | `src/components/layout/MainLayout.tsx` |

### Technical Details

**Prescription RLS**: Adding `FOR DELETE USING (auth.uid() = patient_id)` allows patients to delete only their own prescriptions. Residents who somehow have prescriptions (edge case) would need a similar policy if relevant.

**Font Preconnect** (index.html):
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap" />
```

**Deferred Providers** (App.tsx):
```typescript
function AuthenticatedProviders({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <>{children}</>;
  return (
    <WalletProvider>
      <VaultProvider>
        <ChatProvider>
          <PostConsultationRatingProvider>
            <IncomingCallProvider>
              {children}
            </IncomingCallProvider>
          </PostConsultationRatingProvider>
        </ChatProvider>
      </VaultProvider>
    </WalletProvider>
  );
}
```

