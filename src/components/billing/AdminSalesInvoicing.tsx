import { useEffect, useMemo, useState } from 'react';
import { Loader2, Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { money2 } from '@/lib/proFormat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { INVOICE_DEADLINE_HOURS } from './DoctorSalesInvoices';
import { isMissingRelation } from './satCatalogs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Row {
  doctor_id: string;
  invoice_status: 'pending' | 'issued' | 'cancelled';
  amount: number;
  created_at: string;
}

interface DoctorAgg {
  doctorId: string;
  name: string;
  pending: number;
  pendingAmount: number;
  overdue: number;
  issued: number;
  cancelled: number;
  lastSale: string;
}

/** Estado de la facturación a compradores, por médico (ventas en doctor_sales). */
export function AdminSalesInvoicing() {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [onlyPending, setOnlyPending] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await db
        .from('doctor_sales')
        .select('doctor_id, invoice_status, amount, created_at')
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) {
        setNotReady(isMissingRelation(error));
        setLoading(false);
        return;
      }
      const list = (data || []) as Row[];
      setRows(list);
      const ids = [...new Set(list.map((r) => r.doctor_id))];
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, name').in('id', ids);
        setNames(new Map((profs || []).map((p) => [p.id, p.name || ''])));
      }
      setLoading(false);
    })();
  }, []);

  const doctors = useMemo<DoctorAgg[]>(() => {
    const cutoff = Date.now() - INVOICE_DEADLINE_HOURS * 3600 * 1000;
    const m = new Map<string, DoctorAgg>();
    for (const r of rows) {
      const a = m.get(r.doctor_id) ?? {
        doctorId: r.doctor_id, name: names.get(r.doctor_id) || t('billing.admin.unknownDoctor'),
        pending: 0, pendingAmount: 0, overdue: 0, issued: 0, cancelled: 0, lastSale: r.created_at,
      };
      if (r.invoice_status === 'pending') {
        a.pending += 1;
        a.pendingAmount += Number(r.amount || 0);
        if (new Date(r.created_at).getTime() < cutoff) a.overdue += 1;
      } else if (r.invoice_status === 'issued') a.issued += 1;
      else a.cancelled += 1;
      if (r.created_at > a.lastSale) a.lastSale = r.created_at;
      m.set(r.doctor_id, a);
    }
    return [...m.values()].sort((x, y) => y.overdue - x.overdue || y.pending - x.pending || x.name.localeCompare(y.name));
  }, [rows, names, t]);

  const shown = onlyPending ? doctors.filter((d) => d.pending > 0) : doctors;
  const totals = useMemo(() => ({
    pending: doctors.reduce((a, d) => a + d.pending, 0),
    overdue: doctors.reduce((a, d) => a + d.overdue, 0),
    issued: doctors.reduce((a, d) => a + d.issued, 0),
  }), [doctors]);

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary" aria-hidden /> {t('billing.admin.title')}
        </CardTitle>
        <p className="text-xs sm:text-sm text-muted-foreground">{t('billing.admin.subtitle').replace('{h}', String(INVOICE_DEADLINE_HOURS))}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : notReady ? (
          <p className="text-sm text-muted-foreground">{t('billing.notReady')}</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="rounded-lg border border-border px-3 py-2"><p className="text-xs text-muted-foreground">{t('billing.admin.pending')}</p><p className="text-lg font-bold text-foreground">{totals.pending}</p></div>
              <div className="rounded-lg border border-border px-3 py-2"><p className="text-xs text-muted-foreground">{t('billing.admin.overdue')}</p><p className={`text-lg font-bold ${totals.overdue ? 'text-destructive' : 'text-foreground'}`}>{totals.overdue}</p></div>
              <div className="rounded-lg border border-border px-3 py-2"><p className="text-xs text-muted-foreground">{t('billing.admin.issued')}</p><p className="text-lg font-bold text-foreground">{totals.issued}</p></div>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground mb-2 cursor-pointer w-fit">
              <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} className="accent-primary w-4 h-4" />
              {t('billing.admin.onlyPending')}
            </label>
            {shown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">{t('billing.admin.empty')}</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="px-2 py-2 font-medium">{t('billing.admin.colDoctor')}</th>
                      <th className="px-2 py-2 font-medium text-right">{t('billing.admin.pending')}</th>
                      <th className="px-2 py-2 font-medium text-right">{t('billing.admin.colPendingAmount')}</th>
                      <th className="px-2 py-2 font-medium text-right">{t('billing.admin.overdue')}</th>
                      <th className="px-2 py-2 font-medium text-right">{t('billing.admin.issued')}</th>
                      <th className="px-2 py-2 font-medium text-right">{t('billing.admin.cancelled')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((d) => (
                      <tr key={d.doctorId} className="border-b border-border last:border-0">
                        <td className="px-2 py-2 text-foreground font-medium">{d.name}</td>
                        <td className="px-2 py-2 text-right text-foreground">{d.pending}</td>
                        <td className="px-2 py-2 text-right text-foreground">{money2(d.pendingAmount, language)}</td>
                        <td className={`px-2 py-2 text-right ${d.overdue ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>{d.overdue}</td>
                        <td className="px-2 py-2 text-right text-foreground">{d.issued}</td>
                        <td className="px-2 py-2 text-right text-muted-foreground">{d.cancelled}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default AdminSalesInvoicing;
