

# Fix: Live Chat Scrolling the Entire Page

## Problem
In `src/components/live/LiveChat.tsx`, line 94 uses `messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })`. The `scrollIntoView` API scrolls **all ancestor scrollable containers**, including the browser window. This causes the entire page to jump down whenever:
- A viewer joins and messages load
- Anyone sends a chat message
- A realtime message arrives from the doctor or another viewer

## Solution
Replace `scrollIntoView` with direct `scrollTop` manipulation on the chat's `ScrollArea` viewport element. This keeps auto-scroll contained entirely within the chat panel.

## Changes

### File: `src/components/live/LiveChat.tsx`

1. Add a ref to the ScrollArea component to access its viewport
2. Replace the auto-scroll effect (lines 92-95) to find the Radix ScrollArea viewport child and set `scrollTop = scrollHeight` instead of calling `scrollIntoView`
3. Remove the now-unnecessary `messagesEndRef` div

**Before:**
```typescript
const messagesEndRef = useRef<HTMLDivElement>(null);

// Auto-scroll to bottom
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);
```

**After:**
```typescript
const scrollAreaRef = useRef<HTMLDivElement>(null);

// Auto-scroll to bottom (contained within chat panel only)
useEffect(() => {
  const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
  if (viewport) {
    viewport.scrollTop = viewport.scrollHeight;
  }
}, [messages]);
```

This is a minimal, surgical fix -- no other live functionality is affected. The chat will still auto-scroll to the latest message, but only inside its own container.

