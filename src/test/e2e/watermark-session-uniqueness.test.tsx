/**
 * Watermark sessionId uniqueness:
 * - Each mount of <DynamicWatermark> generates a unique sessionId
 * - Re-mount produces a different sessionId
 * - Multiple simultaneous players have distinct sessionIds
 * - Explicit sessionId prop is respected (no override)
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DynamicWatermark } from '@/components/recordings/DynamicWatermark';

describe('Watermark — sessionId uniqueness per session', () => {
  it('generates a sessionId on mount when none is provided', () => {
    const { getByTestId } = render(<DynamicWatermark email="a@b.com" userId="user-1" />);
    const wm = getByTestId('dynamic-watermark');
    const sid = wm.getAttribute('data-session-id');
    expect(sid).toBeTruthy();
    expect(sid!.length).toBeGreaterThan(5);
  });

  it('different mounts produce different sessionIds (proof of uniqueness)', () => {
    const { getByTestId, unmount } = render(
      <DynamicWatermark email="a@b.com" userId="user-1" />
    );
    const sid1 = getByTestId('dynamic-watermark').getAttribute('data-session-id');
    unmount();

    const { getByTestId: get2 } = render(
      <DynamicWatermark email="a@b.com" userId="user-1" />
    );
    const sid2 = get2('dynamic-watermark').getAttribute('data-session-id');

    expect(sid1).toBeTruthy();
    expect(sid2).toBeTruthy();
    expect(sid1).not.toBe(sid2);
  });

  it('three simultaneous players each have a unique sessionId', () => {
    const { getAllByTestId } = render(
      <>
        <DynamicWatermark email="a@b.com" userId="u1" />
        <DynamicWatermark email="a@b.com" userId="u1" />
        <DynamicWatermark email="a@b.com" userId="u1" />
      </>
    );
    const watermarks = getAllByTestId('dynamic-watermark');
    expect(watermarks).toHaveLength(3);
    const ids = watermarks.map((w) => w.getAttribute('data-session-id'));
    const uniq = new Set(ids);
    expect(uniq.size).toBe(3); // all distinct
  });

  it('respects an explicit sessionId prop (does not regenerate)', () => {
    const { getByTestId } = render(
      <DynamicWatermark email="a@b.com" userId="u1" sessionId="explicit-session-xyz" />
    );
    const wm = getByTestId('dynamic-watermark');
    expect(wm.getAttribute('data-session-id')).toBe('explicit-session-xyz');
  });

  it('renders the truncated sessionId visibly in the watermark text', () => {
    const { getByTestId } = render(
      <DynamicWatermark email="a@b.com" userId="user-12345" sessionId="abcdef-1234-5678" />
    );
    const sessionDisplay = getByTestId('watermark-session');
    // First 6 hex chars (no dashes) → "abcdef"
    expect(sessionDisplay.textContent).toBe('abcdef');
  });

  it('shows email and userId truncated to 8 chars in the watermark', () => {
    const { getByTestId } = render(
      <DynamicWatermark
        email="evidence@medical-masters.com"
        userId="abcdef12-3456-7890-abcd-ef1234567890"
      />
    );
    const wm = getByTestId('dynamic-watermark');
    expect(wm.textContent).toContain('evidence@medical-masters.com');
    expect(wm.textContent).toContain('abcdef12');
  });

  it('uses mix-blend-mode: difference for visibility on any background', () => {
    const { getByTestId } = render(
      <DynamicWatermark email="a@b.com" userId="u1" />
    );
    const wm = getByTestId('dynamic-watermark') as HTMLElement;
    expect(wm.style.mixBlendMode).toBe('difference');
  });

  it('starts at position index 0 (top-left rotation)', () => {
    const { getByTestId } = render(
      <DynamicWatermark email="a@b.com" userId="u1" />
    );
    const wm = getByTestId('dynamic-watermark');
    expect(wm.getAttribute('data-position-index')).toBe('0');
  });

  it('falls back to "anon" / "visitante" when no email or userId', () => {
    const { getByTestId } = render(<DynamicWatermark />);
    const wm = getByTestId('dynamic-watermark');
    expect(wm.textContent).toContain('visitante');
    expect(wm.textContent).toContain('anon');
  });
});
