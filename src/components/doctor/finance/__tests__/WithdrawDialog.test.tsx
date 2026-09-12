// F3 retiros · pruebas del diálogo «Retirar saldo» con el hook simulado.
// Comprueban los estados con datos (que en local no se ven sin la migración) y
// la regla del encargo: el primer clic NUNCA envía la solicitud.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'es', t: (k: string) => k, setLanguage: () => {}, translations: {} }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'doc-1' }, role: 'doctor' }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(), functions: { invoke: vi.fn() } },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/hooks/usePayoutRequests', async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, usePayoutRequests: vi.fn() };
});

import { usePayoutRequests, classifyPayoutError } from '@/hooks/usePayoutRequests';
import { WithdrawDialog, parseAmountInput } from '@/components/doctor/finance/WithdrawDialog';

const baseState = () => ({
  requests: [],
  payouts: {},
  openRequest: null as any,
  pendingEarnings: 1500,
  isApprovedDoctor: true,
  bank: {
    id: 'b1', bank_name: 'BBVA', clabe_last4: '4587', account_holder_name: 'Dra. Prueba',
    payment_method: 'bank', is_verified: true,
  } as any,
  minimum: 100 as number | null,
  loading: false,
  loadError: false,
  pendingActivation: false,
  submitting: false,
  reload: vi.fn(),
  requestPayout: vi.fn(async () => ({ ok: true, id: 'req-1' })),
  cancelRequest: vi.fn(async () => ({ ok: true, id: 'req-1' })),
});

const mockHook = (patch: Record<string, any> = {}) => {
  const state = { ...baseState(), ...patch };
  (usePayoutRequests as any).mockReturnValue(state);
  return state;
};

const renderDialog = () =>
  render(
    <MemoryRouter>
      <WithdrawDialog open onOpenChange={() => {}} />
    </MemoryRouter>,
  );

const buttonWithText = (text: string) => screen.getByText(text).closest('button') as HTMLButtonElement;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WithdrawDialog · estados', () => {
  it('sin migración: avisa «pendiente de activar», ofrece Cuenta bancaria y no enseña formulario', () => {
    mockHook({ pendingActivation: true, minimum: null });
    renderDialog();
    expect(screen.getByText('mm2.retiros.pending.title')).toBeInTheDocument();
    expect(screen.getByText('mm2.retiros.dialog.goBank').closest('a')).toHaveAttribute('href', '/settings?s=finanzas&f=banco');
    expect(screen.queryByLabelText('mm2.retiros.dialog.amountLabel')).toBeNull();
  });

  it('sin cuenta: explica y enlaza a añadir cuenta', () => {
    mockHook({ bank: null });
    renderDialog();
    expect(screen.getByText('mm2.retiros.gate.noBankTitle')).toBeInTheDocument();
    expect(screen.getByText('pro.earnings.addAccount').closest('a')).toHaveAttribute('href', '/settings?s=finanzas&f=banco');
    expect(screen.queryByLabelText('mm2.retiros.dialog.amountLabel')).toBeNull();
  });

  it('cuenta sin verificar: no deja solicitar', () => {
    mockHook({ bank: { ...baseState().bank, is_verified: false } });
    renderDialog();
    expect(screen.getByText('mm2.retiros.gate.unverifiedTitle')).toBeInTheDocument();
    expect(screen.queryByLabelText('mm2.retiros.dialog.amountLabel')).toBeNull();
  });

  it('saldo por debajo del mínimo: lo dice y no hay formulario', () => {
    mockHook({ pendingEarnings: 50, minimum: 100 });
    renderDialog();
    expect(screen.getByText('mm2.retiros.gate.belowMinTitle')).toBeInTheDocument();
    expect(screen.queryByLabelText('mm2.retiros.dialog.amountLabel')).toBeNull();
  });

  it('médico no aprobado: lo dice', () => {
    mockHook({ isApprovedDoctor: false });
    renderDialog();
    expect(screen.getByText('mm2.retiros.gate.notApprovedTitle')).toBeInTheDocument();
  });

  it('solicitud en curso: se enseña y cancelar pide confirmación antes de llamar', async () => {
    const state = mockHook({
      openRequest: {
        id: 'req-9', doctor_id: 'doc-1', amount: 800, status: 'pending', bank_account_id: 'b1',
        doctor_note: null, admin_note: null, reviewed_by: null, reviewed_at: null, payout_id: null,
        created_at: '2026-09-12T15:00:00Z', updated_at: '2026-09-12T15:00:00Z',
      },
    });
    renderDialog();
    expect(screen.getByText('mm2.retiros.gate.openTitle')).toBeInTheDocument();
    fireEvent.click(buttonWithText('mm2.retiros.cancel.button'));
    expect(await screen.findByText('mm2.retiros.cancel.title')).toBeInTheDocument();
    expect(state.cancelRequest).not.toHaveBeenCalled();
    const confirmBtn = buttonWithText('mm2.retiros.cancel.confirm');
    await waitFor(() => expect(confirmBtn).not.toBeDisabled());
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(state.cancelRequest).toHaveBeenCalledWith('req-9'));
  });
});

