import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Copy, Download, FileCode2, FileText, Loader2, Receipt, Upload, UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppDateFormat } from '@/lib/dateFormat';
import { money2 } from '@/lib/proFormat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { InvoiceStatusBadge, type InvoiceStatus } from './InvoiceStatusBadge';
import { openSaleInvoiceFile } from './BuyerBillingSection';
import {
  CFDI_UUID_REGEX, cfdiUseName, fiscalToClipboardText, isMissingRelation, parseCfdiXml, regimeName,
  type BuyerFiscal,
} from './satCatalogs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Horas que tiene el médico para subir el CFDI antes de que se retengan sus pagos. */
export const INVOICE_DEADLINE_HOURS = 72;

interface Sale {
  id: string;
  concept: string;
  amount: number;
  currency: string;
  buyer_fiscal: BuyerFiscal | null;
  invoice_status: InvoiceStatus;
  cfdi_uuid: string | null;
  invoice_pdf_path: string | null;
  invoice_xml_path: string | null;
  invoiced_at: string | null;
  refunded_at: string | null;
  created_at: string;
}

type Filter = 'pending' | 'issued' | 'cancelled' | 'all';

const isOverdue = (s: Sale) =>
  s.invoice_status === 'pending' && Date.now() - new Date(s.created_at).getTime() > INVOICE_DEADLINE_HOURS * 3600 * 1000;

