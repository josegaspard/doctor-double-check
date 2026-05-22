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
  tax_iva_payable: 'IVA por pagar',
  shipping_collected: 'Envío recaudado',
  refund_expense: 'Reembolsos pagados',
  dispute_loss: 'Pérdida por disputas',
};

export default function AdminAccounting() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language } = useLanguage();
  const es = language === 'es';

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState<string>(monthStart.toISOString().slice(0, 10));
  const [to, setTo] = useState<string>(today.toISOString().slice(0, 10));
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { if (role && role !== 'admin') navigate('/'); }, [role, navigate]);

  const fetchData = async () => {
    setLoading(true);
    const fromIso = new Date(from).toISOString();
    const toIso = new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000).toISOString();
    const [{ data: sum, error: sumErr }, { data: rec }] = await Promise.all([
      (supabase as any).rpc('get_accounting_summary', { p_from: fromIso, p_to: toIso }),
      (supabase as any).from('accounting_ledger').select('*').gte('created_at', fromIso).lt('created_at', toIso).order('created_at', { ascending: false }).limit(100),
    ]);
    if (sumErr) toast.error(sumErr.message);
    setSummary(sum || []);
    setRecent(rec || []);
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
      toast.success('CSV exportado');
    } catch (e: any) {
      toast.error(e.message);
    } finally { setExporting(false); }
  };

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="mb-3 -ml-2 text-white hover:bg-white/10 hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-1" /> {es ? 'Volver al panel' : 'Back to admin'}
        </Button>

        <div className="mb-6 rounded-2xl bg-white border-2 border-primary/30 shadow-md p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow">
              <Calculator className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-secondary truncate">{es ? 'Contabilidad' : 'Accounting'}</h1>
              <p className="text-xs sm:text-sm text-secondary/70">{es ? 'Estado financiero de toda la plataforma en tiempo real — consultas, grabaciones, suscripciones, marketplace y recargas' : 'Real-time platform-wide P&L'}</p>
            </div>
          </div>
        </div>

        <Card className="mb-4">
          <CardContent className="p-3 sm:p-4 flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-xs">{es ? 'Desde' : 'From'}</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">{es ? 'Hasta' : 'To'}</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9" />
            </div>
            <Button onClick={fetchData} disabled={loading} size="sm" className="h-9">
              {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              {es ? 'Actualizar' : 'Refresh'}
            </Button>
            <Button onClick={exportCSV} disabled={exporting} variant="outline" size="sm" className="h-9 ml-auto">
              {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
              {es ? 'Exportar CSV' : 'Export CSV'}
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <KpiCard label={es ? 'Comisión plataforma' : 'Platform revenue'} value={fmt(platformRevenue)} icon={TrendingUp} tone="success" />
          <KpiCard label={es ? 'Neto plataforma' : 'Net platform'} value={fmt(netPlatform)} icon={Receipt} tone={netPlatform >= 0 ? 'success' : 'destructive'} />
          <KpiCard label={es ? 'Adeudo a doctores' : 'Doctor payable'} value={fmt(doctorPayable)} icon={Wallet} tone="warning" />
          <KpiCard label={es ? 'Adeudo a vendors' : 'Vendor payable'} value={fmt(vendorPayable)} icon={Wallet} tone="warning" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <KpiCard label={es ? 'IVA por pagar' : 'VAT payable'} value={fmt(ivaPayable)} icon={FileText} tone="warning" />
          <KpiCard label={es ? 'Saldo usuarios (wallets)' : 'User wallet balance'} value={fmt(userWalletLiability)} icon={Wallet} tone="muted" />
          <KpiCard label={es ? 'Devoluciones' : 'Refunds'} value={fmt(refundExpense)} icon={AlertTriangle} tone="destructive" />
          <KpiCard label={es ? 'Efectivo entrante' : 'Cash in'} value={fmt(cashIn)} icon={DollarSign} tone="primary" />
        </div>

        <Tabs defaultValue="summary">
          <TabsList>
            <TabsTrigger value="summary">{es ? 'Resumen por cuenta' : 'By account'}</TabsTrigger>
            <TabsTrigger value="entries">{es ? 'Asientos recientes' : 'Recent entries'}</TabsTrigger>
          </TabsList>
          <TabsContent value="summary">
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left p-3 font-semibold">{es ? 'Cuenta' : 'Account'}</th>
                      <th className="text-right p-3 font-semibold">{es ? 'Débitos' : 'Debits'}</th>
                      <th className="text-right p-3 font-semibold">{es ? 'Créditos' : 'Credits'}</th>
                      <th className="text-right p-3 font-semibold">{es ? 'Balance' : 'Balance'}</th>
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
                    {summary.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{es ? 'Sin movimientos en este rango' : 'No entries in this range'}</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="entries">
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left p-2 font-semibold">{es ? 'Fecha' : 'Date'}</th>
                      <th className="text-left p-2 font-semibold">{es ? 'Cuenta' : 'Account'}</th>
                      <th className="text-left p-2 font-semibold">{es ? 'Tipo' : 'Type'}</th>
                      <th className="text-right p-2 font-semibold">{es ? 'Monto' : 'Amount'}</th>
                      <th className="text-left p-2 font-semibold hidden sm:table-cell">{es ? 'Descripción' : 'Description'}</th>
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
                    {recent.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{es ? 'Sin asientos' : 'No entries'}</td></tr>}
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
