import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, DollarSign, Loader2, TrendingUp, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function VendorEarnings() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { supabaseUser } = useAuth();

  const [vendor, setVendor] = useState<any>(null);
  const [balance, setBalance] = useState<any>(null);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseUser?.id) return;
    (async () => {
      setLoading(true);
      const { data: v } = await (supabase as any).from('marketplace_vendors').select('*').eq('user_id', supabaseUser.id).maybeSingle();
      if (!v) { setLoading(false); return; }
      setVendor(v);
      const [{ data: bal }, { data: es_data }, { data: po }] = await Promise.all([
        (supabase as any).rpc('get_vendor_payout_balance', { p_vendor_id: v.id }),
        (supabase as any).from('vendor_earnings').select('*, marketplace_orders(id, total_amount, marketplace_products(name))').eq('vendor_id', v.id).order('created_at', { ascending: false }).limit(100),
        (supabase as any).from('vendor_payouts').select('*').eq('vendor_id', v.id).order('initiated_at', { ascending: false }).limit(50),
      ]);
      setBalance(bal?.[0]);
      setEarnings(es_data || []);
      setPayouts(po || []);
      setLoading(false);
    })();
  }, [supabaseUser?.id]);

  const fmt = (n: number) => Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) return <MainLayout><div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></MainLayout>;
  if (!vendor) return (
    <MainLayout>
      <div className="container mx-auto px-4 py-16 max-w-md">
        <Card>
          <CardContent className="p-6 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">{t('fix20.pages.vendorNotFound')}</p>
            <Button size="sm" className="gap-1.5" onClick={() => navigate('/vendor/dashboard')}>
              {t('autoI18n.vendorEarn1')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-3xl">
        <Button variant="back" size="sm" onClick={() => navigate('/vendor/dashboard')} className="mb-3 -ml-2 text-white hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('autoI18n.vendorEarn1')}
        </Button>

        <div className="mb-4 rounded-2xl bg-white border-2 border-primary/30 shadow-md p-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shadow">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-secondary">{t('autoI18n.vendorEarn2')}</h1>
              <p className="text-xs text-secondary/70">{vendor.name}</p>
            </div>
          </div>
        </div>

        {!vendor.stripe_payouts_enabled && (
          <Card className="mb-4 bg-warning/10 border-warning">
            <CardContent className="p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <p className="font-medium">{t('autoI18n.vendorEarn3')}</p>
                <Button size="sm" className="mt-2" onClick={() => navigate('/vendor/stripe-setup')}>{t('autoI18n.vendorEarn4')}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-2 mb-4">
          <Card><CardContent className="p-3">
            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-warning" /><p className="text-[10px] text-muted-foreground">{t('autoI18n.vendorEarn5')}</p></div>
            <p className="text-base sm:text-lg font-bold font-mono mt-1">{fmt(balance?.pending_amount || 0)}</p>
            <p className="text-[10px] text-muted-foreground">{balance?.pending_count || 0} {t('autoI18n.vendorEarn6')}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-primary" /><p className="text-[10px] text-muted-foreground">{t('autoI18n.vendorEarn7')}</p></div>
            <p className="text-base sm:text-lg font-bold font-mono mt-1 text-primary">{fmt(balance?.available_amount || 0)}</p>
            <p className="text-[10px] text-muted-foreground">{balance?.available_count || 0} {t('autoI18n.vendorEarn8')}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3">
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-success" /><p className="text-[10px] text-muted-foreground">{t('autoI18n.vendorEarn9')}</p></div>
            <p className="text-base sm:text-lg font-bold font-mono mt-1 text-success">{fmt(balance?.total_paid || 0)}</p>
          </CardContent></Card>
        </div>

        <Card className="mb-4">
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-2">{t('autoI18n.vendorEarn10')}</p>
            {payouts.length === 0 ? <p className="text-xs text-muted-foreground">{t('autoI18n.vendorEarn11')}</p> : (
              <div className="space-y-1">
                {payouts.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
                    <div>
                      <span className="font-medium">{fmt(p.total_amount)} {p.currency}</span>
                      <span className="text-muted-foreground"> · {p.earnings_count} {t('autoI18n.vendorEarn12')}</span>
                    </div>
                    <div className="text-right">
                      <Badge variant={p.status === 'paid' ? 'verified' : 'secondary'} className="text-[10px]">{p.status}</Badge>
                      <p className="text-[10px] text-muted-foreground">{new Date(p.initiated_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-2">{t('autoI18n.vendorEarn13')}</p>
            {earnings.length === 0 ? <p className="text-xs text-muted-foreground">{t('autoI18n.vendorEarn14')}</p> : (
              <div className="space-y-1">
                {earnings.map(e => (
                  <div key={e.id} className="flex items-center justify-between p-2 bg-muted/20 rounded text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{e.marketplace_orders?.marketplace_products?.name || '—'}</p>
                      <p className="text-muted-foreground">{new Date(e.created_at).toLocaleDateString()} · {(Number(e.commission_rate) * 100).toFixed(0)}% comisión</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold">{fmt(e.net_amount)} {e.currency}</p>
                      <Badge variant={e.status === 'paid' ? 'verified' : 'secondary'} className="text-[10px]">{e.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
