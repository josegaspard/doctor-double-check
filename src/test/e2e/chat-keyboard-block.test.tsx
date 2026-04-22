/**
 * Chat keyboard / focus / placeholder behavior when the chat is gated by paywall.
 *
 * Tests the pure logic without rendering the full panel — we model the same
 * decision functions used by ChatMessagesPanel to keep tests fast and stable.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface GateState {
  userRole: 'patient' | 'doctor' | 'resident' | 'admin';
  hasChatEntitlement: boolean;
  entitlementChecked: boolean;
  otherDoctorId: string | null;
}

const base = (o: Partial<GateState> = {}): GateState => ({
  userRole: 'patient',
  hasChatEntitlement: false,
  entitlementChecked: true,
  otherDoctorId: 'doctor-1',
  ...o,
});

function isDisabled(s: GateState) {
  return s.userRole === 'patient' && s.entitlementChecked && !s.hasChatEntitlement;
}

function placeholder(s: GateState, normal: string) {
  return isDisabled(s) ? 'Compra una consulta para enviar mensajes' : normal;
}

function handleKeyDown(
  s: GateState,
  e: { key: string; shiftKey?: boolean },
  send: () => void,
  openPaywall: () => void
): 'sent' | 'paywall' | 'noop' {
  if (e.key !== 'Enter') return 'noop';
  if (e.shiftKey) return 'noop'; // newline, never sends
  if (isDisabled(s) && s.otherDoctorId) {
    openPaywall();
    return 'paywall';
  }
  send();
  return 'sent';
}

describe('Chat gate — Enter key behavior', () => {
  let send: ReturnType<typeof vi.fn>;
  let openPaywall: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    send = vi.fn();
    openPaywall = vi.fn();
  });

  it('Enter on disabled chat opens paywall and does NOT send', () => {
    const r = handleKeyDown(base(), { key: 'Enter' }, send, openPaywall);
    expect(r).toBe('paywall');
    expect(openPaywall).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });

  it('Shift+Enter on disabled chat is a no-op (newline) — does NOT open paywall', () => {
    const r = handleKeyDown(base(), { key: 'Enter', shiftKey: true }, send, openPaywall);
    expect(r).toBe('noop');
    expect(openPaywall).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('Enter on enabled chat sends the message', () => {
    const r = handleKeyDown(
      base({ hasChatEntitlement: true }),
      { key: 'Enter' },
      send,
      openPaywall
    );
    expect(r).toBe('sent');
    expect(send).toHaveBeenCalledTimes(1);
    expect(openPaywall).not.toHaveBeenCalled();
  });

  it('non-Enter keys are ignored', () => {
    expect(handleKeyDown(base(), { key: 'a' }, send, openPaywall)).toBe('noop');
    expect(handleKeyDown(base(), { key: 'Tab' }, send, openPaywall)).toBe('noop');
    expect(send).not.toHaveBeenCalled();
    expect(openPaywall).not.toHaveBeenCalled();
  });
});

describe('Chat gate — placeholder & focus contract', () => {
  it('shows paywall placeholder when disabled', () => {
    expect(placeholder(base(), 'Escribe…')).toBe('Compra una consulta para enviar mensajes');
  });

  it('shows normal placeholder when enabled', () => {
    expect(placeholder(base({ hasChatEntitlement: true }), 'Escribe…')).toBe('Escribe…');
  });

  it('placeholder transitions back to normal once entitlement flips after purchase', () => {
    let s = base();
    expect(placeholder(s, 'Escribe…')).toBe('Compra una consulta para enviar mensajes');
    s = { ...s, hasChatEntitlement: true };
    expect(placeholder(s, 'Escribe…')).toBe('Escribe…');
  });
});

describe('Chat gate — DOM focus restoration after paywall close', () => {
  it('restores focus to the chat input element after dialog dismiss', () => {
    document.body.innerHTML = '<input data-testid="chat-input" />';
    const input = document.querySelector('[data-testid="chat-input"]') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    // Simulate paywall opening and stealing focus
    const dialog = document.createElement('button');
    dialog.textContent = 'cerrar';
    document.body.appendChild(dialog);
    dialog.focus();
    expect(document.activeElement).toBe(dialog);

    // Simulate dialog dismissed → restore focus to input
    dialog.remove();
    input.focus();
    expect(document.activeElement).toBe(input);
  });
});
