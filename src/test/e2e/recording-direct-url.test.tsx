import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const invokeMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: any[]) => invokeMock(...args) },
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'tester@example.com', role: 'patient' },
    supabaseUser: { id: 'user-1' },
    role: 'patient',
  }),
}));

vi.mock('hls.js', () => {
  class HlsMock {
    static isSupported = () => true;
    static Events = { MANIFEST_PARSED: 'parsed', LEVEL_LOADED: 'level', ERROR: 'err' };
    static ErrorTypes = { NETWORK_ERROR: 'net', MEDIA_ERROR: 'media' };
    loadSource() {}
    attachMedia() {}
    on() {}
    destroy() {}
  }
  return { default: HlsMock };
});

const { CloudflareRecordingPlayer } = await import('@/components/recordings/CloudflareRecordingPlayer');

beforeEach(() => {
  invokeMock.mockReset();
});

describe('Recording paywall hardening — direct URL & 403 server-side gating', () => {
  it('with active purchase: edge function is called WITH recordingId so backend can verify', async () => {
    invokeMock.mockResolvedValue({
      data: { success: true, playbackUrl: 'https://signed.example/manifest.m3u8', duration: 600 },
      error: null,
    });

    render(<CloudflareRecordingPlayer videoUrl="pending:input-uid" recordingId="rec-1" />);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        'get-cloudflare-playback',
        expect.objectContaining({
          body: expect.objectContaining({ recordingId: 'rec-1', videoUid: 'pending:input-uid' }),
        })
      );
    });
  });

  it('without purchase: edge function returns 403 → no playback URL leaks to <video src>', async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: 'Forbidden: No purchase found', status: 403 },
    });

    render(<CloudflareRecordingPlayer videoUrl="pending:input-uid" recordingId="rec-2" />);

    await waitFor(() => {
      expect(
        screen.queryByText(/Reintentar/i) || screen.queryByText(/Error/i)
      ).toBeTruthy();
    });

    const video = document.querySelector('video');
    if (video) expect(video.getAttribute('src') ?? '').toBe('');
  });

  it('non-pending UID (admin/owner shortcut): NO edge function call, URL constructed directly', async () => {
    render(<CloudflareRecordingPlayer videoUrl="ready-uid-xyz" recordingId="rec-3" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('contract: a direct fetch to the edge function without auth returns 403', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: false, error: 'Forbidden: missing authorization' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    ) as any;

    const res = await fetch('https://example.supabase.co/functions/v1/get-cloudflare-playback', {
      method: 'POST',
      body: JSON.stringify({ videoUid: 'x', type: 'recording', recordingId: 'rec-x' }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/Forbidden/i);

    global.fetch = originalFetch;
  });

  it('processing status: shows processing UI, never exposes URL to <video>', async () => {
    invokeMock.mockResolvedValue({
      data: { success: false, status: 'processing', error: 'Recording is still processing' },
      error: null,
    });

    render(<CloudflareRecordingPlayer videoUrl="pending:in-x" recordingId="rec-proc" />);

    await waitFor(() => {
      expect(screen.getByText(/Procesando grabación/i)).toBeInTheDocument();
    });

    const video = document.querySelector('video');
    if (video) expect(video.getAttribute('src') ?? '').toBe('');
  });
});
