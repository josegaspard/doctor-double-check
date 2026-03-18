

# Plan: Optimize Recording Loading Speed

## Problem
When opening a recording, the user sees multiple sequential loading states: "Cargando grabación..." → "Verificando acceso..." → spinner in player (edge function call). Three sequential async operations create unnecessary delay.

## Root Causes

1. **Sequential DB queries**: Recording fetch and purchase check run one after the other, but they're independent
2. **Unnecessary edge function call**: For non-pending Cloudflare videos (UID already resolved), the player calls `get-cloudflare-playback` edge function just to construct a URL that can be built client-side: `https://customer-subdomain/${uid}/manifest/video.m3u8`
3. **Two separate loading screens**: Page shows "loading recording" then "checking access" as distinct phases

## Changes

### 1. `src/pages/RecordingPlayer.tsx` — Parallelize DB queries
- Run recording fetch AND purchase check simultaneously using `Promise.all` instead of two separate `useEffect` hooks
- Show a single loading state instead of two sequential ones
- Pass the recording data directly to eliminate the wait between phases

### 2. `src/components/recordings/CloudflareRecordingPlayer.tsx` — Skip edge function for ready videos
- If `videoUrl` is a plain UID (not `pending:*`), construct the HLS URL directly on the client: `https://customer-3afz9zesalmyroc9.cloudflarestream.com/${videoUrl}/manifest/video.m3u8`
- Only call the edge function for `pending:` videos that need resolution
- This eliminates an entire network round-trip (edge function cold start + Cloudflare API call) for the majority of recordings

### Technical Details

```text
BEFORE (sequential):
  DB: fetch recording ──→ DB: fetch doctor ──→ DB: check purchase ──→ Edge fn: get-cloudflare-playback ──→ HLS init
  ~200ms                  ~200ms               ~200ms                 ~500-1500ms                          ~300ms
  Total: ~1.4-2.4s

AFTER (parallel + skip edge fn):
  DB: fetch recording + doctor + purchase (parallel) ──→ HLS init (direct URL)
  ~250ms                                                 ~300ms
  Total: ~550ms
```

### Files to Modify
- `src/pages/RecordingPlayer.tsx` — merge loading into single parallel fetch
- `src/components/recordings/CloudflareRecordingPlayer.tsx` — direct URL construction for ready UIDs

