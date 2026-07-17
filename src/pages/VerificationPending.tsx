import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Clock, CheckCircle, ArrowRight, Home, Eye } from 'lucide-react';
import { AppBackground } from '@/components/layout/AppBackground';

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
      <AppBackground className="min-h-[100dvh] flex items-center justify-center p-4 py-10">
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
      </AppBackground>
    );
  }

  return (
    <AppBackground className="min-h-[100dvh] flex items-center justify-center p-4 py-10">
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
    </AppBackground>
  );
}
