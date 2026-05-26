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
import { Package, Loader2, Truck, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp, MapPin, Phone, Copy, Search, ShoppingBag, DollarSign, ArrowRight, ExternalLink, RotateCcw, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const STATUS_CONFIG = {
  // Badge style: fondo tintado + texto sólido + borde para que SE VEA en cards blancos.
  // Antes con bg-X text-X (mismo color) el texto era invisible.
  pending:   {
    label_es: 'Pendiente', label_en: 'Pending', icon: Clock, dotColor: 'bg-warning',
    color: 'bg-warning/15 text-warning border-warning/40',
    pillIdle:   'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20 hover:border-warning/50',
    pillActive: 'bg-warning text-warning-foreground border-warning shadow-sm shadow-warning/30',
    countIdle:  'bg-warning/20 text-warning',
    countActive:'bg-warning-foreground/25 text-warning-foreground',
  },
  paid:      {
    label_es: 'Pagado', label_en: 'Paid', icon: CheckCircle2, dotColor: 'bg-primary',
    color: 'bg-primary/15 text-primary border-primary/40',
    pillIdle:   'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 hover:border-primary/50',
    pillActive: 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/30',
    countIdle:  'bg-primary/20 text-primary',
    countActive:'bg-primary-foreground/25 text-primary-foreground',
  },
  shipped:   {
    label_es: 'Enviado', label_en: 'Shipped', icon: Truck, dotColor: 'bg-secondary',
    color: 'bg-secondary/15 text-secondary border-secondary/40',
    pillIdle:   'bg-secondary/10 text-secondary border-secondary/30 hover:bg-secondary/20 hover:border-secondary/50',
    pillActive: 'bg-secondary text-secondary-foreground border-secondary shadow-sm shadow-secondary/30',
    countIdle:  'bg-secondary/20 text-secondary',
    countActive:'bg-secondary-foreground/25 text-secondary-foreground',
  },
  delivered: {
    label_es: 'Entregado', label_en: 'Delivered', icon: CheckCircle2, dotColor: 'bg-success',
    color: 'bg-success/15 text-success border-success/40',
    pillIdle:   'bg-success/10 text-success border-success/30 hover:bg-success/20 hover:border-success/50',
    pillActive: 'bg-success text-success-foreground border-success shadow-sm shadow-success/30',
    countIdle:  'bg-success/20 text-success',
    countActive:'bg-success-foreground/25 text-success-foreground',
  },
  cancelled: {
    label_es: 'Cancelado', label_en: 'Cancelled', icon: XCircle, dotColor: 'bg-destructive',
    color: 'bg-destructive/15 text-destructive border-destructive/40',
    pillIdle:   'bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20 hover:border-destructive/50',
    pillActive: 'bg-destructive text-destructive-foreground border-destructive shadow-sm shadow-destructive/30',
    countIdle:  'bg-destructive/20 text-destructive',
    countActive:'bg-destructive-foreground/25 text-destructive-foreground',
  },
};

// Pill style for the "Todos / All" filter (neutral, uses card surface + foreground)
const ALL_PILL_IDLE   = 'bg-card text-card-foreground border-border hover:border-foreground/30 hover:bg-muted';
const ALL_PILL_ACTIVE = 'bg-foreground text-background border-foreground shadow-sm';
const ALL_COUNT_IDLE  = 'bg-muted text-muted-foreground';
const ALL_COUNT_ACTIVE= 'bg-background/20 text-background';

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
  const [refundOrder, setRefundOrder] = useState<any>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundCategory, setRefundCategory] = useState<string>('damaged');
  const [refundBusy, setRefundBusy] = useState(false);
  const [reviewOrder, setReviewOrder] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewBody, setReviewBody] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);

  const submitRefund = async () => {
    if (!refundOrder || !refundReason.trim()) {
      toast.error(es ? 'Describe el motivo' : 'Describe the reason');
      return;
    }
    setRefundBusy(true);
    const { data, error } = await supabase.functions.invoke('request-marketplace-refund', {
      body: { orderId: refundOrder.id, reasonCategory: refundCategory, reason: refundReason },
    });
    setRefundBusy(false);
    if (error || !data?.ok) {
      toast.error(error?.message || data?.error || 'Error');
      return;
    }
    toast.success(es ? 'Solicitud enviada — recibirás respuesta en 48h' : 'Request submitted — response in 48h');
    setRefundOrder(null); setRefundReason(''); setRefundCategory('damaged');
    // Refresh orders
    if (user) {
      const { data } = await supabase.from('marketplace_orders').select('*, marketplace_products(name, image_url, currency)').eq('buyer_id', user.id).order('created_at', { ascending: false });
      setOrders((data as any[]) || []);
    }
  };

  const submitReview = async () => {
    if (!reviewOrder || reviewRating < 1) return;
    setReviewBusy(true);
    const { error } = await (supabase as any).from('product_reviews').insert({
      product_id: reviewOrder.product_id,
      order_id: reviewOrder.id,
      reviewer_id: user?.id,
      rating: reviewRating,
      title: reviewTitle.trim() || null,
      body: reviewBody.trim() || null,
      verified_purchase: true,
    });
    setReviewBusy(false);
    if (error) {
      if (error.code === '23505') toast.error(es ? 'Ya reseñaste este pedido' : 'Already reviewed');
      else toast.error(error.message);
      return;
    }
    toast.success(es ? 'Gracias por tu reseña' : 'Thanks for your review');
    setReviewOrder(null); setReviewRating(5); setReviewTitle(''); setReviewBody('');
  };

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
        {/* Header — panel sólido brand para que destaque sobre el fondo teal del brandbook */}
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-primary to-secondary text-primary-foreground p-5 sm:p-8 shadow-xl border border-primary/30 overflow-hidden relative">
          <div aria-hidden className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-light/25 blur-2xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-light/25 border border-light/40 backdrop-blur-sm flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-primary-foreground">{es ? 'Mis Compras' : 'My Orders'}</h1>
                <p className="text-sm text-light">{es ? 'Historial y seguimiento de pedidos' : 'Order history & tracking'}</p>
              </div>
            </div>

            {/* Stats — cards sólidas sobre el header brand */}
            {orders.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-light/20 border border-light/40 backdrop-blur p-3 text-center">
                  <p className="text-lg sm:text-xl font-bold text-primary-foreground">{stats.total}</p>
                  <p className="text-[10px] text-light">{es ? 'Pedidos' : 'Orders'}</p>
                </div>
                <div className="rounded-xl bg-light/20 border border-light/40 backdrop-blur p-3 text-center">
                  <p className="text-lg sm:text-xl font-bold text-primary-foreground">${stats.totalSpent.toLocaleString()}</p>
                  <p className="text-[10px] text-light">{es ? 'Total gastado' : 'Total spent'}</p>
                </div>
                <div className="rounded-xl bg-light/20 border border-light/40 backdrop-blur p-3 text-center">
                  <p className="text-lg sm:text-xl font-bold text-primary-foreground">{stats.active}</p>
                  <p className="text-[10px] text-light">{es ? 'En curso' : 'Active'}</p>
                </div>
              </div>
            )}
          </div>
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
                const PillIcon = sc?.icon;
                const pillCls = s === 'all'
                  ? (active ? ALL_PILL_ACTIVE : ALL_PILL_IDLE)
                  : (active ? sc!.pillActive : sc!.pillIdle);
                const countCls = s === 'all'
                  ? (active ? ALL_COUNT_ACTIVE : ALL_COUNT_IDLE)
                  : (active ? sc!.countActive : sc!.countIdle);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    aria-pressed={active ? 'true' : 'false'}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring/60 active:scale-[0.98] ${pillCls}`}
                  >
                    {PillIcon && <PillIcon className="w-3.5 h-3.5" />}
                    <span>{s === 'all' ? (es ? 'Todos' : 'All') : (es ? sc!.label_es : sc!.label_en)}</span>
                    <span className={`min-w-[20px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors ${countCls}`}>{count}</span>
                  </button>
                );
              })}
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder={es ? 'Buscar por producto...' : 'Search by product...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-10 text-sm bg-card border border-border shadow-sm hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary transition-colors placeholder:text-muted-foreground"
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
                          <div className="bg-destructive dark:bg-destructive/20 rounded-lg p-3 flex items-center gap-2">
                            <XCircle className="w-5 h-5 text-destructive" />
                            <span className="text-sm text-destructive dark:text-destructive">{es ? 'Este pedido fue cancelado' : 'This order was cancelled'}</span>
                          </div>
                        )}

                        {/* Tracking */}
                        {o.tracking_number && (
                          <div className="bg-secondary dark:bg-secondary/20 rounded-xl p-4">
                            <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                              <Truck className="w-4 h-4 text-secondary" />
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
                            {o.paid_at && <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" />✅ {es ? 'Pagado' : 'Paid'}: {new Date(o.paid_at).toLocaleString('es-MX')}</div>}
                            {o.shipped_at && <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-secondary" />📦 {es ? 'Enviado' : 'Shipped'}: {new Date(o.shipped_at).toLocaleString('es-MX')}</div>}
                            {o.delivered_at && <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-success" />🎉 {es ? 'Entregado' : 'Delivered'}: {new Date(o.delivered_at).toLocaleString('es-MX')}</div>}
                          </div>
                        </div>

                        {/* Refund + Review actions */}
                        <div className="flex flex-col sm:flex-row gap-2">
                          {(['paid','shipped','delivered'].includes(o.status)) && o.refund_status !== 'refunded' && o.refund_status !== 'requested' && (
                            <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5" onClick={() => setRefundOrder(o)}>
                              <RotateCcw className="w-3.5 h-3.5" /> {es ? 'Solicitar devolución' : 'Request refund'}
                            </Button>
                          )}
                          {o.refund_status === 'requested' && (
                            <Badge variant="secondary" className="self-center text-[10px]">{es ? 'Devolución en revisión' : 'Refund under review'}</Badge>
                          )}
                          {o.refund_status === 'refunded' && (
                            <Badge variant="verified" className="self-center text-[10px]">{es ? 'Reembolsado' : 'Refunded'}</Badge>
                          )}
                          {o.status === 'delivered' && (
                            <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5" onClick={() => setReviewOrder(o)}>
                              <Star className="w-3.5 h-3.5" /> {es ? 'Calificar producto' : 'Rate product'}
                            </Button>
                          )}
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

        {/* Refund Dialog */}
        <Dialog open={!!refundOrder} onOpenChange={(o) => { if (!o) setRefundOrder(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{es ? 'Solicitar devolución' : 'Request refund'}</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">{refundOrder?.marketplace_products?.name}</p>
              <p className="font-semibold">{es ? 'Importe' : 'Amount'}: {Number(refundOrder?.total_amount || 0).toFixed(2)} {refundOrder?.marketplace_products?.currency || 'MXN'}</p>
              <div>
                <Label className="text-xs">{es ? 'Motivo' : 'Reason'}</Label>
                <Select value={refundCategory} onValueChange={setRefundCategory}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="damaged">{es ? 'Producto dañado' : 'Damaged'}</SelectItem>
                    <SelectItem value="not_received">{es ? 'No lo recibí' : 'Not received'}</SelectItem>
                    <SelectItem value="wrong_item">{es ? 'Producto incorrecto' : 'Wrong item'}</SelectItem>
                    <SelectItem value="not_as_described">{es ? 'No corresponde a la descripción' : 'Not as described'}</SelectItem>
                    <SelectItem value="changed_mind">{es ? 'Cambié de opinión' : 'Changed mind'}</SelectItem>
                    <SelectItem value="other">{es ? 'Otro' : 'Other'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{es ? 'Cuéntanos más detalles' : 'More details'}</Label>
                <Textarea value={refundReason} onChange={e => setRefundReason(e.target.value)} rows={4} placeholder={es ? 'Ej: El producto llegó con la caja rota...' : 'E.g. arrived with broken packaging...'} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRefundOrder(null)}>{es ? 'Cancelar' : 'Cancel'}</Button>
              <Button onClick={submitRefund} disabled={refundBusy || !refundReason.trim()}>
                {refundBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {es ? 'Enviar solicitud' : 'Submit'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Review Dialog */}
        <Dialog open={!!reviewOrder} onOpenChange={(o) => { if (!o) setReviewOrder(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{es ? 'Calificar producto' : 'Rate product'}</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">{reviewOrder?.marketplace_products?.name}</p>
              <div>
                <Label className="text-xs">{es ? 'Calificación' : 'Rating'}</Label>
                <div className="flex gap-1 mt-1">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => setReviewRating(n)}>
                      <Star className={`w-7 h-7 ${n <= reviewRating ? 'fill-warning text-warning' : 'text-muted-foreground'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">{es ? 'Título (opcional)' : 'Title (optional)'}</Label>
                <Input value={reviewTitle} onChange={e => setReviewTitle(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{es ? 'Reseña (opcional)' : 'Review (optional)'}</Label>
                <Textarea value={reviewBody} onChange={e => setReviewBody(e.target.value)} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewOrder(null)}>{es ? 'Cancelar' : 'Cancel'}</Button>
              <Button onClick={submitReview} disabled={reviewBusy}>
                {reviewBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                {es ? 'Publicar reseña' : 'Submit review'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
