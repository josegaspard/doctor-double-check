import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CheckCircle2, Clock, XCircle, ShieldCheck, Info } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export type CredentialType = 'cedula' | 'cofepris';
export type CredentialStatus = 'pending' | 'approved' | 'rejected' | null | undefined;

interface CredentialStatusBadgeProps {
  type: CredentialType;
  status?: CredentialStatus;
  value?: string | null;
  rejectionReason?: string | null;
  size?: 'xs' | 'sm';
  className?: string;
}

/**
 * Badge unificado para mostrar el estado de verificación de credenciales médicas
 * (Cédula Profesional / Permiso COFEPRIS) con explicación de razón si está rechazada.
 */
export function CredentialStatusBadge({
  type,
  status,
  value,
  rejectionReason,
  size = 'xs',
  className,
}: CredentialStatusBadgeProps) {
  const { t } = useLanguage();
  // Compliance: el badge SIEMPRE renderiza (en /lives card y en LivePlayer la
  // barra "Profesional verificado" debe ser visible aunque la credencial aún
  // no esté cargada). Si no hay value, mostramos "Pendiente" en vez de ocultar.
  const hasValue = !!(value && String(value).trim());
  // COFEPRIS sin estado NUNCA se da por aprobado: solo cuenta lo que revisó el equipo
  // (cliente 2026-10-01). La cédula conserva el criterio anterior.
  const effectiveStatus: CredentialStatus =
    status || (type === 'cedula' && hasValue ? 'approved' : 'pending');

  const labels = {
    cedula: t('cofepris.badge.cedulaShort'),
    cofepris: t('cofepris.badge.cofeprisShort'),
  };

  const fullLabels = {
    cedula: t('cofepris.badge.cedulaFull'),
    cofepris: t('cofepris.badge.cofeprisFull'),
  };
  const tip = (key: string, reason = '') =>
    t(`cofepris.badge.${key}`).replace('{label}', fullLabels[type]).replace('{reason}', reason);

  const config = (() => {
    switch (effectiveStatus) {
      case 'approved':
        return {
          variant: type === 'cedula' ? 'success' : 'info',
          icon: ShieldCheck,
          tooltip: tip('approvedTip'),
        } as const;
      case 'pending':
        return {
          variant: 'warning',
          icon: Clock,
          tooltip: tip('pendingTip'),
        } as const;
      case 'rejected':
        return {
          variant: 'destructive',
          icon: XCircle,
          tooltip:
            rejectionReason && rejectionReason.trim()
              ? tip('rejectedTipReason', rejectionReason.trim())
              : tip('rejectedTip'),
        } as const;
      default:
        return {
          variant: 'secondary',
          icon: Info,
          tooltip: tip('noneTip'),
        } as const;
    }
  })();

  const Icon = config.icon;
  const sizeCls =
    size === 'xs'
      ? 'text-[10px] px-1.5 py-0 h-4 gap-0.5'
      : 'text-xs px-2 py-0.5 gap-1';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center cursor-help ${className || ''}`}
          aria-label={config.tooltip}
        >
          <Badge
            variant={config.variant as any}
            className={`${sizeCls} leading-none whitespace-nowrap shrink-0`}
          >
            <Icon className={size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            <span className="font-medium">{labels[type]}</span>
            <span className="opacity-90 ml-0.5 truncate max-w-[80px]">
              {hasValue ? String(value).slice(0, 12) : t('cofepris.badge.pendingValue')}
            </span>
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 text-xs">
        <div className="flex items-start gap-2">
          <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-semibold text-sm text-foreground">{fullLabels[type]}</p>
            <p className="text-muted-foreground">{config.tooltip}</p>
            {effectiveStatus === 'approved' && (
              <p className="text-success flex items-center gap-1 text-[11px] mt-1">
                <CheckCircle2 className="w-3 h-3" /> {t('mm2.common.credentialApprovedBadge')}
              </p>
            )}
            {effectiveStatus === 'pending' && (
              <p className="text-warning text-[11px] mt-1">
                {t('cofepris.badge.pendingEta')}
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
