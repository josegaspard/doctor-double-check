// Calculadoras de la mujer: días fértiles, fecha probable de parto y aumento de
// peso en el embarazo. La FUM y el ciclo se comparten entre las tres.
import { useState } from 'react';
import { CalendarHeart, Baby, Droplet } from 'lucide-react';
import {
  bmi, bmiCategory, dueDate, fertileCycles, gestationalAge, pregnancyGainAtWeek,
  pregnancyWeightGain, trimester, PREGNANCY_MILESTONES, startOfDay,
} from '@/lib/healthTools/calc';
import { fmt, fmtDate, fmtShort, type HT } from '@/lib/healthTools/i18n';
import {
  DateField, EmptyResult, Note, NumberField, ResultBox, Segmented, ToolFooter, ToolHead, num, parseYmd, toYmd,
} from './parts';

export const WOMEN_HREF = '/salud-mujer';

export interface CycleState { lmp: string; cycle: string }
export const initialCycle: CycleState = { lmp: '', cycle: '28' };
type CycleProps = { ht: HT; locale: string; cycleState: CycleState; setCycleState: (c: CycleState) => void };

function cycleLen(s: string) {
  const n = Math.round(num(s));
  return n >= 20 && n <= 45 ? n : 28;
}

function CycleFields({ ht, cycleState, setCycleState }: Omit<CycleProps, 'locale'>) {
  return (
    <div className="ht-grid">
      <DateField label={ht('common.lmp')} value={cycleState.lmp} max={toYmd(new Date())} onChange={v => setCycleState({ ...cycleState, lmp: v })} />
      <NumberField label={ht('common.cycle')} value={cycleState.cycle} onChange={v => setCycleState({ ...cycleState, cycle: v })} min={20} max={45} placeholder="28" suffix={ht('common.days')} />
    </div>
  );
}

export function OvulationTool({ ht, locale, cycleState, setCycleState }: CycleProps) {
  const lmp = parseYmd(cycleState.lmp);
  const today = startOfDay(new Date());
  const cycles = lmp ? fertileCycles(lmp, cycleLen(cycleState.cycle), 6).filter(c => c.nextPeriod >= today).slice(0, 3) : [];
  return (
    <div className="ht-tool">
      <ToolHead title={ht('ovulation.title')} intro={ht('ovulation.intro')} />
      <CycleFields ht={ht} cycleState={cycleState} setCycleState={setCycleState} />
      <p className="ht-help">{ht('common.cycleHelp')}</p>
      {cycles.length ? (
        <div className="ht-cycles">
          {cycles.map((c, i) => (
            <ResultBox key={i} tone={i === 0 ? 'ok' : 'info'} kicker={ht('ovulation.cycleN', { n: i + 1 })}>
              <ul className="ht-list">
                <li><span><CalendarHeart className="w-4 h-4" aria-hidden="true" />{ht('ovulation.fertileWindow')}</span><strong>{fmtShort(c.fertileStart, locale)} – {fmtShort(c.fertileEnd, locale)}</strong></li>
                <li><span><Baby className="w-4 h-4" aria-hidden="true" />{ht('ovulation.ovulationDay')}</span><strong>{fmtShort(c.ovulation, locale)}</strong></li>
                <li><span><Droplet className="w-4 h-4" aria-hidden="true" />{ht('ovulation.nextPeriod')}</span><strong>{fmtShort(c.nextPeriod, locale)}</strong></li>
              </ul>
            </ResultBox>
          ))}
        </div>
      ) : <EmptyResult text={ht('common.fillAll')} />}
      <Note>{ht('ovulation.note')}</Note>
      <ToolFooter ht={ht} source={ht('ovulation.source')} cta={{ href: '/doctors?search=Ginecología' }} />
    </div>
  );
}

