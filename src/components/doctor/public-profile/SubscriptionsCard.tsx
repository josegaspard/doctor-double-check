// «Suscripciones» del perfil público (diseño de Marta, 12-sep-2026; planes con
// nombre propio F2, 13-sep-2026).
//
// Una fila por nivel (Básico / Premium). Si el médico personalizó ese nivel se
// pinta SU plan (nombre, precio y ventajas, useDoctorSubscriptionPlans); si no,
// el global de hoy (useSubscriptionPricing + las ventajas que la app ya
// enumeraba). Cada plan lleva su «Suscribirme», que abre directamente el
// resumen de pago de ESE nivel (SubscribeButton en modo planTier), como en la
// maqueta. Seguir gratis, los avisos y cancelar siguen en el botón «Seguir» de
// la cabecera del perfil. Para el propio médico no hay botones de compra: un
// enlace a su editor de planes.
import { Link } from 'react-router-dom';
import { CreditCard, Heart, Users, Check, Pencil } from 'lucide-react';
import { SubscribeButton } from '@/components/subscriptions/SubscribeButton';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscriptionPricing } from '@/hooks/useSubscriptionPricing';
import { PLAN_TIERS, resolveTierPlan, useDoctorSubscriptionPlans } from '@/hooks/useDoctorSubscriptionPlans';
import { doctorHref } from '@/lib/doctorSections';
import { money2 } from '@/lib/proFormat';
import '@/styles/funciones-planes.css';

interface SubscriptionsCardProps {
  doctorId: string;
  doctorName: string;
  isOwner: boolean;
  /** Cambia cuando el seguimiento se toca desde otro botón de la página, para refrescar este. */
  refreshKey: number;
  onSubscriptionChange: () => void | Promise<void>;
}

export function SubscriptionsCard({ doctorId, doctorName, isOwner, refreshKey, onSubscriptionChange }: SubscriptionsCardProps) {
  const { t, language } = useLanguage();
  const { pricing } = useSubscriptionPricing();
  const { plans } = useDoctorSubscriptionPlans(doctorId);

  const tiers = PLAN_TIERS.map(tier => ({
    ...resolveTierPlan(tier, plans, pricing, t),
    Icon: tier === 'basic' ? Heart : Users,
  }));
  const hasCustom = tiers.some(p => p.isCustom);

  return (
    <section className="pro-card pro-card-pad bg-card min-w-0 pp-subs" id="pp-suscripciones" aria-labelledby="pp-suscripciones-title">
      <div className="pro-card-head">
        <h2 className="pro-card-title" id="pp-suscripciones-title"><CreditCard /> {t('mm2.publicProfile.subsTitle')}</h2>
        <span className="pp-hint">{t('mm2.publicProfile.subsCancelAnytime')}</span>
      </div>

      {tiers.map(plan => (
        <div key={plan.tier} className="pp-tier pp-plan">
          <span className="pro-icon-box"><plan.Icon /></span>
          <div className="pp-plan-body">
            <div className="pp-tier-name">{plan.name}</div>
            <div className="pp-tier-price">{money2(plan.priceCents / 100, language)} <small>{t('mm2.publicProfile.perMonth')}</small></div>
            {plan.perks.length > 0 && (
              <ul>
                {plan.perks.map((p, i) => <li key={`${i}-${p}`}><Check /> <span>{p}</span></li>)}
              </ul>
            )}
          </div>
          {!isOwner && (
            <div className="pp-plan-cta">
              <SubscribeButton
                key={`pp-plan-${plan.tier}-${refreshKey}`}
                doctorId={doctorId}
                doctorName={doctorName}
                planTier={plan.tier}
                onSubscriptionChange={onSubscriptionChange}
              />
            </div>
          )}
        </div>
      ))}

      {isOwner && (
        <p className="pp-plan-owner">
          {!hasCustom && <span>{t('mm2.planes.card.ownerStandard')}</span>}
          <Link to={doctorHref('cuenta', { tab: 'perfil', b: 'contenido' })}>
            <Pencil /> {t('mm2.planes.card.ownerEdit')}
          </Link>
        </p>
      )}
    </section>
  );
}

export default SubscriptionsCard;
