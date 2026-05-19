import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldOff, ArrowLeft, Lock, Download, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AccessDenied() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { t } = useLanguage();
  const reason = params.get('reason') || 'protected';
  const fileId = params.get('file_id');
  const patientId = params.get('patient_id');
  const loggedRef = useRef(false);

  // Si llegamos aquí desde un intento de acceso al Vault, registramos `access_denied`
  useEffect(() => {
    if (loggedRef.current) return;
    if (!fileId || !patientId) return;
    loggedRef.current = true;
    (async () => {
      try {
        await supabase.rpc('log_vault_action', {
          p_file_id: fileId,
          p_patient_id: patientId,
          p_action: 'access_denied',
          p_metadata: { source: 'access_denied_page', reason },
        });
      } catch (err) {
        console.warn('[AccessDenied] log_vault_action failed', err);
      }
    })();
  }, [fileId, patientId, reason]);

  const messages: Record<string, { title: string; description: string }> = {
    role: {
      title: t('accessDeniedPage.role.title'),
      description: t('accessDeniedPage.role.description'),
    },
    expired: {
      title: t('accessDeniedPage.expired.title'),
      description: t('accessDeniedPage.expired.description'),
    },
    drm: {
      title: t('accessDeniedPage.drm.title'),
      description: t('accessDeniedPage.drm.description'),
    },
    protected: {
      title: t('accessDeniedPage.protected.title'),
      description: t('accessDeniedPage.protected.description'),
    },
  };

  const m = messages[reason] || messages.protected;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-6 sm:p-10 text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldOff className="w-10 h-10 text-destructive" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{m.title}</h1>
              <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
                {m.description}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto pt-4">
              <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-left">
                <Lock className="w-5 h-5 text-primary mb-1" />
                <p className="text-xs font-medium text-foreground">{t('accessDeniedPage.badges.confidential.title')}</p>
                <p className="text-[11px] text-muted-foreground">{t('accessDeniedPage.badges.confidential.description')}</p>
              </div>
              <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-left">
                <Download className="w-5 h-5 text-destructive mb-1" />
                <p className="text-xs font-medium text-foreground">{t('accessDeniedPage.badges.noDownloads.title')}</p>
                <p className="text-[11px] text-muted-foreground">{t('accessDeniedPage.badges.noDownloads.description')}</p>
              </div>
              <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-left">
                <Eye className="w-5 h-5 text-info mb-1" />
                <p className="text-xs font-medium text-foreground">{t('accessDeniedPage.badges.unlimitedView.title')}</p>
                <p className="text-[11px] text-muted-foreground">{t('accessDeniedPage.badges.unlimitedView.description')}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-4">
              <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                {t('accessDeniedPage.actions.back')}
              </Button>
              <Button asChild>
                <Link to="/help">{t('accessDeniedPage.actions.contactSupport')}</Link>
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground pt-2">
              {t('accessDeniedPage.footer.policy')}
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
