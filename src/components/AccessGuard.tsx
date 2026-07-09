import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppRole as UserRole } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Lock, LogIn, UserPlus, Loader2, ChevronDown, ChevronUp, Info } from 'lucide-react';

interface AccessGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  requiresEntitlement?: 'chat' | 'recordings';
  /** Si true, un doctor/residente con perfil NO 'approved' es bloqueado y enviado
   *  a /verification-pending (antes cualquier doctor pending entraba al panel). */
  requireApproved?: boolean;
  fallbackMessage?: string;
  fallbackType?: 'login' | 'upgrade' | 'forbidden';
  /** Optional human-readable feature label for audit panel */
  featureLabel?: string;
}

export default function AccessGuard({
  children,
  allowedRoles,
  requiresEntitlement,
  requireApproved = false,
  fallbackMessage,
  fallbackType = 'login',
  featureLabel,
}: AccessGuardProps) {
  const { user, role, isAuthenticated, isLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [auditOpen, setAuditOpen] = useState(false);

  // Gate de "aprobado": el status vive en el perfil de doctor/residente. Admin
  // siempre pasa. Si aún no cargó el perfil, no bloqueamos (evita falso negativo).
  const approvalStatus = user?.doctorProfile?.status ?? user?.residentProfile?.status;
  const needsApproval = requireApproved && role !== 'admin' && (role === 'doctor' || role === 'resident');
  const notApproved = needsApproval && !!approvalStatus && approvalStatus !== 'approved';
  useEffect(() => {
    if (!isLoading && notApproved) {
      navigate('/verification-pending', { replace: true });
    }
  }, [isLoading, notApproved, navigate]);

  // Si el usuario NO tiene sesión (p. ej. acaba de cerrar sesión estando en una
  // página protegida), NO mostramos "Acceso denegado": lo llevamos al landing con
  // una pantalla de carga (cliente 2026-06-19). Las páginas tipo 'login' (que
  // invitan a iniciar sesión en línea) conservan su prompt.
  const loggedOutRedirect = !isLoading && !isAuthenticated && fallbackType !== 'login';
  useEffect(() => {
    if (loggedOutRedirect) {
      navigate('/', { replace: true });
    }
  }, [loggedOutRedirect, navigate]);

  if (isLoading || loggedOutRedirect || notApproved) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check role access
  const hasRoleAccess = role && allowedRoles.includes(role);

  // Check entitlement if required
  let hasEntitlement = true;
  let entitlementReason = '';
  if (requiresEntitlement && user) {
    if (requiresEntitlement === 'chat') {
      const ent = user.entitlements?.find((e) => e.type === 'chat');
      hasEntitlement = !!ent && ent.isActive && (!ent.expiresAt || new Date(ent.expiresAt) > new Date());
      if (!hasEntitlement) {
        entitlementReason = ent
          ? (ent.expiresAt && new Date(ent.expiresAt) <= new Date()
              ? `Tu acceso al chat expiró el ${new Date(ent.expiresAt).toLocaleDateString('es-MX')}`
              : 'Tu acceso al chat no está activo')
          : 'No has comprado una orientación médica activa';
      }
    } else if (requiresEntitlement === 'recordings') {
      hasEntitlement = role === 'doctor' || role === 'admin';
      if (!hasEntitlement) entitlementReason = 'Las grabaciones requieren compra individual o suscripción';
    }
  }

  if (!hasRoleAccess || !hasEntitlement) {
    // Build audit reasons (why was this blocked?)
    const reasons: { label: string; status: 'fail' | 'pass'; detail: string }[] = [
      {
        label: 'Sesión iniciada',
        status: isAuthenticated ? 'pass' : 'fail',
        detail: isAuthenticated ? `Conectado como ${user?.email || user?.name || 'usuario'}` : 'Necesitas iniciar sesión',
      },
      {
        label: 'Rol autorizado',
        status: hasRoleAccess ? 'pass' : 'fail',
        detail: hasRoleAccess
          ? `Tu rol "${role}" tiene acceso`
          : `Tu rol actual es "${role || 'visitante'}". Roles permitidos: ${allowedRoles.join(', ')}`,
      },
    ];
    if (requiresEntitlement) {
      reasons.push({
        label: `Permiso (${requiresEntitlement})`,
        status: hasEntitlement ? 'pass' : 'fail',
        detail: hasEntitlement ? 'Permiso activo' : entitlementReason || 'Permiso requerido no activo',
      });
    }

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-3 sm:p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 sm:p-8 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              {fallbackType === 'login' ? (
                <Lock className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground" />
              ) : fallbackType === 'upgrade' ? (
                <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-premium" />
              ) : (
                <Lock className="w-7 h-7 sm:w-8 sm:h-8 text-destructive" />
              )}
            </div>

            <h2 className="font-heading text-lg sm:text-xl font-bold text-foreground mb-2">
              {fallbackType === 'login' && t('login.title')}
              {fallbackType === 'upgrade' && t('recordings.premiumContent')}
              {fallbackType === 'forbidden' && t('admin.accessDenied')}
            </h2>

            <p className="text-sm text-muted-foreground mb-4 sm:mb-6">
              {fallbackMessage || (
                fallbackType === 'login'
                  ? t('chat.chatUnavailable')
                  : fallbackType === 'upgrade'
                  ? t('chat.premiumService')
                  : t('admin.onlyAdmins')
              )}
            </p>

            {/* Audit panel — explains exactly why access was blocked */}
            <div className="mb-4 text-left">
              <button
                type="button"
                onClick={() => setAuditOpen((s) => !s)}
                className="w-full flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md bg-muted/50 hover:bg-muted min-h-[44px]"
                aria-expanded={auditOpen}
              >
                <span className="flex items-center gap-2">
                  <Info className="w-3.5 h-3.5" />
                  ¿Por qué no puedo entrar?{featureLabel ? ` (${featureLabel})` : ''}
                </span>
                {auditOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {auditOpen && (
                <ul className="mt-2 space-y-1.5 bg-muted/30 border border-border rounded-md p-3">
                  {reasons.map((r) => (
                    <li key={r.label} className="flex items-start gap-2 text-xs">
                      <Badge
                        variant={r.status === 'pass' ? 'success' : 'destructive'}
                        className="text-[10px] px-1.5 py-0 mt-0.5 flex-shrink-0"
                      >
                        {r.status === 'pass' ? 'OK' : 'BLOQ'}
                      </Badge>
                      <span className="flex-1 min-w-0">
                        <span className="font-medium text-foreground">{r.label}:</span>{' '}
                        <span className="text-muted-foreground break-words">{r.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
              {fallbackType === 'login' && (
                <>
                  <Button onClick={() => navigate('/login')} className="gap-2 min-h-[44px]">
                    <LogIn className="w-4 h-4" />
                    {t('nav.login')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/login')}
                    className="gap-2 min-h-[44px]"
                  >
                    <UserPlus className="w-4 h-4" />
                    {t('login.register')}
                  </Button>
                </>
              )}
              {fallbackType === 'upgrade' && (
                <Button onClick={() => navigate('/wallet')} className="gap-2 min-h-[44px]">
                  <Shield className="w-4 h-4" />
                  {t('chat.viewOptions')}
                </Button>
              )}
              <Button variant="ghost" onClick={() => navigate('/lives')} className="min-h-[44px]">
                {t('chat.goToLives')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
