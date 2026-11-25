// Lista de espera de pacientes (24-nov-2026).
//
// Mientras «Acceso para PACIENTES» (site_settings/feature_toggles →
// enable_patient_access) esté apagado, todo lo que invitaba a un paciente a
// reservar, chatear, pagar o crear cuenta se cambia por esta invitación. Al
// encenderlo en Admin → Ajustes del sitio vuelve todo solo, sin desplegar.
//
// No hay tabla nueva: se reutiliza la función pública `submit-contact`, que
// guarda el mensaje en `reports` (se ve en /admin/reports con el asunto
// «Lista de espera · pacientes») y avisa a los administradores.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSiteToggles } from '@/hooks/useSiteToggles';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCoherenceText } from '@/lib/coherence/i18n';
import { track } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export const WAITLIST_SUBJECT = 'Lista de espera · pacientes';

export function usePatientsOpen() {
  const { toggles, isLoading } = useSiteToggles();
  return { patientsOpen: toggles.enable_patient_access === true, isLoading };
}

interface ButtonProps {
  source: string;
  className?: string;
  children?: React.ReactNode;
}

/** Botón que abre el formulario. `className` permite vestirlo como el botón al que sustituye. */
export function WaitlistButton({ source, className, children }: ButtonProps) {
  const ct = useCoherenceText();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} data-waitlist-cta={source}>
        {children ?? <><Clock aria-hidden="true" className="w-4 h-4" /> {ct('wl.cta')}</>}
      </button>
      <WaitlistDialog open={open} onOpenChange={setOpen} source={source} />
    </>
  );
}

export function WaitlistDialog({ open, onOpenChange, source }: { open: boolean; onOpenChange: (v: boolean) => void; source: string }) {
  const ct = useCoherenceText();
  const { language } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [interest, setInterest] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error' | 'invalid'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setState('invalid'); return; }
    setState('sending');
    try {
      const { data, error } = await supabase.functions.invoke('submit-contact', {
        body: {
          name: name.trim(),
          email: email.trim(),
          subject: WAITLIST_SUBJECT,
          message: [
            'Quiere que le avisen cuando se abran las cuentas de pacientes.',
            `Especialidad de interés: ${interest.trim() || '—'}`,
            `Desde: ${source}`,
            `Idioma: ${language}`,
          ].join('\n'),
        },
      });
      if (error || (data && (data as { error?: string }).error)) throw new Error('send failed');
      track('waitlist_join', { source });
      setState('done');
    } catch {
      setState('error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{state === 'done' ? ct('wl.done') : ct('wl.title')}</DialogTitle>
          <DialogDescription>{state === 'done' ? ct('wl.doneBody') : ct('wl.body')}</DialogDescription>
        </DialogHeader>
        {state === 'done' ? (
          <div className="flex flex-col items-center gap-4 py-2">
            <CheckCircle2 className="w-10 h-10 text-success" aria-hidden="true" />
            <Button type="button" onClick={() => onOpenChange(false)} className="min-h-[44px] w-full">{ct('wl.close')}</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor={`wl-name-${source}`}>{ct('wl.name')}</Label>
              <Input id={`wl-name-${source}`} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`wl-email-${source}`}>{ct('wl.email')}</Label>
              <Input id={`wl-email-${source}`} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`wl-int-${source}`}>{ct('wl.interest')}</Label>
              <Input id={`wl-int-${source}`} value={interest} onChange={(e) => setInterest(e.target.value)} maxLength={120} />
            </div>
            {(state === 'error' || state === 'invalid') && (
              <p className="text-sm text-destructive" role="alert">{state === 'invalid' ? ct('wl.invalid') : ct('wl.error')}</p>
            )}
            <Button type="submit" disabled={state === 'sending'} className="min-h-[44px] w-full">
              {state === 'sending' ? <><Loader2 className="w-4 h-4 animate-spin" /> {ct('wl.sending')}</> : ct('wl.submit')}
            </Button>
            <p className="text-xs text-muted-foreground text-center">{ct('wl.privacy')}</p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Tarjeta para el perfil público del médico (sustituye a la de suscripciones). */
export function WaitlistCard({ source }: { source: string }) {
  const ct = useCoherenceText();
  return (
    <section className="pro-card pro-card-pad bg-card wl-card" aria-label={ct('wl.title')}>
      <p className="text-xs font-bold uppercase tracking-wider text-primary">{ct('wl.badge')}</p>
      <p className="mt-2 text-sm text-muted-foreground">{ct('wl.profileNote')}</p>
      <WaitlistButton source={source} className="pro-btn pro-btn-teal mt-3 w-full" />
      <Link to="/login" state={{ preferredRole: 'doctor', mode: 'signup' }} className="mt-3 block text-center text-sm font-medium text-primary underline-offset-2 hover:underline">
        {ct('wl.doctorQ')}
      </Link>
    </section>
  );
}
