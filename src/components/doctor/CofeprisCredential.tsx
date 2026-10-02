import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Clock, ExternalLink, FileText, Loader2, RotateCcw,
  ShieldCheck, Upload, X, XCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// COFEPRIS en la verificación del médico (cliente 2026-10-01).
// El médico declara si tiene registro/permiso COFEPRIS. Si lo tiene: tipo, número/folio
// y documento (foto o PDF) en el bucket privado 'doctor-credentials' (<uid>/…), y la RPC
// submit_cofepris lo deja en 'pending' para que el admin lo apruebe o rechace con motivo.
// La misma pieza se usa en el onboarding y en la tarjeta de credenciales del perfil.

export const COFEPRIS_DOC_TYPES = [
  'aviso_funcionamiento',
  'licencia_sanitaria',
  'permiso_controlados',
  'permiso_publicidad',
  'otro',
] as const;
export type CofeprisDocType = (typeof COFEPRIS_DOC_TYPES)[number];

export interface CofeprisDraft {
  has: boolean | null;
  docType: CofeprisDocType | '';
  permit: string;
  docPath: string | null;
}

export const EMPTY_COFEPRIS: CofeprisDraft = { has: null, docType: '', permit: '', docPath: null };

export type CofeprisErrors = Partial<Record<'has' | 'docType' | 'permit' | 'doc', string>>;

export function validateCofepris(d: CofeprisDraft, t: (k: string) => string): CofeprisErrors {
  const e: CofeprisErrors = {};
  if (d.has === null) e.has = t('cofepris.validationAnswer');
  if (d.has) {
    if (!d.docType) e.docType = t('cofepris.validationType');
    const len = d.permit.trim().length;
    if (len < 4 || len > 50) e.permit = t('cofepris.validationPermit');
    if (!d.docPath) e.doc = t('cofepris.validationDoc');
  }
  return e;
}

/** Envía la declaración a la RPC. Devuelve el código de error de la RPC si falla. */
export async function submitCofepris(d: CofeprisDraft): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await (supabase as any).rpc('submit_cofepris', {
    p_has: d.has,
    p_doc_type: d.has ? d.docType : null,
    p_permit: d.has ? d.permit.trim() : null,
    p_doc_path: d.has ? d.docPath : null,
  });
  if (error) return { ok: false, error: error.message };
  if (!data?.success) return { ok: false, error: data?.error || 'unknown' };
  return { ok: true };
}

export function cofeprisErrorMessage(code: string | undefined, t: (k: string) => string): string {
  const known = ['invalid_doc_type', 'invalid_permit', 'document_required', 'not_a_doctor', 'nothing_to_resubmit', 'answer_required'];
  return code && known.includes(code) ? t(`cofepris.errors.${code}`) : t('cofepris.toastError');
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const isPdfPath = (p: string | null) => !!p && p.toLowerCase().endsWith('.pdf');

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="text-sm text-destructive flex items-center gap-1" role="alert">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      {msg}
    </p>
  );
}

