import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { HoverPlayCard } from '@/components/recordings/HoverPlayCard';

// crypto.randomUUID polyfill — generates predictable but unique ids
let __seq = 0;
beforeEach(() => {
  __seq = 0;
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
    __seq += 1;
    return `uuid-${__seq}-xxxx-xxxx-xxxx-xxxxxxxxxxxx` as `${string}-${string}-${string}-${string}-${string}`;
  });
});

describe('HoverPlayCard — DRM watermark on hover-play previews', () => {
  it('with hover-play DISABLED (unpurchased): no video, no watermark, only static poster', () => {
    render(
      <HoverPlayCard
        recordingId="rec-1"
        thumbnailUrl="https://example.com/poster.jpg"
        previewClipUrl="https://example.com/clip.mp4"
        alt="Recording 1"
        enableHoverPlay={false}
        userEmail="user@test.local"
        userId="user-1"
      />
    );

    const card = screen.getByTestId('hover-play-card-rec-1');
    expect(card).toBeInTheDocument();
    expect(card.getAttribute('data-hover-play-enabled')).toBe('false');

    // Hover should be a no-op for watermark mounting
    fireEvent.mouseEnter(card);
    expect(screen.queryByTestId('hover-play-video-rec-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dynamic-watermark')).not.toBeInTheDocument();
  });

  it('with hover-play ENABLED but NOT hovering: poster only — no watermark', () => {
    render(
      <HoverPlayCard
        recordingId="rec-2"
        thumbnailUrl="https://example.com/poster.jpg"
        previewClipUrl="https://example.com/clip.mp4"
        alt="Recording 2"
        enableHoverPlay={true}
        userEmail="user@test.local"
        userId="user-1"
      />
    );

    expect(screen.queryByTestId('hover-play-video-rec-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dynamic-watermark')).not.toBeInTheDocument();
  });

  it('with hover-play ENABLED + hovering: mounts video + DynamicWatermark with stable previewSessionId', () => {
    render(
      <HoverPlayCard
        recordingId="rec-3"
        thumbnailUrl="https://example.com/poster.jpg"
        previewClipUrl="https://example.com/clip.mp4"
        alt="Recording 3"
        enableHoverPlay={true}
        userEmail="user@test.local"
        userId="user-1"
      />
    );

    const card = screen.getByTestId('hover-play-card-rec-3');
    fireEvent.mouseEnter(card);

    expect(screen.getByTestId('hover-play-video-rec-3')).toBeInTheDocument();
    const wm = screen.getByTestId('dynamic-watermark');
    expect(wm).toBeInTheDocument();
    expect(wm.getAttribute('data-session-id')).toMatch(/^uuid-1-/);
  });

  it('mouseLeave unmounts video AND watermark', () => {
    render(
      <HoverPlayCard
        recordingId="rec-4"
        thumbnailUrl="https://example.com/poster.jpg"
        previewClipUrl="https://example.com/clip.mp4"
        alt="Recording 4"
        enableHoverPlay={true}
        userEmail="user@test.local"
        userId="user-1"
      />
    );

    const card = screen.getByTestId('hover-play-card-rec-4');
    fireEvent.mouseEnter(card);
    expect(screen.getByTestId('hover-play-video-rec-4')).toBeInTheDocument();
    expect(screen.getByTestId('dynamic-watermark')).toBeInTheDocument();

    fireEvent.mouseLeave(card);
    expect(screen.queryByTestId('hover-play-video-rec-4')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dynamic-watermark')).not.toBeInTheDocument();
  });

  it('re-hovering the SAME card reuses the same previewSessionId (useMemo per recordingId)', () => {
    render(
      <HoverPlayCard
        recordingId="rec-5"
        thumbnailUrl="https://example.com/poster.jpg"
        previewClipUrl="https://example.com/clip.mp4"
        alt="Recording 5"
        enableHoverPlay={true}
        userEmail="user@test.local"
        userId="user-1"
      />
    );

    const card = screen.getByTestId('hover-play-card-rec-5');

    fireEvent.mouseEnter(card);
    const firstId = screen.getByTestId('dynamic-watermark').getAttribute('data-session-id');
    fireEvent.mouseLeave(card);

    fireEvent.mouseEnter(card);
    const secondId = screen.getByTestId('dynamic-watermark').getAttribute('data-session-id');

    expect(firstId).toBeTruthy();
    expect(secondId).toBe(firstId);
  });

  it('hovering 3 different cards yields 3 unique sessionIds (no leak across cards)', () => {
    const { rerender } = render(
      <>
        <HoverPlayCard
          recordingId="rec-A"
          thumbnailUrl=""
          previewClipUrl="https://example.com/A.mp4"
          alt="A"
          enableHoverPlay={true}
          userEmail="u@test"
          userId="user-1"
        />
        <HoverPlayCard
          recordingId="rec-B"
          thumbnailUrl=""
          previewClipUrl="https://example.com/B.mp4"
          alt="B"
          enableHoverPlay={true}
          userEmail="u@test"
          userId="user-1"
        />
        <HoverPlayCard
          recordingId="rec-C"
          thumbnailUrl=""
          previewClipUrl="https://example.com/C.mp4"
          alt="C"
          enableHoverPlay={true}
          userEmail="u@test"
          userId="user-1"
        />
      </>
    );

    fireEvent.mouseEnter(screen.getByTestId('hover-play-card-rec-A'));
    fireEvent.mouseEnter(screen.getByTestId('hover-play-card-rec-B'));
    fireEvent.mouseEnter(screen.getByTestId('hover-play-card-rec-C'));

    const watermarks = screen.getAllByTestId('dynamic-watermark');
    expect(watermarks).toHaveLength(3);
    const ids = watermarks.map((w) => w.getAttribute('data-session-id'));
    expect(new Set(ids).size).toBe(3);
  });

  it('previewClipUrl missing: hover does NOT mount video or watermark even if enabled', () => {
    render(
      <HoverPlayCard
        recordingId="rec-no-clip"
        thumbnailUrl="https://example.com/poster.jpg"
        alt="No clip"
        enableHoverPlay={true}
        userEmail="user@test"
        userId="user-1"
      />
    );

    fireEvent.mouseEnter(screen.getByTestId('hover-play-card-rec-no-clip'));
    expect(screen.queryByTestId('hover-play-video-rec-no-clip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dynamic-watermark')).not.toBeInTheDocument();
  });

  it('watermark contains the user email truncated and shortId for forensic traceability', () => {
    render(
      <HoverPlayCard
        recordingId="rec-trace"
        thumbnailUrl=""
        previewClipUrl="https://example.com/x.mp4"
        alt="Trace"
        enableHoverPlay={true}
        userEmail="forensic@example.com"
        userId="abcd1234-5678-90ab-cdef-1234567890ab"
      />
    );

    fireEvent.mouseEnter(screen.getByTestId('hover-play-card-rec-trace'));
    const wm = screen.getByTestId('dynamic-watermark');
    expect(wm.textContent).toContain('forensic@example.com');
    expect(wm.textContent).toContain('abcd1234');
  });

  it('static poster (img tag) is rendered immediately on mount, before any hover', () => {
    render(
      <HoverPlayCard
        recordingId="rec-poster"
        thumbnailUrl="https://example.com/static-poster.jpg"
        previewClipUrl="https://example.com/clip.mp4"
        alt="Poster"
        enableHoverPlay={true}
      />
    );

    const img = screen.getByAltText('Poster') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe('https://example.com/static-poster.jpg');
    // No watermark before hover
    expect(screen.queryByTestId('dynamic-watermark')).not.toBeInTheDocument();
  });
});
