import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { es as esDict } from '@/lib/i18n/es';

const resolveEs = (key: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const val = key.split('.').reduce((o: any, k) => (o == null ? undefined : o[k]), esDict as any);
  return typeof val === 'string' ? val : key;
};
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: resolveEs, language: 'es' }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'a@b.mx' } }),
}));

// billing_profiles simulado: GET devuelve `row`, upsert la guarda.
let row: Record<string, unknown> | null = null;
const upsert = vi.fn(async (payload: Record<string, unknown>) => { row = payload; return { error: null }; });
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
      upsert,
    }),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { BillingGateProvider, useBillingGate, isBillingRequiredError } from '../BillingGate';

describe('isBillingRequiredError', () => {
  it('reconoce el 409 de las edge functions (FunctionsHttpError)', async () => {
    const context = new Response(JSON.stringify({ code: 'billing_profile_required', error: 'x' }), { status: 409 });
    expect(await isBillingRequiredError({ message: 'Edge Function returned a non-2xx status code', context })).toBe(true);
  });
  it('no confunde otro 409 ni un 500', async () => {
    expect(await isBillingRequiredError({ context: new Response('{"code":"slot_taken"}', { status: 409 }) })).toBe(false);
    expect(await isBillingRequiredError({ context: new Response('{"code":"billing_profile_required"}', { status: 500 }) })).toBe(false);
  });
  it('reconoce la excepción del trigger en las RPC de monedero y el resultado {error}', async () => {
    expect(await isBillingRequiredError({ message: 'billing_profile_required', code: 'P0001' })).toBe(true);
    expect(await isBillingRequiredError(null, { success: false, error: 'billing_profile_required' })).toBe(true);
    expect(await isBillingRequiredError(new Error('Saldo insuficiente'))).toBe(false);
  });
});

function Buyer({ onResult }: { onResult: (ok: boolean) => void }) {
  const { ensureBillingProfile } = useBillingGate();
  return <button onClick={async () => onResult(await ensureBillingProfile())}>Comprar</button>;
}

describe('BillingGateProvider', () => {
  beforeEach(() => { row = null; upsert.mockClear(); });

  it('sin datos fiscales abre el diálogo y no deja seguir con datos incompletos', async () => {
    const onResult = vi.fn();
    render(<BillingGateProvider><Buyer onResult={onResult} /></BillingGateProvider>);
    fireEvent.click(screen.getByText('Comprar'));
    await screen.findByText(esDict.billing.gate.title);
    expect(screen.getByText(esDict.billing.gate.why)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(esDict.billing.form.rfc), { target: { value: 'goma850101ab1' } });
    fireEvent.change(screen.getByLabelText(esDict.billing.form.zip), { target: { value: '06600' } });
    fireEvent.change(screen.getByLabelText(esDict.billing.form.name), { target: { value: 'Ana Gómez' } });
    // Sin régimen no deja guardar
    await act(async () => { fireEvent.click(screen.getByText(esDict.billing.gate.saveAndContinue)); });
    expect(await screen.findByText(esDict.billing.form.errRegime)).toBeTruthy();
    expect(upsert).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
  });

  it('con datos fiscales no molesta: la compra sigue directa', async () => {
    row = { rfc: 'GOMA850101AB1', legal_name: 'ANA', tax_zip: '06600', tax_regime: '605', cfdi_use: 'D01', email: null };
    const onResult = vi.fn();
    render(<BillingGateProvider><Buyer onResult={onResult} /></BillingGateProvider>);
    fireEvent.click(screen.getByText('Comprar'));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    expect(screen.queryByText(esDict.billing.gate.title)).toBeNull();
  });

  it('si cierra el diálogo, la compra no sigue', async () => {
    const onResult = vi.fn();
    render(<BillingGateProvider><Buyer onResult={onResult} /></BillingGateProvider>);
    fireEvent.click(screen.getByText('Comprar'));
    await screen.findByText(esDict.billing.gate.title);
    fireEvent.click(screen.getByText(esDict.billing.form.cancel));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });
});
