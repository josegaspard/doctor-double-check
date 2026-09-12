// Editor «Planes de suscripción» con nombre propio (F2 «planes», 13-sep-2026).
//
// Va en Cuenta › Perfil › «Contenido y monetización» (UserProfile.tsx,
// profTab === 'contenido'), debajo de la tarjeta «Suscripciones».
//
// El modelo de niveles no cambia: el médico personaliza SUS dos niveles
// (Básico y Premium): nombre, precio al mes, descripción, hasta 6 ventajas y si
// el plan está activo. Un nivel sin plan activo se muestra y se cobra con el
// nombre y el precio globales de hoy.
//
// Guardar SIEMPRE pasa por useConfirmAction (el primer clic nunca publica) y el
// resumen avisa de que quien ya está suscrito mantiene su precio en Stripe
// (price_data dinámico: cada suscripción conserva el precio con el que se creó).
//
// Sin la migración 20260913b: aviso «pendiente de activar» y los dos planes
// estándar que hoy se ven y se cobran; ningún formulario que finja guardar.
import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, CreditCard, Heart, Info, Loader2, Plus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import { useSubscriptionPricing } from '@/hooks/useSubscriptionPricing';
import {
  PLAN_LIMITS,
  PLAN_TIERS,
  cleanPerks,
  globalTierPlan,
  parsePriceToCents,
  resolveTierPlan,
  useDoctorSubscriptionPlans,
  validatePlanInput,
  type DoctorSubscriptionPlan,
  type PlanField,
  type PlanFieldError,
  type PlanInput,
  type PlanTier,
  type ResolvedTierPlan,
} from '@/hooks/useDoctorSubscriptionPlans';
import { fill, money2 } from '@/lib/proFormat';
import '@/styles/funciones-planes.css';

type T = (path: string) => string;

interface FormState {
  name: string;
  price: string;
  description: string;
  perks: string[];
  isActive: boolean;
}

const formFromPlan = (plan: DoctorSubscriptionPlan | null): FormState => ({
  name: plan?.name ?? '',
  price: plan ? String(plan.price_cents / 100) : '',
  description: plan?.description ?? '',
  perks: plan && plan.perks.length ? [...plan.perks] : [''],
  isActive: plan ? plan.is_active : true,
});

const priceKey = (raw: string) => {
  const c = parsePriceToCents(raw);
  return Number.isFinite(c) ? String(c) : raw.trim();
};

const sameForm = (a: FormState, b: FormState) =>
  a.name.trim() === b.name.trim() &&
  a.description.trim() === b.description.trim() &&
  priceKey(a.price) === priceKey(b.price) &&
  a.isActive === b.isActive &&
  JSON.stringify(cleanPerks(a.perks)) === JSON.stringify(cleanPerks(b.perks));

const TIER_ICON = { basic: Heart, premium: Users } as const;

const tierLabel = (tier: PlanTier, t: T) =>
  tier === 'basic' ? t('mm2.planes.editor.tierBasic') : t('mm2.planes.editor.tierPremium');

const tierShortName = (tier: PlanTier, t: T) =>
  tier === 'basic' ? t('subscriptions.basicTierName') : t('subscriptions.premiumTierName');

