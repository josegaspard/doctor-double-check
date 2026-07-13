import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft, DollarSign, TrendingUp, Wallet, AlertTriangle, Download, RefreshCw, Loader2, Receipt, CreditCard, FileText, Calculator } from 'lucide-react';

interface SummaryRow {
  account: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

const ACCOUNT_LABELS_ES: Record<string, string> = {
  cash_in: 'Efectivo entrante (telemedicina)',
  cash_stripe: 'Efectivo entrante (Stripe / marketplace)',
  revenue_gross: 'Ingreso bruto marketplace',
  revenue_platform: 'Comisión plataforma (ingreso)',
  liability_doctor_payable: 'Adeudo a doctores',
  liability_vendor_payable: 'Adeudo a vendors',
  liability_user_wallet: 'Saldo de usuarios (wallets)',
  expense_stripe_fee: 'Gastos comisiones Stripe',
  receivable_marketplace_fee: 'Fees marketplace por cobrar',
  tax_iva_payable: 'IVA por pagar',
  shipping_collected: 'Envío recaudado',
  refund_expense: 'Reembolsos pagados',
  dispute_loss: 'Pérdida por disputas',
};

export default function AdminAccounting() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t } = useLanguage();

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState<string>(monthStart.toISOString().slice(0, 10));
  const [to, setTo] = useState<string>(today.toISOString().slice(0, 10));
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { if (role && role !== 'admin') navigate('/'); }, [role, navigate]);

  const fetchData = async () => {
    setLoading(true);
    const fromIso = new Date(from).toISOString();
    const toIso = new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000).toISOString();
    // OJO: hint de FK obligatorio en product_interests↔marketplace_products
    // (dos relaciones: product_id y reserved_interest_id).
    const [{ data: sum, error: sumErr }, { data: rec }, { data: buys }] = await Promise.all([
      (supabase as any).rpc('get_accounting_summary', { p_from: fromIso, p_to: toIso }),
      (supabase as any).from('accounting_ledger').select('*').gte('created_at', fromIso).lt('created_at', toIso).order('created_at', { ascending: false }).limit(100),
      (supabase as any).from('product_interests')
        .select('id, status, fee_status, fee_amount, fee_rate, product_price, currency, created_at, completed_at, buyer_id, marketplace_products!product_interests_product_id_fkey(name), marketplace_vendors(name)')
        .gte('created_at', fromIso).lt('created_at', toIso)
        .order('created_at', { ascending: false }).limit(200),
    ]);
    if (sumErr) toast.error(sumErr.message);
    setSummary(sum || []);
    setRecent(rec || []);
    const buyRows = (buys as any[]) || [];
    const buyerIds = Array.from(new Set(buyRows.map(b => b.buyer_id).filter(Boolean)));
    if (buyerIds.length > 0) {
      const { data: bp } = await (supabase as any).from('profiles').select('id, name').in('id', buyerIds);
      const names = new Map(((bp as any[]) || []).map(p => [p.id, p.name]));
      buyRows.forEach(b => { b.buyerName = names.get(b.buyer_id) || null; });
    }
    setPurchases(buyRows);
    setLoading(false);
  };
  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const get = (acct: string) => summary.find(s => s.account === acct);
  const balance = (acct: string) => Number(get(acct)?.balance || 0);

  // Cuentas de efectivo (débito positivo = entrada). cash_in = telemedicina,
  // cash_stripe = marketplace; el panel suma ambas para la vista de plataforma.
  const cashIn = balance('cash_stripe') + balance('cash_in');
  // Cuentas de ingreso/pasivo son 'credit' → su balance es negativo; se invierte.
  const platformRevenue = -balance('revenue_platform'); // comisión total (telemedicina + marketplace)
  const doctorPayable = -balance('liability_doctor_payable');
  const vendorPayable = -balance('liability_vendor_payable');
  const userWalletLiability = -balance('liability_user_wallet');
  const stripeFee = balance('expense_stripe_fee');
  const refundExpense = balance('refund_expense');
  const ivaPayable = -balance('tax_iva_payable');
  const netPlatform = platformRevenue - stripeFee - refundExpense;

  const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const exportCSV = async () => {
    setExporting(true);
    try {
      const fromIso = new Date(from).toISOString();
      const toIso = new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000).toISOString();
      const session = (await supabase.auth.getSession()).data.session;
      const supabaseUrl = (supabase as any).supabaseUrl;
      const res = await fetch(`${supabaseUrl}/functions/v1/export-accounting-csv?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `accounting_${from}_${to}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success(t('autoI18n.clAdminAccount29'));
    } catch (e: any) {
      toast.error(e.message);
    } finally { setExporting(false); }
  };

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        <Button variant="back" size="sm" onClick={() => navigate('/admin')} className="mb-3 -ml-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('autoI18n.clAdminAccount1')}
        </Button>

        {/* bg-card (no bg-white fijo): en dark mode la placa blanca rompía el tema. */}
        <div className="mb-6 rounded-2xl bg-card border-2 border-primary/30 shadow-md p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow">
              <Calculator className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate">{t('autoI18n.clAdminAccount2')}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">{t('autoI18n.clAdminAccount3')}</p>
            </div>
          </div>
        </div>

        <Card className="mb-4">
          <CardContent className="p-3 sm:p-4 flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-xs">{t('autoI18n.clAdminAccount4')}</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">{t('autoI18n.clAdminAccount5')}</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9" />
            </div>
            <Button onClick={fetchData} disabled={loading} size="sm" className="h-9">
              {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              {t('autoI18n.clAdminAccount6')}
            </Button>
            <Button onClick={exportCSV} disabled={exporting} variant="outline" size="sm" className="h-9 ml-auto">
              {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
              {t('autoI18n.clAdminAccount7')}
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <KpiCard label={t('autoI18n.clAdminAccount8')} value={fmt(platformRevenue)} icon={TrendingUp} tone="success" />
          <KpiCard label={t('autoI18n.clAdminAccount9')} value={fmt(netPlatform)} icon={Receipt} tone={netPlatform >= 0 ? 'success' : 'destructive'} />
          <KpiCard label={t('autoI18n.clAdminAccount10')} value={fmt(doctorPayable)} icon={Wallet} tone="warning" />
          <KpiCard label={t('autoI18n.clAdminAccount11')} value={fmt(vendorPayable)} icon={Wallet} tone="warning" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <KpiCard label={t('autoI18n.clAdminAccount12')} value={fmt(ivaPayable)} icon={FileText} tone="warning" />
          <KpiCard label={t('autoI18n.clAdminAccount13')} value={fmt(userWalletLiability)} icon={Wallet} tone="muted" />
          <KpiCard label={t('autoI18n.clAdminAccount14')} value={fmt(refundExpense)} icon={AlertTriangle} tone="destructive" />
          <KpiCard label={t('autoI18n.clAdminAccount15')} value={fmt(cashIn)} icon={DollarSign} tone="primary" />
        </div>

        <Tabs defaultValue="summary">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="summary">{t('autoI18n.clAdminAccount16')}</TabsTrigger>
            <TabsTrigger value="entries">{t('autoI18n.clAdminAccount17')}</TabsTrigger>
            <TabsTrigger value="purchases">Compras</TabsTrigger>
          </TabsList>
          <TabsContent value="summary">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full min-w-[460px] text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left p-3 font-semibold">{t('autoI18n.clAdminAccount18')}</th>
                      <th className="text-right p-3 font-semibold">{t('autoI18n.clAdminAccount19')}</th>
                      <th className="text-right p-3 font-semibold">{t('autoI18n.clAdminAccount20')}</th>
                      <th className="text-right p-3 font-semibold">{t('autoI18n.clAdminAccount21')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map(s => (
                      <tr key={s.account} className="border-t">
                        <td className="p-3">{ACCOUNT_LABELS_ES[s.account] || s.account}</td>
                        <td className="p-3 text-right font-mono">{fmt(Number(s.total_debit))}</td>
                        <td className="p-3 text-right font-mono">{fmt(Number(s.total_credit))}</td>
                        <td className={`p-3 text-right font-mono font-bold ${Number(s.balance) < 0 ? 'text-success' : 'text-foreground'}`}>{fmt(Number(s.balance))}</td>
                      </tr>
                    ))}
                    {summary.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{t('autoI18n.clAdminAccount22')}</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="entries">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full min-w-[380px] text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left p-2 font-semibold">{t('autoI18n.clAdminAccount23')}</th>
                      <th className="text-left p-2 font-semibold">{t('autoI18n.clAdminAccount24')}</th>
                      <th className="text-left p-2 font-semibold">{t('autoI18n.clAdminAccount25')}</th>
                      <th className="text-right p-2 font-semibold">{t('autoI18n.clAdminAccount26')}</th>
                      <th className="text-left p-2 font-semibold hidden sm:table-cell">{t('autoI18n.clAdminAccount27')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map(r => (
                      <tr key={r.id} className="border-t hover:bg-muted/20">
                        <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                        <td className="p-2 text-xs">{ACCOUNT_LABELS_ES[r.account] || r.account}</td>
                        <td className="p-2 text-xs"><Badge variant={r.entry_type === 'debit' ? 'secondary' : 'verified'} className="text-[10px]">{r.entry_type}</Badge></td>
                        <td className="p-2 text-right text-xs font-mono">{fmt(Number(r.amount))} {r.currency}</td>
                        <td className="p-2 text-xs text-muted-foreground hidden sm:table-cell">{r.description}</td>
                      </tr>
                    ))}
                    {recent.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{t('autoI18n.clAdminAccount28')}</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="purchases">
            {/* Compras del marketplace de intermediación: cada orden con su fee.
                Los asientos contables (venta concretada / fee cobrado) se generan
                solos por trigger y aparecen en las otras pestañas. */}
            <Card className="mb-3">
              <CardContent className="p-3 sm:p-4 flex flex-wrap gap-6">
                {(() => {
                  const completed = purchases.filter(p => p.status === 'completed' || p.status === 'paid');
                  const gross = completed.reduce((a, p) => a + Number(p.product_price || 0), 0);
                  const feesPaid = purchases.filter(p => p.fee_status === 'paid').reduce((a, p) => a + Number(p.fee_amount || 0), 0);
                  const feesPending = completed.filter(p => p.fee_status === 'pending').reduce((a, p) => a + Number(p.fee_amount || 0), 0);
                  return (
                    <>
                      <div><p className="text-lg font-bold font-mono">{fmt(gross)}</p><p className="text-[11px] text-muted-foreground">{t('autoI18n.clAdminAccount30')}</p></div>
                      <div><p className="text-lg font-bold font-mono text-success">{fmt(feesPaid)}</p><p className="text-[11px] text-muted-foreground">{t('autoI18n.clAdminAccount31')}</p></div>
                      <div><p className="text-lg font-bold font-mono text-warning">{fmt(feesPending)}</p><p className="text-[11px] text-muted-foreground">{t('autoI18n.clAdminAccount32')}</p></div>
                      <div><p className="text-lg font-bold font-mono">{purchases.length}</p><p className="text-[11px] text-muted-foreground">{t('autoI18n.clAdminAccount33')}</p></div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left p-2 font-semibold">{t('autoI18n.clAdminAccount23')}</th>
                      <th className="text-left p-2 font-semibold">{t('autoI18n.clAdminAccount34')}</th>
                      <th className="text-left p-2 font-semibold hidden sm:table-cell">{t('autoI18n.clAdminAccount35')}</th>
                      <th className="text-left p-2 font-semibold hidden sm:table-cell">{t('autoI18n.clAdminAccount36')}</th>
                      <th className="text-right p-2 font-semibold">{t('autoI18n.clAdminAccount37')}</th>
                      <th className="text-right p-2 font-semibold">{t('autoI18n.clAdminAccount38')}</th>
                      <th className="text-left p-2 font-semibold">{t('autoI18n.clAdminAccount39')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map(p => (
                      <tr key={p.id} className="border-t hover:bg-muted/20">
                        <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(p.created_at).toLocaleDateString('es-MX')}</td>
                        <td className="p-2 text-xs">{p.marketplace_products?.name || '—'}</td>
                        <td className="p-2 text-xs hidden sm:table-cell">{p.marketplace_vendors?.name || '—'}</td>
                        <td className="p-2 text-xs hidden sm:table-cell">{p.buyerName || '—'}</td>
                        <td className="p-2 text-right text-xs font-mono">{fmt(Number(p.product_price))}</td>
                        <td className="p-2 text-right text-xs font-mono">{fmt(Number(p.fee_amount))} <span className="text-muted-foreground">({Math.round(Number(p.fee_rate) * 100)}%)</span></td>
                        <td className="p-2 text-xs">
                          {p.status === 'ordered' && <Badge variant="secondary" className="text-[10px]">{t('autoI18n.clAdminAccount40')}</Badge>}
                          {(p.status === 'completed' || p.status === 'paid') && p.fee_status === 'paid' && <Badge variant="verified" className="text-[10px]">{t('autoI18n.clAdminAccount41')}</Badge>}
                          {p.status === 'completed' && p.fee_status === 'pending' && <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700">{t('autoI18n.clAdminAccount42')}</Badge>}
                          {(p.status === 'cancelled' || p.status === 'expired') && <Badge variant="destructive" className="text-[10px]">{t('autoI18n.clAdminAccount43')}</Badge>}
                        </td>
                      </tr>
                    ))}
                    {purchases.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{t('autoI18n.clAdminAccount44')}</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: string }) {
  const toneClasses: Record<string, string> = {
    primary: 'bg-primary text-white',
    success: 'bg-success text-white',
    warning: 'bg-warning text-white',
    destructive: 'bg-destructive text-white',
    muted: 'bg-muted text-foreground',
  };
  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-2">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${toneClasses[tone] || 'bg-muted'}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
            <p className="text-base sm:text-lg font-bold mt-0.5 truncate font-mono">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
