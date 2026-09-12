// Modal de revisión común (11-sep-2026).
//
// Regla del encargo: el primer clic NUNCA ejecuta una acción con consecuencias.
// Toda acción que suscribe, cobra, publica, borra, crea una conversación o
// guarda horarios pasa por aquí: se enseña un resumen de lo que va a pasar y
// solo el botón de confirmar devuelve `true`.
//
// Uso:
//   const { confirm, dialog } = useConfirmAction();
//   const ok = await confirm({ title, description, details, tone });
//   if (!ok) return;            // cerrar, Escape o Cancelar → false
//   ...la escritura va DESPUÉS
//   return (<>{...}{dialog}</>);
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CreditCard, ShieldCheck } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { fill } from '@/lib/proFormat';

export type ConfirmTone = 'default' | 'destructive' | 'payment';

export interface ConfirmActionDetail {
  label: string;
  value: React.ReactNode;
  /** Con tono `payment`, la fila destacada es el importe (si no se marca ninguna, la última). */
  emphasis?: boolean;
}

export interface ConfirmActionOptions {
  title: string;
  description?: React.ReactNode;
  details?: ConfirmActionDetail[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  /** Borrados graves: hay que escribir esta palabra para habilitar el botón. */
  requireText?: string;
}

/** Milisegundos que el botón de confirmar tarda en armarse: un doble clic en el
 *  botón que abre el modal no puede caer encima de «Confirmar». */
const ARM_DELAY_MS = 350;

const toneIcon = (tone: ConfirmTone) =>
  tone === 'destructive' ? AlertTriangle : tone === 'payment' ? CreditCard : ShieldCheck;

const confirmClass = (tone: ConfirmTone) =>
  tone === 'destructive'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : tone === 'payment'
      ? 'bg-primary hover:bg-primary/90 text-white'
      : 'bg-primary hover:bg-primary/90 text-white';

interface ConfirmActionDialogProps {
  open: boolean;
  options: ConfirmActionOptions | null;
  /** true = confirmar, false = cancelar o cerrar */
  onResolve: (confirmed: boolean) => void;
}

/** Versión controlada, por si una pantalla prefiere manejar el estado. */
export function ConfirmActionDialog({ open, options, onResolve }: ConfirmActionDialogProps) {
  const { t } = useLanguage();
  const [typed, setTyped] = useState('');
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!open) {
      setArmed(false);
      setTyped('');
      return;
    }
    setTyped('');
    setArmed(false);
    const id = window.setTimeout(() => setArmed(true), ARM_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [open, options]);

  const tone: ConfirmTone = options?.tone ?? 'default';
  const Icon = toneIcon(tone);
  const details = options?.details ?? [];
  const emphasisIndex = details.some(d => d.emphasis)
    ? details.findIndex(d => d.emphasis)
    : tone === 'payment' && details.length > 0
      ? details.length - 1
      : -1;

  const needsText = !!options?.requireText;
  const textOk =
    !needsText ||
    typed.trim().toLocaleLowerCase() === String(options?.requireText).trim().toLocaleLowerCase();
  const canConfirm = armed && textOk;

  return (
    <AlertDialog open={open} onOpenChange={o => { if (!o) onResolve(false); }}>
      <AlertDialogContent className="bg-white sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-secondary">
            <span
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
                tone === 'destructive' ? 'bg-red-50 text-red-600' : 'bg-primary/10 text-primary'
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">{options?.title}</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[13.5px] text-slate-600">
            {options?.description ?? t('mm2.confirm.reviewIntro')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {details.length > 0 && (
          <dl className="rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-200">
            {details.map((d, i) => (
              <div key={`${d.label}-${i}`} className="flex items-start justify-between gap-3 px-3 py-2">
                <dt className="text-[13px] text-slate-500">{d.label}</dt>
                <dd
                  className={
                    i === emphasisIndex
                      ? 'text-right text-[15px] font-extrabold text-secondary'
                      : 'text-right text-[13.5px] font-semibold text-slate-800'
                  }
                >
                  {d.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {tone === 'destructive' && (
          <p className="text-[13px] font-semibold text-red-600">{t('mm2.confirm.irreversible')}</p>
        )}

        {needsText && (
          <div className="space-y-1.5">
            <label className="block text-[13px] text-slate-600" htmlFor="mm2-confirm-text">
              {fill(t('mm2.confirm.typeToConfirm'), { word: String(options?.requireText) })}
            </label>
            <input
              id="mm2-confirm-text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              autoComplete="off"
              placeholder={t('mm2.confirm.typePlaceholder')}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>
        )}

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => onResolve(false)}
          >
            {options?.cancelLabel || t('mm2.confirm.cancel')}
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            className={`h-10 rounded-lg px-4 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${confirmClass(tone)}`}
            onClick={() => { if (canConfirm) onResolve(true); }}
          >
            {options?.confirmLabel || t('mm2.confirm.confirm')}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export interface UseConfirmAction {
  confirm: (options: ConfirmActionOptions) => Promise<boolean>;
  dialog: React.ReactNode;
}

export function useConfirmAction(): UseConfirmAction {
  const [state, setState] = useState<{ open: boolean; options: ConfirmActionOptions | null }>({
    open: false,
    options: null,
  });
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmActionOptions) => {
    // Si ya había una confirmación abierta, la anterior se resuelve en «no».
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
    return new Promise<boolean>(resolve => {
      resolverRef.current = resolve;
      setState({ open: true, options });
    });
  }, []);

  const onResolve = useCallback((confirmed: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setState(s => ({ ...s, open: false }));
    resolve?.(confirmed);
  }, []);

  // Si el componente se desmonta con el modal abierto, nadie confirmó: `false`.
  useEffect(() => () => { resolverRef.current?.(false); resolverRef.current = null; }, []);

  const dialog = (
    <ConfirmActionDialog open={state.open} options={state.options} onResolve={onResolve} />
  );

  return { confirm, dialog };
}

export default ConfirmActionDialog;