/** «Ventas por facturar»: cada venta del médico con los datos fiscales del comprador y su CFDI. */
export function DoctorSalesInvoices() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { formatDate } = useAppDateFormat();
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [uploadFor, setUploadFor] = useState<Sale | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    setLoadError(false);
    const { data, error } = await db
      .from('doctor_sales')
      .select('id, concept, amount, currency, buyer_fiscal, invoice_status, cfdi_uuid, invoice_pdf_path, invoice_xml_path, invoiced_at, refunded_at, created_at')
      .eq('doctor_id', user.id)
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) {
      if (isMissingRelation(error)) setNotReady(true); else setLoadError(true);
      setSales([]);
    } else {
      setSales((data || []) as Sale[]);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    pending: sales.filter((s) => s.invoice_status === 'pending').length,
    issued: sales.filter((s) => s.invoice_status === 'issued').length,
    cancelled: sales.filter((s) => s.invoice_status === 'cancelled').length,
    all: sales.length,
  }), [sales]);
  const overdue = useMemo(() => sales.filter(isOverdue), [sales]);
  const pendingAmount = useMemo(
    () => sales.filter((s) => s.invoice_status === 'pending').reduce((a, s) => a + Number(s.amount || 0), 0),
    [sales],
  );
  const shown = filter === 'all' ? sales : sales.filter((s) => s.invoice_status === filter);

  const copyFiscal = async (f: BuyerFiscal) => {
    try {
      await navigator.clipboard.writeText(fiscalToClipboardText(f));
      toast.success(t('billing.doctor.copied'));
    } catch {
      toast.error(t('billing.doctor.copyError'));
    }
  };

  const failMsg = t('billing.files.openError');
  const filters: { id: Filter; label: string }[] = [
    { id: 'pending', label: t('billing.doctor.filterPending') },
    { id: 'issued', label: t('billing.doctor.filterIssued') },
    { id: 'cancelled', label: t('billing.doctor.filterCancelled') },
    { id: 'all', label: t('billing.doctor.filterAll') },
  ];

  return (
    <section className="pro-card pro-card-pad mb-5 bg-card" id="ventas-por-facturar">
      <div className="pro-card-head">
        <h2 className="pro-card-title"><Receipt /> {t('billing.doctor.title')}</h2>
      </div>
      <p className="pro-row-sub mb-3">{t('billing.doctor.why')}</p>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : notReady ? (
        <p className="text-sm text-muted-foreground">{t('billing.notReady')}</p>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="text-sm text-muted-foreground">{t('billing.loadError')}</p>
          <Button variant="outline" size="sm" onClick={load}>{t('billing.retry')}</Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">{t('billing.doctor.kpiPending')}</p>
              <p className="text-lg font-bold text-foreground">{counts.pending}</p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">{t('billing.doctor.kpiPendingAmount')}</p>
              <p className="text-lg font-bold text-foreground">{money2(pendingAmount, language)}</p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2 col-span-2 sm:col-span-1">
              <p className="text-xs text-muted-foreground">{t('billing.doctor.kpiIssued')}</p>
              <p className="text-lg font-bold text-foreground">{counts.issued}</p>
            </div>
          </div>

          {overdue.length > 0 && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 mb-3 text-sm text-foreground">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" aria-hidden />
              <span>{t('billing.doctor.overdueBanner').replace('{n}', String(overdue.length)).replace('{h}', String(INVOICE_DEADLINE_HOURS))}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-3" role="tablist" aria-label={t('billing.doctor.title')}>
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`pro-btn pro-btn-sm ${filter === f.id ? 'pro-btn-teal' : 'pro-btn-outline'}`}
              >
                {f.label} <span className="opacity-80">({counts[f.id]})</span>
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {filter === 'pending' ? t('billing.doctor.emptyPending') : t('billing.doctor.empty')}
            </p>
          ) : (
            <ul className="space-y-3">
              {shown.map((s) => {
                const f = s.buyer_fiscal;
                const late = isOverdue(s);
                return (
                  <li key={s.id} className={`rounded-lg border p-3 sm:p-4 ${late ? 'border-destructive/50' : 'border-border'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground break-words">{s.concept}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(s.created_at, 'd MMM yyyy, HH:mm')}
                          {' · '}<span className="font-semibold text-foreground">{money2(Number(s.amount) || 0, language)}</span>
                          {late && <span className="text-destructive font-medium"> · {t('billing.doctor.overdue')}</span>}
                        </p>
                      </div>
                      <InvoiceStatusBadge status={s.invoice_status} />
                    </div>

                    <div className="mt-3 rounded-md bg-muted/40 border border-border px-3 py-2">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <UserRound className="w-3.5 h-3.5 text-primary" aria-hidden /> {t('billing.doctor.buyerData')}
                        </p>
                        {f && (
                          <button type="button" className="pro-btn pro-btn-outline pro-btn-xs" onClick={() => copyFiscal(f)}>
                            <Copy /> {t('billing.doctor.copy')}
                          </button>
                        )}
                      </div>
                      {f ? (
                        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2 text-xs">
                          <div><dt className="inline text-muted-foreground">RFC: </dt><dd className="inline font-semibold text-foreground">{f.rfc}</dd></div>
                          <div><dt className="inline text-muted-foreground">{t('billing.form.zipShort')}: </dt><dd className="inline text-foreground">{f.tax_zip}</dd></div>
                          <div className="sm:col-span-2"><dt className="inline text-muted-foreground">{t('billing.form.nameShort')}: </dt><dd className="inline text-foreground break-words">{f.legal_name}</dd></div>
                          <div><dt className="inline text-muted-foreground">{t('billing.form.regime')}: </dt><dd className="inline text-foreground">{f.tax_regime} · {regimeName(f.tax_regime)}</dd></div>
                          <div><dt className="inline text-muted-foreground">{t('billing.form.use')}: </dt><dd className="inline text-foreground">{f.cfdi_use} · {cfdiUseName(f.cfdi_use)}</dd></div>
                          {f.email && <div className="sm:col-span-2"><dt className="inline text-muted-foreground">{t('billing.form.email')}: </dt><dd className="inline text-foreground break-all">{f.email}</dd></div>}
                        </dl>
                      ) : (
                        <p className="text-xs text-muted-foreground">{t('billing.doctor.noFiscal')}</p>
                      )}
                    </div>

                    {s.refunded_at && s.invoice_status === 'issued' && (
                      <p className="mt-2 text-xs text-destructive font-medium">{t('billing.doctor.refundedIssued')}</p>
                    )}
                    {s.invoice_status === 'cancelled' && (
                      <p className="mt-2 text-xs text-muted-foreground">{t('billing.doctor.cancelledNote')}</p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {s.invoice_status === 'issued' && (
                        <>
                          {s.cfdi_uuid && (
                            <span className="text-xs text-muted-foreground break-all">UUID {s.cfdi_uuid}</span>
                          )}
                          {s.invoice_pdf_path && (
                            <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={() => openSaleInvoiceFile(s.invoice_pdf_path!, failMsg)}>
                              <Download /> PDF
                            </button>
                          )}
                          {s.invoice_xml_path && (
                            <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={() => openSaleInvoiceFile(s.invoice_xml_path!, failMsg)}>
                              <FileCode2 /> XML
                            </button>
                          )}
                        </>
                      )}
                      {s.invoice_status !== 'cancelled' && (
                        <button
                          type="button"
                          className={`pro-btn pro-btn-sm ${s.invoice_status === 'pending' ? 'pro-btn-teal' : 'pro-btn-outline'}`}
                          onClick={() => setUploadFor(s)}
                          disabled={!f && s.invoice_status === 'pending'}
                          title={!f ? t('billing.doctor.noFiscal') : undefined}
                        >
                          <Upload /> {s.invoice_status === 'issued' ? t('billing.doctor.replace') : t('billing.doctor.upload')}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <UploadCfdiDialog
        sale={uploadFor}
        onClose={() => setUploadFor(null)}
        onDone={() => { setUploadFor(null); load(); }}
      />
    </section>
  );
}

function UploadCfdiDialog({ sale, onClose, onDone }: { sale: Sale | null; onClose: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [pdf, setPdf] = useState<File | null>(null);
  const [xml, setXml] = useState<File | null>(null);
  const [uuid, setUuid] = useState('');
  const [xmlRfc, setXmlRfc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPdf(null); setXml(null); setUuid(''); setXmlRfc(null); setError(null); setSaving(false);
  }, [sale?.id]);

  const onXml = async (file: File | null) => {
    setXml(file);
    setError(null);
    setXmlRfc(null);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError(t('billing.upload.tooBig')); setXml(null); return; }
    const parsed = parseCfdiXml(await file.text());
    if (parsed.uuid) setUuid(parsed.uuid);
    setXmlRfc(parsed.receptorRfc);
    if (!parsed.uuid) setError(t('billing.upload.noUuidInXml'));
  };

  const onPdf = (file: File | null) => {
    setError(null);
    if (file && file.size > 5 * 1024 * 1024) { setError(t('billing.upload.tooBig')); setPdf(null); return; }
    if (file && file.type && file.type !== 'application/pdf') { setError(t('billing.upload.pdfOnly')); setPdf(null); return; }
    setPdf(file);
  };

  const buyerRfc = sale?.buyer_fiscal?.rfc ?? null;
  const rfcMismatch = !!(xmlRfc && buyerRfc && xmlRfc !== buyerRfc);
  const uuidOk = CFDI_UUID_REGEX.test(uuid.trim().toUpperCase());

  const submit = async () => {
    if (!sale || !user?.id) return;
    if (!pdf || !xml) { setError(t('billing.upload.bothFiles')); return; }
    if (!uuidOk) { setError(t('billing.upload.badUuid')); return; }
    if (rfcMismatch) { setError(t('billing.upload.rfcMismatch').replace('{xml}', xmlRfc!).replace('{buyer}', buyerRfc!)); return; }
    setSaving(true);
    setError(null);
    const u = uuid.trim().toUpperCase();
    const base = `${user.id}/${sale.id}/cfdi-${u}`;
    const store = supabase.storage.from('sale-invoices');
    const up1 = await store.upload(`${base}.pdf`, pdf, { upsert: true, contentType: 'application/pdf' });
    const up2 = up1.error ? null : await store.upload(`${base}.xml`, xml, { upsert: true, contentType: 'application/xml' });
    if (up1.error || up2?.error) {
      setSaving(false);
      setError(t('billing.upload.uploadError'));
      return;
    }
    const { data, error: rpcError } = await db.rpc('doctor_attach_sale_invoice', {
      p_sale_id: sale.id, p_cfdi_uuid: u, p_pdf_path: `${base}.pdf`, p_xml_path: `${base}.xml`,
    });
    setSaving(false);
    const res = data as { success?: boolean; error?: string } | null;
    if (rpcError || !res?.success) {
      const code = res?.error;
      setError(code === 'sale_cancelled' ? t('billing.upload.saleCancelled')
        : code === 'invalid_cfdi_uuid' ? t('billing.upload.badUuid')
        : t('billing.upload.uploadError'));
      return;
    }
    toast.success(t('billing.upload.done'));
    onDone();
  };

  return (
    <Dialog open={!!sale} onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload className="w-5 h-5 text-primary" aria-hidden /> {t('billing.upload.title')}</DialogTitle>
          <DialogDescription>
            {sale ? `${sale.concept} · ${money2(Number(sale.amount) || 0, language)}` : ''}
          </DialogDescription>
        </DialogHeader>

        {sale?.buyer_fiscal && (
          <p className="text-sm text-foreground rounded-md border border-border bg-muted/40 px-3 py-2">
            {t('billing.upload.issueTo')} <b>{sale.buyer_fiscal.legal_name}</b> · RFC <b>{sale.buyer_fiscal.rfc}</b>
          </p>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="cfdi-xml" className="flex items-center gap-1.5"><FileCode2 className="w-4 h-4 text-primary" aria-hidden /> {t('billing.upload.xml')}</Label>
            <Input id="cfdi-xml" type="file" accept=".xml,application/xml,text/xml" className="mt-1" onChange={(e) => onXml(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted-foreground mt-1">{t('billing.upload.xmlHint')}</p>
          </div>
          <div>
            <Label htmlFor="cfdi-pdf" className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-primary" aria-hidden /> {t('billing.upload.pdf')}</Label>
            <Input id="cfdi-pdf" type="file" accept=".pdf,application/pdf" className="mt-1" onChange={(e) => onPdf(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <Label htmlFor="cfdi-uuid">{t('billing.upload.uuid')}</Label>
            <Input
              id="cfdi-uuid"
              value={uuid}
              onChange={(e) => setUuid(e.target.value.toUpperCase().replace(/[^0-9A-F-]/g, '').slice(0, 36))}
              placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
              className="mt-1 tracking-wide"
              aria-invalid={!!uuid && !uuidOk}
            />
            {xmlRfc && !rfcMismatch && (
              <p className="text-xs text-muted-foreground mt-1">{t('billing.upload.rfcOk').replace('{rfc}', xmlRfc)}</p>
            )}
          </div>
          {(error || rfcMismatch) && (
            <p role="alert" className="text-sm text-destructive">
              {error ?? t('billing.upload.rfcMismatch').replace('{xml}', xmlRfc ?? '').replace('{buyer}', buyerRfc ?? '')}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>{t('billing.form.cancel')}</Button>
          <Button onClick={submit} disabled={saving || !pdf || !xml || !uuidOk || rfcMismatch} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {t('billing.upload.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DoctorSalesInvoices;
