import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, Package, ShoppingCart, BarChart3, Loader2, Store,
  Building2, Phone, Globe, MapPin, FileCheck, ChevronRight, CheckCircle2,
  Clock, TrendingUp, DollarSign, Eye, EyeOff, ArrowRight,
} from 'lucide-react';

// ─── Sub-components ──────────────────────────────────────────

function VendorHero({ es, onStart }: { es: boolean; onStart: () => void }) {
  const benefits = es
    ? ['Panel exclusivo para gestionar productos', 'Procesamiento de pagos integrado', 'Analíticas de ventas en tiempo real', 'Soporte y visibilidad en la plataforma']
    : ['Exclusive dashboard to manage products', 'Integrated payment processing', 'Real-time sales analytics', 'Platform visibility & support'];

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4 border border-primary/20">
          <Store className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">
          {es ? 'Vende en Medical Masters' : 'Sell on Medical Masters'}
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          {es ? 'Registra tu empresa para comercializar material y equipo médico en nuestro marketplace.' : 'Register your company to sell medical supplies and equipment on our marketplace.'}
        </p>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background mb-6">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            {es ? '¿Por qué vender con nosotros?' : 'Why sell with us?'}
          </h3>
          <ul className="space-y-3">
            {benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                {b}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="text-center">
        <Button size="lg" onClick={onStart} className="gap-2 px-8">
          <Building2 className="w-5 h-5" />
          {es ? 'Registrar mi Empresa' : 'Register my Company'}
        </Button>
      </div>
    </div>
  );
}

interface RegFormData {
  name: string; description: string; website: string; phone: string;
  location: string; tax_id: string; contact_email: string; logo_url: string;
}

const emptyRegForm: RegFormData = { name: '', description: '', website: '', phone: '', location: '', tax_id: '', contact_email: '', logo_url: '' };

