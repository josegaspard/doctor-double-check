// Tarjeta con pestañas de herramientas de salud (18-nov-2026).
//
// Se pone encima del directorio en cada sección (Nutrición, Psicología, Salud de
// la mujer) y en /herramientas. Con `groups` añade una fila de «etapas» encima
// de las pestañas, como los «momentos» de Quirónsalud (Buscar embarazo ·
// Embarazo · Después del parto).
//
// La pestaña abierta va en la URL (?h=imc) para poder enlazarla, y respeta los
// demás parámetros de la página (el directorio usa ?search y ?specialty).
import { useMemo, useState, type ComponentType } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { useHealthToolsText, type HT } from '@/lib/healthTools/i18n';
import {
  BmiTool, CaloriesTool, IdealWeightTool, WaistTool, WaterTool, initialBody, type BodyState,
} from './NutritionTools';
import { DueDateTool, OvulationTool, PregnancyWeightTool, initialCycle, type CycleState } from './WomenTools';
import { EpdsTool, Gad7Tool, Phq9Tool } from './Questionnaires';
import { SymptomGuideTool } from './SymptomGuide';
import { FertilityCheckTool } from './FertilityCheck';
import '@/styles/herramientas.css';

export type ToolId =
  | 'bmi' | 'idealWeight' | 'calories' | 'waist' | 'water'
  | 'fertilityCheck' | 'ovulation' | 'dueDate' | 'pregnancyWeight'
  | 'phq9' | 'gad7' | 'epds' | 'guide';

// Alias cortos y en castellano para la URL (?h=imc).
export const TOOL_SLUG: Record<ToolId, string> = {
  bmi: 'imc', idealWeight: 'peso-saludable', calories: 'calorias', waist: 'cintura', water: 'agua',
  fertilityCheck: 'test-fertilidad', ovulation: 'dias-fertiles', dueDate: 'fecha-de-parto', pregnancyWeight: 'peso-embarazo',
  phq9: 'animo', gad7: 'ansiedad', epds: 'animo-posparto', guide: 'orientador',
};
const SLUG_TOOL = Object.fromEntries(Object.entries(TOOL_SLUG).map(([k, v]) => [v, k])) as Record<string, ToolId>;

export interface ToolGroup { id: string; labelKey: string; tools: ToolId[] }

interface Props {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  tools?: ToolId[];
  groups?: ToolGroup[];
  /** Nombre del parámetro de la URL (por si una página tiene dos paneles). */
  param?: string;
  className?: string;
}

interface Shared {
  ht: HT; locale: string;
  body: BodyState; setBody: (b: BodyState) => void;
  cycleState: CycleState; setCycleState: (c: CycleState) => void;
}

const RENDER: Record<ToolId, ComponentType<Shared>> = {
  bmi: BmiTool,
  idealWeight: IdealWeightTool,
  calories: CaloriesTool,
  waist: WaistTool,
  water: WaterTool,
  fertilityCheck: ({ ht }) => <FertilityCheckTool ht={ht} />,
  ovulation: OvulationTool,
  dueDate: DueDateTool,
  pregnancyWeight: PregnancyWeightTool,
  phq9: ({ ht }) => <Phq9Tool ht={ht} />,
  gad7: ({ ht }) => <Gad7Tool ht={ht} />,
  epds: ({ ht }) => <EpdsTool ht={ht} />,
  guide: ({ ht }) => <SymptomGuideTool ht={ht} />,
};

export default function HealthToolsPanel({ title, subtitle, icon: Icon, tools, groups, param = 'h', className = '' }: Props) {
  const { ht, locale } = useHealthToolsText();
  const [params, setParams] = useSearchParams();
  const all = useMemo(() => groups ? groups.flatMap(g => g.tools) : (tools ?? []), [groups, tools]);
  const fromUrl = SLUG_TOOL[params.get(param) ?? ''];
  const active: ToolId = fromUrl && all.includes(fromUrl) ? fromUrl : all[0];
  const activeGroup = groups?.find(g => g.tools.includes(active));
  const visible = activeGroup ? activeGroup.tools : all;

  const [body, setBody] = useState<BodyState>(initialBody);
  const [cycleState, setCycleState] = useState<CycleState>(initialCycle);

  const open = (id: ToolId) => {
    const next = new URLSearchParams(params);
    next.set(param, TOOL_SLUG[id]);
    setParams(next, { replace: true, preventScrollReset: true });
  };

  const Tool = RENDER[active];
  return (
    <section className={`pro-card bg-card ht-panel ${className}`} aria-label={title}>
      <div className="ht-panel-head">
        {Icon && <span className="pro-icon-box ht-panel-icon"><Icon className="w-5 h-5" aria-hidden="true" /></span>}
        <div className="min-w-0">
          <h2 className="ht-panel-title">{title}</h2>
          {subtitle && <p className="ht-panel-sub">{subtitle}</p>}
        </div>
      </div>

      {groups && (
        <div className="ht-stages" role="tablist" aria-label={title}>
          {groups.map(g => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={activeGroup?.id === g.id}
              className={activeGroup?.id === g.id ? 'is-active' : ''}
              onClick={() => open(g.tools[0])}
            >
              {ht(g.labelKey)}
            </button>
          ))}
        </div>
      )}

      {visible.length > 1 && (
        <div className="ht-tabs" role="tablist" aria-label={title}>
          {visible.map(id => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`ht-tab-${id}`}
              aria-selected={active === id}
              aria-controls="ht-tabpanel"
              className={active === id ? 'is-active' : ''}
              onClick={() => open(id)}
            >
              {ht(`tabs.${id}`)}
            </button>
          ))}
        </div>
      )}

      <div id="ht-tabpanel" role="tabpanel" aria-labelledby={`ht-tab-${active}`} className="ht-tabpanel">
        <Tool ht={ht} locale={locale} body={body} setBody={setBody} cycleState={cycleState} setCycleState={setCycleState} />
      </div>
    </section>
  );
}
