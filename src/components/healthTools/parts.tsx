// Piezas comunes de las herramientas de salud: campos, conmutadores, caja de
// resultado, barra de IMC y llamada al especialista. Todas pintan dentro de una
// .pro-card blanca (las reglas globales de .pro-card fijan colores de botones,
// por eso los estados activos llevan !important en herramientas.css).
import { type ReactNode, useId } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Info, ShieldCheck } from 'lucide-react';
import type { HT } from '@/lib/healthTools/i18n';
import type { Sex } from '@/lib/healthTools/calc';

export function ToolHead({ title, intro }: { title: string; intro: string }) {
  return (
    <div className="ht-head">
      <h3 className="ht-title">{title}</h3>
      <p className="ht-intro">{intro}</p>
    </div>
  );
}

export function NumberField({
  label, value, onChange, min, max, step = 1, placeholder, suffix,
}: {
  label: string; value: string; onChange: (v: string) => void;
  min?: number; max?: number; step?: number; placeholder?: string; suffix?: string;
}) {
  const id = useId();
  return (
    <label className="ht-field" htmlFor={id}>
      <span className="ht-label">{label}</span>
      <span className="ht-input-wrap">
        <input
          id={id}
          className="ht-input"
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        {suffix && <span className="ht-suffix">{suffix}</span>}
      </span>
    </label>
  );
}

export function DateField({ label, value, onChange, max }: { label: string; value: string; onChange: (v: string) => void; max?: string }) {
  const id = useId();
  return (
    <label className="ht-field" htmlFor={id}>
      <span className="ht-label">{label}</span>
      <input id={id} className="ht-input" type="date" value={value} max={max} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

export function SelectField({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const id = useId();
  return (
    <label className="ht-field ht-field-wide" htmlFor={id}>
      <span className="ht-label">{label}</span>
      <select id={id} className="ht-input" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Segmented<T extends string>({
  label, value, onChange, options,
}: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="ht-field">
      <span className="ht-label">{label}</span>
      <div className="ht-seg" role="radiogroup" aria-label={label}>
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={value === o.value ? 'is-active' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SexField({ ht, value, onChange }: { ht: HT; value: Sex; onChange: (v: Sex) => void }) {
  return (
    <Segmented
      label={ht('common.sex')}
      value={value}
      onChange={onChange}
      options={[{ value: 'female', label: ht('common.female') }, { value: 'male', label: ht('common.male') }]}
    />
  );
}

export type Tone = 'ok' | 'warn' | 'alert' | 'info';

export function ResultBox({
  tone = 'info', kicker, value, label, children, textValue = false,
}: { tone?: Tone; kicker?: string; value?: ReactNode; label?: string; children?: ReactNode; textValue?: boolean }) {
  return (
    <div className={`ht-result ht-tone-${tone}`} role="status" aria-live="polite">
      {kicker && <div className="ht-result-kicker">{kicker}</div>}
      {(value !== undefined || label) && (
        <div className="ht-result-main">
          {value !== undefined && <span className={`ht-result-value${textValue ? ' ht-result-value-sm' : ''}`}>{value}</span>}
          {label && <span className="ht-result-label">{label}</span>}
        </div>
      )}
      {children && <div className="ht-result-body">{children}</div>}
    </div>
  );
}

export function EmptyResult({ text }: { text: string }) {
  return <div className="ht-empty">{text}</div>;
}

/** Barra 15–40 con los tramos de la OMS y un marcador en el valor. */
export function BmiGauge({ value, locale = 'es-MX' }: { value: number; locale?: string }) {
  const pos = Math.min(1, Math.max(0, (value - 15) / 25)) * 100;
  // tramos: <18,5 · 18,5–25 · 25–30 · 30–35 · 35–40 · >40 (sobre 15–40)
  const stops = [{ w: 14, c: 'u' }, { w: 26, c: 'n' }, { w: 20, c: 'o' }, { w: 20, c: 'o1' }, { w: 20, c: 'o2' }];
  return (
    <div className="ht-gauge" aria-hidden="true">
      <div className="ht-gauge-bar">
        {stops.map((s, i) => <span key={i} className={`ht-gauge-seg ht-g-${s.c}`} style={{ width: `${s.w}%` }} />)}
      </div>
      <span className="ht-gauge-mark" style={{ left: `${pos}%` }} />
      <div className="ht-gauge-scale">{[15, 18.5, 25, 30, 35, 40].map(n => <span key={n}>{n.toLocaleString(locale)}</span>)}</div>
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="ht-note"><Info className="w-4 h-4" aria-hidden="true" /><span>{children}</span></p>;
}

export function ToolFooter({ ht, source, cta }: { ht: HT; source?: string; cta?: { href: string; label?: string } }) {
  return (
    <div className="ht-foot">
      <p className="ht-disclaimer"><ShieldCheck className="w-4 h-4" aria-hidden="true" /><span>{ht('common.disclaimer')}{source && <> <span className="ht-source">{ht('common.source')}: {source}.</span></>}</span></p>
      {cta && (
        <Link to={cta.href} className="pro-btn pro-btn-teal ht-cta">
          {cta.label ?? ht('common.bookSpecialist')}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export const num = (s: string) => {
  const n = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

/** yyyy-mm-dd → Date local (sin desfase por zona horaria). */
export function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return Number.isNaN(d.getTime()) ? null : d;
}
export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
