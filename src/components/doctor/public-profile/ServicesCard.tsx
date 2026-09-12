// «Servicios y precios» del perfil público (diseño de Marta, 12-sep-2026).
// Hoy la app tiene UN solo servicio: la consulta / orientación con la tarifa
// `consultation_fee`. Se pinta una fila por servicio que exista — es decir,
// una — y el botón «Reservar» hace exactamente lo mismo que «Solicitar
// consulta» del hero (mismo handler, sin flujo nuevo).
import { Tag, Video, Clock } from 'lucide-react';
import { PriceDisplay } from '@/components/currency/PriceDisplay';
import { useLanguage } from '@/contexts/LanguageContext';
import { fill } from '@/lib/proFormat';

interface ServicesCardProps {
  consultationFee: number;
  /** Minutos del tramo de orientación que usa el flujo de reserva. */
  durationMinutes: number;
  /** El propio médico no ve el botón de reservar. */
  canBook: boolean;
  onBook: () => void;
}

export function ServicesCard({ consultationFee, durationMinutes, canBook, onBook }: ServicesCardProps) {
  const { t } = useLanguage();
  const isFree = consultationFee === 0;

  return (
    <section className="pro-card pro-card-pad bg-card min-w-0" id="pp-servicios" aria-labelledby="pp-servicios-title">
      <div className="pro-card-head">
        <h2 className="pro-card-title" id="pp-servicios-title"><Tag /> {t('mm2.publicProfile.servicesTitle')}</h2>
        <span className="pp-hint">{t('mm2.publicProfile.servicesHint')}</span>
      </div>

      <div className="pp-svc">
        <span className="pro-icon-box"><Video /></span>
        <div className="min-w-0">
          <div className="pp-svc-title">{t('mm2.publicProfile.serviceConsultTitle')}</div>
          <div className="pp-svc-desc">{t('mm2.publicProfile.serviceConsultDesc')}</div>
        </div>
        <div className="pp-svc-foot">
          <span className="pp-svc-dur"><Clock /> {fill(t('mm2.publicProfile.minutes'), { n: durationMinutes })}</span>
          <span className="pp-svc-price">
            {isFree ? <span className="text-success">{t('doctorProfile.free')}</span> : <PriceDisplay amount={consultationFee} size="lg" />}
          </span>
          {canBook && (
            <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={onBook}>
              {t('mm2.publicProfile.book')}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default ServicesCard;
