// /herramientas — todas las herramientas de salud en una página (18-nov-2026).
// Cada grupo vive además en su sección: Nutrición (/nutricion), Salud de la
// mujer (/salud-mujer) y Psicología (/psicologia). Aquí van juntas con una fila
// de grupos encima de las pestañas.
import { Link } from 'react-router-dom';
import { Apple, ArrowRight, Brain, Calculator, Compass, HeartPulse, Stethoscope } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import HealthToolsPanel, { type ToolGroup } from '@/components/healthTools/HealthToolsPanel';
import { useHealthToolsText } from '@/lib/healthTools/i18n';
import { useAuth } from '@/contexts/AuthContext';

export const ALL_TOOL_GROUPS: ToolGroup[] = [
  { id: 'nutricion', labelKey: 'hub.groupNutrition', tools: ['bmi', 'idealWeight', 'calories', 'waist', 'water'] },
  { id: 'mujer', labelKey: 'hub.groupWomen', tools: ['fertilityCheck', 'ovulation', 'dueDate', 'pregnancyWeight', 'epds'] },
  { id: 'mente', labelKey: 'hub.groupMind', tools: ['phq9', 'gad7'] },
  { id: 'orientador', labelKey: 'hub.groupGuide', tools: ['guide'] },
];

export default function HealthTools() {
  const { ht } = useHealthToolsText();
  const { role } = useAuth();
  const sections = [
    { href: '/nutricion', icon: Apple, title: ht('hub.groupNutrition'), text: ht('hub.groupNutritionSub'), go: ht('hub.sectionNutrition') },
    { href: '/salud-mujer', icon: HeartPulse, title: ht('hub.groupWomen'), text: ht('hub.groupWomenSub'), go: ht('hub.sectionWomen') },
    { href: '/psicologia', icon: Brain, title: ht('hub.groupMind'), text: ht('hub.groupMindSub'), go: ht('hub.sectionMind') },
    { href: '/herramientas?h=orientador', icon: Compass, title: ht('hub.groupGuide'), text: ht('hub.groupGuideSub'), go: ht('hub.open') },
  ];
  return (
    <MainLayout>
      <div className="pro-container pro-page">
        <div className="pro-page-head">
          <div className="min-w-0">
            <h1 className="pro-page-title">
              <Calculator className="w-7 h-7" />
              <span className="truncate">{ht('hub.title')}</span>
            </h1>
            <p className="pro-page-sub">{ht('hub.subtitle')}</p>
          </div>
        </div>

        <HealthToolsPanel title={ht('hub.title')} subtitle={ht('panel.privacy')} icon={Calculator} groups={ALL_TOOL_GROUPS} />

        <div className="ht-hub-grid">
          {sections.map(s => (
            <Link key={s.href} to={s.href} className="pro-card ht-hub-card">
              <span className="pro-icon-box"><s.icon className="w-5 h-5" aria-hidden="true" /></span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              <span className="ht-hub-go">{s.go}<ArrowRight className="w-4 h-4" aria-hidden="true" /></span>
            </Link>
          ))}
        </div>

        {(role === 'doctor' || role === 'resident' || role === 'admin') && (
          <div className="pro-card pro-card-pad ht-hub-card">
            <span className="pro-icon-box"><Stethoscope className="w-5 h-5" aria-hidden="true" /></span>
            <h3>{ht('hub.forDoctorsTitle')}</h3>
            <p>{ht('hub.forDoctorsText')}</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
