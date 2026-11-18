// Calculadoras de nutrición: IMC, peso saludable, calorías, cintura y agua.
import { useState } from 'react';
import {
  bmi, bmiCategory, healthyWeightRange, devineIdealWeight, dailyCalories, waistRisk,
  waistToHeight, waterIntake, type ActivityLevel, type BmiCategory, type Sex,
} from '@/lib/healthTools/calc';
import { fmt, type HT } from '@/lib/healthTools/i18n';
import {
  BmiGauge, EmptyResult, Note, NumberField, ResultBox, SelectField, SexField, ToolFooter, ToolHead, num, type Tone,
} from './parts';

export const NUTRITION_HREF = '/nutricion';
const CARDIO_HREF = '/doctors?search=Cardiología';

export function bmiTone(c: BmiCategory): Tone {
  if (c === 'normal') return 'ok';
  if (c === 'under' || c === 'over') return 'warn';
  return 'alert';
}

// El peso y la estatura se comparten entre IMC, peso saludable, calorías y
// cintura: quien los escribe una vez no los vuelve a escribir al cambiar de pestaña.
export interface BodyState { weight: string; height: string; age: string; sex: Sex }
export const initialBody: BodyState = { weight: '', height: '', age: '', sex: 'female' };
type BodyProps = { ht: HT; locale: string; body: BodyState; setBody: (b: BodyState) => void };

export function BmiTool({ ht, locale, body, setBody }: BodyProps) {
  const value = bmi(num(body.weight), num(body.height));
  const cat = value !== null ? bmiCategory(value) : null;
  const range = healthyWeightRange(num(body.height));
  return (
    <div className="ht-tool">
      <ToolHead title={ht('bmi.title')} intro={ht('bmi.intro')} />
      <div className="ht-grid">
        <NumberField label={ht('common.weightKg')} value={body.weight} onChange={v => setBody({ ...body, weight: v })} min={2} max={400} step={0.1} placeholder="70" suffix="kg" />
        <NumberField label={ht('common.heightCm')} value={body.height} onChange={v => setBody({ ...body, height: v })} min={40} max={250} placeholder="165" suffix="cm" />
      </div>
      {value !== null && cat ? (
        <ResultBox tone={bmiTone(cat)} kicker={ht('bmi.yourBmi')} value={fmt(value, locale)} label={ht(`bmi.cat_${cat}`)}>
          <BmiGauge value={value} locale={locale} />
          <p>{ht(`bmi.msg_${cat}`)}</p>
          {range && <p className="ht-strong">{ht('bmi.healthyRange', { min: fmt(range.min, locale), max: fmt(range.max, locale) })}</p>}
        </ResultBox>
      ) : <EmptyResult text={ht('common.fillAll')} />}
      <Note>{ht('bmi.note')}</Note>
      <ToolFooter ht={ht} source={ht('bmi.source')} cta={{ href: NUTRITION_HREF }} />
    </div>
  );
}

export function IdealWeightTool({ ht, locale, body, setBody }: BodyProps) {
  const h = num(body.height);
  const range = healthyWeightRange(h);
  const devine = devineIdealWeight(h, body.sex);
  const w = num(body.weight);
  let delta: string | null = null;
  if (range && w > 0) {
    if (w > range.max) delta = ht('idealWeight.toLose', { kg: fmt(w - range.max, locale) });
    else if (w < range.min) delta = ht('idealWeight.toGain', { kg: fmt(range.min - w, locale) });
    else delta = ht('idealWeight.inRange');
  }
  return (
    <div className="ht-tool">
      <ToolHead title={ht('idealWeight.title')} intro={ht('idealWeight.intro')} />
      <div className="ht-grid">
        <NumberField label={ht('common.heightCm')} value={body.height} onChange={v => setBody({ ...body, height: v })} min={40} max={250} placeholder="165" suffix="cm" />
        <SexField ht={ht} value={body.sex} onChange={sex => setBody({ ...body, sex })} />
        <NumberField label={ht('idealWeight.currentOptional')} value={body.weight} onChange={v => setBody({ ...body, weight: v })} min={2} max={400} step={0.1} placeholder="70" suffix="kg" />
      </div>
      {range ? (
        <ResultBox
          tone={delta && delta !== ht('idealWeight.inRange') ? 'warn' : 'ok'}
          kicker={ht('idealWeight.range')}
          value={`${fmt(range.min, locale)}–${fmt(range.max, locale)}`}
          label={ht('common.kg')}
        >
          {devine !== null && <p>{ht('idealWeight.devine')}: <strong>{fmt(devine, locale)} kg</strong></p>}
          {delta && <p className="ht-strong">{delta}</p>}
        </ResultBox>
      ) : <EmptyResult text={ht('common.fillAll')} />}
      <ToolFooter ht={ht} source={ht('idealWeight.source')} cta={{ href: NUTRITION_HREF }} />
    </div>
  );
}

const ACTIVITIES: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'high', 'athlete'];

