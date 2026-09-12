// Editor de «Servicios y precios» del médico (F1 servicios, 12-sep-2026).
//
// Se monta en Cuenta › Perfil › «Servicios y disponibilidad» (UserProfile.tsx,
// profTab === 'servicios'), debajo del precio de la consulta.
//
// Lista, crear, editar, reordenar (subir/bajar), mostrar/ocultar y eliminar.
// Crear, guardar cambios, mostrar/ocultar y eliminar pasan por el modal de
// revisión (useConfirmAction): el primer clic nunca escribe.
// Sin servicios, explica que el perfil enseña la tarifa única de consulta.
// Sin migración: aviso «pendiente de activar» y ningún botón que finja guardar.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Clock, ExternalLink, Info, Loader2, MapPin, Monitor, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConfirmAction, type ConfirmActionDetail } from '@/components/common/ConfirmActionDialog';
import { fill, money2 } from '@/lib/proFormat';
import { useDoctorServices, type ServiceMutationFailure } from '@/hooks/useDoctorServices';
import {
  DURATION_PRESETS,
  SERVICE_ICON_IDS,
  SERVICE_LIMITS,
  SERVICE_MODALITIES,
  draftFromService,
  draftToPayload,
  emptyServiceDraft,
  hasServiceErrors,
  minServicePrice,
  validateServiceDraft,
  type DoctorService,
  type ServiceDraft,
  type ServiceErrors,
  type ServiceField,
  type ServiceFieldError,
  type ServiceModality,
} from './serviceModel';
import { SERVICE_ICONS, serviceIcon } from './serviceIcons';
import '@/styles/funciones-servicios.css';

interface ServicesEditorProps {
  /** consultation_fee actual: se cita en el estado vacío (es lo que el perfil enseña sin servicios). */
  consultationFee?: number;
  /** Aviso al padre tras cualquier cambio guardado. */
  onChanged?: () => void;
}

const FIELD_ORDER: ServiceField[] = ['name', 'description', 'duration_minutes', 'price', 'modality', 'icon'];
const FIELD_INPUT_ID: Partial<Record<ServiceField, string>> = {
  name: 'fs-name',
  description: 'fs-desc',
  duration_minutes: 'fs-dur',
  price: 'fs-price',
};

const ModalityIcon = ({ m }: { m: ServiceModality }) =>
  m === 'presencial' ? <MapPin aria-hidden="true" /> : <Monitor aria-hidden="true" />;

