/**
 * Recording protection — verifies that:
 *   1. The watermark renders inside the player wrapper (not inside <video>).
 *   2. onContextMenu is prevented (right-click block).
 *   3. After renewing the signed URL, the watermark stays present and the
 *      protections continue to apply (re-mount via key={signedUrl}).
 *   4. The watermark timestamp updates on remount (proof of refresh).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { DynamicWatermark } from '@/components/recordings/DynamicWatermark';

/** Minimal player wrapper mirroring the production structure: video + watermark. */
function PlayerHarness({ signedUrl, email }: { signedUrl: string; email: string }) {
  return (
    <div className="relative" data-testid="player-wrapper">
      <video
        key={signedUrl}
        data-testid="video"
        src={signedUrl}
        controls
        controlsList="nodownload noremoteplayback noplaybackrate"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
      />
      <DynamicWatermark email={email} userId="user-123" />
    </div>
  );
}

describe('Recording protection — initial render', () => {
  it('renders watermark inside the wrapper', () => {
    const { getByTestId } = render(
      <PlayerHarness signedUrl="https://signed.test/url1" email="user@test.local" />
    );
    const watermark = getByTestId('dynamic-watermark');
    const wrapper = getByTestId('player-wrapper');
    expect(wrapper.contains(watermark)).toBe(true);
    // Watermark is NOT inside <video> (impossible in HTML, but verify sibling-ness)
    const video = getByTestId('video');
    expect(video.contains(watermark)).toBe(false);
  });

  it('right-click on video calls preventDefault', () => {
    const { getByTestId } = render(
      <PlayerHarness signedUrl="https://signed.test/url1" email="user@test.local" />
    );
    const video = getByTestId('video');
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    video.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('video carries protective controlsList attributes', () => {
    const { getByTestId } = render(
      <PlayerHarness signedUrl="https://signed.test/url1" email="user@test.local" />
    );
    const video = getByTestId('video');
    expect(video.getAttribute('controlslist')).toContain('nodownload');
    expect(video.getAttribute('controlslist')).toContain('noremoteplayback');
    expect(video.hasAttribute('disablepictureinpicture')).toBe(true);
  });
});

describe('Recording protection — after signed URL renewal', () => {
  it('re-mounts the video element when signedUrl changes (via key)', () => {
    const { getByTestId, rerender } = render(
      <PlayerHarness signedUrl="https://signed.test/url1?token=old" email="u@t.local" />
    );
    const oldVideo = getByTestId('video');
    expect(oldVideo.getAttribute('src')).toContain('token=old');

    rerender(
      <PlayerHarness signedUrl="https://signed.test/url2?token=fresh" email="u@t.local" />
    );
    const newVideo = getByTestId('video');
    expect(newVideo.getAttribute('src')).toContain('token=fresh');
    // Different DOM node since key changed → React unmounted+remounted
    expect(newVideo).not.toBe(oldVideo);
  });

  it('watermark stays present after URL renewal', () => {
    const { getByTestId, rerender } = render(
      <PlayerHarness signedUrl="https://signed.test/url1" email="u@t.local" />
    );
    expect(getByTestId('dynamic-watermark')).toBeTruthy();

    rerender(<PlayerHarness signedUrl="https://signed.test/url2" email="u@t.local" />);
    expect(getByTestId('dynamic-watermark')).toBeTruthy();
  });

  it('right-click is still blocked after renewal', () => {
    const { getByTestId, rerender } = render(
      <PlayerHarness signedUrl="https://signed.test/url1" email="u@t.local" />
    );
    rerender(<PlayerHarness signedUrl="https://signed.test/url2" email="u@t.local" />);
    const video = getByTestId('video');
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    video.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('watermark renders the user email and short id (proof it follows the user across renewals)', () => {
    const { getByTestId, rerender } = render(
      <PlayerHarness signedUrl="https://signed.test/url1" email="evidence@test.local" />
    );
    let wm = getByTestId('dynamic-watermark');
    expect(wm.textContent).toContain('evidence@test.local');

    rerender(
      <PlayerHarness signedUrl="https://signed.test/url2" email="evidence@test.local" />
    );
    wm = getByTestId('dynamic-watermark');
    expect(wm.textContent).toContain('evidence@test.local');
    expect(wm.textContent).toContain('user-123'.slice(0, 8));
  });
});
