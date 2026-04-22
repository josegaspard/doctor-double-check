import React, { useRef, useState, useEffect } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';

/**
 * E2E: Paywall preserves typed text and restores focus to input after close.
 * The user should be able to retry Enter without losing the message,
 * and the send must remain blocked while gated.
 */

interface HarnessProps {
  onSend: () => void;
  isGated: boolean;
}

function ChatHarness({ onSend, isGated }: HarnessProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [paywallOpen, setPaywallOpen] = useState(false);

  const handleSendIntercept = () => {
    if (isGated) {
      setPaywallOpen(true);
      return;
    }
    onSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.shiftKey) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendIntercept();
    }
  };

  // Restore focus after paywall closes
  useEffect(() => {
    if (!paywallOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [paywallOpen]);

  return (
    <div>
      <input
        ref={inputRef}
        data-testid="chat-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {paywallOpen && (
        <div role="dialog" data-testid="paywall">
          <button onClick={() => setPaywallOpen(false)} data-testid="paywall-close">
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}

describe('Chat paywall — text & focus persistence', () => {
  it('preserves typed text and restores focus across 3 paywall cycles', async () => {
    vi.useFakeTimers();
    const onSend = vi.fn();
    const { getByTestId, queryByTestId } = render(<ChatHarness onSend={onSend} isGated />);

    const input = getByTestId('chat-input') as HTMLInputElement;
    const TEXT = 'Hola doctor, tengo dolor';

    // Type the message
    fireEvent.change(input, { target: { value: TEXT } });
    expect(input.value).toBe(TEXT);

    for (let cycle = 0; cycle < 3; cycle++) {
      // Press Enter — paywall opens, send blocked
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(queryByTestId('paywall')).not.toBeNull();
      expect(onSend).toHaveBeenCalledTimes(0);

      // Close paywall
      const closeBtn = getByTestId('paywall-close');
      fireEvent.click(closeBtn);
      expect(queryByTestId('paywall')).toBeNull();

      // Text is preserved
      expect(input.value).toBe(TEXT);

      // Focus restored after the deferred setTimeout
      await act(async () => {
        vi.runAllTimers();
      });
      expect(document.activeElement).toBe(input);
    }

    // After 3 cycles, send was never invoked
    expect(onSend).toHaveBeenCalledTimes(0);
    expect(input.value).toBe(TEXT);

    vi.useRealTimers();
  });

  it('Shift+Enter does NOT open paywall (newline only)', () => {
    const onSend = vi.fn();
    const { getByTestId, queryByTestId } = render(<ChatHarness onSend={onSend} isGated />);
    const input = getByTestId('chat-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'foo' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(queryByTestId('paywall')).toBeNull();
    expect(onSend).not.toHaveBeenCalled();
  });
});
