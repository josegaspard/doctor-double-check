// /salud-mujer — Salud de la mujer (18-nov-2026): calculadoras por etapa (como
// los «momentos» de Quirónsalud: Buscar embarazo · Embarazo · Después del parto)
// encima del directorio de Ginecología y Obstetricia. Mismo patrón que
// Nutrición y Psicología: el directorio compartido con prefijo de especialidad.
import { HeartPulse, Calculator, Sprout, Baby, HeartHandshake } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Doctors from '@/pages/Doctors';
import HealthToolsPanel, { type ToolGroup } from '@/components/healthTools/HealthToolsPanel';
import { useHealthToolsText } from '@/lib/healthTools/i18n';

const WOMEN_GROUPS: ToolGroup[] = [
  { id: 'fertilidad', labelKey: 'stages.fertility', icon: Sprout, tools: ['fertilityCheck', 'ovulation'] },
  { id: 'embarazo', labelKey: 'stages.pregnancy', icon: Baby, tools: ['dueDate', 'pregnancyWeight'] },
  { id: 'posparto', labelKey: 'stages.postpartum', icon: HeartHandshake, tools: ['epds'] },
];

export default function WomenHealthDirectory() {
  const { ht } = useHealthToolsText();
  return (
    <MainLayout>
      <div className="pro-container pro-page">
        <div className="pro-page-head">
          <div className="min-w-0">
            <h1 className="pro-page-title">
              <HeartPulse className="w-7 h-7" />
              <span className="truncate">{ht('women.title')}</span>
            </h1>
            <p className="pro-page-sub">{ht('women.hero')}</p>
          </div>
        </div>
        <HealthToolsPanel title={ht('panel.womenTitle')} subtitle={ht('panel.womenSub')} icon={Calculator} groups={WOMEN_GROUPS} />
        <Doctors embedded specialtyPrefix="Ginecología" />
      </div>
    </MainLayout>
  );
}
