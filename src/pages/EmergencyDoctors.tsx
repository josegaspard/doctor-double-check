import MainLayout from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import Doctors from '@/pages/Doctors';
import { Plus, Phone, HeartHandshake } from 'lucide-react';
import { useCoherenceText } from '@/lib/coherence/i18n';

// Atención inmediata (11-sep-2026): atajo de Comunidad > Descubrir > Médicos
// con «disponibles ahora» ya puesto (`onlyAvailableNow`) y sin la franja de
// urgencias que lleva a esta misma página (`hideEmergencyBanner`, evita el
// bucle). El directorio compartido (Doctors) refresca solo cada 60 s y por
// tiempo real cuando un médico cambia su horario (doctor_profiles): el botón
// «Actualizar» de la versión anterior ya no hace falta.
export default function EmergencyDoctors() {
  const { t } = useLanguage();
  const ct = useCoherenceText();
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
        {/* Bloque de seguridad fijo (24-nov-2026): una videoconsulta no sustituye a
            urgencias. Siempre visible, haya o no médicos disponibles. */}
        <section className="em-safety pro-card bg-card mb-4" role="note" aria-label={ct('em.safetyTitle')}>
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5 p-4 sm:p-5 rounded-[inherit] border-2 border-red-600/70">
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-red-700">{ct('em.safetyTitle')}</h2>
              <p className="mt-1 text-sm text-foreground">{ct('em.safetyBody')}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 md:flex-shrink-0">
              <a href="tel:911" className="pro-btn em-call-911 inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700" style={{ color: '#fff' }}>
                <Phone className="w-4 h-4" aria-hidden="true" /> {ct('em.call911')}
              </a>
              <a href="tel:8009112000" className="pro-btn pro-btn-outline inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-lg font-semibold">
                <HeartHandshake className="w-4 h-4" aria-hidden="true" /> {ct('em.lineaVida')}
              </a>
            </div>
          </div>
          <p className="px-4 sm:px-5 pb-3 -mt-1 text-xs text-muted-foreground">{ct('em.lineaVidaD')}</p>
        </section>
        <Doctors embedded onlyAvailableNow hideEmergencyBanner />
      </div>
    </MainLayout>
  );
}
