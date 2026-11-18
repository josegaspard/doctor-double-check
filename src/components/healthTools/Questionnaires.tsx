// Cuestionarios validados: PHQ-9 (ánimo), GAD-7 (ansiedad) y EPDS (Edimburgo,
// ánimo en el embarazo y el posparto). Nada se guarda ni se envía: el estado
// vive en el componente y se pierde al salir.
//
// Seguridad: si la pregunta de autolesión (PHQ-9 n.º 9, EPDS n.º 10) tiene
// cualquier respuesta distinta de «nunca», se enseña ARRIBA la caja de crisis
// con la Línea de la Vida y el acceso a médicos disponibles ahora, aunque no
// estén contestadas las demás.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LifeBuoy, ListChecks, Phone } from 'lucide-react';
import { useNarrow } from './useNarrow';
import { allAnswered, epdsLevel, gad7Severity, phq9Severity, sum } from '@/lib/healthTools/calc';
import type { HT } from '@/lib/healthTools/i18n';
import { ResultBox, ToolFooter, ToolHead, type Tone } from './parts';

export const MIND_HREF = '/psicologia';

function CrisisBox({ ht }: { ht: HT }) {
  return (
    <div className="ht-crisis" role="alert">
      <LifeBuoy className="w-6 h-6" aria-hidden="true" />
      <div>
        <p className="ht-crisis-title">{ht('quiz.crisisTitle')}</p>
        <p>{ht('quiz.crisisText')}</p>
        <div className="ht-crisis-actions">
          <a href="tel:8009112000" className="pro-btn pro-btn-live"><Phone className="w-4 h-4" aria-hidden="true" />800 911 2000</a>
          <Link to="/emergency" className="pro-btn pro-btn-outline">{ht('quiz.crisisCta')}</Link>
        </div>
      </div>
    </div>
  );
}

interface Item { q: string; options: { label: string; score: number }[] }

