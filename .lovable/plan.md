

# Fix: Remove empty gap next to Premium button

## Problem
When subscribed, `SubscribeButton` wraps its content in its own `<div className="flex items-center gap-2">` (line 161). Inside the parent `flex-1 min-w-0` container in `DoctorProfile.tsx`, this inner div doesn't stretch to fill the space — creating a visible gap.

## Solution

**`src/pages/DoctorProfile.tsx` (lines 616-635)**

Change from `flex` with `flex-1` to a **3-column grid** that guarantees equal sizing with no gaps:

```tsx
<div className="grid grid-cols-[1fr_1fr_auto] gap-2">
  <SubscribeButton ... className="w-full" />
  <Button variant="outline" size="sm" className="w-full gap-1.5" ...>
    <Video /> Ver Lives
  </Button>
  <BlockUserButton size="icon" ... />
</div>
```

This ensures:
- Subscribe and Ver Lives each take equal space (1fr)
- Block icon gets only the space it needs (auto)
- No empty gaps regardless of subscription state

**`src/components/subscriptions/SubscribeButton.tsx`**

Add `className` prop support and pass `w-full` to the outer container so it fills the grid cell. Ensure both the subscribed and unsubscribed states render a single button that accepts `className`.

## Files
1. `src/pages/DoctorProfile.tsx` — Switch to `grid-cols-[1fr_1fr_auto]`
2. `src/components/subscriptions/SubscribeButton.tsx` — Accept and forward `className` prop to fill container

