import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { checkPurchaseReturn } from '@/lib/analytics';

// Al volver de Stripe con la marca de éxito en la URL, manda `purchase` a GA4
// (una sola vez por pago). Ver lib/analytics.ts.
export function AnalyticsRouteListener() {
  const { pathname, search } = useLocation();
  useEffect(() => { checkPurchaseReturn(pathname, search); }, [pathname, search]);
  return null;
}
