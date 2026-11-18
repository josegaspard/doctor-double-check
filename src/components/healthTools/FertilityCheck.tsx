// Test de fertilidad paso a paso (18-nov-2026): una pregunta por pantalla con
// contador, como el de Quirónsalud que gustó a los médicos, pero con criterios
// propios de las guías clínicas (NICE CG156 y ASRM 2013/2020) sobre CUÁNDO
// consultar a un especialista: no da una «probabilidad de embarazo».
//
//   · Consultar ya: mujer ≥ 40 años · 35–39 y ≥ 6 meses buscando · > 12 meses
//     buscando · reglas irregulares o ausentes · endometriosis, SOP, infección
//     pélvica o cirugía de trompas/ovarios · ≥ 2 pérdidas · factor masculino
//     conocido · quimio o radioterapia previa.
//   · Si no: seguir intentándolo y consultar si no hay embarazo en N meses.
import { useState } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import type { HT } from '@/lib/healthTools/i18n';
import { ResultBox, ToolFooter, ToolHead } from './parts';

type Answer = string;
interface Step { id: string; options: string[] }

const STEPS: Step[] = [
  { id: 'age', options: ['lt35', '35to39', 'ge40'] },
  { id: 'time', options: ['lt6', '6to12', 'gt12'] },
  { id: 'cycles', options: ['no', 'yes'] },
  { id: 'conditions', options: ['no', 'yes', 'unknown'] },
  { id: 'losses', options: ['no', 'yes'] },
  { id: 'partner', options: ['no', 'yes', 'unknown'] },
  { id: 'cancer', options: ['no', 'yes'] },
];

export function fertilityVerdict(a: Record<string, Answer>): { level: 'now' | 'soon' | 'wait'; months?: number; reasons: string[] } {
  const reasons: string[] = [];
  if (a.age === 'ge40') reasons.push('age40');
  if (a.age === '35to39' && a.time !== 'lt6') reasons.push('age35time');
  if (a.time === 'gt12') reasons.push('time12');
  if (a.cycles === 'yes') reasons.push('cycles');
  if (a.conditions === 'yes') reasons.push('conditions');
  if (a.losses === 'yes') reasons.push('losses');
  if (a.partner === 'yes') reasons.push('partner');
  if (a.cancer === 'yes') reasons.push('cancer');
  if (reasons.length) return { level: 'now', reasons };
  // Sin motivos: plazo hasta consultar (6 meses desde los 35, 12 antes).
  const limit = a.age === '35to39' ? 6 : 12;
  const elapsed = a.time === '6to12' ? 6 : 0;
  const months = Math.max(1, limit - elapsed);
  return { level: a.conditions === 'unknown' || a.partner === 'unknown' ? 'soon' : 'wait', months, reasons };
}

export function FertilityCheckTool({ ht }: { ht: HT }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const done = step >= STEPS.length;
  const cur = STEPS[Math.min(step, STEPS.length - 1)];

  const choose = (v: Answer) => {
    setAnswers(a => ({ ...a, [cur.id]: v }));
    setStep(s => s + 1);
  };
  const restart = () => { setAnswers({}); setStep(0); };
  const verdict = done ? fertilityVerdict(answers) : null;

  return (
    <div className="ht-tool">
      <ToolHead title={ht('fertility.title')} intro={ht('fertility.intro')} />
      {!done ? (
        <div className="ht-stepper">
          <div className="ht-stepper-top">
            <span className="ht-stepper-count">{ht('fertility.stepOf', { n: step + 1, total: STEPS.length })}</span>
            <div className="ht-stepper-bar" aria-hidden="true"><span style={{ width: `${(step / STEPS.length) * 100}%` }} /></div>
          </div>
          <p className="ht-stepper-q" id={`ht-fq-${cur.id}`}>{ht(`fertility.q_${cur.id}`)}</p>
          {ht(`fertility.h_${cur.id}`) !== `fertility.h_${cur.id}` && <p className="ht-help">{ht(`fertility.h_${cur.id}`)}</p>}
          <div className="ht-opts ht-opts-col" role="radiogroup" aria-labelledby={`ht-fq-${cur.id}`}>
            {cur.options.map(o => (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={answers[cur.id] === o}
                className={answers[cur.id] === o ? 'is-active' : ''}
                onClick={() => choose(o)}
              >
                {ht(`fertility.o_${cur.id}_${o}`)}
              </button>
            ))}
          </div>
          {step > 0 && (
            <button type="button" className="pro-btn pro-btn-outline pro-btn-sm ht-back" onClick={() => setStep(s => s - 1)}>
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />{ht('fertility.back')}
            </button>
          )}
        </div>
      ) : verdict && (
        <>
          <ResultBox
            tone={verdict.level === 'now' ? 'warn' : verdict.level === 'soon' ? 'info' : 'ok'}
            textValue
            value={ht(`fertility.v_${verdict.level}`)}
          >
            {verdict.level === 'now' ? (
              <>
                <p>{ht('fertility.m_now')}</p>
                <ul className="ht-reasons">{verdict.reasons.map(r => <li key={r}>{ht(`fertility.r_${r}`)}</li>)}</ul>
              </>
            ) : (
              <p>{ht(`fertility.m_${verdict.level}`, { m: verdict.months ?? 12 })}</p>
            )}
            <p className="ht-muted">{ht('fertility.tips')}</p>
          </ResultBox>
          <div className="ht-row-end">
            <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={restart}>
              <RotateCcw className="w-4 h-4" aria-hidden="true" />{ht('fertility.restart')}
            </button>
          </div>
        </>
      )}
      <ToolFooter ht={ht} source={ht('fertility.source')} cta={{ href: '/doctors?search=Ginecología' }} />
    </div>
  );
}
