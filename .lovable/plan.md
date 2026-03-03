
# Fix White Screen Issue

## Root Cause
The app has **NO ErrorBoundary**. When any component throws during render (e.g., a null property access, a failed hook, or a provider crash), React's entire tree dies silently -- resulting in a completely white screen with no console output.

This is compounded by the `AuthenticatedProviders` pattern: when a user is logged in, 5 heavy providers (LivesProvider, WalletProvider, VaultProvider, ChatProvider, IncomingCallProvider) all mount at once. If ANY of them throws during render, the app crashes with no recovery.

## Plan (3 files)

### 1. Add ErrorBoundary component (`src/components/ErrorBoundary.tsx`) -- NEW FILE
Create a React class component ErrorBoundary that:
- Catches render errors and displays a friendly error screen instead of white screen
- Shows a "Reload" button to recover
- Logs the error to console for debugging
- In development, shows the error message for easier debugging

### 2. Wrap App with ErrorBoundary (`src/App.tsx`)
- Import and wrap the entire app tree with `<ErrorBoundary>`
- Also wrap `AuthenticatedProviders` children with a second ErrorBoundary so provider crashes don't kill the whole app

### 3. Add safety to `AuthenticatedProviders` (`src/App.tsx`)
- Wrap each provider group in the authenticated providers with error handling
- Ensure that if LivesProvider or any other provider crashes, the page still renders (just without that provider's data)

## Technical Details

**ErrorBoundary component:**
```typescript
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <FallbackUI onRetry={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}
```

**App.tsx changes:**
```tsx
const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider ...>
        <AuthProvider>
          <LanguageProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <ErrorBoundary>
                  <AuthenticatedProviders>
                    <Suspense fallback={<PageLoader />}>
                      <Routes>...</Routes>
                    </Suspense>
                  </AuthenticatedProviders>
                </ErrorBoundary>
              </BrowserRouter>
            </TooltipProvider>
          </LanguageProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);
```

This ensures that even if a crash occurs, the user sees an error message with a reload button instead of a blank white screen. The inner ErrorBoundary specifically catches provider/route crashes without taking down the entire app shell.
