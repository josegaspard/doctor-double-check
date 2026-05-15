import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Package, ArrowRight, ShoppingBag, Loader2, PartyPopper } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function OrderSuccess() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const es = language === 'es';
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fire confetti
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { y: 0.5, x: 0.7 } }), 400);
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchLatestOrder = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('marketplace_orders')
        .select('*, marketplace_products(name, image_url, currency)')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      setOrder(data);
      setLoading(false);
    };
    fetchLatestOrder();
  }, [user]);

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-500 shadow-lg shadow-primary/30">
            <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {es ? '¡Compra Exitosa!' : 'Purchase Successful!'}
          </h1>
          <p className="text-muted-foreground animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
            {es ? 'Tu pedido ha sido procesado correctamente' : 'Your order has been processed successfully'}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : order ? (
          <Card className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
                <PartyPopper className="w-4 h-4 text-warning" />
                <span>{es ? 'Resumen del pedido' : 'Order summary'}</span>
              </div>
              <div className="flex items-start gap-4">
                {order.marketplace_products?.image_url ? (
                  <img src={order.marketplace_products.image_url} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <Package className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{order.marketplace_products?.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {es ? 'Cantidad' : 'Quantity'}: {order.quantity}
                  </p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <p className="text-lg font-bold text-primary">${Number(order.total_amount).toLocaleString()}</p>
                    <span className="text-xs text-muted-foreground">{order.marketplace_products?.currency || 'MXN'}</span>
                  </div>
                  {order.delivery_fee > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      + ${Number(order.delivery_fee).toLocaleString()} {es ? 'envío' : 'shipping'}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <Badge className="bg-primary text-primary-foreground border-primary border text-xs">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {es ? 'Pagado' : 'Paid'}
                </Badge>
                {order.shipping_city && (
                  <p className="text-xs text-muted-foreground mt-2">
                    📍 {es ? 'Envío a' : 'Shipping to'}: {order.shipping_city}{order.shipping_state ? `, ${order.shipping_state}` : ''}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
          <Button onClick={() => navigate('/my-orders')} className="w-full gap-2" size="lg">
            <ShoppingBag className="w-4 h-4" />
            {es ? 'Ver mis pedidos' : 'View my orders'}
          </Button>
          <Button onClick={() => navigate('/medical-supplies')} variant="outline" className="w-full gap-2" size="lg">
            <ArrowRight className="w-4 h-4" />
            {es ? 'Seguir comprando' : 'Continue shopping'}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          {es
            ? 'Recibirás un correo con la confirmación de tu compra y actualizaciones del envío.'
            : 'You will receive an email with your purchase confirmation and shipping updates.'}
        </p>
      </div>
    </MainLayout>
  );
}