export function ServicesEditor({ consultationFee, onChanged }: ServicesEditorProps) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { confirm, dialog } = useConfirmAction();
  const { services, loading, saving, error, pendingActivation, reload, create, update, setActive, remove, move } =
    useDoctorServices();

  /** 'new' = formulario de alta abierto · id = editando ese servicio · null = cerrado */
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<ServiceDraft>(emptyServiceDraft);
  const [errors, setErrors] = useState<ServiceErrors>({});
  const [touched, setTouched] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [fee, setFee] = useState<number | null>(typeof consultationFee === 'number' ? consultationFee : null);

  // Precio de consulta que enseña hoy el perfil (si el padre no lo pasa, se lee).
  useEffect(() => {
    if (typeof consultationFee === 'number') {
      setFee(consultationFee);
      return;
    }
    if (!user?.id) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('doctor_profiles')
        .select('consultation_fee')
        .eq('user_id', user.id)
        .maybeSingle();
      if (alive && data) setFee(Number(data.consultation_fee) || 0);
    })();
    return () => {
      alive = false;
    };
  }, [consultationFee, user?.id]);

  const priceText = (n: number) => (n === 0 ? t('doctorProfile.free') : money2(n, language));
  const minutesText = (n: number) => fill(t('mm2.publicProfile.minutes'), { n });
  const modalityText = (m: ServiceModality) => t(`mm2.servicios.modality.${m}`);
  const feeText = fee === null ? '—' : priceText(fee);
  const atLimit = services.length >= SERVICE_LIMITS.maxServices;
  const fromPrice = minServicePrice(services);

  const errorText = (field: ServiceField, code: ServiceFieldError): string => {
    const L = SERVICE_LIMITS;
    switch (field) {
      case 'name':
        if (code === 'required') return t('mm2.servicios.errors.nameRequired');
        if (code === 'tooShort') return fill(t('mm2.servicios.errors.nameTooShort'), { min: L.nameMin });
        return fill(t('mm2.servicios.errors.nameTooLong'), { max: L.nameMax });
      case 'description':
        return fill(t('mm2.servicios.errors.descriptionTooLong'), { max: L.descriptionMax });
      case 'duration_minutes':
        if (code === 'required') return t('mm2.servicios.errors.durationRequired');
        if (code === 'notInteger') return t('mm2.servicios.errors.durationNotInteger');
        return fill(t('mm2.servicios.errors.durationOutOfRange'), { min: L.durationMin, max: L.durationMax });
      case 'price':
        if (code === 'required') return t('mm2.servicios.errors.priceRequired');
        if (code === 'tooManyDecimals') return t('mm2.servicios.errors.priceTooManyDecimals');
        if (code === 'outOfRange') return fill(t('mm2.servicios.errors.priceOutOfRange'), { max: money2(L.priceMax, language) });
        return t('mm2.servicios.errors.priceNotNumber');
      default:
        return t('mm2.servicios.errors.invalidOption');
    }
  };

  const failToast = (reason: ServiceMutationFailure) => {
    if (reason === 'limit') toast.error(fill(t('mm2.servicios.toast.limit'), { n: SERVICE_LIMITS.maxServices }));
    else if (reason === 'pending_activation') toast.error(t('mm2.servicios.toast.pending'));
    else if (reason === 'forbidden') toast.error(t('mm2.servicios.toast.forbidden'));
    else if (reason === 'invalid') toast.error(t('mm2.servicios.toast.invalid'));
    else toast.error(t('mm2.servicios.toast.error'));
  };

  const openNew = () => {
    setDraft(emptyServiceDraft());
    setErrors({});
    setTouched(false);
    setEditing('new');
  };

  const openEdit = (s: DoctorService) => {
    setDraft(draftFromService(s));
    setErrors({});
    setTouched(false);
    setEditing(s.id);
  };

  const closeForm = () => {
    setEditing(null);
    setErrors({});
    setTouched(false);
  };

  const patch = (p: Partial<ServiceDraft>) => {
    const next = { ...draft, ...p };
    setDraft(next);
    if (touched) setErrors(validateServiceDraft(next));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || saving) return;
    const errs = validateServiceDraft(draft);
    setErrors(errs);
    setTouched(true);
    if (hasServiceErrors(errs)) {
      const first = FIELD_ORDER.find((f) => errs[f]);
      const inputId = first ? FIELD_INPUT_ID[first] : undefined;
      if (inputId) document.getElementById(inputId)?.focus();
      return;
    }

    const payload = draftToPayload(draft);
    const isNew = editing === 'new';
    const prev = isNew ? null : services.find((s) => s.id === editing) || null;
    const details: ConfirmActionDetail[] = [
      { label: t('mm2.servicios.confirm.lblName'), value: payload.name },
      { label: t('mm2.servicios.confirm.lblDuration'), value: minutesText(payload.duration_minutes) },
      { label: t('mm2.servicios.confirm.lblModality'), value: modalityText(payload.modality) },
      {
        label: t('mm2.servicios.confirm.lblVisibility'),
        value: payload.is_active ? t('mm2.servicios.editor.active') : t('mm2.servicios.editor.inactive'),
      },
    ];
    if (prev && prev.price !== payload.price) {
      details.push({ label: t('mm2.servicios.confirm.lblPricePrev'), value: priceText(prev.price) });
    }
    details.push({ label: t('mm2.servicios.confirm.lblPrice'), value: priceText(payload.price), emphasis: true });

    const ok = await confirm({
      title: isNew ? t('mm2.servicios.confirm.createTitle') : t('mm2.servicios.confirm.updateTitle'),
      description: isNew
        ? payload.is_active
          ? t('mm2.servicios.confirm.createDescVisible')
          : t('mm2.servicios.confirm.createDescHidden')
        : t('mm2.servicios.confirm.updateDesc'),
      details,
      confirmLabel: isNew ? t('mm2.servicios.confirm.createCta') : t('mm2.servicios.confirm.saveCta'),
    });
    if (!ok) return;

    const res = isNew ? await create(draft) : await update(editing, draft);
    if (res.ok === false) {
      failToast(res.reason);
      return;
    }
    toast.success(isNew ? t('mm2.servicios.toast.created') : t('mm2.servicios.toast.updated'));
    onChanged?.();
    closeForm();
  };

  const toggle = async (s: DoctorService, next: boolean) => {
    if (saving) return;
    const ok = await confirm({
      title: fill(t(next ? 'mm2.servicios.confirm.showTitle' : 'mm2.servicios.confirm.hideTitle'), { service: s.name }),
      description: t(next ? 'mm2.servicios.confirm.showDesc' : 'mm2.servicios.confirm.hideDesc'),
      details: [
        { label: t('mm2.servicios.confirm.lblName'), value: s.name },
        { label: t('mm2.servicios.confirm.lblDuration'), value: minutesText(s.duration_minutes) },
        { label: t('mm2.servicios.confirm.lblPrice'), value: priceText(s.price), emphasis: true },
      ],
      confirmLabel: t(next ? 'mm2.servicios.confirm.showCta' : 'mm2.servicios.confirm.hideCta'),
    });
    if (!ok) return;
    setBusyId(s.id);
    const res = await setActive(s.id, next);
    setBusyId(null);
    if (res.ok === false) {
      failToast(res.reason);
      return;
    }
    toast.success(t(next ? 'mm2.servicios.toast.shown' : 'mm2.servicios.toast.hidden'));
    onChanged?.();
  };

  const del = async (s: DoctorService) => {
    if (saving) return;
    const ok = await confirm({
      title: fill(t('mm2.servicios.confirm.deleteTitle'), { service: s.name }),
      description: t('mm2.servicios.confirm.deleteDesc'),
      tone: 'destructive',
      details: [
        { label: t('mm2.servicios.confirm.lblName'), value: s.name },
        { label: t('mm2.servicios.confirm.lblPrice'), value: priceText(s.price) },
      ],
      confirmLabel: t('mm2.servicios.confirm.deleteCta'),
    });
    if (!ok) return;
    setBusyId(s.id);
    const res = await remove(s.id);
    setBusyId(null);
    if (res.ok === false) {
      failToast(res.reason);
      return;
    }
    if (editing === s.id) closeForm();
    toast.success(t('mm2.servicios.toast.deleted'));
    onChanged?.();
  };

  // Reordenar no pide confirmación: solo cambia el orden de la lista y se deshace con el botón contrario.
  const reorder = async (s: DoctorService, dir: -1 | 1) => {
    if (saving) return;
    setBusyId(s.id);
    const res = await move(s.id, dir);
    setBusyId(null);
    if (res.ok === false) {
      if (res.reason === 'pending_activation') failToast(res.reason);
      else toast.error(t('mm2.servicios.toast.reorderError'));
      return;
    }
    onChanged?.();
  };

  const fieldError = (f: ServiceField) =>
    errors[f] ? (
      <span id={`fs-${f}-err`} className="fs-err">
        {errorText(f, errors[f])}
      </span>
    ) : null;

  const renderForm = () => {
    const isNew = editing === 'new';
    return (
      <form className="fs-form" onSubmit={submit} noValidate aria-labelledby="fs-form-title">
        <p className="fs-form-title" id="fs-form-title">
          {isNew ? t('mm2.servicios.form.newTitle') : t('mm2.servicios.form.editTitle')}
        </p>

        <div className="fs-fld">
          <label htmlFor="fs-name">{t('mm2.servicios.form.name')}</label>
          <input
            id="fs-name"
            className="fs-input bg-white"
            type="text"
            autoComplete="off"
            autoFocus
            maxLength={SERVICE_LIMITS.nameMax}
            value={draft.name}
            placeholder={t('mm2.servicios.form.namePlaceholder')}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'fs-name-err' : undefined}
            onChange={(e) => patch({ name: e.target.value })}
          />
          {fieldError('name')}
        </div>

        <div className="fs-fld">
          <div className="fs-lblrow">
            <label htmlFor="fs-desc">{t('mm2.servicios.form.description')}</label>
            <span className="fs-count" aria-hidden="true">
              {draft.description.length}/{SERVICE_LIMITS.descriptionMax}
            </span>
          </div>
          <textarea
            id="fs-desc"
            className="fs-input bg-white"
            rows={2}
            maxLength={SERVICE_LIMITS.descriptionMax}
            value={draft.description}
            placeholder={t('mm2.servicios.form.descriptionPlaceholder')}
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? 'fs-description-err' : undefined}
            onChange={(e) => patch({ description: e.target.value })}
          />
          {fieldError('description')}
        </div>

        <div className="fs-grid2">
          <div className="fs-fld">
            <label htmlFor="fs-dur">{t('mm2.servicios.form.duration')}</label>
            <div className="fs-affix">
              <input
                id="fs-dur"
                className="fs-input bg-white"
                type="number"
                inputMode="numeric"
                min={SERVICE_LIMITS.durationMin}
                max={SERVICE_LIMITS.durationMax}
                step={5}
                value={draft.duration_minutes}
                aria-invalid={!!errors.duration_minutes}
                aria-describedby={errors.duration_minutes ? 'fs-duration_minutes-err' : undefined}
                onChange={(e) => patch({ duration_minutes: e.target.value })}
              />
              <span>{t('mm2.servicios.form.minutesSuffix')}</span>
            </div>
            <div className="fs-opts" role="group" aria-label={t('mm2.servicios.form.durationPresets')}>
              {DURATION_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className="fs-opt"
                  aria-pressed={draft.duration_minutes.trim() === String(n)}
                  onClick={() => patch({ duration_minutes: String(n) })}
                >
                  {minutesText(n)}
                </button>
              ))}
            </div>
            {fieldError('duration_minutes')}
          </div>

          <div className="fs-fld">
            <label htmlFor="fs-price">{t('mm2.servicios.form.price')}</label>
            <div className="fs-affix">
              <span aria-hidden="true">$</span>
              <input
                id="fs-price"
                className="fs-input bg-white"
                type="number"
                inputMode="decimal"
                min={0}
                max={SERVICE_LIMITS.priceMax}
                step="0.01"
                value={draft.price}
                placeholder="0"
                aria-invalid={!!errors.price}
                aria-describedby={errors.price ? 'fs-price-err fs-price-hint' : 'fs-price-hint'}
                onChange={(e) => patch({ price: e.target.value })}
              />
              <span>MXN</span>
            </div>
            <span id="fs-price-hint" className="fs-hint">{t('mm2.servicios.form.priceHint')}</span>
            {fieldError('price')}
          </div>
        </div>

        <div className="fs-fld">
          <span className="fs-lbl" id="fs-mod-lbl">{t('mm2.servicios.form.modality')}</span>
          <div className="fs-opts" role="group" aria-labelledby="fs-mod-lbl">
            {SERVICE_MODALITIES.map((m) => (
              <button
                key={m}
                type="button"
                className="fs-opt"
                aria-pressed={draft.modality === m}
                onClick={() => patch({ modality: m })}
              >
                <ModalityIcon m={m} /> {modalityText(m)}
              </button>
            ))}
          </div>
        </div>

        <div className="fs-fld">
          <span className="fs-lbl" id="fs-icon-lbl">{t('mm2.servicios.form.icon')}</span>
          <div className="fs-opts" role="group" aria-labelledby="fs-icon-lbl">
            {SERVICE_ICON_IDS.map((id) => {
              const I = SERVICE_ICONS[id];
              const label = t(`mm2.servicios.icon.${id}`);
              return (
                <button
                  key={id}
                  type="button"
                  className="fs-opt fs-opt-icon"
                  aria-pressed={draft.icon === id}
                  aria-label={label}
                  title={label}
                  onClick={() => patch({ icon: id })}
                >
                  <I aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="fs-switchrow">
          <div className="min-w-0">
            <label htmlFor="fs-visible" className="fs-lbl">{t('mm2.servicios.form.visible')}</label>
            <span className="fs-hint">{t('mm2.servicios.form.visibleHint')}</span>
          </div>
          <Switch id="fs-visible" checked={draft.is_active} onCheckedChange={(v) => patch({ is_active: v })} />
        </div>

        <div className="fs-form-foot">
          <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={closeForm} disabled={saving}>
            {t('mm2.servicios.form.cancel')}
          </button>
          <button type="submit" className="pro-btn pro-btn-teal pro-btn-sm" disabled={saving}>
            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
            {saving ? t('mm2.servicios.form.saving') : t('mm2.servicios.form.save')}
          </button>
        </div>
      </form>
    );
  };

  const showAdd = !pendingActivation && !loading && !error && services.length > 0 && editing !== 'new';
  const hasVisible = fromPrice !== null;
  const footHint = pendingActivation || loading || error || services.length === 0
    ? null
    : atLimit
      ? fill(t('mm2.servicios.editor.limitReached'), { n: SERVICE_LIMITS.maxServices })
      : hasVisible
        ? fill(t('mm2.servicios.editor.fromNote'), { price: priceText(fromPrice) })
        : fill(t('mm2.servicios.editor.allHidden'), { fee: feeText });

  return (
    <section className="pro-card pro-card-pad fs-ed" aria-labelledby="fs-ed-title">
      <div className="pro-card-head">
        <h3 className="pro-card-title" id="fs-ed-title"><Tag /> {t('mm2.servicios.editor.title')}</h3>
        {showAdd && (
          <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={openNew} disabled={saving || atLimit}>
            <Plus aria-hidden="true" /> {t('mm2.servicios.editor.add')}
          </button>
        )}
      </div>
      <p className="fs-ed-intro">{t('mm2.servicios.editor.intro')}</p>

      {pendingActivation ? (
        <div className="pro-note" role="status">
          <Info aria-hidden="true" />
          <div className="min-w-0">
            <b>{t('mm2.servicios.editor.pendingTitle')}</b>
            {fill(t('mm2.servicios.editor.pendingDesc'), { fee: feeText })}
          </div>
        </div>
      ) : loading ? (
        <div className="py-1" aria-hidden="true">
          <span className="fs-skel fs-skel-line" />
          <span className="fs-skel fs-skel-line" />
        </div>
      ) : error ? (
        <div className="pro-note" role="alert">
          <Info aria-hidden="true" />
          <div className="min-w-0">
            <b>{t('mm2.servicios.editor.loadError')}</b>
            <button type="button" className="pro-btn pro-btn-outline pro-btn-xs" onClick={() => reload()}>
              {t('mm2.servicios.editor.retry')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {editing === 'new' && renderForm()}

          {services.length === 0 ? (
            editing !== 'new' && (
              <div className="fs-empty">
                <span className="pro-icon-box" aria-hidden="true"><Tag /></span>
                <p className="fs-empty-title">{t('mm2.servicios.editor.emptyTitle')}</p>
                <p className="fs-empty-desc">{fill(t('mm2.servicios.editor.emptyDesc'), { fee: feeText })}</p>
                <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={openNew}>
                  <Plus aria-hidden="true" /> {t('mm2.servicios.editor.emptyCta')}
                </button>
              </div>
            )
          ) : (
            <ul className="fs-ed-list">
              {services.map((s, i) => {
                const Icon = serviceIcon(s.icon);
                const isEditing = editing === s.id;
                return (
                  <li key={s.id} className={`fs-ed-row${s.is_active ? '' : ' is-off'}`}>
                    <span className="pro-icon-box" aria-hidden="true"><Icon /></span>
                    <div className="fs-ed-main">
                      <div className="fs-ed-name">
                        <span className="min-w-0">{s.name}</span>
                        {!s.is_active && (
                          <span className="pro-pill pro-pill-muted fs-ed-offpill">{t('mm2.servicios.editor.inactive')}</span>
                        )}
                      </div>
                      {s.description && <p className="fs-ed-desc">{s.description}</p>}
                      <div className="fs-ed-meta">
                        <span><Clock aria-hidden="true" /> {minutesText(s.duration_minutes)}</span>
                        <span><ModalityIcon m={s.modality} /> {modalityText(s.modality)}</span>
                        <b>{priceText(s.price)}</b>
                      </div>
                    </div>
                    <div className="fs-ed-actions">
                      <label className="fs-ed-switch">
                        <Switch
                          checked={s.is_active}
                          disabled={saving}
                          onCheckedChange={(v) => toggle(s, v)}
                          aria-label={fill(t('mm2.servicios.editor.toggleAria'), { service: s.name })}
                        />
                        <span>{s.is_active ? t('mm2.servicios.editor.active') : t('mm2.servicios.editor.inactive')}</span>
                      </label>
                      <button
                        type="button"
                        className="fs-iconbtn"
                        onClick={() => reorder(s, -1)}
                        disabled={saving || i === 0}
                        aria-label={fill(t('mm2.servicios.editor.moveUp'), { service: s.name })}
                        title={fill(t('mm2.servicios.editor.moveUp'), { service: s.name })}
                      >
                        <ArrowUp aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="fs-iconbtn"
                        onClick={() => reorder(s, 1)}
                        disabled={saving || i === services.length - 1}
                        aria-label={fill(t('mm2.servicios.editor.moveDown'), { service: s.name })}
                        title={fill(t('mm2.servicios.editor.moveDown'), { service: s.name })}
                      >
                        <ArrowDown aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="fs-iconbtn"
                        onClick={() => (isEditing ? closeForm() : openEdit(s))}
                        disabled={saving}
                        aria-expanded={isEditing}
                        aria-label={fill(t('mm2.servicios.editor.edit'), { service: s.name })}
                        title={fill(t('mm2.servicios.editor.edit'), { service: s.name })}
                      >
                        <Pencil aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="fs-iconbtn is-danger"
                        onClick={() => del(s)}
                        disabled={saving}
                        aria-label={fill(t('mm2.servicios.editor.delete'), { service: s.name })}
                        title={fill(t('mm2.servicios.editor.delete'), { service: s.name })}
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                      {busyId === s.id && <Loader2 className="animate-spin h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                    </div>
                    {isEditing && <div className="fs-ed-formslot">{renderForm()}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <div className="fs-ed-foot">
        {footHint && <span className="fs-hint">{footHint}</span>}
        {user?.id && (
          <Link to={`/doctor/${user.id}?tab=servicios`} className="pro-link">
            <ExternalLink aria-hidden="true" /> {t('mm2.servicios.editor.viewPublic')}
          </Link>
        )}
      </div>
      {dialog}
    </section>
  );
}

export default ServicesEditor;
