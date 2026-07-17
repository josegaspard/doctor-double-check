import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSocialLinks } from '@/hooks/useSiteSettings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Clock, CheckCircle, ArrowRight, ArrowLeft, Home, Eye, Facebook, Instagram, Twitter, Linkedin, Youtube } from 'lucide-react';
import { AppBackground } from '@/components/layout/AppBackground';
import { LanguageSwitcher } from '@/components/settings/LanguageSwitcher';
import logoMedicalMastersWhite from '@/assets/logo-medical-masters-white.png';

// Shell con el MISMO header + footer que Login/Onboarding/ResetPassword
// (app-shell-header / app-shell-footer) para que la pantalla no salga "pelada".
function VerificationShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { socialLinks } = useSocialLinks();

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

      {/* Footer */}
      <footer className="app-shell-footer py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <img src={logoMedicalMastersWhite} alt="Medical Masters" className="h-8 w-auto" />
                <span className="text-sm text-light">{t('footer.platform')}</span>
              </div>
              <div className="flex items-center gap-4">
                {socialLinks.facebook && (
                  <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-light/90 hover:text-light transition-colors">
                    <Facebook className="w-5 h-5" />
                  </a>
                )}
                {socialLinks.instagram && (
                  <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-light/90 hover:text-light transition-colors">
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
                {socialLinks.twitter && (
                  <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-light/90 hover:text-light transition-colors">
                    <Twitter className="w-5 h-5" />
                  </a>
                )}
                {socialLinks.linkedin && (
                  <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-light/90 hover:text-light transition-colors">
                    <Linkedin className="w-5 h-5" />
                  </a>
                )}
                {socialLinks.youtube && (
                  <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="text-light/90 hover:text-light transition-colors">
                    <Youtube className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>
            <div className="border-t border-light/20" />
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <nav className="flex items-center gap-6">
                <Link to="/terms" className="text-sm text-light/90 hover:text-light transition-colors">
                  {t('footer.termsOfService')}
                </Link>
                <Link to="/privacy" className="text-sm text-light/90 hover:text-light transition-colors">
                  {t('footer.privacyPolicy')}
                </Link>
              </nav>
              <p className="app-shell-footer-copy text-sm">{t('footer.copyright')}</p>
            </div>
          </div>
        </div>
      </footer>
    </AppBackground>
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
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-warning/20 flex items-center justify-center">
            <Clock className="w-8 h-8 text-warning" />
          </div>
          <CardTitle className="text-2xl">{t('verificationPendingPage.pendingTitle')}</CardTitle>
          <CardDescription>
            {role === 'doctor'
              ? t('verificationPendingPage.pendingDescriptionDoctor')
              : t('verificationPendingPage.pendingDescriptionResident')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Info */}
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
