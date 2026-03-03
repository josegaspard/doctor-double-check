
# Fix Console Warnings: PageLoader Ref + LivesProvider Timeout

## Issue 1: PageLoader ref warning
React's `Suspense` passes a ref to its `fallback` component. Since `PageLoader` is a plain function component, React warns that it cannot accept refs.

**Fix**: Convert `PageLoader` to use `React.forwardRef` in `src/App.tsx`:
```typescript
const PageLoader = React.forwardRef<HTMLDivElement>((_, ref) => (
  <div ref={ref} className="min-h-screen flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
));
PageLoader.displayName = 'PageLoader';
```

## Issue 2: LivesProvider safety timeout
Now that `LivesProvider` is inside `AuthenticatedProviders`, it only mounts for authenticated users. The 10-second safety timeout fires unnecessarily because `isLoading` starts as `true` and the async fetch sometimes takes a moment. 

**Fix** in `src/contexts/LivesContext.tsx`:
- Reduce safety timeout from 10s to 5s
- Ensure `setIsLoading(false)` is called in a `finally` block so it never gets stuck

## Issue 3: React dedupe in Vite
Add `resolve.dedupe` for `react`, `react-dom`, and `react/jsx-runtime` to `vite.config.ts` to prevent duplicate React instances that can cause spurious context/ref warnings.

## Files to modify (3)
1. `src/App.tsx` -- Convert `PageLoader` to `forwardRef`
2. `src/contexts/LivesContext.tsx` -- Fix safety timeout and ensure `finally` cleanup
3. `vite.config.ts` -- Add `resolve.dedupe`
