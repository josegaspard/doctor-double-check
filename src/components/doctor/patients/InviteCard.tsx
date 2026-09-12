// Tarjeta «Invitado» de Mis pacientes (13-sep-2026): mismo formato que la
// tarjeta de paciente (pro-patient + dp-card), con las acciones de la
// invitación. Las acciones con consecuencias (enviar, revocar) las confirma la
// página con useConfirmAction; copiar el enlace no cambia nada.
import React from 'react';
import { Ban, Calendar, Copy, Mail, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppDateFormat } from '@/lib/dateFormat';
import { initialsOf } from '@/lib/proFormat';
import type { PatientInvite } from '@/hooks/usePatientInvites';
import '@/styles/funciones-importar.css';

interface InviteCardProps {
  invite: PatientInvite;
  busy?: boolean;
  onCopy: (invite: PatientInvite) => void;
  onSend: (invite: PatientInvite) => void;
  onRevoke: (invite: PatientInvite) => void;
}

export function InviteCard({ invite, busy, onCopy, onSend, onRevoke }: InviteCardProps) {
  const { t } = useLanguage();
  const { formatDate } = useAppDateFormat();

  const shortDate = (iso: string) => {
    const d = new Date(iso);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return formatDate(d, sameYear ? 'd MMM' : 'd MMM yyyy').replace('.', '');
  };
  const wasSent = invite.status === 'sent' && !!invite.sentAt;
  const noEmailHint = !invite.email ? t('mm2.importar.card.noEmail') : undefined;

  return (
    <article className="pro-patient dp-card fi-invite">
      <div className="top">
        <span className="pro-initials fi-invite-initials" aria-hidden="true">{initialsOf(invite.fullName)}</span>
        <div className="min-w-0 flex-1">
          <div className="name">{invite.fullName}</div>
          {invite.email && <div className="mail" title={invite.email}>{invite.email}</div>}
          {invite.phone && <div className="mail fi-invite-phone" title={invite.phone}>{invite.phone}</div>}
          <span className={`pro-pill mt-1.5 ${wasSent ? 'pro-pill-info' : 'pro-pill-muted'}`}>
            {wasSent ? t('mm2.importar.card.statusSent') : t('mm2.importar.card.statusInvited')}
          </span>
        </div>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button type="button" className="pro-kebab" aria-label={t('mm2.importar.card.more')}>
              <MoreHorizontal />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem onClick={() => onCopy(invite)}>
              <Copy className="w-4 h-4 mr-2" />
              {t('mm2.importar.card.copy')}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!invite.email || busy} onClick={() => onSend(invite)}>
              <Mail className="w-4 h-4 mr-2" />
              {t('mm2.importar.card.send')}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={busy} onClick={() => onRevoke(invite)}>
              <Ban className="w-4 h-4 mr-2" />
              {t('mm2.importar.card.revoke')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="dp-meta">
        <span>
          <Calendar />
          {t('mm2.importar.card.invited')}: {shortDate(invite.createdAt)}
        </span>
        <span>
          {t('mm2.importar.card.sent')}: {wasSent ? shortDate(invite.sentAt as string) : t('mm2.importar.card.notSent')}
        </span>
      </div>

      <div className="dp-acts">
        <button type="button" onClick={() => onCopy(invite)} title={t('mm2.importar.card.copy')}>
          <Copy /> <span>{t('mm2.importar.card.copyShort')}</span>
        </button>
        <button
          type="button"
          onClick={() => onSend(invite)}
          disabled={!invite.email || busy}
          title={noEmailHint || t('mm2.importar.card.send')}
        >
          <Mail /> <span>{t('mm2.importar.card.sendShort')}</span>
        </button>
        <button type="button" onClick={() => onRevoke(invite)} disabled={busy} title={t('mm2.importar.card.revoke')}>
          <Ban /> <span>{t('mm2.importar.card.revokeShort')}</span>
        </button>
      </div>
    </article>
  );
}

export default InviteCard;
