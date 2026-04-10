// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Package, Loader2, Truck, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp, MapPin, Phone, Copy, Search, ShoppingBag, DollarSign, ArrowRight, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  pending: { label_es: 'Pendiente', label_en: 'Pending', icon: Clock, color: 'bg-yellow-100 text-yellow-800 border-yellow-300', dotColor: 'bg-yellow-500' },
  paid: { label_es: 'Pagado', label_en: 'Paid', icon: CheckCircle2, color: 'bg-blue-100 text-blue-800 border-blue-300', dotColor: 'bg-blue-500' },
  shipped: { label_es: 'Enviado', label_en: 'Shipped', icon: Truck, color: 'bg-purple-100 text-purple-800 border-purple-300', dotColor: 'bg-purple-500' },
  delivered: { label_es: 'Entregado', label_en: 'Delivered', icon: CheckCircle2, color: 'bg-green-100 text-green-800 border-green-300', dotColor: 'bg-green-500' },
  cancelled: { label_es: 'Cancelado', label_en: 'Cancelled', icon: XCircle, color: 'bg-red-100 text-red-800 border-red-300', dotColor: 'bg-red-500' },
};

const TIMELINE_STEPS = ['pending', 'paid', 'shipped', 'delivered'];
const STATUS_FILTERS = ['all', 'pending', 'paid', 'shipped', 'delivered', 'cancelled'];

