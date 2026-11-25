// Señales de confianza comprobables (24-nov-2026). Sustituyen a las cifras sin
// respaldo (5 000+ médicos, 15M+ pacientes, 98 %, 40 % menos ausentismo, 3x ROI).
// Cada frase describe algo que el código hace de verdad:
//  · cédula → verify-cedula-sep + revisión en /admin/verifications
//  · COFEPRIS → CofeprisCredential (pendiente/aprobado/rechazado por el equipo)
//  · Daily.co → create-daily-room crea salas `privacy: "private"` con token
//  · factura → payout_settings.require_invoice = true (retiros con CFDI)
import { BadgeCheck, FileCheck2, Lock, Receipt } from 'lucide-react';
import { useCoherenceText } from '@/lib/coherence/i18n';

export default function TrustSignals({ withHeading = true }: { withHeading?: boolean }) {
  const ct = useCoherenceText();
  const items = [
    { icon: BadgeCheck, t: ct('trust.cedulaT'), d: ct('trust.cedulaD') },
    { icon: FileCheck2, t: ct('trust.cofeprisT'), d: ct('trust.cofeprisD') },
    { icon: Lock, t: ct('trust.dailyT'), d: ct('trust.dailyD') },
    { icon: Receipt, t: ct('trust.invoiceT'), d: ct('trust.invoiceD') },
  ];
  return (
    <div className="max-w-5xl mx-auto" data-trust-signals>
      {withHeading && (
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">{ct('trust.title')}</h2>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">{ct('trust.subtitle')}</p>
        </div>
      )}
      <ul className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, t, d }) => (
          <li key={t} className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <Icon className="w-6 h-6 text-primary mb-2" aria-hidden="true" />
            <h3 className="text-sm sm:text-base font-bold text-foreground">{t}</h3>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">{d}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