/** Subida del documento COFEPRIS (imagen o PDF) al bucket privado. Guarda el PATH. */
function CofeprisDocUpload({
  userId, path, onChange, hasError,
}: { userId: string; path: string | null; onChange: (p: string | null) => void; hasError?: boolean }) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) { setSignedUrl(null); return; }
    let cancelled = false;
    supabase.storage.from('doctor-credentials').createSignedUrl(path, 3600).then(({ data }) => {
      if (!cancelled) setSignedUrl(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [path]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf && !file.type.startsWith('image/')) { toast.error(t('cofepris.docInvalidType')); return; }
    if (file.size > MAX_SIZE_BYTES) { toast.error(t('cofepris.docTooLarge')); return; }
    setUploading(true);
    try {
      const { compressImageIfNeeded, withTimeout } = await import('@/lib/imageUpload');
      const upload = isPdf ? file : await compressImageIfNeeded(file);
      const ext = isPdf ? 'pdf' : ((upload.name.split('.').pop() || 'jpg').toLowerCase());
      const newPath = `${userId}/cofepris-${Date.now()}.${ext}`;
      const { error } = await withTimeout(
        supabase.storage.from('doctor-credentials').upload(newPath, upload, {
          upsert: true,
          contentType: isPdf ? 'application/pdf' : (upload.type || 'image/jpeg'),
        }),
        60_000,
        'subida de documento COFEPRIS',
      );
      if (error) throw error;
      onChange(newPath);
      toast.success(t('cofepris.docUploaded'));
    } catch (err) {
      console.error('[CofeprisDocUpload] upload error', err);
      toast.error(t('cofepris.docUploadError'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf,.pdf"
        className="hidden"
        onChange={onFile}
        disabled={uploading}
        data-testid="cofepris-doc-input"
      />
      {path ? (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
          {isPdfPath(path) || !signedUrl ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{path.split('/').pop()}</p>
                {signedUrl && (
                  <a href={signedUrl} target="_blank" rel="noopener noreferrer"
                     className="text-xs text-primary underline-offset-2 hover:underline inline-flex items-center gap-1">
                    {t('cofepris.docView')} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <img src={signedUrl} alt={t('cofepris.docLabel')}
                 className="w-full max-h-56 object-contain rounded-md bg-background"
                 onContextMenu={(e) => e.preventDefault()} />
          )}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs text-success flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t('cofepris.docUploaded')}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground"
                      onClick={() => onChange(null)} aria-label={t('cofepris.docRemove')}>
                <X className="w-3.5 h-3.5" /> {t('cofepris.docRemove')}
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={uploading}
                      onClick={() => inputRef.current?.click()}>
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {t('cofepris.docChange')}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className={`w-full rounded-lg border-2 border-dashed p-5 flex flex-col items-center gap-2 text-center transition-colors hover:bg-muted/40 ${
            hasError ? 'border-destructive/60' : 'border-border'
          }`}
        >
          {uploading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <Upload className="w-6 h-6 text-primary" />}
          <span className="text-sm font-medium text-foreground">
            {uploading ? t('cofepris.docUploading') : t('cofepris.docUpload')}
          </span>
          <span className="text-xs text-muted-foreground leading-relaxed max-w-xs">{t('cofepris.docHelp')}</span>
        </button>
      )}
    </div>
  );
}

/** Pregunta Sí/No + tipo + folio + documento. Controlado desde fuera. */
export function CofeprisFields({
  userId, value, onChange, errors = {}, hideQuestion = false,
}: {
  userId: string;
  value: CofeprisDraft;
  onChange: (next: CofeprisDraft) => void;
  errors?: CofeprisErrors;
  hideQuestion?: boolean;
}) {
  const { t } = useLanguage();
  const set = (patch: Partial<CofeprisDraft>) => onChange({ ...value, ...patch });

  const choice = (has: boolean, label: string) => {
    const active = value.has === has;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={() => set({ has })}
        className={`flex-1 min-h-11 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          active
            ? 'border-primary bg-primary text-primary-foreground'
            : `bg-background text-foreground hover:bg-muted/50 ${errors.has ? 'border-destructive/60' : 'border-border'}`
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {!hideQuestion && (
        <div className="space-y-2">
          <Label id="cofepris-question" className="block leading-snug">
            {t('cofepris.question')} <span className="text-destructive">*</span>
          </Label>
          <p className="text-xs text-muted-foreground leading-relaxed">{t('cofepris.questionHelp')}</p>
          <div role="radiogroup" aria-labelledby="cofepris-question" className="flex flex-col sm:flex-row gap-2">
            {choice(true, t('cofepris.yes'))}
            {choice(false, t('cofepris.no'))}
          </div>
          <FieldError msg={errors.has} />
          {value.has === false && (
            <p className="text-xs text-muted-foreground">{t('cofepris.noHelp')}</p>
          )}
        </div>
      )}

      {value.has && (
        <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
          <div className="space-y-2">
            <Label htmlFor="cofepris-type" className="flex items-center gap-1">
              {t('cofepris.typeLabel')} <span className="text-destructive">*</span>
            </Label>
            <Select value={value.docType} onValueChange={(v) => set({ docType: v as CofeprisDocType })}>
              <SelectTrigger id="cofepris-type" className={`text-left [&>span]:truncate [&>span]:block ${errors.docType ? 'border-destructive focus:ring-destructive' : ''}`}>
                <SelectValue placeholder={t('cofepris.typePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {COFEPRIS_DOC_TYPES.map((k) => (
                  <SelectItem key={k} value={k}>{t(`cofepris.types.${k}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError msg={errors.docType} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cofepris-permit" className="flex items-center gap-1">
              {t('cofepris.permitLabel')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cofepris-permit"
              value={value.permit}
              onChange={(e) => set({ permit: e.target.value.slice(0, 50) })}
              placeholder={t('cofepris.permitPlaceholder')}
              maxLength={50}
              autoComplete="off"
              className={errors.permit ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {errors.permit ? <FieldError msg={errors.permit} /> : (
              <p className="text-xs text-muted-foreground">{t('cofepris.permitHelp')}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              {t('cofepris.docLabel')} <span className="text-destructive">*</span>
            </Label>
            <CofeprisDocUpload userId={userId} path={value.docPath} onChange={(p) => set({ docPath: p })} hasError={!!errors.doc} />
            <FieldError msg={errors.doc} />
          </div>
        </div>
      )}
    </div>
  );
}

interface CofeprisRow {
  cofepris_has: boolean | null;
  cofepris_doc_type: string | null;
  cofepris_permit: string | null;
  cofepris_doc_url: string | null;
  cofepris_status: 'pending' | 'approved' | 'rejected' | null;
  cofepris_rejection_reason: string | null;
}

/** Estado del permiso COFEPRIS en el perfil del médico, con reenviar / corregir. */
export function CofeprisStatusPanel({ userId }: { userId: string }) {
  const { t } = useLanguage();
  const [row, setRow] = useState<CofeprisRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CofeprisDraft>(EMPTY_COFEPRIS);
  const [errors, setErrors] = useState<CofeprisErrors>({});
  const [busy, setBusy] = useState<'send' | 'resubmit' | null>(null);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('doctor_profiles')
      .select('cofepris_has, cofepris_doc_type, cofepris_permit, cofepris_doc_url, cofepris_status, cofepris_rejection_reason')
      .eq('user_id', userId)
      .maybeSingle();
    if (data) setRow(data as CofeprisRow);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (has: boolean | null) => {
    setDraft({
      has,
      docType: (COFEPRIS_DOC_TYPES as readonly string[]).includes(row?.cofepris_doc_type || '')
        ? (row!.cofepris_doc_type as CofeprisDocType) : '',
      permit: row?.cofepris_permit || '',
      docPath: row?.cofepris_doc_url || null,
    });
    setErrors({});
    setEditing(true);
  };

  const send = async () => {
    const e = validateCofepris(draft, t);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy('send');
    const res = await submitCofepris(draft);
    setBusy(null);
    if (!res.ok) { toast.error(cofeprisErrorMessage(res.error, t)); return; }
    toast.success(draft.has ? t('cofepris.toastSent') : t('cofepris.toastSavedNo'));
    setEditing(false);
    load();
  };

  const resubmit = async () => {
    setBusy('resubmit');
    const { data, error } = await (supabase as any).rpc('resubmit_credential', { p_kind: 'cofepris' });
    setBusy(null);
    if (error || !data?.success) { toast.error(cofeprisErrorMessage(data?.error, t)); return; }
    toast.success(t('cofepris.toastResubmitted'));
    load();
  };

  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-6" />;

  if (editing) {
    return (
      <div className="ml-6 space-y-3">
        <CofeprisFields userId={userId} value={draft} onChange={setDraft} errors={errors} />
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={!!busy}>
            {t('cofepris.actionCancel')}
          </Button>
          <Button type="button" size="sm" className="gap-1.5" onClick={send} disabled={!!busy || draft.has === null}>
            {busy === 'send' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {draft.has === false ? t('cofepris.actionSaveNo') : t('cofepris.actionSend')}
          </Button>
        </div>
      </div>
    );
  }

  const status = row?.cofepris_status ?? null;
  const declaredNo = row?.cofepris_has === false;
  const typeLabel = row?.cofepris_doc_type ? t(`cofepris.types.${row.cofepris_doc_type}`) : null;

  const badge = status === 'approved'
    ? <Badge variant="verified" className="gap-1 text-[11px]"><ShieldCheck className="w-3 h-3" />{t('cofepris.status.approved')}</Badge>
    : status === 'pending'
      ? <Badge variant="warning" className="gap-1 text-[11px]"><Clock className="w-3 h-3" />{t('cofepris.status.pending')}</Badge>
      : status === 'rejected'
        ? <Badge variant="destructive" className="gap-1 text-[11px]"><XCircle className="w-3 h-3" />{t('cofepris.status.rejected')}</Badge>
        : <Badge variant="secondary" className="text-[11px]">{declaredNo ? t('cofepris.status.notHas') : t('cofepris.status.none')}</Badge>;

  return (
    <div className="ml-6 space-y-2" data-testid="cofepris-status">
      <div className="flex items-center gap-2 flex-wrap">
        {badge}
        {row?.cofepris_permit && status && (
          <span className="text-sm text-foreground">
            {typeLabel ? `${typeLabel} · ` : ''}{row.cofepris_permit}
          </span>
        )}
      </div>

      {status === 'pending' && <p className="text-xs text-muted-foreground">{t('cofepris.pendingHelp')}</p>}
      {status === 'approved' && <p className="text-xs text-muted-foreground">{t('cofepris.approvedHelp')}</p>}
      {status === 'rejected' && (
        <p className="text-xs text-destructive">
          {row?.cofepris_rejection_reason?.trim()
            ? t('cofepris.rejectedReason').replace('{reason}', row.cofepris_rejection_reason.trim())
            : t('cofepris.rejectedDefault')}
        </p>
      )}
      {!status && <p className="text-xs text-muted-foreground">{declaredNo ? t('cofepris.notHasHelp') : t('cofepris.noneHelp')}</p>}

      <div className="flex gap-2 flex-wrap pt-1">
        {!status && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => startEdit(declaredNo ? true : null)}>
            <Upload className="w-3.5 h-3.5" /> {t('cofepris.actionAdd')}
          </Button>
        )}
        {status === 'rejected' && (
          <>
            <Button type="button" size="sm" className="gap-1.5" onClick={() => startEdit(true)}>
              <Upload className="w-3.5 h-3.5" /> {t('cofepris.actionCorrect')}
            </Button>
            {row?.cofepris_doc_url && (
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={resubmit} disabled={!!busy}>
                {busy === 'resubmit' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                {t('cofepris.actionResubmit')}
              </Button>
            )}
          </>
        )}
        {(status === 'pending' || status === 'approved') && (
          <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => startEdit(true)}>
            {t('cofepris.actionUpdate')}
          </Button>
        )}
      </div>
    </div>
  );
}
