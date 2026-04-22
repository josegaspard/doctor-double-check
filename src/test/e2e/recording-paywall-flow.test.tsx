import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithRouter } from './helpers';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, language: 'es', setLanguage: vi.fn() }),
  LanguageProvider: ({ children }: any) => <>{children}</>,
}));

const purchaseWithWalletMock = vi.fn();
const purchaseWithStripeMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('@/hooks/usePurchases', () => ({
  usePurchases: () => ({
    purchaseWithWallet: purchaseWithWalletMock,
    purchaseWithStripe: purchaseWithStripeMock,
    refresh: refreshMock,
  }),
}));

let walletBalance = 0;
let walletAfford = false;
vi.mock('@/contexts/WalletContext', () => ({
  useWallet: () => ({
    balance: walletBalance,
    canAfford: () => walletAfford,
  }),
}));

import { RecordingPaywall } from '@/components/recordings/RecordingPaywall';

describe('Recording paywall — wallet flow with state transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    walletBalance = 1000;
    walletAfford = true;
  });

  it('renders idle wallet state with balance badge', () => {
    renderWithRouter(
      <RecordingPaywall
        recordingId="rec-1"
        title="Caso clínico"
        doctorName="Dra. López"
        specialty="Cardiología"
        price={300}
        durationSeconds={1200}
        onPaid={vi.fn()}
      />
    );
    expect(screen.getByText(/Saldo:/i)).toBeInTheDocument();
    expect(screen.getByText(/\$1,000 MXN/)).toBeInTheDocument();
  });

  it('transitions idle → initiated → paid on successful wallet purchase', async () => {
    purchaseWithWalletMock.mockResolvedValueOnce({ success: true });
    refreshMock.mockResolvedValueOnce(undefined);
    const onPaid = vi.fn().mockResolvedValue(undefined);

    renderWithRouter(
      <RecordingPaywall
        recordingId="rec-1"
        title="X"
        doctorName="Dra. López"
        specialty="Cardiología"
        price={300}
        durationSeconds={600}
        onPaid={onPaid}
      />
    );

    const payBtn = screen.getByRole('button', { name: /Pagar con Wallet/i });
    fireEvent.click(payBtn);

    await waitFor(() => {
      expect(purchaseWithWalletMock).toHaveBeenCalledWith('rec-1');
    });

    await waitFor(() => {
      expect(screen.getByText(/Pagado · Cargando reproductor/i)).toBeInTheDocument();
    });

    // onPaid is auto-fired ~1.2s after paid state — verify it eventually runs
    await waitFor(() => expect(onPaid).toHaveBeenCalled(), { timeout: 2500 });
  });

  it('shows failed state with retry button when wallet purchase fails', async () => {
    purchaseWithWalletMock.mockResolvedValueOnce({ success: false, error: 'Insufficient balance' });

    renderWithRouter(
      <RecordingPaywall
        recordingId="rec-1"
        title="X"
        doctorName="Dra. López"
        specialty="Cardiología"
        price={300}
        durationSeconds={600}
        onPaid={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Pagar con Wallet/i }));

    await waitFor(() => {
      expect(screen.getByText(/Pago rechazado/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Insufficient balance/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument();
  });

  it('shows insufficient balance state when canAfford is false', () => {
    walletBalance = 50;
    walletAfford = false;

    renderWithRouter(
      <RecordingPaywall
        recordingId="rec-1"
        title="X"
        doctorName="Dra. López"
        specialty="Cardiología"
        price={300}
        durationSeconds={600}
        onPaid={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Saldo insuficiente/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Recargar Wallet/i })).toBeInTheDocument();
  });

  it('always exposes Stripe fallback button alongside wallet', () => {
    renderWithRouter(
      <RecordingPaywall
        recordingId="rec-1"
        title="X"
        doctorName="Dra. López"
        specialty="Cardiología"
        price={300}
        durationSeconds={600}
        onPaid={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Pagar con Tarjeta/i })).toBeInTheDocument();
  });
});
