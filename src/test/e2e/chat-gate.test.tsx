import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Chat gate logic — patient without entitlement_chat must:
 *   1. See a paywall banner offering to buy the consultation
 *   2. Have the input disabled (no message typing or sending)
 *   3. Have onSend intercepted to open the paywall instead
 *   4. After purchase success → entitlement refreshed, input re-enabled
 *
 * This file tests the gate logic in isolation so it doesn't depend on the
 * heavy ChatMessagesPanel component tree.
 */

interface ChatGateState {
  userRole: 'patient' | 'doctor' | 'visitor' | 'resident' | 'admin';
  hasChatEntitlement: boolean;
  entitlementChecked: boolean;
  otherDoctorId: string | null;
  consultationFee: number;
}

function isInputDisabled(s: ChatGateState): boolean {
  return s.userRole === 'patient' && s.entitlementChecked && !s.hasChatEntitlement;
}

function shouldShowPaywallBanner(s: ChatGateState): boolean {
  return (
    s.userRole === 'patient' &&
    s.entitlementChecked &&
    !s.hasChatEntitlement &&
    s.otherDoctorId !== null
  );
}

function inputPlaceholder(s: ChatGateState, defaultPh: string): string {
  return isInputDisabled(s) ? 'Compra una consulta para enviar mensajes' : defaultPh;
}

async function handleSendIntercept(
  s: ChatGateState,
  onSend: () => void,
  openPaywall: () => void
): Promise<'sent' | 'paywall_opened'> {
  if (s.userRole === 'patient' && s.entitlementChecked && !s.hasChatEntitlement && s.otherDoctorId) {
    openPaywall();
    return 'paywall_opened';
  }
  onSend();
  return 'sent';
}

const baseState = (overrides: Partial<ChatGateState> = {}): ChatGateState => ({
  userRole: 'patient',
  hasChatEntitlement: false,
  entitlementChecked: true,
  otherDoctorId: 'doctor-1',
  consultationFee: 300,
  ...overrides,
});

describe('Chat gate — visibility', () => {
  it('shows banner for patient without entitlement chatting with a doctor', () => {
    expect(shouldShowPaywallBanner(baseState())).toBe(true);
  });

  it('does NOT show banner before entitlement check completes (avoid flash)', () => {
    expect(shouldShowPaywallBanner(baseState({ entitlementChecked: false }))).toBe(false);
  });

  it('does NOT show banner when entitlement is active', () => {
    expect(shouldShowPaywallBanner(baseState({ hasChatEntitlement: true }))).toBe(false);
  });

  it('does NOT show banner for non-patient roles (doctor-to-doctor chat)', () => {
    expect(shouldShowPaywallBanner(baseState({ userRole: 'doctor' }))).toBe(false);
    expect(shouldShowPaywallBanner(baseState({ userRole: 'resident' }))).toBe(false);
  });

  it('does NOT show banner if the other party is not a doctor', () => {
    expect(shouldShowPaywallBanner(baseState({ otherDoctorId: null }))).toBe(false);
  });
});

describe('Chat gate — input state', () => {
  it('disables input for unentitled patient', () => {
    expect(isInputDisabled(baseState())).toBe(true);
  });

  it('enables input once entitlement is purchased', () => {
    expect(isInputDisabled(baseState({ hasChatEntitlement: true }))).toBe(false);
  });

  it('keeps input enabled while entitlement is still being checked', () => {
    // We treat unchecked as "innocent until proven guilty" → don't disable
    expect(isInputDisabled(baseState({ entitlementChecked: false }))).toBe(false);
  });

  it('shows paywall placeholder when disabled, normal placeholder otherwise', () => {
    expect(inputPlaceholder(baseState(), 'Escribe un mensaje…'))
      .toBe('Compra una consulta para enviar mensajes');
    expect(inputPlaceholder(baseState({ hasChatEntitlement: true }), 'Escribe un mensaje…'))
      .toBe('Escribe un mensaje…');
  });
});

describe('Chat gate — send interception', () => {
  let onSend: ReturnType<typeof vi.fn>;
  let openPaywall: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSend = vi.fn();
    openPaywall = vi.fn();
  });

  it('intercepts send and opens paywall when no entitlement', async () => {
    const result = await handleSendIntercept(baseState(), onSend, openPaywall);
    expect(result).toBe('paywall_opened');
    expect(openPaywall).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('forwards send when entitlement is active', async () => {
    const result = await handleSendIntercept(
      baseState({ hasChatEntitlement: true }),
      onSend,
      openPaywall
    );
    expect(result).toBe('sent');
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(openPaywall).not.toHaveBeenCalled();
  });

  it('does not open paywall for non-patient roles even without entitlement', async () => {
    const result = await handleSendIntercept(
      baseState({ userRole: 'doctor' }),
      onSend,
      openPaywall
    );
    expect(result).toBe('sent');
    expect(openPaywall).not.toHaveBeenCalled();
  });
});

describe('Chat gate — purchase → unlock cycle', () => {
  it('flips hasChatEntitlement to true after successful purchase, immediately unlocking input', async () => {
    let state = baseState();
    expect(isInputDisabled(state)).toBe(true);

    // Simulate successful RPC
    const purchaseRpc = vi.fn(async () => ({
      success: true,
      amount_charged: 300,
      new_balance: 700,
    }));
    const refetchEntitlement = vi.fn(async () => true);

    const purchaseResult = await purchaseRpc();
    expect(purchaseResult.success).toBe(true);

    const newEntitlement = await refetchEntitlement();
    state = { ...state, hasChatEntitlement: newEntitlement };

    expect(isInputDisabled(state)).toBe(false);
    expect(shouldShowPaywallBanner(state)).toBe(false);
  });

  it('failed purchase keeps the gate closed and surfaces error', async () => {
    let state = baseState();
    const purchaseRpc = vi.fn(async () => ({
      success: false,
      error: 'Insufficient balance',
    }));

    const result = await purchaseRpc();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient balance');
    // State unchanged → input still disabled
    expect(isInputDisabled(state)).toBe(true);
  });
});

describe('Chat gate — banner CTA copy', () => {
  it('shows fee in CTA when consultationFee > 0', () => {
    const fee = baseState().consultationFee;
    const cta = fee > 0 ? `Comprar ($${fee.toFixed(0)})` : 'Comprar';
    expect(cta).toBe('Comprar ($300)');
  });

  it('falls back to "Comprar" without amount when fee is 0/unknown', () => {
    const fee = 0;
    const cta = fee > 0 ? `Comprar ($${fee.toFixed(0)})` : 'Comprar';
    expect(cta).toBe('Comprar');
  });
});
