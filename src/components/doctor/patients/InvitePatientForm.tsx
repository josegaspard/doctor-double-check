// «Invitar a un paciente» dentro de «Añadir paciente» (13-sep-2026).
// Nombre + correo o teléfono (+ nota opcional). Crea UNA invitación con la
// misma RPC que la importación (valida y deduplica en la base). No envía
// correos: eso se hace desde la tarjeta «Invitado», también con revisión.
import React, { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Info, Loader2, Upload, UserPlus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import { fill } from '@/lib/proFormat';
import type { ImportSummary, InviteResult } from '@/hooks/usePatientInvites';
import { normalizePatientRow, validatePatientRow, type PatientRowInput, type RowIssue } from './patientRows';
import { failureKey, reasonKey } from './inviteMessages';
import '@/styles/funciones-importar.css';

interface InvitePatientFormProps {
  pendingActivation: boolean;
  onImport: (rows: PatientRowInput[]) => Promise<InviteResult<ImportSummary>>;
  onCreated: () => void;
  onOpenImport: () => void;
}

const fieldOf = (issue: RowIssue | null): 'name' | 'email' | 'phone' | 'note' | 'contact' | null => {
  if (!issue) return null;
  if (issue === 'name_missing' || issue === 'name_too_long') return 'name';
  if (issue === 'email_invalid') return 'email';
  if (issue === 'phone_invalid') return 'phone';
  if (issue === 'note_too_long') return 'note';
  return 'contact';
};

export function InvitePatientForm({ pendingActivation, onImport, onCreated, onOpenImport }: InvitePatientFormProps) {
  const { t } = useLanguage();
  const { confirm, dialog } = useConfirmAction();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [issue, setIssue] = useState<RowIssue | null>(null);
  const [serverReason, setServerReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const errorFor = (field: ReturnType<typeof fieldOf>) =>
    fieldOf(issue) === field ? <p className="fi-err" role="alert">{t(reasonKey(issue))}</p> : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerReason(null);
    const row = normalizePatientRow({ full_name: name, email, phone, note });
    const problem = validatePatientRow(row);
    setIssue(problem);
    if (problem || pendingActivation) return;

    const details = [
      { label: t('mm2.importar.col.name'), value: row.full_name },
      ...(row.email ? [{ label: t('mm2.importar.col.email'), value: row.email }] : []),
      ...(row.phone ? [{ label: t('mm2.importar.col.phone'), value: row.phone }] : []),
      { label: t('mm2.importar.confirm.emails'), value: t('mm2.importar.confirm.emailsValue') },
    ];
    const ok = await confirm({
      title: fill(t('mm2.importar.invite.confirmTitle'), { name: row.full_name }),
      description: t('mm2.importar.invite.confirmDesc'),
      details,
      confirmLabel: t('mm2.importar.invite.confirm'),
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const res = await onImport([row]);
      if (res.ok === false) {
        toast.error(t(failureKey(res.reason)));
        return;
      }
      const first = res.data.rows[0];
      if (first?.result === 'created') {
        toast.success(fill(t('mm2.importar.invite.created'), { name: row.full_name }));
        setName('');
        setEmail('');
        setPhone('');
        setNote('');
        setIssue(null);
        onCreated();
      } else {
        setServerReason(first?.reason || 'invalid');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fi-form-shell">
      <div className="flex items-start gap-2.5 mb-3">
        <span className="pro-icon-box"><UserPlus /></span>
        <div className="min-w-0">
          <p className="text-sm font-bold pro-ink">{t('mm2.importar.invite.title')}</p>
          <p className="text-xs pro-muted leading-snug">{t('mm2.importar.invite.desc')}</p>
        </div>
      </div>

      {pendingActivation && (
        <div className="fi-notice is-warn mb-3" role="status">
          <AlertTriangle />
          <span>{t('mm2.importar.pendingActivation')}</span>
        </div>
      )}

      <form className="fi-form" onSubmit={submit} noValidate>
        <div className="fi-field fi-span">
          <label htmlFor="fi-invite-name">{t('mm2.importar.invite.name')}</label>
          <input id="fi-invite-name" className="fi-input" value={name} maxLength={120} autoComplete="off" onChange={e => setName(e.target.value)} />
          {errorFor('name')}
        </div>
        <div className="fi-field">
          <label htmlFor="fi-invite-email">{t('mm2.importar.invite.email')}</label>
          <input id="fi-invite-email" type="email" inputMode="email" className="fi-input" value={email} maxLength={254} autoComplete="off" onChange={e => setEmail(e.target.value)} />
          {errorFor('email')}
        </div>
        <div className="fi-field">
          <label htmlFor="fi-invite-phone">{t('mm2.importar.invite.phone')}</label>
          <input id="fi-invite-phone" type="tel" inputMode="tel" className="fi-input" value={phone} maxLength={24} autoComplete="off" onChange={e => setPhone(e.target.value)} />
          {errorFor('phone')}
        </div>
        {fieldOf(issue) === 'contact' && <p className="fi-err fi-span" role="alert">{t(reasonKey(issue))}</p>}
        <div className="fi-field fi-span">
          <label htmlFor="fi-invite-note">{t('mm2.importar.invite.note')}</label>
          <input id="fi-invite-note" className="fi-input" value={note} maxLength={500} autoComplete="off" onChange={e => setNote(e.target.value)} />
          {errorFor('note')}
        </div>

        {serverReason && (
          <div className="fi-notice is-warn fi-span" role="alert">
            <Info />
            <span>{t(reasonKey(serverReason))}</span>
          </div>
        )}

        <div className="fi-span flex flex-wrap items-center gap-2">
          <button type="submit" className="pro-btn pro-btn-teal pro-btn-sm" disabled={submitting || pendingActivation}>
            {submitting ? <Loader2 className="animate-spin" /> : <UserPlus />} {t('mm2.importar.invite.submit')}
          </button>
          <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={onOpenImport}>
            <Upload /> {t('mm2.importar.invite.orImport')}
          </button>
        </div>
      </form>
      {dialog}
    </div>
  );
}

export default InvitePatientForm;
