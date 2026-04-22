import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DynamicWatermark } from '@/components/recordings/DynamicWatermark';

/**
 * E2E: DRM watermark renders on chat-replay video previews and on chat
 * message bubbles that carry video attachments. Each preview gets a unique
 * sessionId. Image attachments do NOT mount a watermark.
 */

function VideoPreviewHarness({
  email,
  userId,
  sessionId,
  testId,
}: {
  email: string;
  userId: string;
  sessionId?: string;
  testId: string;
}) {
  return (
    <div data-testid={testId} className="relative">
      <video src="https://example.com/v.mp4" controls />
      <DynamicWatermark email={email} userId={userId} sessionId={sessionId} />
    </div>
  );
}

function ImagePreviewHarness({ testId }: { testId: string }) {
  return (
    <div data-testid={testId} className="relative">
      <img src="https://example.com/img.jpg" alt="test" />
      {/* No watermark for image attachments */}
    </div>
  );
}

describe('DRM watermark on previews', () => {
  it('renders watermark on a video chat replay with email visible', () => {
    const { getByTestId, getAllByTestId } = render(
      <VideoPreviewHarness
        email="patient@test.local"
        userId="user-abc-123"
        sessionId="session-replay-1"
        testId="replay-video-preview"
      />
    );

    expect(getByTestId('replay-video-preview')).toBeTruthy();
    const watermarks = getAllByTestId('dynamic-watermark');
    expect(watermarks).toHaveLength(1);

    // Email is rendered inside the watermark
    expect(watermarks[0].textContent).toContain('patient@test.local');
    // sessionId data attribute is non-empty
    expect(watermarks[0].getAttribute('data-session-id')).toBeTruthy();
    expect(watermarks[0].getAttribute('data-session-id')).toBe('session-replay-1');
  });

  it('renders watermark on chat message bubble with video attachment', () => {
    const { getAllByTestId } = render(
      <VideoPreviewHarness
        email="user@test.local"
        userId="user-bubble-1"
        sessionId="session-bubble-1"
        testId="chat-video-attachment"
      />
    );
    const watermarks = getAllByTestId('dynamic-watermark');
    expect(watermarks).toHaveLength(1);
    expect(watermarks[0].getAttribute('data-session-id')).toBe('session-bubble-1');
  });

  it('renders 3 unique sessionIds when multiple previews are mounted simultaneously', () => {
    const { getAllByTestId } = render(
      <>
        <VideoPreviewHarness
          email="a@test.local"
          userId="u1"
          sessionId="sess-A"
          testId="v1"
        />
        <VideoPreviewHarness
          email="a@test.local"
          userId="u1"
          sessionId="sess-B"
          testId="v2"
        />
        <VideoPreviewHarness
          email="a@test.local"
          userId="u1"
          sessionId="sess-C"
          testId="v3"
        />
      </>
    );

    const watermarks = getAllByTestId('dynamic-watermark');
    expect(watermarks).toHaveLength(3);
    const ids = watermarks.map((w) => w.getAttribute('data-session-id'));
    expect(new Set(ids).size).toBe(3);
  });

  it('auto-generates a unique sessionId when none is provided', () => {
    const { getAllByTestId, rerender } = render(
      <VideoPreviewHarness email="x@test.local" userId="u" testId="v" />
    );
    const id1 = getAllByTestId('dynamic-watermark')[0].getAttribute('data-session-id');
    expect(id1).toBeTruthy();
    expect(id1!.length).toBeGreaterThan(4);

    rerender(<VideoPreviewHarness email="x@test.local" userId="u" testId="v" />);
    const id2 = getAllByTestId('dynamic-watermark')[0].getAttribute('data-session-id');
    // Same instance → memoized id stable across re-renders
    expect(id2).toBe(id1);
  });

  it('image attachments do NOT mount a watermark', () => {
    const { queryAllByTestId } = render(<ImagePreviewHarness testId="img-attach" />);
    expect(queryAllByTestId('dynamic-watermark')).toHaveLength(0);
  });
});
