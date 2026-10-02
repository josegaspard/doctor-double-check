import { useCallback, useEffect, useState } from 'react';
import { Download, FileCode2, FileText, Loader2, Pencil, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppDateFormat } from '@/lib/dateFormat';
import { money2 } from '@/lib/proFormat';
import { BillingProfileForm, fetchBillingProfile } from './BillingProfileForm';
import { useBillingGate } from './BillingGate';
import { InvoiceStatusBadge, type InvoiceStatus } from './InvoiceStatusBadge';
import { cfdiUseName, isMissingRelation, regimeName, type BuyerFiscal } from './satCatalogs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Abre el PDF o XML de una factura con una URL firmada de 5 minutos. */
export async function openSaleInvoiceFile(path: string, failMsg: string) {
  const { data, error } = await supabase.storage.from('sale-invoices').createSignedUrl(path, 300);
  if (error || !data?.signedUrl) { toast.error(failMsg); return; }
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

/** «Datos de facturación»: lo que el médico pone en la factura del comprador. */
export function BillingProfileCard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { markBillingProfileSaved } = useBillingGate();
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [profile, setProfile] = useState<BuyerFiscal | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    fetchBillingProfile(user.id).then(({ profile: p, error }) => {
      if (error && isMissingRelation(error)) setNotReady(true);
      setProfile(p);
      setEditing(!p);
      setLoading(false);
    });
  }, [user?.id]);

  return (
    <section className="pro-card pro-card-pad bg-card" id="datos-facturacion">
      <div className="pro-card-head">
        <h2 className="pro-card-title"><Receipt /> {t('billing.settings.title')}</h2>
        {profile && !editing && (
          <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={() => setEditing(true)}>
            <Pencil /> {t('billing.settings.edit')}
          </button>
        )}
      </div>
      <p className="pro-row-sub mb-3">{t('billing.settings.why')}</p>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : notReady ? (
        <p className="text-sm text-muted-foreground">{t('billing.notReady')}</p>
      ) : editing ? (
        <BillingProfileForm
          initial={profile}
          onCancel={profile ? () => setEditing(false) : undefined}
          onSaved={(p) => { setProfile(p); setEditing(false); markBillingProfileSaved(); }}
        />
      ) : profile ? (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
          <div><dt className="text-muted-foreground text-xs">{t('billing.form.rfc')}</dt><dd className="font-semibold text-foreground">{profile.rfc}</dd></div>
          <div><dt className="text-muted-foreground text-xs">{t('billing.form.zip')}</dt><dd className="font-medium text-foreground">{profile.tax_zip}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted-foreground text-xs">{t('billing.form.name')}</dt><dd className="font-medium text-foreground break-words">{profile.legal_name}</dd></div>
          <div><dt className="text-muted-foreground text-xs">{t('billing.form.regime')}</dt><dd className="text-foreground">{profile.tax_regime} · {regimeName(profile.tax_regime)}</dd></div>
          <div><dt className="text-muted-foreground text-xs">{t('billing.form.use')}</dt><dd className="text-foreground">{profile.cfdi_use} · {cfdiUseName(profile.cfdi_use)}</dd></div>
          {profile.email && <div className="sm:col-span-2"><dt className="text-muted-foreground text-xs">{t('billing.form.email')}</dt><dd className="text-foreground break-all">{profile.email}</dd></div>}
        </dl>
      ) : null}
    </section>
  );
}

interface BuyerSale {
  id: string;
  concept: string;
  amount: number;
  currency: string;
  invoice_status: InvoiceStatus;
  cfdi_uuid: string | null;
  invoice_pdf_path: string | null;
  invoice_xml_path: string | null;
  created_at: string;
  refunded_at: string | null;
  doctor_id: string;
  doctor_name?: string;
}

/** «Mis facturas»: cada compra a un médico y su CFDI cuando el médico lo sube. */
export function BuyerInvoicesCard() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { formatDate } = useAppDateFormat();
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [sales, setSales] = useState<BuyerSale[]>([]);

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await db
      .from('doctor_sales')
      .select('id, concept, amount, currency, invoice_status, cfdi_uuid, invoice_pdf_path, invoice_xml_path, created_at, refunded_at, doctor_id')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      setNotReady(isMissingRelation(error));
      setSales([]);
      setLoading(false);
      return;
    }
    const rows = (data || []) as BuyerSale[];
    const ids = [...new Set(rows.map((r) => r.doctor_id))];
    if (ids.length) {
      const { data: docs } = await supabase.from('profiles').select('id, name').in('id', ids);
      const names = new Map((docs || []).map((d) => [d.id, d.name]));
      rows.forEach((r) => { r.doctor_name = names.get(r.doctor_id) || undefined; });
    }
    setSales(rows);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const failMsg = t('billing.files.openError');

  return (
    <section className="pro-card pro-card-pad bg-card" id="mis-facturas">
      <div className="pro-card-head">
        <h2 className="pro-card-title"><FileText /> {t('billing.buyer.title')}</h2>
      </div>
      <p className="pro-row-sub mb-3">{t('billing.buyer.subtitle')}</p>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : notReady ? (
        <p className="text-sm text-muted-foreground">{t('billing.notReady')}</p>
      ) : sales.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">{t('billing.buyer.empty')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {sales.map((s) => (
            <li key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground truncate">{s.concept}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(s.created_at, 'd MMM yyyy')}
                  {s.doctor_name ? ` · ${s.doctor_name}` : ''}
                  {' · '}<span className="font-semibold text-foreground">{money2(Number(s.amount) || 0, language)}</span>
                </p>
                {s.invoice_status === 'pending' && (
                  <p className="text-xs text-muted-foreground mt-0.5">{t('billing.buyer.pendingHint')}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <InvoiceStatusBadge status={s.invoice_status} />
                {s.invoice_status === 'issued' && s.invoice_pdf_path && (
                  <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={() => openSaleInvoiceFile(s.invoice_pdf_path!, failMsg)}>
                    <Download /> PDF
                  </button>
                )}
                {s.invoice_status === 'issued' && s.invoice_xml_path && (
                  <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={() => openSaleInvoiceFile(s.invoice_xml_path!, failMsg)}>
                    <FileCode2 /> XML
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
