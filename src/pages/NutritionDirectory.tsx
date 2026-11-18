import MainLayout from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import Doctors from '@/pages/Doctors';
import { Apple, Calculator } from 'lucide-react';
import HealthToolsPanel from '@/components/healthTools/HealthToolsPanel';
import { useHealthToolsText } from '@/lib/healthTools/i18n';

// Directorio de Nutrición (11-sep-2026): atajo de Comunidad > Descubrir > Médicos.
// Mismo motivo que Psicología: la especialidad real en la base es «Nutriología
// Clínica», así que el prefijo «Nutriología» (sin tildes, en cliente) es lo
// que de verdad encuentra médicos — la comparación EXACTA del RPC daba 0.
export default function NutritionDirectory() {
  const { t } = useLanguage();
  const { ht } = useHealthToolsText();
  return (
    <MainLayout>
      <div className="pro-container pro-page">
        <div className="pro-page-head">
          <div className="min-w-0">
            <h1 className="pro-page-title">
              <Apple className="w-7 h-7" />
              <span className="truncate">{t('doctors.nutritionTitle')}</span>
            </h1>
            <p className="pro-page-sub">{t('doctors.nutritionHero')}</p>
          </div>
        </div>
        {/* Calculadoras de nutrición (18-nov-2026, a petición de los médicos tras ver Quirónsalud). */}
        <HealthToolsPanel
          title={ht('panel.nutritionTitle')}
          subtitle={ht('panel.nutritionSub')}
          icon={Calculator}
          tools={['bmi', 'idealWeight', 'calories', 'waist', 'water']}
        />
        <Doctors embedded specialtyPrefix="Nutriología" />
      </div>
    </MainLayout>
  );
}
