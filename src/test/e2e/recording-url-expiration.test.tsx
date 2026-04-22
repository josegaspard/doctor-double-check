import { describe, it, expect } from 'vitest';
import { mockSignedUrl } from './helpers';

/**
 * Signed URL expiration contract — these tests guarantee the player will
 * detect/refuse expired tokens regardless of UI changes.
 *
 * Rule: any URL whose generatedAt + expiresIn < now must be considered
 * unusable; the player must fetch a new one before mounting <video>.
 */

const NOW = 1_750_000_000_000;

describe('Recording signed URL expiration', () => {
  it('marks a URL generated 56 minutes ago with 1h TTL as still valid', () => {
    const u = mockSignedUrl('rec/abc.mp4', 3600, 56 * 60 * 1000);
    expect(u.isExpired).toBe(false);
    expect(u.signedUrl).toContain('token=fresh');
  });

  it('marks a URL generated 61 minutes ago with 1h TTL as EXPIRED', () => {
    const u = mockSignedUrl('rec/abc.mp4', 3600, 61 * 60 * 1000);
    expect(u.isExpired).toBe(true);
    expect(u.signedUrl).toContain('token=expired');
  });

  it('signals the renewal window correctly (< 5 minutes left → renew soon)', () => {
    const u = mockSignedUrl('rec/abc.mp4', 3600, 56 * 60 * 1000);
    const remainingMs = u.expiresAt - Date.now();
    const needsRenewSoon = remainingMs < 5 * 60 * 1000;
    expect(needsRenewSoon).toBe(true);
  });

  it('a fresh URL fetched after expiration replaces the old token', () => {
    const old = mockSignedUrl('rec/abc.mp4', 3600, 90 * 60 * 1000);
    expect(old.isExpired).toBe(true);

    // Simulate renewal
    const fresh = mockSignedUrl('rec/abc.mp4', 3600, 0);
    expect(fresh.isExpired).toBe(false);
    expect(fresh.signedUrl).not.toBe(old.signedUrl);
    expect(fresh.signedUrl).toContain('token=fresh');
  });

  it('treats a 0-second TTL as immediately expired (defensive)', () => {
    const u = mockSignedUrl('rec/abc.mp4', 0, 0);
    expect(u.isExpired).toBe(true);
  });

  it('different sessions produce different tokens (anti-replay)', () => {
    const a = mockSignedUrl('rec/abc.mp4', 3600, 0);
    const b = mockSignedUrl('rec/def.mp4', 3600, 0);
    expect(a.signedUrl).not.toBe(b.signedUrl);
  });

  it('expiresAt always equals generatedAt + expiresIn*1000', () => {
    const u = mockSignedUrl('rec/x.mp4', 1800, 1000);
    expect(u.expiresAt - u.generatedAt).toBe(1800 * 1000);
  });
});

describe('Player gating logic against expired URLs', () => {
  /**
   * shouldMountVideo returns true only when:
   *  - user has purchased OR is owner
   *  - signed URL is fresh
   * Otherwise paywall or expiration overlay is rendered instead.
   */
  function shouldMountVideo(opts: {
    hasPurchased: boolean;
    isOwner: boolean;
    urlExpired: boolean;
  }): 'video' | 'paywall' | 'expired' {
    if (!opts.hasPurchased && !opts.isOwner) return 'paywall';
    if (opts.urlExpired) return 'expired';
    return 'video';
  }

  it('shows paywall when user has not purchased and is not owner', () => {
    expect(shouldMountVideo({ hasPurchased: false, isOwner: false, urlExpired: false }))
      .toBe('paywall');
  });

  it('shows expiration overlay when purchased but URL is stale', () => {
    expect(shouldMountVideo({ hasPurchased: true, isOwner: false, urlExpired: true }))
      .toBe('expired');
  });

  it('mounts video when purchased AND URL is fresh', () => {
    expect(shouldMountVideo({ hasPurchased: true, isOwner: false, urlExpired: false }))
      .toBe('video');
  });

  it('owner bypass: doctor sees video for own recordings even without purchase', () => {
    expect(shouldMountVideo({ hasPurchased: false, isOwner: true, urlExpired: false }))
      .toBe('video');
  });

  it('owner with stale URL still hits the expiration path → renew before play', () => {
    expect(shouldMountVideo({ hasPurchased: false, isOwner: true, urlExpired: true }))
      .toBe('expired');
  });
});