export function CaloriesTool({ ht, locale, body, setBody }: BodyProps) {
  const [activity, setActivity] = useState<ActivityLevel>('light');
  const r = dailyCalories(num(body.weight), num(body.height), num(body.age), body.sex, activity);
  const kcal = (n: number) => fmt(n, locale, 0);
  return (
    <div className="ht-tool">
      <ToolHead title={ht('calories.title')} intro={ht('calories.intro')} />
      <div className="ht-grid">
        <NumberField label={ht('common.weightKg')} value={body.weight} onChange={v => setBody({ ...body, weight: v })} min={20} max={400} step={0.1} placeholder="70" suffix="kg" />
        <NumberField label={ht('common.heightCm')} value={body.height} onChange={v => setBody({ ...body, height: v })} min={100} max={250} placeholder="165" suffix="cm" />
        <NumberField label={ht('common.age')} value={body.age} onChange={v => setBody({ ...body, age: v })} min={15} max={100} placeholder="35" />
        <SexField ht={ht} value={body.sex} onChange={sex => setBody({ ...body, sex })} />
        <SelectField
          label={ht('calories.activity')}
          value={activity}
          onChange={v => setActivity(v as ActivityLevel)}
          options={ACTIVITIES.map(a => ({ value: a, label: ht(`calories.act_${a}`) }))}
        />
      </div>
      {r ? (
        <ResultBox tone="info" kicker={ht('calories.maintain')} value={kcal(r.maintain)} label={ht('calories.perDay')}>
          <ul className="ht-list">
            <li><span>{ht('calories.lose')}</span><strong>{kcal(r.lose)} {ht('calories.perDay')}</strong></li>
            <li><span>{ht('calories.gain')}</span><strong>{kcal(r.gain)} {ht('calories.perDay')}</strong></li>
            <li><span>{ht('calories.bmr')}</span><strong>{kcal(r.bmr)} {ht('calories.perDay')}</strong></li>
          </ul>
        </ResultBox>
      ) : <EmptyResult text={ht('common.fillAll')} />}
      <Note>{ht('calories.note')}</Note>
      <ToolFooter ht={ht} source={ht('calories.source')} cta={{ href: NUTRITION_HREF }} />
    </div>
  );
}

export function WaistTool({ ht, locale, body, setBody }: BodyProps) {
  const [waist, setWaist] = useState('');
  const risk = waistRisk(num(waist), body.sex);
  const ratio = waistToHeight(num(waist), num(body.height));
  const tone: Tone = risk === 'low' ? 'ok' : risk === 'increased' ? 'warn' : 'alert';
  return (
    <div className="ht-tool">
      <ToolHead title={ht('waist.title')} intro={ht('waist.intro')} />
      <div className="ht-grid">
        <NumberField label={ht('waist.waistCm')} value={waist} onChange={setWaist} min={40} max={200} placeholder="85" suffix="cm" />
        <SexField ht={ht} value={body.sex} onChange={sex => setBody({ ...body, sex })} />
        <NumberField label={ht('common.heightCm')} value={body.height} onChange={v => setBody({ ...body, height: v })} min={100} max={250} placeholder="165" suffix="cm" />
      </div>
      {risk ? (
        <ResultBox tone={tone} textValue value={ht(`waist.risk_${risk}`)}>
          <p>{ht(`waist.msg_${risk}`)}</p>
          {ratio !== null && (
            <p className="ht-strong">
              {ht('waist.ratio', { r: fmt(ratio, locale, 2) })} · {ratio >= 0.5 ? ht('waist.ratioHigh') : ht('waist.ratioOk')}
            </p>
          )}
        </ResultBox>
      ) : <EmptyResult text={ht('common.fillAll')} />}
      <ToolFooter ht={ht} source={ht('waist.source')} cta={{ href: risk === 'high' ? CARDIO_HREF : NUTRITION_HREF }} />
    </div>
  );
}

export function WaterTool({ ht, locale, body, setBody }: BodyProps) {
  const [minutes, setMinutes] = useState('');
  const r = waterIntake(num(body.weight), num(minutes) || 0);
  return (
    <div className="ht-tool">
      <ToolHead title={ht('water.title')} intro={ht('water.intro')} />
      <div className="ht-grid">
        <NumberField label={ht('common.weightKg')} value={body.weight} onChange={v => setBody({ ...body, weight: v })} min={20} max={400} step={0.1} placeholder="70" suffix="kg" />
        <NumberField label={ht('water.exercise')} value={minutes} onChange={setMinutes} min={0} max={600} placeholder="30" suffix="min" />
      </div>
      {r ? (
        <ResultBox tone="info" textValue value={ht('water.liters', { l: fmt(r.liters, locale) })}>
          <p>{ht('water.glasses', { g: r.glasses })}</p>
        </ResultBox>
      ) : <EmptyResult text={ht('common.fillAll')} />}
      <Note>{ht('water.note')}</Note>
      <ToolFooter ht={ht} source={ht('water.source')} cta={{ href: NUTRITION_HREF }} />
    </div>
  );
}
