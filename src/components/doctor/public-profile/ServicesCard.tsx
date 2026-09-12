// «Servicios y precios» del perfil público (diseño de Marta, 12-sep-2026).
//
// Con catálogo (F1 servicios): una fila por servicio ACTIVO del médico con su
// icono, descripción, duración, precio y «Reservar» → /book/:id?servicio=<id>
// (el handler lo pone la página: mismas reglas de rol que «Solicitar consulta»).
//
// Sin servicios —el médico aún no creó ninguno, o la migración no está
// aplicada— se pinta la fila única de siempre: «Consulta / Orientación» con
// `consultation_fee` y el tramo de reserva de 30 min.
import { Tag, Video, Clock, Monitor, MapPin } from 'lucide-react';
import { PriceDisplay } from '@/components/currency/PriceDisplay';
import { useLanguage } from '@/contexts/LanguageContext';
import { fill } from '@/lib/proFormat';
import { serviceIcon } from '@/components/doctor/services/serviceIcons';
import { summarizeModalities, type DoctorService } from '@/components/doctor/services/serviceModel';
import '@/styles/funciones-servicios.css';

interface ServicesCardProps {
  consultationFee: number;
  /** Minutos del tramo de orientación que usa el flujo de reserva (fila única sin catálogo). */
  durationMinutes: number;
  /** Servicios activos del médico (vacío = fila única de hoy). */
  services?: DoctorService[];
  /** Mientras se leen los servicios no se pinta ni la fila única ni el catálogo. */
  loading?: boolean;
  /** El propio médico no ve el botón de reservar. */
  canBook: boolean;
  onBook: (serviceId?: string) => void;
}

export function ServicesCard({
  consultationFee,
  durationMinutes,
  services = [],
  loading = false,
  canBook,
  onBook,
}: ServicesCardProps) {
  const { t } = useLanguage();
  const hasServices = services.length > 0;
  const summary = summarizeModalities(services);

  const hint = !hasServices
    ? t('mm2.publicProfile.servicesHint')
    : summary === 'both'
      ? t('mm2.servicios.public.hintBoth')
      : summary === 'presencial'
        ? t('mm2.servicios.public.hintPresencial')
        : t('mm2.servicios.public.hintOnline');

  const priceNode = (amount: number, freeClass: string) =>
    amount === 0 ? <span className={freeClass}>{t('doctorProfile.free')}</span> : <PriceDisplay amount={amount} size="lg" />;

  return (
    <section
      className="pro-card pro-card-pad bg-card min-w-0"
      id="pp-servicios"
      aria-labelledby="pp-servicios-title"
      aria-busy={loading || undefined}
    >
      <div className="pro-card-head">
        <h2 className="pro-card-title" id="pp-servicios-title"><Tag /> {t('mm2.publicProfile.servicesTitle')}</h2>
        {!loading && <span className="pp-hint">{hint}</span>}
      </div>

      {loading ? (
        <div className="py-2" aria-hidden="true">
          <span className="fs-skel fs-skel-line" />
          <span className="fs-skel fs-skel-line" />
        </div>
      ) : hasServices ? (
        <div className="fs-svc-wrap">
          <ul className="fs-svc-list">
            {services.map((s) => {
              const Icon = serviceIcon(s.icon);
              return (
                <li key={s.id} className="fs-svc">
                  <span className="pro-icon-box" aria-hidden="true"><Icon /></span>
                  <div className="fs-svc-id">
                    <h3 className="fs-svc-name">{s.name}</h3>
                    {s.description && <p className="fs-svc-desc">{s.description}</p>}
                    {/* Solo cuando el médico mezcla modalidades: la cabecera ya no basta para saber cuál es cuál. */}
                    {summary === 'both' && (
                      <p className="fs-svc-mod">
                        {s.modality === 'presencial' ? <MapPin aria-hidden="true" /> : <Monitor aria-hidden="true" />}
                        {t(`mm2.servicios.modality.${s.modality}`)}
                      </p>
                    )}
                  </div>
                  <div className="fs-svc-foot">
                    <span className="fs-svc-dur">
                      <Clock aria-hidden="true" /> {fill(t('mm2.publicProfile.minutes'), { n: s.duration_minutes })}
                    </span>
                    <span className="fs-svc-price">{priceNode(s.price, 'fs-free')}</span>
                    {canBook && (
                      <button
                        type="button"
                        className="pro-btn pro-btn-teal pro-btn-sm fs-svc-book"
                        onClick={() => onBook(s.id)}
                        aria-label={fill(t('mm2.servicios.public.bookAria'), { service: s.name })}
                      >
                        {t('mm2.publicProfile.book')}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="pp-svc">
          <span className="pro-icon-box"><Video /></span>
          <div className="min-w-0">
            <div className="pp-svc-title">{t('mm2.publicProfile.serviceConsultTitle')}</div>
            <div className="pp-svc-desc">{t('mm2.publicProfile.serviceConsultDesc')}</div>
          </div>
          <div className="pp-svc-foot">
            <span className="pp-svc-dur"><Clock /> {fill(t('mm2.publicProfile.minutes'), { n: durationMinutes })}</span>
            <span className="pp-svc-price">{priceNode(consultationFee, 'text-success')}</span>
            {canBook && (
              <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={() => onBook()}>
                {t('mm2.publicProfile.book')}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default ServicesCard;