export function DueDateTool({ ht, locale, cycleState, setCycleState }: CycleProps) {
  const lmp = parseYmd(cycleState.lmp);
  const today = startOfDay(new Date());
  const len = cycleLen(cycleState.cycle);
  const due = lmp ? dueDate(lmp, len) : null;
  const ga = lmp ? gestationalAge(lmp, today, len) : null;
  const future = lmp ? lmp > today : false;
  const past = due ? due < today && ga!.weeks >= 42 : false;
  return (
    <div className="ht-tool">
      <ToolHead title={ht('dueDate.title')} intro={ht('dueDate.intro')} />
      <CycleFields ht={ht} cycleState={cycleState} setCycleState={setCycleState} />
      {!lmp && <EmptyResult text={ht('common.fillAll')} />}
      {lmp && future && <ResultBox tone="warn"><p>{ht('dueDate.notYet')}</p></ResultBox>}
      {lmp && !future && due && ga && (
        <ResultBox tone={past ? 'alert' : 'ok'} textValue kicker={ht('dueDate.due')} value={fmtDate(due, locale)}>
          {past ? <p className="ht-strong">{ht('dueDate.past')}</p> : (
            <>
              <p className="ht-strong">{ht('dueDate.current', { w: ga.weeks, d: ga.days })} · {ht('dueDate.trimester', { n: trimester(ga.weeks) })}</p>
              <div className="ht-progress" aria-hidden="true"><span style={{ width: `${Math.min(100, (ga.totalDays / 280) * 100)}%` }} /></div>
            </>
          )}
        </ResultBox>
      )}
      {lmp && !future && ga && !past && (
        <div className="ht-milestones">
          <h4>{ht('dueDate.milestones')}</h4>
          <ol>
            {PREGNANCY_MILESTONES.map(m => {
              const state = ga.weeks >= m.toWeek ? 'done' : ga.weeks >= m.fromWeek ? 'now' : 'next';
              return (
                <li key={m.id} className={`is-${state}`}>
                  <span className="ht-ms-weeks">{ht('dueDate.weeksRange', { a: m.fromWeek, b: m.toWeek })}</span>
                  <span>{ht(`dueDate.ms_${m.id}`)}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      <Note>{ht('dueDate.note')}</Note>
      <ToolFooter ht={ht} source={ht('dueDate.source')} cta={{ href: '/doctors?search=Ginecología' }} />
    </div>
  );
}

export function PregnancyWeightTool({ ht, locale, cycleState }: CycleProps) {
  const lmp = parseYmd(cycleState.lmp);
  const autoWeek = lmp ? gestationalAge(lmp, new Date(), cycleLen(cycleState.cycle)).weeks : null;
  const [pre, setPre] = useState('');
  const [height, setHeight] = useState('');
  const [current, setCurrent] = useState('');
  const [week, setWeek] = useState(autoWeek !== null && autoWeek > 0 && autoWeek <= 42 ? String(autoWeek) : '');
  const [twins, setTwins] = useState<'no' | 'yes'>('no');
  const b = bmi(num(pre), num(height));
  const cat = b !== null ? bmiCategory(b) : null;
  const total = b !== null ? pregnancyWeightGain(b, twins === 'yes') : null;
  const w = Math.round(num(week));
  const at = b !== null && w > 0 ? pregnancyGainAtWeek(b, w, twins === 'yes') : null;
  const gained = num(current) > 0 && num(pre) > 0 ? num(current) - num(pre) : null;
  const status = at && gained !== null ? (gained < at.min ? 'below' : gained > at.max ? 'above' : 'within') : null;
  return (
    <div className="ht-tool">
      <ToolHead title={ht('pregnancyWeight.title')} intro={ht('pregnancyWeight.intro')} />
      <div className="ht-grid">
        <NumberField label={ht('pregnancyWeight.preWeight')} value={pre} onChange={setPre} min={30} max={250} step={0.1} placeholder="60" suffix="kg" />
        <NumberField label={ht('common.heightCm')} value={height} onChange={setHeight} min={120} max={220} placeholder="160" suffix="cm" />
        <NumberField label={ht('pregnancyWeight.weekNow')} value={week} onChange={setWeek} min={1} max={42} placeholder="20" />
        <NumberField label={ht('pregnancyWeight.currentWeight')} value={current} onChange={setCurrent} min={30} max={250} step={0.1} placeholder="66" suffix="kg" />
        <Segmented<'no' | 'yes'>
          label={ht('pregnancyWeight.twins')}
          value={twins}
          onChange={setTwins}
          options={[{ value: 'no', label: ht('pregnancyWeight.single') }, { value: 'yes', label: ht('pregnancyWeight.twinsOpt') }]}
        />
      </div>
      {b !== null && cat && total ? (
        <ResultBox
          tone={status === 'within' || !status ? 'ok' : 'warn'}
          kicker={ht('pregnancyWeight.preBmi', { b: fmt(b, locale), cat: ht(`bmi.cat_${cat}`) })}
          textValue
          value={ht('pregnancyWeight.total', { min: fmt(total.min, locale), max: fmt(total.max, locale) })}
        >
          {at && <p>{ht('pregnancyWeight.atWeek', { w, min: fmt(at.min, locale), max: fmt(at.max, locale) })}</p>}
          {gained !== null && <p className="ht-strong">{ht('pregnancyWeight.gained', { kg: fmt(gained, locale) })} {status && ht(`pregnancyWeight.${status}`)}</p>}
        </ResultBox>
      ) : <EmptyResult text={ht('common.fillAll')} />}
      <ToolFooter ht={ht} source={ht('pregnancyWeight.source')} cta={{ href: '/doctors?search=Ginecología' }} />
    </div>
  );
}
