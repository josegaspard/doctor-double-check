

# Fix: Live Chat Scroll Jumping the Page

Same root cause as the regular chat — `scrollIntoView` without `block: 'nearest'` scrolls the entire page.

## Change

**File: `src/components/live/LiveChat.tsx`** — line 94

Change:
```js
messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
```
To:
```js
messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
```

No other files touched. No live streaming logic modified.

