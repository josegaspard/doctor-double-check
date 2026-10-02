import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Clock, CheckCircle, ArrowRight, ArrowLeft, Home, Eye, XCircle, FileCheck, CircleDashed } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { doctorHref } from '@/lib/doctorSections';
import { AppBackground } from '@/components/layout/AppBackground';
import { UnifiedFooter } from '@/components/layout/UnifiedFooter';
import { LanguageSwitcher } from '@/components/settings/LanguageSwitcher';
import logoMedicalMastersWhite from '@/assets/logo-medical-masters-white.png';

// Shell con el MISMO header + footer que Login/Onboarding/ResetPassword
// (app-shell-header / app-shell-footer) para que la pantalla no salga "pelada".
function VerificationShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <AppBackground className="min-h-[100dvh] flex flex-col">
      {/* Header */}
      <header className="app-shell-header">
        <div className="container mx-auto px-4 py-4">
          <div className="relative flex items-center justify-between min-h-14">
            <Button variant="outline" size="icon" onClick={() => navigate('/')} className="app-shell-icon-button">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            {/* Logo GRANDE y centrado, mismo tamaño que el landing (cliente 10-jul) */}
            <Link to="/" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <img src={logoMedicalMastersWhite} alt="Medical Masters" className="h-14 w-auto" />
            </Link>
            <LanguageSwitcher className="text-white hover:text-white hover:bg-white/15" />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
        {children}
      </main>

      {/* Footer COMPLETO — el mismo de toda la app (marca+redes, Plataforma,
          Recursos, Legal, copyright, DMCA). No una versión recortada. */}
      <UnifiedFooter variant="app" />
    </AppBackground>
  );
}

type CredState = 'pending' | 'approved' | 'rejected' | null;
interface CredRow {
  cedula_status: CredState;
  cedula_rejection_reason: string | null;
  cofepris_status: CredState;
  cofepris_rejection_reason: string | null;
  cofepris_has: boolean | null;
}

