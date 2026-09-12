// «Suscripciones» del perfil público (diseño de Marta, 12-sep-2026).
// Una fila por nivel que YA existe (Básico / Premium) con el precio del mismo
// hook que usa SubscribeButton (useSubscriptionPricing) y las ventajas que la
// app ya enumera en su modal de mejora. El botón es el SubscribeButton de
// siempre (seguir gratis → mejorar a Básico/Premium); para el propio médico
// el componente no pinta nada, como hoy.
import { CreditCard, Heart, Crown, Check } from 'lucide-react';
import { SubscribeButton } from '@/components/subscriptions/SubscribeButton';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscriptionPricing } from '@/hooks/useSubscriptionPricing';
import { money2 } from '@/lib/proFormat';

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

  const tiers = [
    {
      id: 'basic',
      name: t('subscriptions.basicTierName'),
      price: pricing.basic_cents / 100,
      Icon: Heart,
      perks: [t('subscriptions.exclusiveContent'), t('subscriptions.priorityNotifications'), t('subscriptions.subscriberBadge')],
    },
    {
      id: 'premium',
      name: t('subscriptions.premiumTierName'),
      price: pricing.premium_cents / 100,
      Icon: Crown,
      perks: [t('subscriptions.allBasicFeatures'), t('subscriptions.recordingDiscount'), t('subscriptions.priorityChat')],
    },
  ];

  return (
    <section className="pro-card pro-card-pad bg-card min-w-0" id="pp-suscripciones" aria-labelledby="pp-suscripciones-title">
      <div className="pro-card-head">
        <h2 className="pro-card-title" id="pp-suscripciones-title"><CreditCard /> {t('mm2.publicProfile.subsTitle')}</h2>
        <span className="pp-hint">{t('mm2.publicProfile.subsCancelAnytime')}</span>
      </div>

      {tiers.map(tier => (
        <div key={tier.id} className="pp-tier">
          <span className="pro-icon-box"><tier.Icon /></span>
          <div className="min-w-0 flex-1">
            <div className="pp-tier-name">{tier.name}</div>
            <div className="pp-tier-price">{money2(tier.price, language)} <small>{t('mm2.publicProfile.perMonth')}</small></div>
            <ul>
              {tier.perks.map(p => <li key={p}><Check /> <span>{p}</span></li>)}
            </ul>
          </div>
        </div>
      ))}

      {!isOwner && (
        <div className="pp-subs-cta">
          <SubscribeButton
            key={`pp-subs-${refreshKey}`}
            doctorId={doctorId}
            doctorName={doctorName}
            className="w-full"
            onSubscriptionChange={onSubscriptionChange}
          />
        </div>
      )}
    </section>
  );
}

export default SubscriptionsCard;