function RegistrationStepper({ es, user, onComplete }: { es: boolean; user: any; onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<RegFormData>(emptyRegForm);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof RegFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const steps = es
    ? ['Información', 'Contacto', 'Documentos', 'Revisión']
    : ['Information', 'Contact', 'Documents', 'Review'];

  const canNext = () => {
    if (step === 1) return !!form.name.trim();
    if (step === 2) return !!form.phone.trim() || !!form.contact_email.trim();
    return true;
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('marketplace_vendors').insert({
      user_id: user.id, name: form.name, description: form.description || null,
      website: form.website || null, phone: form.phone || null,
      location: form.location || null, status: 'pending',
    } as any);
    if (error) toast.error(error.message);
    else { toast.success(es ? 'Solicitud enviada exitosamente' : 'Application submitted successfully'); onComplete(); }
    setSaving(false);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <Button variant="ghost" size="sm" className="mb-4 gap-1 text-muted-foreground" onClick={onComplete}>
        ← {es ? 'Volver' : 'Back'}
      </Button>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                i + 1 < step ? 'bg-primary text-primary-foreground border-primary' :
                i + 1 === step ? 'border-primary text-primary bg-primary/10' :
                'border-muted text-muted-foreground'
              }`}>{i + 1 < step ? '✓' : i + 1}</div>
              {i < steps.length - 1 && <div className={`hidden sm:block w-12 lg:w-20 h-0.5 ${i + 1 < step ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>
        <Progress value={(step / 4) * 100} className="h-1.5" />
        <p className="text-sm text-muted-foreground mt-2">{es ? 'Paso' : 'Step'} {step}/4 — {steps[step - 1]}</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          {step === 1 && (
            <>
              <h2 className="text-lg font-semibold flex items-center gap-2"><Building2 className="w-5 h-5 text-primary" />{es ? 'Información de la Empresa' : 'Company Information'}</h2>
              <div><Label>{es ? 'Nombre de la Empresa' : 'Company Name'} *</Label><Input value={form.name} onChange={set('name')} placeholder={es ? 'Ej: MediSupply México' : 'e.g. MediSupply Inc'} /></div>
              <div><Label>{es ? 'Descripción' : 'Description'}</Label><Textarea value={form.description} onChange={set('description')} rows={3} placeholder={es ? 'Describe tu empresa y los productos que ofreces...' : 'Describe your company and products...'} /></div>
              <div><Label>{es ? 'RFC / ID Fiscal' : 'Tax ID'}</Label><Input value={form.tax_id} onChange={set('tax_id')} placeholder={es ? 'Ej: XAXX010101000' : 'e.g. 12-3456789'} /></div>
              <div><Label>{es ? 'Logo (URL)' : 'Logo (URL)'}</Label><Input value={form.logo_url} onChange={set('logo_url')} placeholder="https://..." /></div>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="text-lg font-semibold flex items-center gap-2"><Phone className="w-5 h-5 text-primary" />{es ? 'Datos de Contacto' : 'Contact Details'}</h2>
              <div><Label>{es ? 'Email de Contacto' : 'Contact Email'}</Label><Input type="email" value={form.contact_email} onChange={set('contact_email')} placeholder="ventas@empresa.com" /></div>
              <div><Label>{es ? 'Teléfono' : 'Phone'}</Label><Input value={form.phone} onChange={set('phone')} placeholder="+52 55 1234 5678" /></div>
              <div><Label>{es ? 'Sitio Web' : 'Website'}</Label><Input value={form.website} onChange={set('website')} placeholder="https://www.empresa.com" /></div>
              <div><Label>{es ? 'Dirección / Ubicación' : 'Address / Location'}</Label><Input value={form.location} onChange={set('location')} placeholder={es ? 'Ciudad, Estado, País' : 'City, State, Country'} /></div>
            </>
          )}
          {step === 3 && (
            <>
              <h2 className="text-lg font-semibold flex items-center gap-2"><FileCheck className="w-5 h-5 text-primary" />{es ? 'Documentos y Verificación' : 'Documents & Verification'}</h2>
              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
                <p>{es ? 'Nuestro equipo revisará tu solicitud. Podrás subir documentos adicionales (licencia comercial, permisos COFEPRIS, etc.) una vez aprobada tu cuenta.' : 'Our team will review your application. You can upload additional documents (commercial license, permits, etc.) once your account is approved.'}</p>
                <p className="font-medium text-foreground">{es ? 'Tiempo estimado de revisión: 1-3 días hábiles' : 'Estimated review time: 1-3 business days'}</p>
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <h2 className="text-lg font-semibold flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary" />{es ? 'Revisión Final' : 'Final Review'}</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-border pb-2"><span className="text-muted-foreground">{es ? 'Empresa' : 'Company'}</span><span className="font-medium">{form.name}</span></div>
                {form.description && <div className="flex justify-between border-b border-border pb-2"><span className="text-muted-foreground">{es ? 'Descripción' : 'Description'}</span><span className="font-medium truncate max-w-[200px]">{form.description}</span></div>}
                {form.tax_id && <div className="flex justify-between border-b border-border pb-2"><span className="text-muted-foreground">RFC</span><span className="font-medium">{form.tax_id}</span></div>}
                {form.contact_email && <div className="flex justify-between border-b border-border pb-2"><span className="text-muted-foreground">Email</span><span className="font-medium">{form.contact_email}</span></div>}
                {form.phone && <div className="flex justify-between border-b border-border pb-2"><span className="text-muted-foreground">{es ? 'Teléfono' : 'Phone'}</span><span className="font-medium">{form.phone}</span></div>}
                {form.location && <div className="flex justify-between border-b border-border pb-2"><span className="text-muted-foreground">{es ? 'Ubicación' : 'Location'}</span><span className="font-medium">{form.location}</span></div>}
              </div>
            </>
          )}

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(s => Math.max(1, s - 1) as any)} disabled={step === 1}>
              ← {es ? 'Anterior' : 'Previous'}
            </Button>
            {step < 4 ? (
              <Button onClick={() => setStep(s => Math.min(4, s + 1) as any)} disabled={!canNext()} className="gap-1">
                {es ? 'Siguiente' : 'Next'} <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {es ? 'Enviar Solicitud' : 'Submit Application'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PendingState({ es }: { es: boolean }) {
  const timeline = es
    ? ['Solicitud recibida', 'En revisión por el equipo', 'Verificación de documentos', 'Aprobación y activación']
    : ['Application received', 'Under team review', 'Document verification', 'Approval & activation'];

  return (
    <div className="container mx-auto px-4 py-12 max-w-lg">
      <Card className="border-primary/20">
        <CardContent className="p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold mb-2">{es ? 'Solicitud en Revisión' : 'Application Under Review'}</h1>
          <p className="text-sm text-muted-foreground mb-6">{es ? 'Tu solicitud está siendo revisada. Te notificaremos cuando sea aprobada.' : 'Your application is being reviewed. We will notify you when approved.'}</p>

          <div className="text-left space-y-3">
            {timeline.map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {i === 0 ? '✓' : i + 1}
                </div>
                <span className={`text-sm ${i === 0 ? 'font-medium' : 'text-muted-foreground'}`}>{t}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export default function VendorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const es = language === 'es';
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', category: '', price: '', image_url: '', stock: '0', is_active: true });
  const [saving, setSaving] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);

  const fetchVendor = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('marketplace_vendors').select('*').eq('user_id', user.id).limit(1);
    if (data && data.length > 0) {
      const v = data[0] as any;
      setVendor(v);
      const [{ data: prods }, { data: ords }] = await Promise.all([
        supabase.from('marketplace_products').select('*').eq('vendor_id', v.id).order('created_at', { ascending: false }),
        supabase.from('marketplace_orders').select('*, marketplace_products(name)').eq('vendor_id', v.id).order('created_at', { ascending: false }),
      ]);
      setProducts((prods as any[]) || []);
      setOrders((ords as any[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchVendor(); }, [user]);

  const handleSaveProduct = async () => {
    if (!form.name || !vendor) return;
    setSaving(true);
    const payload = { name: form.name, description: form.description || null, category: form.category || null, price: parseFloat(form.price) || 0, vendor_id: vendor.id, image_url: form.image_url || null, stock: parseInt(form.stock) || 0, is_active: form.is_active };
    if (editingId) await supabase.from('marketplace_products').update(payload as any).eq('id', editingId);
    else await supabase.from('marketplace_products').insert(payload as any);
    const { data } = await supabase.from('marketplace_products').select('*').eq('vendor_id', vendor.id).order('created_at', { ascending: false });
    setProducts((data as any[]) || []);
    setSaving(false); setDialogOpen(false); toast.success(es ? 'Guardado' : 'Saved');
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm(es ? '¿Eliminar este producto?' : 'Delete this product?') || !vendor) return;
    await supabase.from('marketplace_products').delete().eq('id', id);
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const toggleProductActive = async (id: string, active: boolean) => {
    await supabase.from('marketplace_products').update({ is_active: active } as any).eq('id', id);
    setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: active } : p));
  };

  const updateOrderStatus = async (id: string, status: string) => {
    await supabase.from('marketplace_orders').update({ status } as any).eq('id', id);
    const { data } = await supabase.from('marketplace_orders').select('*, marketplace_products(name)').eq('vendor_id', vendor.id).order('created_at', { ascending: false });
    setOrders((data as any[]) || []); toast.success(es ? 'Actualizado' : 'Updated');
  };

  if (loading) return <MainLayout><div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></MainLayout>;

  // Not registered
  if (!vendor && !showRegistration) {
    return <MainLayout><VendorHero es={es} onStart={() => setShowRegistration(true)} /></MainLayout>;
  }
  if (!vendor && showRegistration) {
    return <MainLayout><RegistrationStepper es={es} user={user} onComplete={() => { setShowRegistration(false); fetchVendor(); }} /></MainLayout>;
  }

  // Pending
  if (vendor.status === 'pending') {
    return <MainLayout><PendingState es={es} /></MainLayout>;
  }

  // Approved — Dashboard
  const paidOrders = orders.filter(o => ['paid', 'shipped', 'delivered'].includes(o.status));
  const totalRevenue = paidOrders.reduce((a, o) => a + (o.total_amount || 0), 0);
  const activeProducts = products.filter(p => p.is_active).length;
  const pendingOrders = orders.filter(o => o.status === 'paid').length;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
        {/* Header — panel sólido brand para que destaque sobre fondo teal del brandbook */}
        <div className="mb-6 p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-xl border border-primary/30 overflow-hidden relative">
          <div aria-hidden className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-light/25 blur-2xl pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-light/25 border border-light/40 backdrop-blur-sm flex items-center justify-center">
              <Store className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-primary-foreground">{vendor.name}</h1>
              <p className="text-sm text-light">{es ? 'Panel de vendedor' : 'Vendor dashboard'}</p>
            </div>
            <Badge className="ml-auto bg-light/25 text-primary-foreground border-light/40 backdrop-blur-sm">{es ? 'Aprobado' : 'Approved'}</Badge>
          </div>
        </div>

        {/* Stats — cards sólidas con borde brand para que se vean */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Package,      label: es ? 'Productos Activos' : 'Active Products', value: activeProducts,                       iconColor: 'text-primary',   bgColor: 'bg-primary/10',   border: 'border-primary/30' },
            { icon: ShoppingCart, label: es ? 'Pedidos Totales' : 'Total Orders',      value: orders.length,                        iconColor: 'text-secondary', bgColor: 'bg-secondary/10', border: 'border-secondary/30' },
            { icon: Clock,        label: es ? 'Pendientes Envío' : 'Pending Shipment', value: pendingOrders,                        iconColor: 'text-accent',    bgColor: 'bg-accent/15',    border: 'border-accent/30' },
            { icon: DollarSign,   label: es ? 'Ingresos' : 'Revenue',                  value: `$${totalRevenue.toLocaleString()}`,  iconColor: 'text-primary',   bgColor: 'bg-primary/10',   border: 'border-primary/30' },
          ].map((s, i) => (
            <Card key={i} className={`${s.border} shadow-sm`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`w-7 h-7 rounded-lg ${s.bgColor} flex items-center justify-center flex-shrink-0`}>
                    <s.icon className={`w-4 h-4 ${s.iconColor}`} />
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-tight">{s.label}</span>
                </div>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="products">
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="products" className="gap-1"><Package className="w-4 h-4" />{es ? 'Productos' : 'Products'}</TabsTrigger>
            <TabsTrigger value="orders" className="gap-1"><ShoppingCart className="w-4 h-4" />{es ? 'Pedidos' : 'Orders'}</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1"><BarChart3 className="w-4 h-4" />{es ? 'Analíticas' : 'Analytics'}</TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products">
            <div className="flex justify-end mb-3">
              <Button onClick={() => { setEditingId(null); setForm({ name: '', description: '', category: '', price: '', image_url: '', stock: '0', is_active: true }); setDialogOpen(true); }} className="gap-1.5">
                <Plus className="w-4 h-4" /> {es ? 'Agregar Producto' : 'Add Product'}
              </Button>
            </div>
            <div className="space-y-2">
              {products.map(p => (
                <Card key={p.id} className={!p.is_active ? 'opacity-60' : ''}>
                  <CardContent className="p-3 flex items-center gap-3">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-14 h-14 rounded-lg object-cover border border-border" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center"><Package className="w-6 h-6 text-muted-foreground" /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">${p.price} MXN · Stock: {p.stock}</p>
                      {p.category && <Badge variant="secondary" className="text-[10px] mt-1">{p.category}</Badge>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => toggleProductActive(p.id, !p.is_active)} title={p.is_active ? 'Desactivar' : 'Activar'}>
                      {p.is_active ? <Eye className="w-4 h-4 text-success" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setEditingId(p.id); setForm({ name: p.name, description: p.description || '', category: p.category || '', price: p.price.toString(), image_url: p.image_url || '', stock: p.stock.toString(), is_active: p.is_active }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </CardContent>
                </Card>
              ))}
              {products.length === 0 && <p className="text-center text-muted-foreground py-8">{es ? 'Aún no tienes productos. ¡Agrega tu primero!' : 'No products yet. Add your first one!'}</p>}
            </div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <div className="space-y-2">
              {orders.map(o => (
                <Card key={o.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{(o as any).marketplace_products?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Qty: {o.quantity} · ${o.total_amount} MXN · {new Date(o.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={o.status === 'delivered' ? 'default' : o.status === 'shipped' ? 'secondary' : 'outline'} className="text-[10px] capitalize">{o.status}</Badge>
                    {o.status === 'paid' && <Button size="sm" variant="outline" onClick={() => updateOrderStatus(o.id, 'shipped')} className="gap-1">{es ? 'Enviar' : 'Ship'}</Button>}
                    {o.status === 'shipped' && <Button size="sm" variant="outline" onClick={() => updateOrderStatus(o.id, 'delivered')} className="gap-1">{es ? 'Entregado' : 'Delivered'}</Button>}
                  </CardContent>
                </Card>
              ))}
              {orders.length === 0 && <p className="text-center text-muted-foreground py-8">{es ? 'Sin pedidos aún' : 'No orders yet'}</p>}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{es ? 'Ingresos Totales' : 'Total Revenue'}</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold text-primary">${totalRevenue.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">MXN</span></p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{es ? 'Pedidos Entregados' : 'Delivered Orders'}</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold">{orders.filter(o => o.status === 'delivered').length}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{es ? 'Ticket Promedio' : 'Average Order'}</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold">${paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length).toLocaleString() : 0} <span className="text-sm font-normal text-muted-foreground">MXN</span></p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{es ? 'Tasa de Conversión' : 'Conversion Rate'}</CardTitle></CardHeader>
                <CardContent><p className="text-3xl font-bold">{orders.length > 0 ? Math.round((orders.filter(o => o.status === 'delivered').length / orders.length) * 100) : 0}%</p></CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Product Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? (es ? 'Editar Producto' : 'Edit Product') : (es ? 'Nuevo Producto' : 'New Product')}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{es ? 'Nombre' : 'Name'} *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>{es ? 'Descripción' : 'Description'}</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{es ? 'Precio (MXN)' : 'Price (MXN)'}</Label><Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
                <div><Label>Stock</Label><Input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} /></div>
              </div>
              <div><Label>{es ? 'Categoría' : 'Category'}</Label><Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></div>
              <div><Label>{es ? 'URL de Imagen' : 'Image URL'}</Label><Input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label>{es ? 'Activo' : 'Active'}</Label></div>
              <Button onClick={handleSaveProduct} disabled={saving} className="w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (es ? 'Guardar' : 'Save')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
