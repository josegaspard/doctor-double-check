import MainLayout from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import Doctors from '@/pages/Doctors';
import { Plus } from 'lucide-react';

// Atención inmediata (11-sep-2026): atajo de Comunidad > Descubrir > Médicos
// con «disponibles ahora» ya puesto (`onlyAvailableNow`) y sin la franja de
// urgencias que lleva a esta misma página (`hideEmergencyBanner`, evita el
// bucle). El directorio compartido (Doctors) refresca solo cada 60 s y por
// tiempo real cuando un médico cambia su horario (doctor_profiles): el botón
// «Actualizar» de la versión anterior ya no hace falta.
export default function EmergencyDoctors() {
  const { t } = useLanguage();
  return (
    <MainLayout>
      <div className="pro-container pro-page">
        <div className="pro-page-head">
          <div className="min-w-0">
            <h1 className="pro-page-title">
              <Plus className="w-7 h-7" strokeWidth={3} />
              <span className="truncate">{t('emergency.title')}</span>
            </h1>
            <p className="pro-page-sub">{t('emergency.description')}</p>
          </div>
        </div>
        <Doctors embedded onlyAvailableNow hideEmergencyBanner />
      </div>
    </MainLayout>
  );
}
