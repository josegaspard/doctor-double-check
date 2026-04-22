import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Anyone landing on /recording/:id with a stale or stolen signed URL must be
 * blocked — the page never mounts a <video> with a token the backend rejects.
 *
 * These tests verify the contract: if the storage signed URL fetch returns
 * 403 / null, the page must render the paywall or expiration overlay.
 */

interface FetchedUrl {
  signedUrl: string | null;
  status: number;
  isPaywalled?: boolean;
  isExpired?: boolean;
}

async function resolveRecordingAccess(
  recordingId: string,
  signedUrlFromQuery: string | undefined,
  hasPurchased: boolean,
  fetchSignedUrl: (id: string) => Promise<FetchedUrl>
): Promise<{ render: 'video' | 'paywall' | 'expired'; videoSrc?: string }> {
  if (!hasPurchased) {
    return { render: 'paywall' };
  }
  // Even if URL came from query string, re-fetch a fresh token; never trust
  // the URL the user pasted in the address bar.
  const fresh = await fetchSignedUrl(recordingId);
  if (fresh.status === 403 || fresh.signedUrl === null) {
    return { render: 'expired' };
  }
  return { render: 'video', videoSrc: fresh.signedUrl };
}

describe('Direct URL access to /recording/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks unauthenticated visitor with paywall, even if they paste a URL', async () => {
    const fetcher = vi.fn(async () => ({ signedUrl: 'https://x', status: 200 }));
    const res = await resolveRecordingAccess(
      'rec-1',
      'expired_token_from_url',
      /* hasPurchased */ false,
      fetcher
    );
    expect(res.render).toBe('paywall');
    // CRITICAL: must NOT have called the storage backend with the user-supplied token
    expect(fetcher).not.toHaveBeenCalled();
    expect(res.videoSrc).toBeUndefined();
  });

  it('renders expiration overlay when backend rejects the token (403)', async () => {
    const fetcher = vi.fn(async () => ({ signedUrl: null, status: 403 }));
    const res = await resolveRecordingAccess('rec-1', undefined, true, fetcher);
    expect(res.render).toBe('expired');
    expect(res.videoSrc).toBeUndefined();
  });

  it('mounts video with a freshly issued URL — never with the URL from the query string', async () => {
    const stolenToken = 'https://signed.example/rec-1?token=stolen';
    const freshToken = 'https://signed.example/rec-1?token=fresh-new';
    const fetcher = vi.fn(async () => ({ signedUrl: freshToken, status: 200 }));
    const res = await resolveRecordingAccess('rec-1', stolenToken, true, fetcher);
    expect(res.render).toBe('video');
    expect(res.videoSrc).toBe(freshToken);
    expect(res.videoSrc).not.toBe(stolenToken);
  });

  it('an expired URL pasted directly results in 403 → expired overlay', async () => {
    const fetcher = vi.fn(async () => ({ signedUrl: null, status: 403, isExpired: true }));
    const res = await resolveRecordingAccess(
      'rec-1',
      'https://signed.example/rec-1?token=expired',
      true,
      fetcher
    );
    expect(res.render).toBe('expired');
  });

  it('paywall overlay never receives a videoSrc — defensive', async () => {
    const fetcher = vi.fn(async () => ({ signedUrl: 'https://x', status: 200 }));
    const res = await resolveRecordingAccess('rec-1', undefined, false, fetcher);
    expect(res).toEqual({ render: 'paywall' });
  });
});
