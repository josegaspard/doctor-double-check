import MainLayout from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import Doctors from '@/pages/Doctors';
import { Brain } from 'lucide-react';

// Directorio de Psicología (11-sep-2026): atajo de Comunidad > Descubrir > Médicos.
// Antes traía su PROPIA lista y comparaba la especialidad EXACTA contra el RPC
// (0 resultados en producción, porque en la base hay variantes como «Psicología
// Clínica»), con colores bg-secondary/* prohibidos por la guía de diseño y su
// propia copia de isDoctorAvailableNow. Ahora reutiliza el mismo directorio
// (Doctors) con specialtyPrefix, que compara por PREFIJO sin tildes en el
// cliente — así entran todas las variantes de «Psicología…». Mismo buscador,
// filtros, «disponibles ahora» y ficha de perfil que en /doctors: nada se
// pierde, se gana el filtro que antes fallaba.
export default function PsychologyDirectory() {
  const { t } = useLanguage();
  return (
    <MainLayout>
      <div className="pro-container pro-page">
        <div className="pro-page-head">
          <div className="min-w-0">
            <h1 className="pro-page-title">
              <Brain className="w-7 h-7" />
              <span className="truncate">{t('doctors.psychologyTitle')}</span>
            </h1>
            <p className="pro-page-sub">{t('doctors.psychologyHero')}</p>
          </div>
        </div>
        <Doctors embedded specialtyPrefix="Psicología" />
      </div>
    </MainLayout>
  );
}