/** Estado de cada documento del médico (cédula y COFEPRIS) con motivo si se rechazó. */
function CredentialChecklist({ row, onFix }: { row: CredRow; onFix: () => void }) {
  const { t } = useLanguage();
  const item = (label: string, status: CredState, reason: string | null, extra?: string) => {
    const icon = status === 'approved'
      ? <CheckCircle className="w-5 h-5 text-success shrink-0" />
      : status === 'rejected'
        ? <XCircle className="w-5 h-5 text-destructive shrink-0" />
        : status === 'pending'
          ? <Clock className="w-5 h-5 text-warning shrink-0" />
          : <CircleDashed className="w-5 h-5 text-muted-foreground shrink-0" />;
    const badge = status === 'approved'
      ? <Badge variant="success" className="text-[11px]">{t('cofepris.status.approved')}</Badge>
      : status === 'rejected'
        ? <Badge variant="destructive" className="text-[11px]">{t('cofepris.status.rejected')}</Badge>
        : status === 'pending'
          ? <Badge variant="warning" className="text-[11px]">{t('cofepris.status.pending')}</Badge>
          : null;
    return (
      <li className="flex items-start gap-3 py-2.5">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground">{label}</p>
            {badge}
          </div>
          {status === 'rejected' && (
            <p className="text-xs text-destructive mt-0.5">
              {reason?.trim() ? t('cofepris.rejectedReason').replace('{reason}', reason.trim()) : t('cofepris.rejectedDefault')}
            </p>
          )}
          {extra && <p className="text-xs text-muted-foreground mt-0.5">{extra}</p>}
        </div>
      </li>
    );
  };
  const anyRejected = row.cedula_status === 'rejected' || row.cofepris_status === 'rejected';
  const cofeprisExtra = !row.cofepris_status
    ? (row.cofepris_has === false ? t('cofepris.notHasHelp') : t('cofepris.noneHelp'))
    : row.cofepris_status === 'pending' ? t('cofepris.pendingHelp') : undefined;
  return (
    <div className="rounded-lg border border-border/60 p-4">
      <p className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
        <FileCheck className="w-4 h-4 text-primary" /> {t('cofepris.verification.title')}
      </p>
      <ul className="divide-y divide-border/60">
        {item(t('cofepris.verification.cedula'), row.cedula_status ?? 'pending', row.cedula_rejection_reason,
          (row.cedula_status ?? 'pending') === 'pending' ? t('cofepris.verification.cedulaPendingHelp') : undefined)}
        {item(`${t('cofepris.verification.cofepris')} (${t('cofepris.verification.optional')})`, row.cofepris_status, row.cofepris_rejection_reason, cofeprisExtra)}
      </ul>
      <Button
        variant={anyRejected ? 'default' : 'outline'}
        size="sm"
        className="w-full mt-3 gap-2"
        onClick={onFix}
      >
        {anyRejected ? t('cofepris.verification.fixInProfile') : t('cofepris.verification.goToProfile')}
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

export default function VerificationPending() {
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();
  const { t } = useLanguage();

  const isPending = (role === 'doctor' && user?.doctorProfile?.status === 'pending') ||
                   (role === 'resident' && user?.residentProfile?.status === 'pending');

  const isApproved = (role === 'doctor' && user?.doctorProfile?.status === 'approved') ||
                    (role === 'resident' && user?.residentProfile?.status === 'approved');
  const isRejected = (role === 'doctor' && user?.doctorProfile?.status === 'rejected') ||
                    (role === 'resident' && user?.residentProfile?.status === 'rejected');

  // Estado de cada documento del médico: antes la página decía «revisando» sin decir QUÉ,
  // y un médico rechazado veía lo mismo que uno pendiente (cliente 2026-10-01).
  const [creds, setCreds] = useState<CredRow | null>(null);
  useEffect(() => {
    if (role !== 'doctor' || !user?.id) return;
    let cancelled = false;
    (supabase as any)
      .from('doctor_profiles')
      .select('cedula_status, cedula_rejection_reason, cofepris_status, cofepris_rejection_reason, cofepris_has')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }: any) => {
        if (cancelled) return;
        if (data) { setCreds(data as CredRow); return; }
        // Sin las columnas nuevas aún (migración 20261001 sin aplicar): solo la cédula.
        if (error) {
          supabase.from('doctor_profiles')
            .select('cedula_status, cedula_rejection_reason, cofepris_status, cofepris_rejection_reason')
            .eq('user_id', user.id).maybeSingle()
            .then(({ data: d2 }) => { if (!cancelled && d2) setCreds({ ...(d2 as any), cofepris_has: null }); });
        }
      });
    return () => { cancelled = true; };
  }, [role, user?.id]);
  const goFix = () => navigate(doctorHref('cuenta', { tab: 'perfil', b: 'trayectoria' }));

  if (isApproved) {
    return (
      <VerificationShell>
        <Card className="relative z-10 max-w-md w-full border-success/30 bg-success/5">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <CardTitle className="text-2xl">{t('verificationPendingPage.approvedTitle')}</CardTitle>
            <CardDescription>
              {t('verificationPendingPage.approvedDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" onClick={() => navigate('/doctor/dashboard')}>
              {t('verificationPendingPage.goToDashboard')}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </VerificationShell>
    );
  }

  return (
    <VerificationShell>
      <Card className="relative z-10 max-w-md w-full">
        <CardHeader className="text-center">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isRejected ? 'bg-destructive/15' : 'bg-warning/20'}`}>
            {isRejected ? <XCircle className="w-8 h-8 text-destructive" /> : <Clock className="w-8 h-8 text-warning" />}
          </div>
          <CardTitle className="text-2xl">
            {isRejected ? t('cofepris.verification.rejectedTitle') : t('verificationPendingPage.pendingTitle')}
          </CardTitle>
          <CardDescription>
            {isRejected
              ? t('cofepris.verification.rejectedBody')
              : role === 'doctor'
                ? t('verificationPendingPage.pendingDescriptionDoctor')
                : t('verificationPendingPage.pendingDescriptionResident')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {role === 'doctor' && creds && <CredentialChecklist row={creds} onFix={goFix} />}

          {/* Status Info (no aplica si ya se rechazó: ahí manda la lista de arriba) */}
          {!isRejected && (
          <div className="rounded-lg border border-border/60 bg-muted/60 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">{t('verificationPendingPage.credentialsReviewTitle')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('verificationPendingPage.credentialsReviewDescription')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-warning mt-0.5" />
              <div>
                <p className="font-medium text-sm">{t('verificationPendingPage.estimatedTimeTitle')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('verificationPendingPage.estimatedTimeDescription')}
                </p>
              </div>
            </div>
          </div>
          )}

          {/* While you wait */}
          <div>
            <p className="text-sm font-medium mb-3">{t('verificationPendingPage.meanwhileLabel')}</p>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => navigate('/lives')}
              >
                <Eye className="w-4 h-4" />
                {t('verificationPendingPage.exploreLives')}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => navigate('/recordings')}
              >
                <Home className="w-4 h-4" />
                {t('verificationPendingPage.viewRecordings')}
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-border/70">
            <Button variant="ghost" className="flex-1 text-foreground hover:text-foreground" onClick={() => navigate('/')}>
              {t('verificationPendingPage.backToHome')}
            </Button>
            {/* Al cerrar sesión SIEMPRE aterrizar en el landing (cliente 2026-07-02). */}
            <Button variant="outline" className="flex-1" onClick={() => { logout(); navigate('/', { replace: true }); }}>
              {t('verificationPendingPage.logout')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </VerificationShell>
  );
}