function Quiz({
  ht, title, intro, period, items, crisisIndex, max, result, source, cta,
}: {
  ht: HT; title: string; intro: string; period: string; items: Item[]; crisisIndex: number; max: number;
  result: (score: number) => { tone: Tone; label: string; msg: string }; source: string; cta: string;
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => items.map(() => null));
  // Celular: una pregunta por pantalla con avance automático; computadora: la lista entera.
  const narrow = useNarrow();
  const [step, setStep] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const done = allAnswered(answers);
  const score = sum(answers);
  const crisis = (answers[crisisIndex] ?? 0) > 0;
  const r = done ? result(score) : null;
  const answered = answers.filter(a => a !== null).length;
  const stepMode = narrow && !showAll && !done;
  const answer = (i: number, v: number) => {
    setAnswers(a => a.map((x, k) => (k === i ? v : x)));
    if (stepMode) window.setTimeout(() => setStep(st => Math.min(items.length - 1, Math.max(st, i + 1))), 160);
  };
  const reset = () => { setAnswers(items.map(() => null)); setStep(0); setShowAll(false); };
  // Al terminar en el celular, el resultado se trae a la vista.
  useEffect(() => {
    if (done && narrow) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [done, narrow]);

  const renderItem = (it: Item, i: number, cls = '') => (
    <li key={i} className={`${answers[i] !== null ? 'is-answered' : ''} ${cls}`}>
      <p className="ht-q"><span className="ht-qn">{i + 1}</span>{it.q}</p>
      <div className={`ht-opts${stepMode ? ' ht-opts-col' : ''}`} role="radiogroup" aria-label={it.q}>
        {it.options.map((o, j) => (
          <button
            key={j}
            type="button"
            role="radio"
            aria-checked={answers[i] === o.score}
            className={answers[i] === o.score ? 'is-active' : ''}
            onClick={() => answer(i, o.score)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </li>
  );

  return (
    <div className="ht-tool">
      <ToolHead title={title} intro={intro} />
      {crisis && <CrisisBox ht={ht} />}
      <p className="ht-period">{period}</p>
      {stepMode ? (
        <div className="ht-stepper">
          <div className="ht-stepper-top">
            <span className="ht-stepper-count">{ht('fertility.stepOf', { n: step + 1, total: items.length })}</span>
            <div className="ht-stepper-bar" aria-hidden="true"><span style={{ width: `${(answered / items.length) * 100}%` }} /></div>
          </div>
          <ol className="ht-quiz ht-quiz-step" start={step + 1}>{renderItem(items[step], step)}</ol>
          <div className="ht-step-nav">
            {step > 0 && (
              <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={() => setStep(st => st - 1)}>
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />{ht('fertility.back')}
              </button>
            )}
            <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={() => setShowAll(true)}>
              <ListChecks className="w-4 h-4" aria-hidden="true" />{ht('quiz.review')}
            </button>
          </div>
        </div>
      ) : (!narrow || showAll) ? (
        <ol className="ht-quiz">{items.map((it, i) => renderItem(it, i))}</ol>
      ) : null}
      <div ref={resultRef} />
      {r ? (
        <ResultBox tone={r.tone} textValue kicker={ht('quiz.score', { s: score, max })} value={r.label}>
          <p>{r.msg}</p>
          <p className="ht-muted">{ht('quiz.notDiagnosis')}</p>
        </ResultBox>
      ) : (
        !stepMode && <div className="ht-empty">{ht('common.answerAll', { n: answered, total: items.length })}</div>
      )}
      <div className="ht-row-end">
        {narrow && done && !showAll && (
          <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={() => setShowAll(true)}>
            <ListChecks className="w-4 h-4" aria-hidden="true" />{ht('quiz.review')}
          </button>
        )}
        <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={reset}>{ht('common.reset')}</button>
      </div>
      <p className="ht-help">{ht('panel.privacy')}</p>
      <ToolFooter ht={ht} source={source} cta={{ href: cta }} />
    </div>
  );
}

const FREQ = (ht: HT) => [0, 1, 2, 3].map(s => ({ label: ht(`quiz.opt${s}`), score: s }));
const sevTone = (s: string): Tone => (s === 'minimal' ? 'ok' : s === 'mild' ? 'warn' : 'alert');

export function Phq9Tool({ ht }: { ht: HT }) {
  const items = Array.from({ length: 9 }, (_, i) => ({ q: ht(`phq9.q${i + 1}`), options: FREQ(ht) }));
  return (
    <Quiz
      ht={ht}
      title={ht('phq9.title')}
      intro={ht('phq9.intro')}
      period={ht('quiz.period2w')}
      items={items}
      crisisIndex={8}
      max={27}
      result={s => { const v = phq9Severity(s); return { tone: sevTone(v), label: ht(`quiz.sev_${v}`), msg: ht(`quiz.msg_${v}`) }; }}
      source={ht('phq9.source')}
      cta={MIND_HREF}
    />
  );
}

export function Gad7Tool({ ht }: { ht: HT }) {
  const items = Array.from({ length: 7 }, (_, i) => ({ q: ht(`gad7.q${i + 1}`), options: FREQ(ht) }));
  return (
    <Quiz
      ht={ht}
      title={ht('gad7.title')}
      intro={ht('gad7.intro')}
      period={ht('quiz.period2w')}
      items={items}
      crisisIndex={-1}
      max={21}
      result={s => { const v = gad7Severity(s); return { tone: sevTone(v), label: ht(`quiz.sev_${v}`), msg: ht(`quiz.msg_${v}`) }; }}
      source={ht('gad7.source')}
      cta={MIND_HREF}
    />
  );
}

// EPDS: las preguntas 1, 2 y 4 puntúan 0-1-2-3 en el orden en que se leen las
// respuestas; las demás, 3-2-1-0 (Cox 1987).
const EPDS_ASC = new Set([1, 2, 4]);
export function EpdsTool({ ht }: { ht: HT }) {
  const items = Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    const scores = EPDS_ASC.has(n) ? [0, 1, 2, 3] : [3, 2, 1, 0];
    return { q: ht(`epds.q${n}`), options: ['a', 'b', 'c', 'd'].map((l, j) => ({ label: ht(`epds.q${n}${l}`), score: scores[j] })) };
  });
  return (
    <Quiz
      ht={ht}
      title={ht('epds.title')}
      intro={ht('epds.intro')}
      period={ht('quiz.period7d')}
      items={items}
      crisisIndex={9}
      max={30}
      result={s => { const v = epdsLevel(s); return { tone: v === 'low' ? 'ok' : v === 'possible' ? 'warn' : 'alert', label: ht(`epds.lvl_${v}`), msg: ht(`epds.msg_${v}`) }; }}
      source={ht('epds.source')}
      cta="/doctors?search=Ginecología"
    />
  );
}
