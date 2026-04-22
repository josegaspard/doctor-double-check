import React, { useRef, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

/**
 * E2E: Extended chat shortcut blocking when entitlement is missing.
 * Covers Enter, Ctrl+Enter, Cmd+Enter, paste (Ctrl+V), Ctrl+K, drop.
 * Shift+Enter must remain a newline (never blocked).
 */

interface HarnessProps {
  onSend: () => void;
  isGated: boolean;
  onPaywallOpen: () => void;
}

function ChatHarness({ onSend, isGated, onPaywallOpen }: HarnessProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  const handleSendIntercept = () => {
    if (isGated) {
      onPaywallOpen();
      return;
    }
    onSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.shiftKey) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendIntercept();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      if (isGated) {
        e.preventDefault();
        onPaywallOpen();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (isGated) {
      e.preventDefault();
      onPaywallOpen();
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLInputElement>) => {
    if (isGated) {
      e.preventDefault();
      onPaywallOpen();
    }
  };

  return (
    <input
      ref={inputRef}
      data-testid="chat-input"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onDrop={handleDrop}
      disabled={isGated}
    />
  );
}

describe('Chat shortcuts — blocked without entitlement', () => {
  it.each([
    ['Enter', { key: 'Enter' }],
    ['Ctrl+Enter', { key: 'Enter', ctrlKey: true }],
    ['Cmd+Enter', { key: 'Enter', metaKey: true }],
    ['Ctrl+K', { key: 'k', ctrlKey: true }],
    ['Cmd+K', { key: 'k', metaKey: true }],
  ])('blocks %s and opens paywall (no send)', (_label, eventInit) => {
    const onSend = vi.fn();
    const onPaywallOpen = vi.fn();
    const { getByTestId } = render(
      <ChatHarness onSend={onSend} isGated onPaywallOpen={onPaywallOpen} />
    );
    const input = getByTestId('chat-input');
    fireEvent.keyDown(input, eventInit);
    expect(onSend).not.toHaveBeenCalled();
    expect(onPaywallOpen).toHaveBeenCalledTimes(1);
  });

  it('blocks paste (Ctrl+V) and triggers paywall', () => {
    const onSend = vi.fn();
    const onPaywallOpen = vi.fn();
    const { getByTestId } = render(
      <ChatHarness onSend={onSend} isGated onPaywallOpen={onPaywallOpen} />
    );
    const input = getByTestId('chat-input') as HTMLInputElement;

    const event = new Event('paste', { bubbles: true, cancelable: true }) as any;
    event.clipboardData = { getData: () => 'pasted content' };
    fireEvent(input, event);

    expect(onPaywallOpen).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
    expect(input.value).toBe(''); // text never inserted
  });

  it('blocks drop (drag&drop) and triggers paywall', () => {
    const onSend = vi.fn();
    const onPaywallOpen = vi.fn();
    const { getByTestId } = render(
      <ChatHarness onSend={onSend} isGated onPaywallOpen={onPaywallOpen} />
    );
    const input = getByTestId('chat-input');
    fireEvent.drop(input);
    expect(onPaywallOpen).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('Shift+Enter is NOT blocked (allows newline)', () => {
    const onSend = vi.fn();
    const onPaywallOpen = vi.fn();
    const { getByTestId } = render(
      <ChatHarness onSend={onSend} isGated onPaywallOpen={onPaywallOpen} />
    );
    fireEvent.keyDown(getByTestId('chat-input'), { key: 'Enter', shiftKey: true });
    expect(onPaywallOpen).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('5 consecutive blocked shortcuts → onSend stays at 0, paywall opened 5x', () => {
    const onSend = vi.fn();
    const onPaywallOpen = vi.fn();
    const { getByTestId } = render(
      <ChatHarness onSend={onSend} isGated onPaywallOpen={onPaywallOpen} />
    );
    const input = getByTestId('chat-input');

    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
    fireEvent.keyDown(input, { key: 'k', ctrlKey: true });
    fireEvent.keyDown(input, { key: 'k', metaKey: true });

    expect(onSend).toHaveBeenCalledTimes(0);
    expect(onPaywallOpen).toHaveBeenCalledTimes(5);
  });

  it('with entitlement: Enter sends and Ctrl+K does NOT open paywall', () => {
    const onSend = vi.fn();
    const onPaywallOpen = vi.fn();
    const { getByTestId } = render(
      <ChatHarness onSend={onSend} isGated={false} onPaywallOpen={onPaywallOpen} />
    );
    const input = getByTestId('chat-input');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(input, { key: 'k', ctrlKey: true });
    expect(onPaywallOpen).not.toHaveBeenCalled();
  });
});
