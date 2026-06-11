import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, CreditCard, Loader2, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';

export default function VendorStripeSetup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { language, t } = useLanguage();
  const { supabaseUser } = useAuth();
  const es = language === 'es';

  const [vendor, setVendor] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    if (!supabaseUser?.id) { setLoading(false); return; }
    const { data: v } = await (supabase as any).from('marketplace_vendors').select('*').eq('user_id', supabaseUser.id).maybeSingle();
    setVendor(v);
    if (v?.stripe_account_id) {
      const { data: st } = await supabase.functions.invoke('vendor-stripe-account-status', { body: { vendorId: v.id } });
      setStatus(st);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [supabaseUser?.id]);

  useEffect(() => {
    if (params.get('success')) toast.success(t('autoI18n.vendorStripe1'));
    if (params.get('refresh')) toast.info(t('autoI18n.vendorStripe2'));
  }, [params, es]);

  const startOnboarding = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('vendor-stripe-connect-onboarding', { body: {} });
    setBusy(false);
    if (error || !data?.success) {
      toast.error(error?.message || data?.error || 'Error');
      return;
    }
    window.location.href = data.url;
  };

  if (loading) return <MainLayout><div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></MainLayout>;
  if (!vendor) return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Button variant="back" size="sm" onClick={() => navigate('/')} className="mb-3 -ml-2 text-white hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('autoI18n.vendorStripe3')}
        </Button>
        <Card><CardContent className="p-6 text-center">
          <AlertCircle className="w-10 h-10 mx-auto text-warning mb-2" />
          <p>{t('autoI18n.vendorStripe4')}</p>
        </CardContent></Card>
      </div>
    </MainLayout>
  );

  const ready = status?.payoutsEnabled && status?.detailsSubmitted;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-2xl">
        <Button variant="back" size="sm" onClick={() => navigate('/vendor/dashboard')} className="mb-3 -ml-2 text-white hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('autoI18n.vendorStripe5')}
        </Button>

        <div className="mb-6 rounded-2xl bg-white border-2 border-primary/30 shadow-md p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shadow">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-secondary">{t('autoI18n.vendorStripe6')}</h1>
              <p className="text-xs text-secondary/70">{t('autoI18n.vendorStripe7')}</p>
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="p-5 space-y-4">
            {!vendor.stripe_account_id ? (
              <>
                <p className="text-sm">{t('autoI18n.vendorStripe8')}</p>
                <Button onClick={startOnboarding} disabled={busy} className="w-full">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ExternalLink className="w-4 h-4 mr-1" />}
                  {t('autoI18n.vendorStripe9')}
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  {ready ? <CheckCircle2 className="w-5 h-5 text-success" /> : <AlertCircle className="w-5 h-5 text-warning" />}
                  <p className="font-medium">
                    {ready
                      ? t('autoI18n.vendorStripe10')
                      : t('autoI18n.vendorStripe11')}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Card className="bg-muted/30"><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">{t('autoI18n.vendorStripe12')}</p>
                    <Badge variant={status?.detailsSubmitted ? 'verified' : 'secondary'} className="mt-1">{status?.detailsSubmitted ? '✓' : 'pendiente'}</Badge>
                  </CardContent></Card>
                  <Card className="bg-muted/30"><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">{t('autoI18n.vendorStripe13')}</p>
                    <Badge variant={status?.chargesEnabled ? 'verified' : 'secondary'} className="mt-1">{status?.chargesEnabled ? '✓' : 'pendiente'}</Badge>
                  </CardContent></Card>
                  <Card className="bg-muted/30"><CardContent className="p-3 text-center">
                    <p className="text-[10px] text-muted-foreground">{t('autoI18n.vendorStripe14')}</p>
                    <Badge variant={status?.payoutsEnabled ? 'verified' : 'secondary'} className="mt-1">{status?.payoutsEnabled ? '✓' : 'pendiente'}</Badge>
                  </CardContent></Card>
                </div>
                <Button onClick={startOnboarding} disabled={busy} variant="outline" className="w-full">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ExternalLink className="w-4 h-4 mr-1" />}
                  {ready ? t('autoI18n.vendorStripe15') : t('autoI18n.vendorStripe16')}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="mt-3 bg-muted/30 border-dashed">
          <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
            <p><strong>{t('autoI18n.vendorStripe17')}</strong></p>
            <p>• {t('autoI18n.vendorStripe18')}</p>
            <p>• {t('autoI18n.vendorStripe19')}</p>
            <p>• {t('autoI18n.vendorStripe20')}</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