export default function MyOrders() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const es = language === 'es';
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

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

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const name = o.marketplace_products?.name || '';
        return name.toLowerCase().includes(s);
      }
      return true;
    });
  }, [orders, statusFilter, search]);

  const stats = useMemo(() => {
    const total = orders.length;
    const totalSpent = orders.filter(o => o.status !== 'cancelled' && o.status !== 'pending').reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const active = orders.filter(o => o.status === 'paid' || o.status === 'shipped').length;
    return { total, totalSpent, active };
  }, [orders]);

  const getStatusIdx = (status: string) => TIMELINE_STEPS.indexOf(status);
  const formatOrderId = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-3xl">
        {/* Header */}
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent p-5 sm:p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{es ? 'Mis Compras' : 'My Orders'}</h1>
              <p className="text-sm text-muted-foreground">{es ? 'Historial y seguimiento de pedidos' : 'Order history & tracking'}</p>
            </div>
          </div>

          {/* Stats */}
          {orders.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-card/80 backdrop-blur p-3 text-center">
                <p className="text-lg sm:text-xl font-bold">{stats.total}</p>
                <p className="text-[10px] text-muted-foreground">{es ? 'Pedidos' : 'Orders'}</p>
              </div>
              <div className="rounded-xl bg-card/80 backdrop-blur p-3 text-center">
                <p className="text-lg sm:text-xl font-bold text-primary">${stats.totalSpent.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">{es ? 'Total gastado' : 'Total spent'}</p>
              </div>
              <div className="rounded-xl bg-card/80 backdrop-blur p-3 text-center">
                <p className="text-lg sm:text-xl font-bold text-yellow-600">{stats.active}</p>
                <p className="text-[10px] text-muted-foreground">{es ? 'En curso' : 'Active'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        {orders.length > 0 && (
          <div className="mb-4 space-y-3">
            {/* Status tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {STATUS_FILTERS.map(s => {
                const sc = s === 'all' ? null : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG];
                const count = s === 'all' ? orders.length : orders.filter(o => o.status === s).length;
                const active = statusFilter === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                      active
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {s === 'all' ? (es ? 'Todos' : 'All') : (es ? sc!.label_es : sc!.label_en)}
                    <span className={`min-w-[18px] h-[18px] rounded-full text-[10px] flex items-center justify-center ${
                      active ? 'bg-primary-foreground/20' : 'bg-muted-foreground/10'
                    }`}>{count}</span>
                  </button>
                );
              })}
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={es ? 'Buscar por producto...' : 'Search by product...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
        )}

        {/* Orders */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-muted-foreground/30" />
            </div>
            <h3 className="font-semibold mb-1">{es ? 'No tienes compras aún' : 'No orders yet'}</h3>
            <p className="text-sm text-muted-foreground mb-4">{es ? 'Explora nuestro marketplace de material médico' : 'Explore our medical supplies marketplace'}</p>
            <Button onClick={() => navigate('/medical-supplies')} className="gap-2">
              <ArrowRight className="w-4 h-4" /> {es ? 'Ir al Marketplace' : 'Go to Marketplace'}
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">{es ? 'Sin resultados' : 'No results'}</p>
        ) : (
          <div className="space-y-3">
            {filtered.map(o => {
              const sc = STATUS_CONFIG[o.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
              const Icon = sc.icon;
              const expanded = expandedId === o.id;
              const currentStep = getStatusIdx(o.status);
              const product = o.marketplace_products;

              return (
                <Card key={o.id} className={`overflow-hidden transition-all ${expanded ? 'shadow-lg ring-1 ring-border' : 'hover:shadow-md'}`}>
                  <CardContent className="p-0">
                    {/* Main row */}
                    <button
                      onClick={() => setExpandedId(expanded ? null : o.id)}
                      className="w-full flex items-start gap-3 p-4 text-left"
                    >
                      {product?.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                          <Package className="w-7 h-7 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{product?.name || (es ? 'Producto' : 'Product')}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{formatOrderId(o.id)}</p>
                          </div>
                          <Badge className={`text-[10px] ${sc.color} border flex-shrink-0`}>
                            <Icon className="w-3 h-3 mr-1" />
                            {es ? sc.label_es : sc.label_en}
                          </Badge>
                        </div>
                        <div className="flex items-baseline gap-2 mt-2">
                          <p className="text-base font-bold text-primary">${Number(o.total_amount).toLocaleString()}</p>
                          <span className="text-[10px] text-muted-foreground">{product?.currency || 'MXN'}</span>
                          {o.quantity > 1 && <span className="text-[10px] text-muted-foreground">× {o.quantity}</span>}
                          {o.delivery_fee > 0 && <span className="text-[10px] text-muted-foreground">+ ${Number(o.delivery_fee).toLocaleString()} envío</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{new Date(o.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                      <div className="flex-shrink-0 self-center">
                        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {/* Expanded details */}
                    {expanded && (
                      <div className="px-4 pb-4 pt-0 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 border-t">
                        {/* Visual Timeline */}
                        {o.status !== 'cancelled' && (
                          <div className="pt-4">
                            <div className="flex items-start">
                              {TIMELINE_STEPS.map((step, i) => {
                                const stepSc = STATUS_CONFIG[step as keyof typeof STATUS_CONFIG];
                                const StepIcon = stepSc.icon;
                                const done = i <= currentStep;
                                const isLast = i === TIMELINE_STEPS.length - 1;
                                return (
                                  <div key={step} className={`flex flex-col items-center ${isLast ? '' : 'flex-1'}`}>
                                    <div className="flex items-center w-full">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                                        done ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground'
                                      }`}>
                                        <StepIcon className="w-4 h-4" />
                                      </div>
                                      {!isLast && (
                                        <div className={`flex-1 h-1 mx-1 rounded-full transition-colors ${
                                          i < currentStep ? 'bg-primary' : 'bg-muted'
                                        }`} />
                                      )}
                                    </div>
                                    <span className="text-[9px] text-muted-foreground mt-1.5 text-center leading-tight">
                                      {es ? stepSc.label_es : stepSc.label_en}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {o.status === 'cancelled' && (
                          <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 flex items-center gap-2">
                            <XCircle className="w-5 h-5 text-red-500" />
                            <span className="text-sm text-red-700 dark:text-red-400">{es ? 'Este pedido fue cancelado' : 'This order was cancelled'}</span>
                          </div>
                        )}

                        {/* Tracking */}
                        {o.tracking_number && (
                          <div className="bg-purple-50 dark:bg-purple-950/20 rounded-xl p-4">
                            <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                              <Truck className="w-4 h-4 text-purple-600" />
                              {es ? 'Número de rastreo' : 'Tracking number'}
                            </p>
                            <div className="flex items-center gap-2">
                              <code className="text-sm font-mono bg-card px-3 py-1.5 rounded-lg border flex-1">{o.tracking_number}</code>
                              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => { navigator.clipboard.writeText(o.tracking_number); toast.success(es ? 'Copiado' : 'Copied'); }}>
                                <Copy className="w-3 h-3" /> {es ? 'Copiar' : 'Copy'}
                              </Button>
                            </div>
                            {o.estimated_delivery && (
                              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                📅 {es ? 'Entrega estimada:' : 'Estimated delivery:'} <strong>{new Date(o.estimated_delivery).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}</strong>
                              </p>
                            )}
                          </div>
                        )}

                        {/* Shipping info */}
                        {o.shipping_name && (
                          <div className="bg-muted/50 rounded-xl p-4">
                            <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                              <MapPin className="w-4 h-4 text-primary" />
                              {es ? 'Dirección de envío' : 'Shipping address'}
                            </p>
                            <div className="space-y-1">
                              <p className="text-sm font-medium">{o.shipping_name}</p>
                              {o.shipping_phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {o.shipping_phone}</p>}
                              <p className="text-xs text-muted-foreground">{[o.shipping_city, o.shipping_state, o.shipping_zip].filter(Boolean).join(', ')}</p>
                              {o.shipping_notes && <p className="text-xs text-muted-foreground italic mt-1.5 pt-1.5 border-t border-border/50">💬 {o.shipping_notes}</p>}
                            </div>
                          </div>
                        )}

                        {/* Timestamps */}
                        <div className="bg-muted/30 rounded-xl p-3">
                          <p className="text-xs font-semibold mb-2">{es ? 'Historial' : 'History'}</p>
                          <div className="space-y-1.5 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                              {es ? 'Creado' : 'Created'}: {new Date(o.created_at).toLocaleString('es-MX')}
                            </div>
                            {o.paid_at && <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" />✅ {es ? 'Pagado' : 'Paid'}: {new Date(o.paid_at).toLocaleString('es-MX')}</div>}
                            {o.shipped_at && <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500" />📦 {es ? 'Enviado' : 'Shipped'}: {new Date(o.shipped_at).toLocaleString('es-MX')}</div>}
                            {o.delivered_at && <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500" />🎉 {es ? 'Entregado' : 'Delivered'}: {new Date(o.delivered_at).toLocaleString('es-MX')}</div>}
                          </div>
                        </div>

                        {/* Contact support */}
                        <Button variant="ghost" size="sm" className="w-full text-xs gap-1.5 text-muted-foreground" onClick={() => navigate('/contact')}>
                          <ExternalLink className="w-3 h-3" />
                          {es ? '¿Necesitas ayuda? Contactar soporte' : 'Need help? Contact support'}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* CTA at bottom */}
        {orders.length > 0 && (
          <div className="mt-6 text-center">
            <Button variant="outline" size="sm" onClick={() => navigate('/medical-supplies')} className="gap-2 text-xs">
              <ArrowRight className="w-3.5 h-3.5" />
              {es ? 'Seguir comprando' : 'Continue shopping'}
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
