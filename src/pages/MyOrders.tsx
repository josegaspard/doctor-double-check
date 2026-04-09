// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Loader2, Truck, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp, MapPin, Phone, Copy } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  pending: { label_es: 'Pendiente', label_en: 'Pending', icon: Clock, color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  paid: { label_es: 'Pagado', label_en: 'Paid', icon: CheckCircle2, color: 'bg-blue-100 text-blue-800 border-blue-200' },
  shipped: { label_es: 'Enviado', label_en: 'Shipped', icon: Truck, color: 'bg-purple-100 text-purple-800 border-purple-200' },
  delivered: { label_es: 'Entregado', label_en: 'Delivered', icon: CheckCircle2, color: 'bg-green-100 text-green-800 border-green-200' },
  cancelled: { label_es: 'Cancelado', label_en: 'Cancelled', icon: XCircle, color: 'bg-red-100 text-red-800 border-red-200' },
};

const TIMELINE_STEPS = ['pending', 'paid', 'shipped', 'delivered'];

export default function MyOrders() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const es = language === 'es';
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchOrders = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('marketplace_orders')
        .select('*, marketplace_products(name, image_url, currency)')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });
      setOrders((data as any[]) || []);
      setLoading(false);
    };
    fetchOrders();
  }, [user]);

  const getStatusIdx = (status: string) => TIMELINE_STEPS.indexOf(status);

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-3xl">
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent p-5 sm:p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{es ? 'Mis Compras' : 'My Orders'}</h1>
              <p className="text-sm text-muted-foreground">{es ? 'Historial y seguimiento de pedidos' : 'Order history & tracking'}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">{es ? 'No tienes compras aún' : 'No orders yet'}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.href = '/medical-supplies'}>
              {es ? 'Ir al Marketplace' : 'Go to Marketplace'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(o => {
              const sc = STATUS_CONFIG[o.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
              const Icon = sc.icon;
              const expanded = expandedId === o.id;
              const currentStep = getStatusIdx(o.status);
              const product = o.marketplace_products;

              return (
                <Card key={o.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {product?.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <Package className="w-6 h-6 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{product?.name || es ? 'Producto' : 'Product'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {es ? 'Cant' : 'Qty'}: {o.quantity} · ${Number(o.total_amount).toLocaleString()} {product?.currency || 'MXN'}
                          {o.delivery_fee > 0 && ` + $${Number(o.delivery_fee).toLocaleString()} envío`}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(o.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge className={`text-[10px] ${sc.color} border`}>
                          <Icon className="w-3 h-3 mr-1" />
                          {es ? sc.label_es : sc.label_en}
                        </Badge>
                        <button onClick={() => setExpandedId(expanded ? null : o.id)} className="p-1 rounded hover:bg-muted transition-colors">
                          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-4 pt-4 border-t space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* Timeline */}
                        {o.status !== 'cancelled' && (
                          <div className="flex items-center gap-0">
                            {TIMELINE_STEPS.map((step, i) => {
                              const stepSc = STATUS_CONFIG[step as keyof typeof STATUS_CONFIG];
                              const StepIcon = stepSc.icon;
                              const done = i <= currentStep;
                              return (
                                <React.Fragment key={step}>
                                  <div className={`flex flex-col items-center gap-1 ${i === 0 ? '' : 'flex-1'}`}>
                                    {i > 0 && <div className={`h-0.5 w-full mb-1 ${done ? 'bg-primary' : 'bg-muted'}`} />}
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                      <StepIcon className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-[9px] text-center">{es ? stepSc.label_es : stepSc.label_en}</span>
                                  </div>
                                </React.Fragment>
                              );
                            })}
                          </div>
                        )}

                        {/* Tracking */}
                        {o.tracking_number && (
                          <div className="bg-muted/50 rounded-lg p-3">
                            <p className="text-xs font-medium mb-1">{es ? 'Número de rastreo' : 'Tracking number'}</p>
                            <div className="flex items-center gap-2">
                              <code className="text-sm font-mono bg-background px-2 py-1 rounded">{o.tracking_number}</code>
                              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { navigator.clipboard.writeText(o.tracking_number); toast.success(es ? 'Copiado' : 'Copied'); }}>
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                            {o.estimated_delivery && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {es ? 'Entrega estimada:' : 'Estimated delivery:'} {new Date(o.estimated_delivery).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Shipping info */}
                        {o.shipping_name && (
                          <div className="bg-muted/50 rounded-lg p-3">
                            <p className="text-xs font-medium mb-1.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> {es ? 'Dirección de envío' : 'Shipping address'}</p>
                            <p className="text-xs text-muted-foreground">{o.shipping_name}</p>
                            {o.shipping_phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {o.shipping_phone}</p>}
                            <p className="text-xs text-muted-foreground">{[o.shipping_city, o.shipping_state, o.shipping_zip].filter(Boolean).join(', ')}</p>
                            {o.shipping_notes && <p className="text-xs text-muted-foreground italic mt-1">{o.shipping_notes}</p>}
                          </div>
                        )}

                        {/* Timestamps */}
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
                          {o.paid_at && <span>✅ {es ? 'Pagado' : 'Paid'}: {new Date(o.paid_at).toLocaleString()}</span>}
                          {o.shipped_at && <span>📦 {es ? 'Enviado' : 'Shipped'}: {new Date(o.shipped_at).toLocaleString()}</span>}
                          {o.delivered_at && <span>🎉 {es ? 'Entregado' : 'Delivered'}: {new Date(o.delivered_at).toLocaleString()}</span>}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
