import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithRouter } from './helpers';

// El mock de `t` resuelve las traducciones REALES en español (antes devolvía la
// clave, y las aserciones buscaban el texto español → fallaban). Resuelve rutas
// con punto y soporta placeholders {x}.
import { es as esDict } from '@/lib/i18n/es';
const resolveEs = (key: string, vars?: Record<string, string | number>) => {
  const val = key.split('.').reduce((o: any, k) => (o == null ? undefined : o[k]), esDict as any);
  let str = typeof val === 'string' ? val : key;
  if (vars) for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, String(v));
  return str;
};
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: resolveEs, language: 'es', setLanguage: vi.fn() }),
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

  it('is wallet-only: shows the wallet button and top-up, no card fallback', () => {
    // El paywall de grabaciones es SOLO wallet (walletOnlyNotice); ya no hay botón
    // "Pagar con Tarjeta". Este test se actualizó para reflejar el comportamiento
    // actual (antes afirmaba un botón de Stripe que ya no existe).
    walletBalance = 1000;
    walletAfford = true;
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
    expect(screen.getByRole('button', { name: /Pagar con Wallet/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pagar con Tarjeta/i })).toBeNull();
  });
});
