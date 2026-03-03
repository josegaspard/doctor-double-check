

# Diagnosis: Chat Scroll Jumps the Whole Page

## What's Happening

When you send a message, `ChatMessagesPanel` (line 79-81) calls:
```js
messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
```

`scrollIntoView` without `block: 'nearest'` scrolls **all ancestor containers** (including the page itself) to make the element visible. So the entire page jumps down, not just the chat scroll area.

The same pattern exists in `LiveChat.tsx` (line 92) and `VideoCallChat.tsx` (line 27).

## Fix

**Only modify `src/components/chat/ChatMessagesPanel.tsx`** — add `block: 'nearest'` to constrain scrolling to the chat container only:

```js
messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
```

This single parameter change prevents the outer page from scrolling while keeping the auto-scroll-to-bottom behavior inside the chat.

**No changes to LiveChat or VideoCallChat** as requested — those files stay untouched.

## Files to modify
- `src/components/chat/ChatMessagesPanel.tsx` — line 81, add `block: 'nearest'`