export function PlansEditor() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { pricing } = useSubscriptionPricing();
  const { plans, loading, saving, error, pendingActivation, reload, savePlan } =
    useDoctorSubscriptionPlans(user?.id, { scope: 'owner' });
  const { confirm, dialog } = useConfirmAction();

  const price = (cents: number) => money2(cents / 100, language);
  const perMonth = (cents: number) => fill(t('mm2.planes.editor.perMonth'), { price: price(cents) });

  const errorText = (code: PlanFieldError): string => {
    switch (code) {
      case 'nameShort': return fill(t('mm2.planes.editor.err.nameShort'), { n: PLAN_LIMITS.nameMin });
      case 'nameLong': return fill(t('mm2.planes.editor.err.nameLong'), { n: PLAN_LIMITS.nameMax });
      case 'priceLow': return fill(t('mm2.planes.editor.err.priceLow'), { min: price(PLAN_LIMITS.priceMinCents) });
      case 'priceHigh': return fill(t('mm2.planes.editor.err.priceHigh'), { max: price(PLAN_LIMITS.priceMaxCents) });
      case 'descLong': return fill(t('mm2.planes.editor.err.descLong'), { n: PLAN_LIMITS.descMax });
      case 'perksMax': return fill(t('mm2.planes.editor.err.perksMax'), { n: PLAN_LIMITS.perksMax });
      case 'perkLong': return fill(t('mm2.planes.editor.err.perkLong'), { n: PLAN_LIMITS.perkMax });
      case 'priceDecimals': return t('mm2.planes.editor.err.priceDecimals');
      default: return t('mm2.planes.editor.err.priceInvalid');
    }
  };

  /** Resumen con useConfirmAction y guardado. Devuelve true si se guardó. */
  const handleSave = async (tier: PlanTier, input: PlanInput, plan: DoctorSubscriptionPlan | null): Promise<boolean> => {
    const standard = globalTierPlan(tier, pricing, t);
    const creating = !plan;
    const priceChanged = !plan || plan.price_cents !== input.priceCents;
    const deactivating = !!plan && plan.is_active && !input.isActive;
    const activating = !!plan && !plan.is_active && input.isActive;
    const stdVars = { plan: standard.name, price: perMonth(standard.priceCents) };

    const title = deactivating
      ? t('mm2.planes.editor.confirm.deactivateTitle')
      : creating
        ? t('mm2.planes.editor.confirm.createTitle')
        : t('mm2.planes.editor.confirm.updateTitle');

    const description = deactivating
      ? fill(t('mm2.planes.editor.confirm.descDeactivate'), stdVars)
      : !input.isActive
        ? fill(t('mm2.planes.editor.confirm.descInactive'), stdVars)
        : creating || priceChanged || activating
          ? t('mm2.planes.editor.confirm.descPrice')
          : t('mm2.planes.editor.confirm.descUpdate');

    const ok = await confirm({
      title,
      description,
      tone: priceChanged && input.isActive ? 'payment' : 'default',
      details: [
        { label: t('mm2.planes.editor.confirm.tierLabel'), value: tierShortName(tier, t) },
        { label: t('mm2.planes.editor.confirm.nameLabel'), value: input.name.trim() },
        ...(plan && priceChanged
          ? [{ label: t('mm2.planes.editor.confirm.priceBefore'), value: perMonth(plan.price_cents) }]
          : []),
        {
          label: plan && priceChanged ? t('mm2.planes.editor.confirm.priceNew') : t('mm2.planes.editor.confirm.priceLabel'),
          value: perMonth(input.priceCents),
          emphasis: true,
        },
        { label: t('mm2.planes.editor.confirm.perksLabel'), value: String(cleanPerks(input.perks).length) },
        {
          label: t('mm2.planes.editor.confirm.statusLabel'),
          value: input.isActive ? t('mm2.planes.editor.confirm.statusOn') : t('mm2.planes.editor.confirm.statusOff'),
        },
      ],
      confirmLabel: deactivating
        ? t('mm2.planes.editor.confirm.confirmDeactivate')
        : creating
          ? t('mm2.planes.editor.confirm.confirmCreate')
          : t('mm2.planes.editor.confirm.confirmSave'),
    });
    if (!ok) return false;

    const res = await savePlan(tier, input);
    if (res.ok) {
      toast.success(t('mm2.planes.editor.saved'));
      return true;
    }
    const reason = 'reason' in res ? res.reason : 'error';
    if (reason === 'pending_activation') toast.error(t('mm2.planes.editor.pending.title'));
    else if (reason === 'forbidden') toast.error(t('mm2.planes.editor.forbidden'));
    else if (reason === 'invalid') toast.error(t('mm2.planes.editor.invalid'));
    else toast.error(t('mm2.planes.editor.saveError'));
    return false;
  };

  return (
    <section className="pro-card pro-card-pad fp-plans" aria-labelledby="fp-plans-title">
      <div className="pro-card-head">
        <h3 className="pro-card-title" id="fp-plans-title"><CreditCard /> {t('mm2.planes.editor.title')}</h3>
      </div>
      <p className="pro-row-sub mb-3">{t('mm2.planes.editor.intro')}</p>

      {loading ? (
        <p className="fp-loading"><Loader2 className="animate-spin" /> {t('mm2.planes.editor.loading')}</p>
      ) : error ? (
        <div className="text-center py-4">
          <p className="text-sm text-slate-600">{t('mm2.planes.editor.loadError')}</p>
          <button type="button" className="pro-btn pro-btn-outline pro-btn-sm mt-3" onClick={reload}>
            {t('mm2.planes.editor.retry')}
          </button>
        </div>
      ) : pendingActivation ? (
        <>
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 flex items-start gap-2 text-amber-900">
            <AlertCircle className="h-5 w-5 flex-none mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t('mm2.planes.editor.pending.title')}</p>
              <p className="text-xs mt-0.5">{t('mm2.planes.editor.pending.desc')}</p>
            </div>
          </div>
          <div className="fp-std">
            {PLAN_TIERS.map(tier => {
              const std = globalTierPlan(tier, pricing, t);
              return (
                <div key={tier} className="fp-std-row">
                  <span>{tierLabel(tier, t)}</span>
                  <span><b>{std.name}</b> · {perMonth(std.priceCents)}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="fp-plans-grid">
          {PLAN_TIERS.map(tier => (
            <PlanForm
              key={tier}
              tier={tier}
              plan={plans.find(p => p.tier === tier) || null}
              standard={globalTierPlan(tier, pricing, t)}
              current={resolveTierPlan(tier, plans, pricing, t)}
              saving={saving}
              t={t}
              perMonth={perMonth}
              price={price}
              errorText={errorText}
              onSave={handleSave}
            />
          ))}
        </div>
      )}

      {dialog}
    </section>
  );
}

interface PlanFormProps {
  tier: PlanTier;
  plan: DoctorSubscriptionPlan | null;
  standard: ResolvedTierPlan;
  current: ResolvedTierPlan;
  saving: boolean;
  t: T;
  perMonth: (cents: number) => string;
  price: (cents: number) => string;
  errorText: (code: PlanFieldError) => string;
  onSave: (tier: PlanTier, input: PlanInput, plan: DoctorSubscriptionPlan | null) => Promise<boolean>;
}

function PlanForm({ tier, plan, standard, current, saving, t, perMonth, price, errorText, onSave }: PlanFormProps) {
  const Icon = TIER_ICON[tier];
  const [form, setForm] = useState<FormState>(() => formFromPlan(plan));
  const [errors, setErrors] = useState<Partial<Record<PlanField, PlanFieldError>> | null>(null);

  // Solo se reinicia cuando cambia ESTE plan en la base (guardar el otro nivel
  // no borra lo que se esté escribiendo aquí).
  const signature = plan
    ? `${plan.id}|${plan.updated_at ?? ''}|${plan.is_active}|${plan.price_cents}|${plan.name}`
    : 'none';
  useEffect(() => {
    setForm(formFromPlan(plan));
    setErrors(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const dirty = !sameForm(form, formFromPlan(plan));
  const perksCount = cleanPerks(form.perks).length;
  const id = (suffix: string) => `fp-${tier}-${suffix}`;

  const clearError = (field: PlanField) =>
    setErrors(prev => {
      if (!prev?.[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return Object.keys(next).length ? next : null;
    });

  const update = (field: PlanField | null, patch: Partial<FormState>) => {
    setForm(prev => ({ ...prev, ...patch }));
    if (field) clearError(field);
  };
  const setPerk = (index: number, value: string) => {
    setForm(prev => ({ ...prev, perks: prev.perks.map((p, j) => (j === index ? value : p)) }));
    clearError('perks');
  };
  const addPerk = () =>
    setForm(prev => (prev.perks.length >= PLAN_LIMITS.perksMax ? prev : { ...prev, perks: [...prev.perks, ''] }));
  const removePerk = (index: number) => {
    setForm(prev => {
      const next = prev.perks.filter((_, j) => j !== index);
      return { ...prev, perks: next.length ? next : [''] };
    });
    clearError('perks');
  };

  const input: PlanInput = {
    name: form.name,
    description: form.description,
    priceCents: parsePriceToCents(form.price),
    perks: form.perks,
    isActive: form.isActive,
  };

  const submit = async () => {
    const fields = validatePlanInput(input);
    setErrors(fields);
    if (fields) {
      toast.error(t('mm2.planes.editor.invalid'));
      return;
    }
    await onSave(tier, input, plan);
  };

  const status = !plan
    ? { cls: 'pro-pill pro-pill-muted', label: t('mm2.planes.editor.statusStandard') }
    : plan.is_active
      ? { cls: 'pro-pill pro-pill-ok', label: t('mm2.planes.editor.statusPublished') }
      : { cls: 'pro-pill pro-pill-warn', label: t('mm2.planes.editor.statusInactive') };

  const errorFor = (field: PlanField) =>
    errors?.[field] ? (
      <p className="fp-error" id={id(`${field}-err`)} role="alert">{errorText(errors[field] as PlanFieldError)}</p>
    ) : null;
  const describedBy = (field: PlanField, hintId?: string) =>
    [hintId, errors?.[field] ? id(`${field}-err`) : null].filter(Boolean).join(' ') || undefined;

  return (
    <article className="fp-plan" aria-labelledby={id('title')}>
      <div className="fp-plan-head">
        <h4 className="fp-plan-tier" id={id('title')}>
          <span className="pro-icon-box"><Icon /></span> {tierLabel(tier, t)}
        </h4>
        <span className={status.cls}>{status.label}</span>
      </div>

      <p className="fp-now">
        {fill(t(current.isCustom ? 'mm2.planes.editor.showingNow' : 'mm2.planes.editor.showingNowStandard'), {
          plan: current.name,
          price: perMonth(current.priceCents),
        })}
      </p>

      {/* Nombre */}
      <div className="fp-field">
        <div className="fp-label-row">
          <label className="fp-label" htmlFor={id('name')}>{t('mm2.planes.editor.nameLabel')}</label>
          <span className="fp-count" aria-hidden="true">{form.name.trim().length}/{PLAN_LIMITS.nameMax}</span>
        </div>
        <Input
          id={id('name')}
          value={form.name}
          maxLength={PLAN_LIMITS.nameMax}
          placeholder={t('mm2.planes.editor.namePlaceholder')}
          onChange={e => update('name', { name: e.target.value })}
          aria-invalid={!!errors?.name}
          aria-describedby={describedBy('name')}
          disabled={saving}
          className="bg-white"
        />
        {errorFor('name')}
      </div>

      {/* Precio */}
      <div className="fp-field">
        <label className="fp-label" htmlFor={id('price')}>{t('mm2.planes.editor.priceLabel')}</label>
        <div className="fp-price">
          <span aria-hidden="true">$</span>
          <Input
            id={id('price')}
            type="number"
            inputMode="decimal"
            min={PLAN_LIMITS.priceMinCents / 100}
            max={PLAN_LIMITS.priceMaxCents / 100}
            step="0.01"
            value={form.price}
            placeholder={fill(t('mm2.planes.editor.pricePlaceholder'), { price: standard.priceCents / 100 })}
            onChange={e => update('price', { price: e.target.value })}
            aria-invalid={!!errors?.price}
            aria-describedby={describedBy('price', id('price-hint'))}
            disabled={saving}
            className="bg-white"
          />
          <span aria-hidden="true">MXN</span>
        </div>
        <p className="fp-hint" id={id('price-hint')}>
          {fill(t('mm2.planes.editor.priceHint'), { min: price(PLAN_LIMITS.priceMinCents), max: price(PLAN_LIMITS.priceMaxCents) })}
        </p>
        {errorFor('price')}
      </div>

      {/* Descripción */}
      <div className="fp-field">
        <div className="fp-label-row">
          <label className="fp-label" htmlFor={id('description')}>{t('mm2.planes.editor.descLabel')}</label>
          <span className="fp-count" aria-hidden="true">{form.description.length}/{PLAN_LIMITS.descMax}</span>
        </div>
        <Textarea
          id={id('description')}
          rows={2}
          value={form.description}
          maxLength={PLAN_LIMITS.descMax}
          placeholder={t('mm2.planes.editor.descPlaceholder')}
          onChange={e => update('description', { description: e.target.value })}
          aria-invalid={!!errors?.description}
          aria-describedby={describedBy('description', id('description-hint'))}
          disabled={saving}
          className="bg-white"
        />
        <p className="fp-hint" id={id('description-hint')}>{t('mm2.planes.editor.descHint')}</p>
        {errorFor('description')}
      </div>

      {/* Ventajas */}
      <div className="fp-field" role="group" aria-labelledby={id('perks-label')} aria-describedby={describedBy('perks', id('perks-hint'))}>
        <div className="fp-label-row">
          <span className="fp-label" id={id('perks-label')}>{t('mm2.planes.editor.perksLabel')}</span>
          <span className="fp-count" aria-hidden="true">{perksCount}/{PLAN_LIMITS.perksMax}</span>
        </div>
        <div className="fp-perks">
          {form.perks.map((perk, i) => (
            <div key={i} className="fp-perk">
              <Check aria-hidden="true" />
              <Input
                value={perk}
                maxLength={PLAN_LIMITS.perkMax}
                placeholder={fill(t('mm2.planes.editor.perkLabel'), { n: i + 1 })}
                aria-label={fill(t('mm2.planes.editor.perkLabel'), { n: i + 1 })}
                onChange={e => setPerk(i, e.target.value)}
                disabled={saving}
                className="bg-white"
              />
              <button
                type="button"
                className="pro-btn pro-btn-ghost pro-btn-icon"
                onClick={() => removePerk(i)}
                disabled={saving || (form.perks.length === 1 && !perk)}
                aria-label={fill(t('mm2.planes.editor.removePerk'), { n: i + 1 })}
              >
                <X />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="pro-btn pro-btn-outline pro-btn-sm fp-add"
          onClick={addPerk}
          disabled={saving || form.perks.length >= PLAN_LIMITS.perksMax}
        >
          <Plus /> {t('mm2.planes.editor.addPerk')}
        </button>
        <p className="fp-hint" id={id('perks-hint')}>
          {fill(t('mm2.planes.editor.perksHint'), { max: PLAN_LIMITS.perksMax, chars: PLAN_LIMITS.perkMax })}
        </p>
        {errorFor('perks')}
      </div>

      {/* Activo */}
      <div className="fp-field">
        <label className="fp-switch" htmlFor={id('active')}>
          <Switch
            id={id('active')}
            checked={form.isActive}
            onCheckedChange={v => update(null, { isActive: v })}
            disabled={saving}
          />
          <span>{t('mm2.planes.editor.activeLabel')}</span>
        </label>
        {!form.isActive && (
          <p className="fp-hint">
            {fill(t('mm2.planes.editor.inactiveHint'), { plan: standard.name, price: perMonth(standard.priceCents) })}
          </p>
        )}
      </div>

      <p className="pro-note">
        <Info /> <span>{t('mm2.planes.editor.stripeNote')}</span>
      </p>

      <div className="fp-actions">
        {dirty && (
          <button
            type="button"
            className="pro-btn pro-btn-outline pro-btn-sm"
            onClick={() => { setForm(formFromPlan(plan)); setErrors(null); }}
            disabled={saving}
          >
            {t('mm2.planes.editor.discard')}
          </button>
        )}
        <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={submit} disabled={!dirty || saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Check />}
          {plan ? t('mm2.planes.editor.save') : t('mm2.planes.editor.create')}
        </button>
      </div>
    </article>
  );
}

export default PlansEditor;