describe('WithdrawDialog · formulario', () => {
  it('no deja pasar un monto mayor que el saldo', async () => {
    const state = mockHook();
    renderDialog();
    fireEvent.change(screen.getByLabelText('mm2.retiros.dialog.amountLabel'), { target: { value: '2000' } });
    fireEvent.click(buttonWithText('mm2.retiros.dialog.review'));
    expect(await screen.findByText('mm2.retiros.dialog.errAboveBalance')).toBeInTheDocument();
    expect(screen.queryByText('mm2.retiros.review.title')).toBeNull();
    expect(state.requestPayout).not.toHaveBeenCalled();
  });

  it('no deja pasar un monto menor que el mínimo', async () => {
    const state = mockHook();
    renderDialog();
    fireEvent.change(screen.getByLabelText('mm2.retiros.dialog.amountLabel'), { target: { value: '99.99' } });
    fireEvent.click(buttonWithText('mm2.retiros.dialog.review'));
    expect(await screen.findByText('mm2.retiros.dialog.errBelowMin')).toBeInTheDocument();
    expect(state.requestPayout).not.toHaveBeenCalled();
  });

  it('el primer clic abre la revisión; solo «Enviar solicitud» llama a la RPC', async () => {
    const state = mockHook();
    renderDialog();
    fireEvent.change(screen.getByLabelText('mm2.retiros.dialog.amountLabel'), { target: { value: '1,234.50' } });
    fireEvent.change(screen.getByLabelText(/mm2\.retiros\.dialog\.noteLabel/), { target: { value: '  antes del 30  ' } });
    fireEvent.click(buttonWithText('mm2.retiros.dialog.review'));

    expect(await screen.findByText('mm2.retiros.review.title')).toBeInTheDocument();
    expect(state.requestPayout).not.toHaveBeenCalled();

    const confirmBtn = buttonWithText('mm2.retiros.review.confirm');
    await waitFor(() => expect(confirmBtn).not.toBeDisabled());
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(state.requestPayout).toHaveBeenCalledTimes(1));
    expect(state.requestPayout).toHaveBeenCalledWith(1234.5, 'antes del 30');
    expect(await screen.findByText('mm2.retiros.sent.title')).toBeInTheDocument();
  });

  it('«Todo el saldo» rellena el saldo sin redondear hacia arriba', () => {
    mockHook({ pendingEarnings: 100.005 });
    renderDialog();
    fireEvent.click(buttonWithText('mm2.retiros.dialog.allBalance'));
    expect((screen.getByLabelText('mm2.retiros.dialog.amountLabel') as HTMLInputElement).value).toBe('100.00');
  });
});

describe('utilidades', () => {
  it('parseAmountInput acepta formatos de México y rechaza más de 2 decimales', () => {
    expect(parseAmountInput('1234.5')).toBe(1234.5);
    expect(parseAmountInput('1,234.50')).toBe(1234.5);
    expect(parseAmountInput('1234,50')).toBe(1234.5);
    expect(parseAmountInput('12.345')).toBeNull();
    expect(parseAmountInput('abc')).toBeNull();
    expect(parseAmountInput('')).toBeNull();
  });

  it('classifyPayoutError distingue objeto inexistente, motivos de la RPC y el índice único', () => {
    expect(classifyPayoutError({ code: 'PGRST202', message: 'Could not find the function' })).toBe('pending_activation');
    expect(classifyPayoutError({ code: '42P01', message: 'relation does not exist' })).toBe('pending_activation');
    expect(classifyPayoutError({ code: '22023', message: 'below_minimum' })).toBe('below_minimum');
    expect(classifyPayoutError({ code: '42501', message: 'bank_account_not_verified' })).toBe('bank_account_not_verified');
    expect(classifyPayoutError({ code: '42501', message: 'no_bank_account' })).toBe('no_bank_account');
    expect(classifyPayoutError({ code: '22023', message: 'invalid_amount_decimals' })).toBe('invalid_amount');
    expect(classifyPayoutError({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe('request_already_open');
    expect(classifyPayoutError({ code: 'XX000', message: 'boom' })).toBe('error');
  });
});
