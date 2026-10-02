import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Receipt } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { BillingProfileForm, fetchBillingProfile } from './BillingProfileForm';
import { isMissingRelation } from './satCatalogs';

// Antes de cualquier compra a un médico el comprador tiene que tener sus datos
// fiscales: el médico le factura a él (nombre y RFC), no a la plataforma.
//   const { ensureBillingProfile, handleBillingError } = useBillingGate();
//   if (!(await ensureBillingProfile())) return;        // abre el diálogo si faltan
//   ...catch (e) { if (await handleBillingError(e)) return; }  // 409 / RPC de respaldo

export const BILLING_REQUIRED_CODE = 'billing_profile_required';

interface BillingGateValue {
  /** true si ya tiene datos fiscales o los acaba de guardar; false si cerró el diálogo. */
  ensureBillingProfile: () => Promise<boolean>;
  /** true si el error (o la respuesta) es «faltan datos fiscales»; en ese caso abre el diálogo. */
  handleBillingError: (error: unknown, data?: unknown) => Promise<boolean>;
  /** Para Configuración: tras editar los datos, el candado ya sabe que existen. */
  markBillingProfileSaved: () => void;
}

const passthrough: BillingGateValue = {
  ensureBillingProfile: async () => true,
  handleBillingError: async () => false,
  markBillingProfileSaved: () => {},
};

const BillingGateContext = createContext<BillingGateValue | null>(null);

/** Reconoce el aviso del servidor: 409 de las edge functions o excepción/resultado de las RPC de monedero. */
export async function isBillingRequiredError(error: unknown, data?: unknown): Promise<boolean> {
  const has = (v: unknown) => typeof v === 'string' && v.includes(BILLING_REQUIRED_CODE);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  if (d && (has(d.code) || has(d.error) || has(d.message))) return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = error as any;
  if (!e) return false;
  if (has(e) || has(e.message) || has(e.code) || has(e.details) || has(e.hint)) return true;
  // FunctionsHttpError: el cuerpo viene en e.context (Response)
  const ctx = e.context;
  if (ctx && typeof ctx.clone === 'function') {
    try {
      if (ctx.status !== 409) return false;
      const body = await ctx.clone().json();
      return has(body?.code) || has(body?.error);
    } catch {
      return false;
    }
  }
  return false;
}

export function BillingGateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'before' | 'retry'>('before');
  const knownFor = useRef<string | null>(null); // user.id con datos confirmados
  const pending = useRef<((ok: boolean) => void) | null>(null);

  const finish = useCallback((ok: boolean) => {
    setOpen(false);
    const r = pending.current;
    pending.current = null;
    r?.(ok);
  }, []);

  const openDialog = useCallback((m: 'before' | 'retry') => {
    setMode(m);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      pending.current?.(false);
      pending.current = resolve;
    });
  }, []);

  const ensureBillingProfile = useCallback(async () => {
    if (!user?.id) return true; // sin sesión: la compra ya pide login
    if (knownFor.current === user.id) return true;
    const { profile, error } = await fetchBillingProfile(user.id);
    // Migración aún no aplicada o fallo de red: no se frena la compra (el servidor decide).
    if (error) {
      if (!isMissingRelation(error)) console.warn('billing_profiles:', error.message);
      return true;
    }
    if (profile) { knownFor.current = user.id; return true; }
    return openDialog('before');
  }, [user?.id, openDialog]);

  const handleBillingError = useCallback(async (error: unknown, data?: unknown) => {
    if (!(await isBillingRequiredError(error, data))) return false;
    knownFor.current = null;
    void openDialog('retry');
    return true;
  }, [openDialog]);

  const markBillingProfileSaved = useCallback(() => {
    if (user?.id) knownFor.current = user.id;
  }, [user?.id]);

  return (
    <BillingGateContext.Provider value={{ ensureBillingProfile, handleBillingError, markBillingProfileSaved }}>
      {children}
      <Dialog open={open} onOpenChange={(o) => { if (!o) finish(false); }}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" aria-hidden />
              {t('billing.gate.title')}
            </DialogTitle>
            <DialogDescription>{t('billing.gate.why')}</DialogDescription>
          </DialogHeader>
          {mode === 'retry' && (
            <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground">
              {t('billing.gate.retryNote')}
            </p>
          )}
          {open && (
            <BillingProfileForm
              submitLabel={mode === 'before' ? t('billing.gate.saveAndContinue') : t('billing.form.save')}
              onCancel={() => finish(false)}
              onSaved={() => { if (user?.id) knownFor.current = user.id; finish(true); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </BillingGateContext.Provider>
  );
}

export function useBillingGate(): BillingGateValue {
  return useContext(BillingGateContext) ?? passthrough;
}
