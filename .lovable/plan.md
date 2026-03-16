

# Plan: Push notifications on identity verification status change

## What changes

### 1. Update `supabase/functions/veriff-webhook/index.ts`

After the existing email notification block (~line 133-142), add push notification logic directly in the webhook (no need to call `send-push-notification` which is auth-gated and designed for doctor→subscriber use).

The webhook already has `supabase` client with service role key. Add:

1. Import `web-push` at the top (same pattern as `send-push-notification`)
2. After the email notification `try/catch`, add a new block that:
   - Reads VAPID keys from env
   - Configures `webpush.setVapidDetails`
   - Queries `push_subscriptions` for the user (`existingRecord.user_id`)
   - Sends a push with status-appropriate title/body:
     - **verified**: "✅ Identidad verificada" / "Tu identidad ha sido verificada exitosamente"
     - **failed**: "❌ Verificación fallida" / "Tu verificación de identidad no fue aprobada. Puedes intentarlo de nuevo."
     - **in_progress**: skip push (intermediate state)
   - Cleans up expired subscriptions (410/404)
   - Notification data includes `{ url: '/verify-identity' }`

### 2. Update `public/sw.js`

The service worker already handles `data.url` in the `notificationclick` handler, so no changes needed there.

### Files to modify
- **`supabase/functions/veriff-webhook/index.ts`** — add web-push import and push notification block after email notification

Single file change. No database migrations needed.

