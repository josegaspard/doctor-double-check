import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CFDI_USES, DEFAULT_CFDI_USE, RFC_REGEX, TAX_REGIMES, TAX_ZIP_REGEX, rfcKind,
  type BuyerFiscal,
} from './satCatalogs';

// billing_profiles aún no está en los tipos generados de Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function fetchBillingProfile(userId: string): Promise<{ profile: BuyerFiscal | null; error: { code?: string; message?: string } | null }> {
  const { data, error } = await db
    .from('billing_profiles')
    .select('rfc, legal_name, tax_zip, tax_regime, cfdi_use, email')
    .eq('user_id', userId)
    .maybeSingle();
  return { profile: (data as BuyerFiscal) ?? null, error };
}

interface Props {
  /** Se llama con los datos ya guardados. */
  onSaved?: (profile: BuyerFiscal) => void;
  onCancel?: () => void;
  submitLabel?: string;
  /** Datos ya cargados (evita una segunda consulta). */
  initial?: BuyerFiscal | null;
}

type Errors = Partial<Record<keyof BuyerFiscal, string>>;

export function BillingProfileForm({ onSaved, onCancel, submitLabel, initial }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(initial === undefined);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [form, setForm] = useState<BuyerFiscal>({
    rfc: '', legal_name: '', tax_zip: '', tax_regime: '', cfdi_use: DEFAULT_CFDI_USE, email: user?.email ?? '',
  });

  useEffect(() => {
    if (initial) { setForm({ ...initial, email: initial.email ?? user?.email ?? '' }); return; }
    if (initial === null || !user?.id) { setLoading(false); return; }
    let alive = true;
    fetchBillingProfile(user.id).then(({ profile }) => {
      if (!alive) return;
      if (profile) setForm({ ...profile, email: profile.email ?? user.email ?? '' });
      setLoading(false);
    });
    return () => { alive = false; };
  }, [initial, user?.id, user?.email]);

  const kind = rfcKind(form.rfc);
  const regimes = useMemo(() => TAX_REGIMES.filter((r) => !kind || r.kinds.includes(kind)), [kind]);
  const uses = useMemo(() => CFDI_USES.filter((u) => !kind || u.kinds.includes(kind)), [kind]);

  // Si el RFC cambia de tipo (física ↔ moral), se limpia lo que deja de aplicar.
  useEffect(() => {
    if (!kind) return;
    setForm((f) => ({
      ...f,
      tax_regime: regimes.some((r) => r.code === f.tax_regime) ? f.tax_regime : '',
      cfdi_use: uses.some((u) => u.code === f.cfdi_use) ? f.cfdi_use : (kind === 'moral' ? 'G03' : DEFAULT_CFDI_USE),
    }));
  }, [kind, regimes, uses]);

  const set = (k: keyof BuyerFiscal, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (!RFC_REGEX.test(form.rfc)) e.rfc = t('billing.form.errRfc');
    if (form.legal_name.trim().length < 3) e.legal_name = t('billing.form.errName');
    if (!TAX_ZIP_REGEX.test(form.tax_zip)) e.tax_zip = t('billing.form.errZip');
    if (!form.tax_regime) e.tax_regime = t('billing.form.errRegime');
    if (!form.cfdi_use) e.cfdi_use = t('billing.form.errUse');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t('billing.form.errEmail');
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (!user?.id) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      rfc: form.rfc,
      legal_name: form.legal_name.trim().toUpperCase().replace(/\s+/g, ' '),
      tax_zip: form.tax_zip,
      tax_regime: form.tax_regime,
      cfdi_use: form.cfdi_use,
      email: form.email?.trim() || null,
    };
    const { error } = await db.from('billing_profiles').upsert(payload, { onConflict: 'user_id' });
    setSaving(false);
    if (error) {
      toast.error(t('billing.form.saveError'));
      return;
    }
    toast.success(t('billing.form.saved'));
    onSaved?.(payload);
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const fieldErr = (k: keyof BuyerFiscal) =>
    errors[k] ? <p id={`bf-${k}-err`} className="text-xs text-destructive mt-1">{errors[k]}</p> : null;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <Label htmlFor="bf-rfc">{t('billing.form.rfc')}</Label>
          <Input
            id="bf-rfc"
            value={form.rfc}
            onChange={(e) => set('rfc', e.target.value.toUpperCase().replace(/[^A-ZÑ&0-9]/g, '').slice(0, 13))}
            placeholder="XAXX010101000"
            autoComplete="off"
            maxLength={13}
            aria-invalid={!!errors.rfc}
            aria-describedby={errors.rfc ? 'bf-rfc-err' : 'bf-rfc-hint'}
            className="mt-1 uppercase tracking-wide"
          />
          {errors.rfc ? fieldErr('rfc') : (
            <p id="bf-rfc-hint" className="text-xs text-muted-foreground mt-1">
              {kind === 'moral' ? t('billing.form.rfcMoral') : kind === 'fisica' ? t('billing.form.rfcFisica') : t('billing.form.rfcHint')}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="bf-zip">{t('billing.form.zip')}</Label>
          <Input
            id="bf-zip"
            value={form.tax_zip}
            onChange={(e) => set('tax_zip', e.target.value.replace(/\D/g, '').slice(0, 5))}
            inputMode="numeric"
            placeholder="06600"
            maxLength={5}
            aria-invalid={!!errors.tax_zip}
            className="mt-1"
          />
          {fieldErr('tax_zip')}
        </div>
      </div>

      <div>
        <Label htmlFor="bf-name">{t('billing.form.name')}</Label>
        <Input
          id="bf-name"
          value={form.legal_name}
          onChange={(e) => set('legal_name', e.target.value.toUpperCase())}
          placeholder={t('billing.form.namePlaceholder')}
          maxLength={254}
          aria-invalid={!!errors.legal_name}
          className="mt-1"
        />
        {errors.legal_name ? fieldErr('legal_name') : (
          <p className="text-xs text-muted-foreground mt-1">{t('billing.form.nameHint')}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="bf-regime">{t('billing.form.regime')}</Label>
          <Select value={form.tax_regime} onValueChange={(v) => set('tax_regime', v)}>
            <SelectTrigger id="bf-regime" className="mt-1" aria-invalid={!!errors.tax_regime}>
              <SelectValue placeholder={t('billing.form.regimePlaceholder')} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {regimes.map((r) => (
                <SelectItem key={r.code} value={r.code}>{r.code} · {r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErr('tax_regime')}
        </div>
        <div>
          <Label htmlFor="bf-use">{t('billing.form.use')}</Label>
          <Select value={form.cfdi_use} onValueChange={(v) => set('cfdi_use', v)}>
            <SelectTrigger id="bf-use" className="mt-1" aria-invalid={!!errors.cfdi_use}>
              <SelectValue placeholder={t('billing.form.usePlaceholder')} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {uses.map((u) => (
                <SelectItem key={u.code} value={u.code}>{u.code} · {u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErr('cfdi_use')}
        </div>
      </div>

      <div>
        <Label htmlFor="bf-email">{t('billing.form.email')}</Label>
        <Input
          id="bf-email"
          type="email"
          value={form.email ?? ''}
          onChange={(e) => set('email', e.target.value)}
          maxLength={254}
          aria-invalid={!!errors.email}
          className="mt-1"
        />
        {errors.email ? fieldErr('email') : (
          <p className="text-xs text-muted-foreground mt-1">{t('billing.form.emailHint')}</p>
        )}
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            {t('billing.form.cancel')}
          </Button>
        )}
        <Button type="submit" disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {submitLabel ?? t('billing.form.save')}
        </Button>
      </div>
    </form>
  );
}

export default BillingProfileForm;
