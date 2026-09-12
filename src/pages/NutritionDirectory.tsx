import MainLayout from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import Doctors from '@/pages/Doctors';
import { Apple } from 'lucide-react';

// Directorio de Nutrición (11-sep-2026): atajo de Comunidad > Descubrir > Médicos.
// Mismo motivo que Psicología: la especialidad real en la base es «Nutriología
// Clínica», así que el prefijo «Nutriología» (sin tildes, en cliente) es lo
// que de verdad encuentra médicos — la comparación EXACTA del RPC daba 0.
export default function NutritionDirectory() {
  const { t } = useLanguage();
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
        <Doctors embedded specialtyPrefix="Nutriología" />
      </div>
    </MainLayout>
  );
}
