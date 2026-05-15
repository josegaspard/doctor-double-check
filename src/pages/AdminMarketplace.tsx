import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Package, Store, Tag, ShoppingCart, Loader2, Check, X, Download, TrendingUp, DollarSign, Users, BarChart3, ChevronDown, ChevronUp, Truck, MapPin, Phone, Mail, ArrowLeft, FileText, Send, Clock, RotateCcw, AlertTriangle, CreditCard, ClipboardList, AlertCircle, Warehouse } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminMarketplace() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language } = useLanguage();
  const es = language === 'es';

  useEffect(() => { if (role && role !== 'admin') navigate('/'); }, [role, navigate]);
  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="mb-3 -ml-2 text-white hover:bg-white/10 hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-1" /> {es ? 'Volver al panel' : 'Back to admin'}
        </Button>
        <div className="mb-6 rounded-2xl bg-white border-2 border-primary/30 shadow-md p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow">
              <Package className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-secondary truncate">
                {es ? 'Marketplace - Material Médico' : 'Marketplace - Medical Supplies'}
              </h1>
              <p className="text-xs sm:text-sm text-secondary/70">{es ? 'Administra productos, proveedores, categorías, pedidos y ventas' : 'Manage products, vendors, categories, orders and sales'}</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="products">
          <TabsList className="w-full grid grid-cols-5 sm:grid-cols-10 mb-4 h-auto">
            <TabsTrigger value="products" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><Package className="w-3 h-3" /><span className="hidden sm:inline">{es ? 'Productos' : 'Products'}</span></TabsTrigger>
            <TabsTrigger value="vendors" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><Store className="w-3 h-3" /><span className="hidden sm:inline">{es ? 'Vendors' : 'Vendors'}</span></TabsTrigger>
            <TabsTrigger value="categories" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><Tag className="w-3 h-3" /><span className="hidden sm:inline">{es ? 'Cats' : 'Cats'}</span></TabsTrigger>
            <TabsTrigger value="orders" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><ShoppingCart className="w-3 h-3" /><span className="hidden sm:inline">{es ? 'Pedidos' : 'Orders'}</span></TabsTrigger>
            <TabsTrigger value="sales" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><TrendingUp className="w-3 h-3" /><span className="hidden sm:inline">{es ? 'Ventas' : 'Sales'}</span></TabsTrigger>
            <TabsTrigger value="refunds" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><RotateCcw className="w-3 h-3" /><span className="hidden sm:inline">{es ? 'Devol.' : 'Refunds'}</span></TabsTrigger>
            <TabsTrigger value="disputes" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><AlertTriangle className="w-3 h-3" /><span className="hidden sm:inline">{es ? 'Disputas' : 'Disputes'}</span></TabsTrigger>
            <TabsTrigger value="payouts" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><CreditCard className="w-3 h-3" /><span className="hidden sm:inline">{es ? 'Pagos' : 'Payouts'}</span></TabsTrigger>
            <TabsTrigger value="stock" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><Warehouse className="w-3 h-3" /><span className="hidden sm:inline">{es ? 'Stock' : 'Stock'}</span></TabsTrigger>
            <TabsTrigger value="audit" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><ClipboardList className="w-3 h-3" /><span className="hidden sm:inline">{es ? 'Audit' : 'Audit'}</span></TabsTrigger>
          </TabsList>

          <TabsContent value="products"><ProductsTab es={es} /></TabsContent>
          <TabsContent value="vendors"><VendorsTab es={es} /></TabsContent>
          <TabsContent value="categories"><CategoriesTab es={es} /></TabsContent>
          <TabsContent value="orders"><OrdersTab es={es} /></TabsContent>
          <TabsContent value="sales"><SalesTab es={es} /></TabsContent>
          <TabsContent value="refunds"><RefundsTab es={es} /></TabsContent>
          <TabsContent value="disputes"><DisputesTab es={es} /></TabsContent>
          <TabsContent value="payouts"><PayoutsTab es={es} /></TabsContent>
          <TabsContent value="stock"><StockTab es={es} /></TabsContent>
          <TabsContent value="audit"><AuditTab es={es} /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

/* =================== PRODUCTS TAB =================== */
function ProductsTab({ es }: { es: boolean }) {
  const [products, setProducts] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', category: '', price: '', vendor_id: '', image_url: '', stock: '0', is_active: true });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: p }, { data: v }] = await Promise.all([
      supabase.from('marketplace_products').select('*, marketplace_vendors(name)').order('created_at', { ascending: false }),
      supabase.from('marketplace_vendors').select('id, name').eq('status', 'approved'),
    ]);
    setProducts((p as any[]) || []); setVendors((v as any[]) || []); setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.vendor_id) { toast.error(es ? 'Nombre y proveedor requeridos' : 'Name and vendor required'); return; }
    setSaving(true);
    const payload = { name: form.name, description: form.description || null, category: form.category || null, price: parseFloat(form.price) || 0, vendor_id: form.vendor_id, image_url: form.image_url || null, stock: parseInt(form.stock) || 0, is_active: form.is_active };
    if (editingId) await supabase.from('marketplace_products').update(payload as any).eq('id', editingId);
    else await supabase.from('marketplace_products').insert(payload as any);
    setSaving(false); setDialogOpen(false); fetchData(); toast.success(es ? 'Guardado' : 'Saved');
  };

  const handleDelete = async (id: string) => {
    if (!confirm(es ? '¿Eliminar?' : 'Delete?')) return;
    await supabase.from('marketplace_products').delete().eq('id', id);
    fetchData(); toast.success(es ? 'Eliminado' : 'Deleted');
  };

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={es ? 'Buscar producto...' : 'Search product...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => { setEditingId(null); setForm({ name: '', description: '', category: '', price: '', vendor_id: '', image_url: '', stock: '0', is_active: true }); setDialogOpen(true); }} className="gap-1.5">
          <Plus className="w-4 h-4" /> {es ? 'Agregar' : 'Add'}
        </Button>
      </div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <div className="space-y-2">
          {filtered.map(p => (
            <Card key={p.id}><CardContent className="p-3 flex items-center gap-3">
              {p.image_url && <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-lg object-cover" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">{(p as any).marketplace_vendors?.name} · ${p.price} MXN · Stock: {p.stock}</p>
              </div>
              <Badge variant={p.is_active ? 'default' : 'secondary'} className="text-[10px]">{p.is_active ? (es ? 'Activo' : 'Active') : (es ? 'Inactivo' : 'Inactive')}</Badge>
              <Button variant="ghost" size="icon" onClick={() => { setEditingId(p.id); setForm({ name: p.name, description: p.description || '', category: p.category || '', price: p.price.toString(), vendor_id: p.vendor_id, image_url: p.image_url || '', stock: p.stock.toString(), is_active: p.is_active }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </CardContent></Card>
          ))}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">{es ? 'Sin productos' : 'No products'}</p>}
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? (es ? 'Editar Producto' : 'Edit Product') : (es ? 'Nuevo Producto' : 'New Product')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{es ? 'Nombre' : 'Name'} *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>{es ? 'Descripción' : 'Description'}</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div><Label>{es ? 'Proveedor' : 'Vendor'} *</Label>
              <Select value={form.vendor_id} onValueChange={v => setForm(f => ({ ...f, vendor_id: v }))}>
                <SelectTrigger><SelectValue placeholder={es ? 'Seleccionar' : 'Select'} /></SelectTrigger>
                <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{es ? 'Precio (MXN)' : 'Price (MXN)'}</Label><Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
              <div><Label>Stock</Label><Input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} /></div>
            </div>
            <div><Label>{es ? 'Categoría' : 'Category'}</Label><Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></div>
            <div><Label>{es ? 'URL de Imagen' : 'Image URL'}</Label><Input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label>{es ? 'Activo' : 'Active'}</Label></div>
            <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (es ? 'Guardar' : 'Save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =================== VENDORS TAB =================== */
function VendorsTab({ es }: { es: boolean }) {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', website: '', phone: '', location: '', logo_url: '', status: 'approved' });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => { setLoading(true); const { data } = await supabase.from('marketplace_vendors').select('*').order('created_at', { ascending: false }); setVendors((data as any[]) || []); setLoading(false); };
  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!form.name) { toast.error(es ? 'Nombre requerido' : 'Name required'); return; }
    setSaving(true);
    const payload = { name: form.name, description: form.description || null, website: form.website || null, phone: form.phone || null, location: form.location || null, logo_url: form.logo_url || null, status: form.status };
    if (editingId) await supabase.from('marketplace_vendors').update(payload as any).eq('id', editingId);
    else await supabase.from('marketplace_vendors').insert(payload as any);
    setSaving(false); setDialogOpen(false); fetchData(); toast.success(es ? 'Guardado' : 'Saved');
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('marketplace_vendors').update({ status } as any).eq('id', id);
    fetchData(); toast.success(es ? 'Estado actualizado' : 'Status updated');
  };

  const handleDelete = async (id: string) => {
    if (!confirm(es ? '¿Eliminar?' : 'Delete?')) return;
    await supabase.from('marketplace_vendors').delete().eq('id', id);
    fetchData(); toast.success(es ? 'Eliminado' : 'Deleted');
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setEditingId(null); setForm({ name: '', description: '', website: '', phone: '', location: '', logo_url: '', status: 'approved' }); setDialogOpen(true); }} className="gap-1.5"><Plus className="w-4 h-4" /> {es ? 'Agregar Proveedor' : 'Add Vendor'}</Button>
      </div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <div className="space-y-2">
          {vendors.map(v => (
            <Card key={v.id}><CardContent className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">{v.logo_url ? <img src={v.logo_url} alt={v.name} className="w-full h-full object-cover rounded-lg" /> : v.name.slice(0, 2).toUpperCase()}</div>
              <div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{v.name}</p><p className="text-xs text-muted-foreground truncate">{v.location || v.website || ''}</p></div>
              <Badge variant={v.status === 'approved' ? 'default' : v.status === 'pending' ? 'secondary' : 'destructive'} className="text-[10px]">{v.status}</Badge>
              {v.status === 'pending' && (<><Button variant="ghost" size="icon" onClick={() => updateStatus(v.id, 'approved')}><Check className="w-4 h-4 text-success" /></Button><Button variant="ghost" size="icon" onClick={() => updateStatus(v.id, 'rejected')}><X className="w-4 h-4 text-destructive" /></Button></>)}
              <Button variant="ghost" size="icon" onClick={() => { setEditingId(v.id); setForm({ name: v.name, description: v.description || '', website: v.website || '', phone: v.phone || '', location: v.location || '', logo_url: v.logo_url || '', status: v.status }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </CardContent></Card>
          ))}
          {vendors.length === 0 && <p className="text-center text-muted-foreground py-8">{es ? 'Sin proveedores' : 'No vendors'}</p>}
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? (es ? 'Editar Proveedor' : 'Edit Vendor') : (es ? 'Nuevo Proveedor' : 'New Vendor')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{es ? 'Nombre' : 'Name'} *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>{es ? 'Descripción' : 'Description'}</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{es ? 'Sitio Web' : 'Website'}</Label><Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} /></div>
              <div><Label>{es ? 'Teléfono' : 'Phone'}</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div><Label>{es ? 'Ubicación' : 'Location'}</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
            <div><Label>Logo URL</Label><Input value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} /></div>
            <div><Label>{es ? 'Estado' : 'Status'}</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="approved">{es ? 'Aprobado' : 'Approved'}</SelectItem><SelectItem value="pending">{es ? 'Pendiente' : 'Pending'}</SelectItem><SelectItem value="rejected">{es ? 'Rechazado' : 'Rejected'}</SelectItem></SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (es ? 'Guardar' : 'Save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =================== CATEGORIES TAB =================== */
function CategoriesTab({ es }: { es: boolean }) {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name_es: '', name_en: '', icon: 'Package', sort_order: '0', is_active: true });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => { setLoading(true); const { data } = await supabase.from('marketplace_categories').select('*').order('sort_order'); setCategories((data as any[]) || []); setLoading(false); };
  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!form.name_es || !form.name_en) { toast.error(es ? 'Nombres requeridos' : 'Names required'); return; }
    setSaving(true);
    const payload = { name_es: form.name_es, name_en: form.name_en, icon: form.icon, sort_order: parseInt(form.sort_order) || 0, is_active: form.is_active };
    if (editingId) await supabase.from('marketplace_categories').update(payload as any).eq('id', editingId);
    else await supabase.from('marketplace_categories').insert(payload as any);
    setSaving(false); setDialogOpen(false); fetchData(); toast.success(es ? 'Guardado' : 'Saved');
  };

  const handleDelete = async (id: string) => {
    if (!confirm(es ? '¿Eliminar?' : 'Delete?')) return;
    await supabase.from('marketplace_categories').delete().eq('id', id);
    fetchData();
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setEditingId(null); setForm({ name_es: '', name_en: '', icon: 'Package', sort_order: '0', is_active: true }); setDialogOpen(true); }} className="gap-1.5"><Plus className="w-4 h-4" /> {es ? 'Agregar Categoría' : 'Add Category'}</Button>
      </div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <div className="space-y-2">
          {categories.map(c => (
            <Card key={c.id}><CardContent className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold">{c.sort_order}</div>
              <div className="flex-1"><p className="font-medium text-sm">{es ? c.name_es : c.name_en}</p><p className="text-xs text-muted-foreground">{c.icon}</p></div>
              <Badge variant={c.is_active ? 'default' : 'secondary'} className="text-[10px]">{c.is_active ? (es ? 'Activo' : 'Active') : (es ? 'Inactivo' : 'Inactive')}</Badge>
              <Button variant="ghost" size="icon" onClick={() => { setEditingId(c.id); setForm({ name_es: c.name_es, name_en: c.name_en, icon: c.icon, sort_order: c.sort_order.toString(), is_active: c.is_active }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </CardContent></Card>
          ))}
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingId ? (es ? 'Editar Categoría' : 'Edit Category') : (es ? 'Nueva Categoría' : 'New Category')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{es ? 'Nombre (ES)' : 'Name (ES)'} *</Label><Input value={form.name_es} onChange={e => setForm(f => ({ ...f, name_es: e.target.value }))} /></div>
            <div><Label>{es ? 'Nombre (EN)' : 'Name (EN)'} *</Label><Input value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{es ? 'Ícono' : 'Icon'}</Label><Input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} /></div>
              <div><Label>{es ? 'Orden' : 'Order'}</Label><Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label>{es ? 'Activo' : 'Active'}</Label></div>
            <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (es ? 'Guardar' : 'Save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =================== ORDERS TAB =================== */
function OrdersTab({ es }: { es: boolean }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    // Split query: no hay FK declarada entre marketplace_orders.buyer_id y
    // profiles.id, así que PostgREST no puede auto-join. Si lo intentamos en
    // una sola query, falla con PGRST200 y devuelve vacío → admin no ve pedidos.
    const { data: rawOrders, error: ordersErr } = await supabase
      .from('marketplace_orders')
      .select('*, marketplace_products(name, image_url), marketplace_vendors(name)')
      .order('created_at', { ascending: false });
    if (ordersErr) {
      console.error('orders fetch error', ordersErr);
      toast.error(es ? 'Error cargando pedidos' : 'Error loading orders');
      setOrders([]); setLoading(false); return;
    }
    const ordersArr: any[] = (rawOrders as any[]) || [];
    const buyerIds = Array.from(new Set(ordersArr.map(o => o.buyer_id).filter(Boolean)));
    let profilesMap: Record<string, { name: string; email: string }> = {};
    if (buyerIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', buyerIds);
      (profs || []).forEach((p: any) => { profilesMap[p.id] = { name: p.name || '', email: p.email || '' }; });
    }
    const merged = ordersArr.map(o => ({ ...o, profiles: profilesMap[o.buyer_id] || null }));
    setOrders(merged); setLoading(false);
  };
  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (o.marketplace_products?.name || '').toLowerCase().includes(s)
          || (o.profiles?.name || '').toLowerCase().includes(s)
          || (o.profiles?.email || '').toLowerCase().includes(s);
      }
      return true;
    });
  }, [orders, statusFilter, search]);

  const stats = useMemo(() => {
    const paid = orders.filter(o => o.status !== 'pending' && o.status !== 'cancelled');
    const revenue = paid.reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const today = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()).length;
    const pending = orders.filter(o => o.status === 'paid').length;
    const avg = paid.length > 0 ? revenue / paid.length : 0;
    return { revenue, today, pending, avg };
  }, [orders]);

  // Días de envío estimados por estado (zona) — persistencia en localStorage para
  // que admin pueda customizar sin tocar DB. Default 3 días en todo MX.
  const [deliveryDaysByZone, setDeliveryDaysByZone] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('mm_delivery_days_by_zone') || '{}'); } catch { return {}; }
  });
  const getDefaultDays = (city?: string, state?: string) => {
    const key = (state || city || '').toLowerCase().trim();
    return deliveryDaysByZone[key] ?? 3;
  };
  const saveZoneDays = (zoneKey: string, days: number) => {
    const next = { ...deliveryDaysByZone, [zoneKey.toLowerCase().trim()]: days };
    setDeliveryDaysByZone(next);
    localStorage.setItem('mm_delivery_days_by_zone', JSON.stringify(next));
  };

  // Estado por-row para el dialog de despachar
  const [dispatchDialog, setDispatchDialog] = useState<{ orderId: string | null; days: number; tracking: string; carrier: string }>({ orderId: null, days: 3, tracking: '', carrier: '' });

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    const updates: any = { status };
    if (status === 'shipped') updates.shipped_at = new Date().toISOString();
    if (status === 'delivered') updates.delivered_at = new Date().toISOString();

    await supabase.from('marketplace_orders').update(updates).eq('id', id);

    // Send email notification for shipped/delivered
    if (status === 'shipped' || status === 'delivered') {
      const order = orders.find(o => o.id === id);
      if (order?.profiles?.email) {
        try {
          await supabase.functions.invoke('send-purchase-email', {
            body: {
              email: order.profiles.email,
              name: order.profiles.name || 'Usuario',
              productName: order.marketplace_products?.name || 'Producto',
              amount: Number(order.total_amount),
              currency: 'MXN',
              orderId: id,
              type: status,
              trackingNumber: trackingInput[id] || order.tracking_number || undefined,
            },
          });
          toast.success(es ? `Correo de "${status}" enviado al comprador` : `"${status}" email sent to buyer`);
        } catch (e) {
          console.error('Email send error:', e);
        }
      }
    }

    fetchData();
    setUpdatingId(null);
    toast.success(es ? 'Estado actualizado' : 'Status updated');
  };

  const saveTracking = async (id: string) => {
    const val = trackingInput[id];
    if (!val) return;
    await supabase.from('marketplace_orders').update({ tracking_number: val } as any).eq('id', id);
    fetchData();
    toast.success(es ? 'Número de rastreo guardado' : 'Tracking number saved');
  };

  // Despacho con confirmación + tracking + ETA + email + notificación in-app
  const confirmDispatch = async () => {
    const id = dispatchDialog.orderId;
    if (!id) return;
    const order = orders.find(o => o.id === id);
    if (!order) return;
    setUpdatingId(id);

    const eta = new Date();
    eta.setDate(eta.getDate() + (dispatchDialog.days || 3));
    const etaISO = eta.toISOString().slice(0, 10);

    const updates: any = {
      status: 'shipped',
      shipped_at: new Date().toISOString(),
      estimated_delivery: etaISO,
      tracking_number: dispatchDialog.tracking || order.tracking_number || null,
    };

    await supabase.from('marketplace_orders').update(updates).eq('id', id);

    // Persistir días para la zona si el admin los cambió
    const zone = order.shipping_state || order.shipping_city;
    if (zone) saveZoneDays(zone, dispatchDialog.days || 3);

    // Email + notificación in-app
    if (order.profiles?.email) {
      try {
        await supabase.functions.invoke('send-purchase-email', {
          body: {
            email: order.profiles.email,
            name: order.profiles.name || 'Usuario',
            productName: order.marketplace_products?.name || 'Producto',
            amount: Number(order.total_amount),
            currency: 'MXN',
            orderId: id,
            type: 'shipped',
            trackingNumber: updates.tracking_number || undefined,
            shippingCity: order.shipping_city || undefined,
          },
        });
      } catch (e) {
        console.error('Email send error:', e);
      }
    }
    if (order.buyer_id) {
      try {
        await supabase.from('notifications').insert({
          user_id: order.buyer_id,
          type: 'system' as any,
          title: '📦 Tu pedido fue enviado',
          message: `Tu pedido "${order.marketplace_products?.name || 'producto'}" salió. Llegada estimada: ${eta.toLocaleDateString('es-MX')}${dispatchDialog.tracking ? ` · Tracking: ${dispatchDialog.tracking}` : ''}.`,
          data: { order_id: id, type: 'order_shipped', tracking: dispatchDialog.tracking || null, eta: etaISO },
        });
      } catch (e) {
        console.error('Notification insert error:', e);
      }
    }

    setDispatchDialog({ orderId: null, days: 3, tracking: '', carrier: '' });
    fetchData();
    setUpdatingId(null);
    toast.success(es ? `Pedido despachado · ETA ${eta.toLocaleDateString('es-MX')}` : `Order dispatched · ETA ${eta.toLocaleDateString('es-MX')}`);
  };

  const openDispatch = (order: any) => {
    const days = getDefaultDays(order.shipping_city, order.shipping_state);
    setDispatchDialog({
      orderId: order.id,
      days,
      tracking: order.tracking_number || trackingInput[order.id] || '',
      carrier: '',
    });
  };

  // PDF: imprime una ventana nueva con el detalle del pedido y dispara print
  const printOrderPDF = (o: any) => {
    const eta = o.estimated_delivery ? new Date(o.estimated_delivery).toLocaleDateString('es-MX') : '—';
    const created = new Date(o.created_at).toLocaleString('es-MX');
    const html = `
<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Pedido #${o.id.slice(0,8).toUpperCase()} — Medical Masters</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#163A83;padding:24px;max-width:780px;margin:0 auto}
  h1{color:#00768B;margin:0 0 4px}
  .muted{color:#64748b;font-size:12px}
  .box{border:1.5px solid #00768B33;border-radius:10px;padding:14px;margin:14px 0;background:#fff}
  .box h2{margin:0 0 8px;font-size:13px;color:#00768B;text-transform:uppercase;letter-spacing:.5px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  td{padding:6px 0;border-bottom:1px solid #00768B14}
  td:last-child{text-align:right;font-weight:600}
  .total{font-size:18px;color:#00768B;font-weight:700}
  .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;background:#00768B;color:#fff}
  @media print{ body{padding:8px} button{display:none} }
</style></head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <h1>Medical Masters</h1>
      <div class="muted">Pedido #${o.id.slice(0,8).toUpperCase()}</div>
      <div class="muted">Generado: ${created}</div>
    </div>
    <div style="text-align:right">
      <span class="badge">${(o.status || '').toUpperCase()}</span>
      <div class="muted" style="margin-top:6px">ETA: <strong>${eta}</strong></div>
      ${o.tracking_number ? `<div class="muted">Tracking: <strong>${o.tracking_number}</strong></div>` : ''}
    </div>
  </div>
  <div class="box">
    <h2>Comprador</h2>
    <div><strong>${(o.profiles?.name || o.shipping_name || '—').replace(/</g,'&lt;')}</strong></div>
    <div class="muted">${(o.profiles?.email || '').replace(/</g,'&lt;')}</div>
  </div>
  <div class="box">
    <h2>Dirección de envío</h2>
    <div><strong>${(o.shipping_name || '—').replace(/</g,'&lt;')}</strong></div>
    <div class="muted">${(o.shipping_phone || '').replace(/</g,'&lt;')}</div>
    <div>${[o.shipping_city, o.shipping_state, o.shipping_zip].filter(Boolean).join(', ').replace(/</g,'&lt;') || '—'}</div>
    ${o.shipping_notes ? `<div class="muted" style="margin-top:6px">📝 ${String(o.shipping_notes).replace(/</g,'&lt;')}</div>` : ''}
  </div>
  <div class="box">
    <h2>Producto</h2>
    <table>
      <tr><td>${(o.marketplace_products?.name || '—').replace(/</g,'&lt;')}</td><td>×${o.quantity}</td></tr>
      <tr><td class="muted">Subtotal</td><td>$${Number(o.total_amount - (o.delivery_fee || 0)).toLocaleString('es-MX')}</td></tr>
      ${o.delivery_fee ? `<tr><td class="muted">Envío</td><td>$${Number(o.delivery_fee).toLocaleString('es-MX')}</td></tr>` : ''}
      <tr><td class="total">Total</td><td class="total">$${Number(o.total_amount).toLocaleString('es-MX')} MXN</td></tr>
    </table>
  </div>
  <div class="box">
    <h2>Proveedor</h2>
    <div>${(o.marketplace_vendors?.name || '—').replace(/</g,'&lt;')}</div>
  </div>
  <div class="muted" style="margin-top:24px;text-align:center;font-size:11px">
    Este documento es la guía de pedido oficial de Medical Masters. Imprime esta página con Ctrl/Cmd + P y elige "Guardar como PDF".
  </div>
  <button style="margin-top:16px;background:#00768B;color:#fff;border:0;padding:10px 16px;border-radius:8px;cursor:pointer;font-weight:600" onclick="window.print()">Imprimir / Guardar PDF</button>
</body></html>`;
    const win = window.open('', '_blank', 'width=820,height=900');
    if (!win) { toast.error(es ? 'Permite ventanas emergentes para descargar el PDF' : 'Allow popups to download the PDF'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { try { win.print(); } catch {} }, 500);
  };

  const exportCSV = () => {
    const rows = [['Fecha', 'Producto', 'Comprador', 'Email', 'Cantidad', 'Total', 'Envío', 'Status', 'Ciudad', 'Tracking'].join(',')];
    filtered.forEach(o => {
      rows.push([
        new Date(o.created_at).toLocaleDateString(),
        `"${o.marketplace_products?.name || ''}"`,
        `"${o.profiles?.name || ''}"`,
        o.profiles?.email || '',
        o.quantity, o.total_amount, o.delivery_fee || 0,
        o.status, o.shipping_city || '', o.tracking_number || ''
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(es ? 'CSV exportado' : 'CSV exported');
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-warning/15 text-warning border border-warning/30',
    paid: 'bg-primary/15 text-primary border border-primary/30',
    shipped: 'bg-secondary/15 text-secondary border border-secondary/30',
    delivered: 'bg-success/15 text-success border border-success/30',
    cancelled: 'bg-destructive/15 text-destructive border border-destructive/30',
  };

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Card><CardContent className="p-4 text-center">
          <DollarSign className="w-5 h-5 text-success mx-auto mb-1" />
          <p className="text-lg font-bold">${stats.revenue.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">{es ? 'Ingresos totales' : 'Total Revenue'}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <ShoppingCart className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-lg font-bold">{stats.today}</p>
          <p className="text-[10px] text-muted-foreground">{es ? 'Pedidos hoy' : 'Orders Today'}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Package className="w-5 h-5 text-warning mx-auto mb-1" />
          <p className="text-lg font-bold">{stats.pending}</p>
          <p className="text-[10px] text-muted-foreground">{es ? 'Por enviar' : 'Pending Ship'}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <BarChart3 className="w-5 h-5 text-secondary mx-auto mb-1" />
          <p className="text-lg font-bold">${Math.round(stats.avg).toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">{es ? 'Promedio pedido' : 'Avg Order'}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1 flex-1">
          {['all', 'pending', 'paid', 'shipped', 'delivered', 'cancelled'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all ${
                statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              {s === 'all' ? (es ? 'Todos' : 'All') : s.charAt(0).toUpperCase() + s.slice(1)}
              <span className="ml-1 opacity-60">({s === 'all' ? orders.length : orders.filter(o => o.status === s).length})</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder={es ? 'Buscar...' : 'Search...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} className="h-8 text-xs gap-1"><Download className="w-3.5 h-3.5" /> CSV</Button>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">{es ? 'No hay pedidos' : 'No orders'}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(o => {
            const expanded = expandedId === o.id;
            return (
              <Card key={o.id} className={expanded ? 'ring-1 ring-border shadow-md' : ''}>
                <CardContent className="p-0">
                  <button onClick={() => setExpandedId(expanded ? null : o.id)} className="w-full flex items-center gap-3 p-3 text-left">
                    {o.marketplace_products?.image_url && <img src={o.marketplace_products.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{o.marketplace_products?.name || 'Producto eliminado'}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {o.profiles?.name || 'Anónimo'} · {es ? 'Cant' : 'Qty'}: {o.quantity} · ${Number(o.total_amount).toLocaleString()} · {new Date(o.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[o.status] || ''}`}>{o.status}</span>
                    {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>

                  {expanded && (
                    <div className="px-3 pb-4 space-y-3 border-t pt-3 animate-in fade-in duration-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Buyer info */}
                        <div className="bg-primary/8 border border-primary/25 rounded-lg p-3 space-y-1">
                          <p className="text-xs font-semibold text-primary flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {es ? 'Comprador' : 'Buyer'}</p>
                          <p className="text-sm text-secondary font-medium">{o.profiles?.name || 'N/A'}</p>
                          {o.profiles?.email && <p className="text-xs text-secondary/70 flex items-center gap-1 break-all"><Mail className="w-3 h-3 flex-shrink-0" /> {o.profiles.email}</p>}
                        </div>

                        {/* Shipping info */}
                        {(o.shipping_name || o.shipping_city) ? (
                          <div className="bg-secondary/8 border border-secondary/25 rounded-lg p-3 space-y-1">
                            <p className="text-xs font-semibold text-secondary flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {es ? 'Dirección de envío' : 'Shipping address'}</p>
                            {o.shipping_name && <p className="text-sm text-secondary font-medium">{o.shipping_name}</p>}
                            {o.shipping_phone && <p className="text-xs text-secondary/70 flex items-center gap-1"><Phone className="w-3 h-3" /> {o.shipping_phone}</p>}
                            <p className="text-xs text-secondary/70">{[o.shipping_city, o.shipping_state, o.shipping_zip].filter(Boolean).join(', ') || '—'}</p>
                            {o.shipping_notes && <p className="text-xs text-secondary/60 italic">📝 {o.shipping_notes}</p>}
                          </div>
                        ) : (
                          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-xs text-warning">
                            ⚠ {es ? 'Sin dirección de envío registrada' : 'No shipping address on file'}
                          </div>
                        )}
                      </div>

                      {/* Acciones principales por status */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => printOrderPDF(o)}
                          className="h-9 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
                        >
                          <FileText className="w-3.5 h-3.5" /> {es ? 'Descargar PDF' : 'Download PDF'}
                        </Button>

                        {o.status === 'paid' && (
                          <Button
                            size="sm"
                            onClick={() => openDispatch(o)}
                            disabled={updatingId === o.id}
                            className="h-9 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow"
                          >
                            <Truck className="w-3.5 h-3.5" /> {es ? 'Despachar ahora' : 'Dispatch now'}
                          </Button>
                        )}

                        {o.status === 'shipped' && (
                          <Button
                            size="sm"
                            onClick={() => updateStatus(o.id, 'delivered')}
                            disabled={updatingId === o.id}
                            className="h-9 text-xs gap-1.5 bg-secondary text-primary-foreground hover:bg-secondary/90"
                          >
                            <Check className="w-3.5 h-3.5" /> {es ? 'Marcar entregado' : 'Mark delivered'}
                          </Button>
                        )}

                        {o.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(o.id, 'paid')}
                            disabled={updatingId === o.id}
                            className="h-9 text-xs gap-1.5"
                          >
                            <DollarSign className="w-3.5 h-3.5" /> {es ? 'Marcar pagado' : 'Mark paid'}
                          </Button>
                        )}

                        {/* Status override avanzado */}
                        <div className="flex items-center gap-2 ml-auto">
                          <Label className="text-xs text-secondary/70">{es ? 'Estado:' : 'Status:'}</Label>
                          <Select value={o.status} onValueChange={v => updateStatus(o.id, v)}>
                            <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {['pending', 'paid', 'shipped', 'delivered', 'cancelled'].map(s => (
                                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {updatingId === o.id && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                        </div>
                      </div>

                      {/* Tracking number (siempre editable, también después de despachar) */}
                      <div className="flex gap-2 items-center">
                        <Label className="text-xs text-secondary/70 whitespace-nowrap">{es ? 'Tracking:' : 'Tracking:'}</Label>
                        <Input
                          placeholder={es ? 'Número de guía...' : 'Tracking #...'}
                          value={trackingInput[o.id] ?? o.tracking_number ?? ''}
                          onChange={e => setTrackingInput(p => ({ ...p, [o.id]: e.target.value }))}
                          className="h-8 text-xs flex-1"
                        />
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => saveTracking(o.id)}>
                          <Truck className="w-3.5 h-3.5 mr-1" /> {es ? 'Guardar' : 'Save'}
                        </Button>
                      </div>

                      {/* Timestamps */}
                      <div className="text-[10px] text-secondary/60 space-y-0.5 pt-2 border-t border-primary/15">
                        <p>🕒 {es ? 'Creado' : 'Created'}: {new Date(o.created_at).toLocaleString('es-MX')}</p>
                        {o.paid_at && <p>✅ {es ? 'Pagado' : 'Paid'}: {new Date(o.paid_at).toLocaleString('es-MX')}</p>}
                        {o.shipped_at && <p>📦 {es ? 'Enviado' : 'Shipped'}: {new Date(o.shipped_at).toLocaleString('es-MX')}</p>}
                        {o.estimated_delivery && <p>🚚 {es ? 'Llegada estimada' : 'ETA'}: {new Date(o.estimated_delivery).toLocaleDateString('es-MX')}</p>}
                        {o.delivered_at && <p>🎉 {es ? 'Entregado' : 'Delivered'}: {new Date(o.delivered_at).toLocaleString('es-MX')}</p>}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dispatch confirmation dialog */}
      <Dialog open={!!dispatchDialog.orderId} onOpenChange={(open) => !open && setDispatchDialog({ orderId: null, days: 3, tracking: '', carrier: '' })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-secondary">
              <Truck className="w-5 h-5 text-primary" />
              {es ? 'Despachar pedido' : 'Dispatch order'}
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const o = orders.find(x => x.id === dispatchDialog.orderId);
            if (!o) return null;
            return (
              <div className="space-y-4">
                <div className="bg-primary/8 border border-primary/25 rounded-lg p-3">
                  <p className="text-xs font-semibold text-primary mb-1">{o.marketplace_products?.name || 'Producto'}</p>
                  <p className="text-xs text-secondary/70">
                    {o.shipping_name || o.profiles?.name || 'Sin destinatario'}
                    {o.shipping_city ? ` · ${o.shipping_city}` : ''}
                    {o.shipping_state ? `, ${o.shipping_state}` : ''}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{es ? 'Llegará al comprador en (días)' : 'Will arrive in (days)'}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={dispatchDialog.days}
                      onChange={(e) => setDispatchDialog(d => ({ ...d, days: Number(e.target.value) || 1 }))}
                      className="h-9 text-sm w-24"
                    />
                    <div className="flex gap-1 flex-wrap">
                      {[1, 2, 3, 5, 7, 10].map(d => (
                        <Button key={d} type="button" size="sm" variant={dispatchDialog.days === d ? 'default' : 'outline'} className="h-7 text-[11px] px-2.5" onClick={() => setDispatchDialog(s => ({ ...s, days: d }))}>
                          {d}d
                        </Button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-secondary/60">
                    {es
                      ? `ETA: ${new Date(Date.now() + (dispatchDialog.days || 0) * 86400000).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}. Se guarda como default para esta zona (${o.shipping_state || o.shipping_city || 'sin zona'}).`
                      : `ETA: ${new Date(Date.now() + (dispatchDialog.days || 0) * 86400000).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}.`}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{es ? 'Número de guía / tracking (opcional)' : 'Tracking number (optional)'}</Label>
                  <Input
                    placeholder="Ej: ESTAFETA-1234567"
                    value={dispatchDialog.tracking}
                    onChange={(e) => setDispatchDialog(d => ({ ...d, tracking: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="bg-secondary/8 border border-secondary/25 rounded-lg p-3 text-xs text-secondary/80">
                  <p className="font-semibold mb-1 text-secondary flex items-center gap-1"><Send className="w-3 h-3" /> {es ? 'Al confirmar:' : 'On confirm:'}</p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    <li>{es ? 'Estado → enviado, ETA registrada' : 'Status → shipped, ETA logged'}</li>
                    <li>{es ? 'Email al comprador con tracking' : 'Email to buyer with tracking'}</li>
                    <li>{es ? 'Notificación in-app al comprador' : 'In-app notification to buyer'}</li>
                  </ul>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" onClick={() => setDispatchDialog({ orderId: null, days: 3, tracking: '', carrier: '' })} disabled={updatingId === o.id}>
                    {es ? 'Cancelar' : 'Cancel'}
                  </Button>
                  <Button onClick={confirmDispatch} disabled={updatingId === o.id} className="gap-1.5">
                    {updatingId === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {es ? 'Confirmar despacho' : 'Confirm dispatch'}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =================== SALES / ACCOUNTING TAB =================== */
function SalesTab({ es }: { es: boolean }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('marketplace_orders')
        .select('*, marketplace_products(name, category), marketplace_vendors(name)')
        .neq('status', 'pending')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });
      setOrders((data as any[]) || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const stats = useMemo(() => {
    const totalRevenue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const totalUnits = orders.reduce((s, o) => s + Number(o.quantity || 1), 0);
    const buyerIds = new Set(orders.map(o => o.buyer_id));
    const avg = orders.length > 0 ? totalRevenue / orders.length : 0;
    return { totalRevenue, totalUnits, uniqueBuyers: buyerIds.size, avg };
  }, [orders]);

  const vendorBreakdown = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; units: number; orders: number }> = {};
    orders.forEach(o => {
      const vid = o.vendor_id;
      if (!map[vid]) map[vid] = { name: o.marketplace_vendors?.name || 'N/A', revenue: 0, units: 0, orders: 0 };
      map[vid].revenue += Number(o.total_amount || 0);
      map[vid].units += Number(o.quantity || 1);
      map[vid].orders += 1;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; units: number }> = {};
    orders.forEach(o => {
      const pid = o.product_id;
      if (!map[pid]) map[pid] = { name: o.marketplace_products?.name || 'N/A', revenue: 0, units: 0 };
      map[pid].revenue += Number(o.total_amount || 0);
      map[pid].units += Number(o.quantity || 1);
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [orders]);

  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach(o => {
      const key = new Date(o.created_at).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
      map[key] = (map[key] || 0) + Number(o.total_amount || 0);
    });
    return Object.entries(map).map(([month, revenue]) => ({ month, revenue })).reverse();
  }, [orders]);

  const statusBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach(o => { map[o.status] = (map[o.status] || 0) + 1; });
    return Object.entries(map).map(([status, count]) => ({ status, count }));
  }, [orders]);

  const exportAccounting = () => {
    const rows = [['Fecha', 'Producto', 'Proveedor', 'Categoría', 'Cantidad', 'Total (MXN)', 'Status'].join(',')];
    orders.forEach(o => {
      rows.push([
        new Date(o.created_at).toLocaleDateString(),
        `"${o.marketplace_products?.name || ''}"`,
        `"${o.marketplace_vendors?.name || ''}"`,
        `"${o.marketplace_products?.category || ''}"`,
        o.quantity, o.total_amount, o.status
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `sales-report-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(es ? 'Reporte exportado' : 'Report exported');
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <DollarSign className="w-5 h-5 text-success mx-auto mb-1" />
          <p className="text-xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">{es ? 'Ventas totales' : 'Total Sales'}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Package className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-xl font-bold">{stats.totalUnits}</p>
          <p className="text-[10px] text-muted-foreground">{es ? 'Unidades vendidas' : 'Units Sold'}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Users className="w-5 h-5 text-secondary mx-auto mb-1" />
          <p className="text-xl font-bold">{stats.uniqueBuyers}</p>
          <p className="text-[10px] text-muted-foreground">{es ? 'Compradores' : 'Buyers'}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <BarChart3 className="w-5 h-5 text-warning mx-auto mb-1" />
          <p className="text-xl font-bold">${Math.round(stats.avg).toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">{es ? 'Promedio' : 'Avg Order'}</p>
        </CardContent></Card>
      </div>

      {/* Monthly chart */}
      {monthlyData.length > 1 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-3">{es ? 'Tendencia de Ventas' : 'Sales Trend'}</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, es ? 'Ingresos' : 'Revenue']} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vendor breakdown */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">{es ? 'Ventas por Proveedor' : 'Sales by Vendor'}</p>
            <Button variant="outline" size="sm" onClick={exportAccounting} className="h-7 text-xs gap-1"><Download className="w-3 h-3" /> {es ? 'Exportar' : 'Export'}</Button>
          </div>
          <div className="space-y-2">
            {vendorBreakdown.map((v, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{v.name}</p>
                  <p className="text-[10px] text-muted-foreground">{v.orders} {es ? 'pedidos' : 'orders'} · {v.units} {es ? 'unidades' : 'units'}</p>
                </div>
                <p className="text-sm font-bold text-primary">${v.revenue.toLocaleString()}</p>
              </div>
            ))}
            {vendorBreakdown.length === 0 && <p className="text-center text-muted-foreground py-4">{es ? 'Sin datos' : 'No data'}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Top products */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-semibold mb-3">{es ? 'Top 10 Productos' : 'Top 10 Products'}</p>
          <div className="space-y-2">
            {topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                <span className="text-xs font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{p.units} {es ? 'unidades' : 'units'}</p>
                </div>
                <p className="text-sm font-bold text-primary">${p.revenue.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Status breakdown */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-semibold mb-3">{es ? 'Por Estado' : 'By Status'}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {statusBreakdown.map(s => (
              <div key={s.status} className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-lg font-bold">{s.count}</p>
                <p className="text-xs text-muted-foreground capitalize">{s.status}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


/* =================== REFUNDS TAB =================== */
function RefundsTab({ es }: { es: boolean }) {
  const [refunds, setRefunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('requested');
  const [selected, setSelected] = useState<any>(null);
  const [actionDialog, setActionDialog] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');
  const [rejection, setRejection] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    let q = (supabase as any).from('order_refunds').select('*, marketplace_orders(id, total_amount, currency, buyer_id, vendor_id, product_id, marketplace_vendors(name), marketplace_products(name))').order('created_at', { ascending: false }).limit(100);
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data, error } = await q;
    if (error) { toast.error(error.message); setLoading(false); return; }
    setRefunds(data || []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, [statusFilter]);

  const handleAction = async () => {
    if (!selected || !actionDialog) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('process-marketplace-refund', {
      body: { refundId: selected.id, action: actionDialog, adminNotes: notes, rejectionReason: rejection },
    });
    setBusy(false);
    if (error || !data?.ok) { toast.error(error?.message || data?.error || 'Error'); return; }
    toast.success(actionDialog === 'approve' ? (es ? 'Reembolso aprobado' : 'Refund approved') : (es ? 'Reembolso rechazado' : 'Refund rejected'));
    setActionDialog(null); setSelected(null); setNotes(''); setRejection(''); fetchData();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{es ? 'Todos' : 'All'}</SelectItem>
            <SelectItem value="requested">{es ? 'Solicitados' : 'Requested'}</SelectItem>
            <SelectItem value="approved">{es ? 'Aprobados' : 'Approved'}</SelectItem>
            <SelectItem value="rejected">{es ? 'Rechazados' : 'Rejected'}</SelectItem>
            <SelectItem value="refunded">{es ? 'Reembolsados' : 'Refunded'}</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={fetchData} disabled={loading}>{es ? 'Actualizar' : 'Refresh'}</Button>
      </div>

      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : refunds.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">{es ? 'Sin devoluciones' : 'No refunds'}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {refunds.map(r => (
            <Card key={r.id} className="hover:shadow-md transition">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={r.status === 'refunded' ? 'verified' : r.status === 'requested' ? 'secondary' : r.status === 'rejected' ? 'destructive' : 'outline'}>{r.status}</Badge>
                      <span className="text-xs text-muted-foreground">#{r.id.slice(0,8)} · {new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm font-medium mt-1 line-clamp-2">{r.marketplace_orders?.marketplace_products?.name || '—'}</p>
                    <p className="text-xs text-muted-foreground">{r.marketplace_orders?.marketplace_vendors?.name || '—'} · <span className="capitalize">{r.reason_category}</span></p>
                    <p className="text-xs mt-1 line-clamp-2"><strong>{es ? 'Motivo' : 'Reason'}:</strong> {r.reason}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{Number(r.amount).toFixed(2)} {r.currency}</p>
                    {r.status === 'requested' && (
                      <div className="flex gap-1 mt-2">
                        <Button size="sm" variant="default" onClick={() => { setSelected(r); setActionDialog('approve'); }}>{es ? 'Aprobar' : 'Approve'}</Button>
                        <Button size="sm" variant="destructive" onClick={() => { setSelected(r); setActionDialog('reject'); }}>{es ? 'Rechazar' : 'Reject'}</Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!actionDialog} onOpenChange={(o) => { if (!o) { setActionDialog(null); setSelected(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{actionDialog === 'approve' ? (es ? 'Aprobar devolución' : 'Approve refund') : (es ? 'Rechazar devolución' : 'Reject refund')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{selected && `${Number(selected.amount).toFixed(2)} ${selected.currency} — ${selected.marketplace_orders?.marketplace_products?.name || '—'}`}</p>
            {actionDialog === 'reject' && (
              <div>
                <Label className="text-xs">{es ? 'Razón del rechazo (visible al paciente)' : 'Rejection reason (visible to patient)'}</Label>
                <Textarea value={rejection} onChange={e => setRejection(e.target.value)} rows={3} />
              </div>
            )}
            <div>
              <Label className="text-xs">{es ? 'Notas internas' : 'Internal notes'}</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setActionDialog(null)}>{es ? 'Cancelar' : 'Cancel'}</Button>
              <Button onClick={handleAction} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (actionDialog === 'approve' ? (es ? 'Aprobar y reembolsar' : 'Approve & refund') : (es ? 'Rechazar' : 'Reject'))}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =================== DISPUTES TAB =================== */
function DisputesTab({ es }: { es: boolean }) {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any).from('order_disputes').select('*, marketplace_orders(id, total_amount, marketplace_vendors(name), marketplace_products(name))').order('created_at', { ascending: false }).limit(100);
      if (error) { toast.error(error.message); setLoading(false); return; }
      setDisputes(data || []);
      setLoading(false);
    })();
  }, []);
  if (loading) return <Loader2 className="w-5 h-5 animate-spin" />;
  if (disputes.length === 0) return <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">{es ? 'Sin disputas activas' : 'No active disputes'}</CardContent></Card>;
  return (
    <div className="space-y-2">
      {disputes.map(d => (
        <Card key={d.id}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={d.status === 'won' ? 'verified' : d.status === 'lost' ? 'destructive' : 'secondary'}>{d.status.replace(/_/g, ' ')}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm font-medium mt-1">{d.marketplace_orders?.marketplace_products?.name || '—'}</p>
                <p className="text-xs text-muted-foreground">{d.marketplace_orders?.marketplace_vendors?.name || '—'} · {d.reason || '—'}</p>
                {d.evidence_due_by && <p className="text-xs text-warning mt-1">{es ? 'Evidencia hasta' : 'Evidence due'} {new Date(d.evidence_due_by).toLocaleDateString()}</p>}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{Number(d.amount).toFixed(2)} {d.currency}</p>
                <a href={`https://dashboard.stripe.com/disputes/${d.stripe_dispute_id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Stripe →</a>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* =================== PAYOUTS TAB =================== */
function PayoutsTab({ es }: { es: boolean }) {
  const [balances, setBalances] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: bals }, { data: payoutHist }] = await Promise.all([
      (supabase as any).rpc('get_vendor_payout_balance'),
      (supabase as any).from('vendor_payouts').select('*, marketplace_vendors(name)').order('initiated_at', { ascending: false }).limit(50),
    ]);
    setBalances(bals || []);
    setPayouts(payoutHist || []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const eligible = balances.filter((b: any) => b.payouts_enabled && b.stripe_account_id && Number(b.available_amount) > 0);

  const handlePayAll = async () => {
    if (!confirm(es ? `¿Pagar ${eligible.length} vendors por un total de ${eligible.reduce((s: number,e: any)=>s+Number(e.available_amount),0).toFixed(2)} MXN?` : `Pay ${eligible.length} vendors?`)) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('process-vendor-payouts', { body: {} });
    setBusy(false);
    if (error || !data?.ok) { toast.error(error?.message || data?.error || 'Error'); return; }
    toast.success(`${data.processed} payouts procesados`);
    fetchData();
  };

  const handlePayOne = async (vendorId: string) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('process-vendor-payouts', { body: { vendorIds: [vendorId] } });
    setBusy(false);
    if (error || !data?.ok) { toast.error(error?.message || data?.error || 'Error'); return; }
    toast.success(es ? 'Payout enviado' : 'Payout sent');
    fetchData();
  };

  if (loading) return <Loader2 className="w-5 h-5 animate-spin" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{es ? 'Balances de vendors' : 'Vendor balances'}</p>
              <p className="text-xs text-muted-foreground">{eligible.length} {es ? 'vendors elegibles' : 'eligible vendors'} · {eligible.reduce((s: number,e: any)=>s+Number(e.available_amount),0).toFixed(2)} MXN {es ? 'disponible' : 'available'}</p>
            </div>
            <Button onClick={handlePayAll} disabled={busy || eligible.length === 0}>
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              {es ? 'Pagar a TODOS los elegibles' : 'Pay ALL eligible'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {balances.map((b: any) => (
          <Card key={b.vendor_id}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate">{b.vendor_name}</p>
                    {b.payouts_enabled ? <Badge variant="verified" className="text-[10px]">Stripe OK</Badge> : <Badge variant="destructive" className="text-[10px]">{es ? 'Sin Stripe' : 'No Stripe'}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{es ? 'Disp.' : 'Avail.'}: <strong className="text-primary">{Number(b.available_amount).toFixed(2)}</strong> · {es ? 'Pend.' : 'Pend.'}: {Number(b.pending_amount).toFixed(2)} · {es ? 'Pagado total' : 'Total paid'}: {Number(b.total_paid).toFixed(2)}</p>
                </div>
                {b.payouts_enabled && Number(b.available_amount) > 0 && (
                  <Button size="sm" variant="outline" onClick={() => handlePayOne(b.vendor_id)} disabled={busy}>
                    {es ? 'Pagar' : 'Pay'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">{es ? 'Historial de pagos' : 'Payout history'}</p>
        <div className="space-y-1.5">
          {payouts.map((p: any) => (
            <Card key={p.id} className="bg-muted/30">
              <CardContent className="p-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{p.marketplace_vendors?.name || '—'}</span>
                  <span className="text-muted-foreground"> · {p.earnings_count} {es ? 'ventas' : 'sales'}</span>
                  <span className="text-muted-foreground"> · {new Date(p.initiated_at).toLocaleDateString()}</span>
                </div>
                <div className="text-right">
                  <p className="font-bold">{Number(p.total_amount).toFixed(2)} {p.currency}</p>
                  <Badge variant={p.status === 'paid' ? 'verified' : p.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px]">{p.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          {payouts.length === 0 && <p className="text-xs text-muted-foreground">{es ? 'Sin payouts aún' : 'No payouts yet'}</p>}
        </div>
      </div>
    </div>
  );
}

/* =================== STOCK TAB =================== */
function StockTab({ es }: { es: boolean }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('low');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any).from('marketplace_products').select('id, name, stock, low_stock_threshold, track_stock, total_sold, is_active, marketplace_vendors(name)').eq('track_stock', true).order('stock', { ascending: true });
      setProducts(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'out') return products.filter(p => p.stock === 0);
    if (filter === 'low') return products.filter(p => p.stock <= (p.low_stock_threshold || 5));
    return products;
  }, [products, filter]);

  if (loading) return <Loader2 className="w-5 h-5 animate-spin" />;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>{es ? 'Todos' : 'All'} ({products.length})</Button>
        <Button size="sm" variant={filter === 'low' ? 'default' : 'outline'} onClick={() => setFilter('low')}>{es ? 'Bajo' : 'Low'}</Button>
        <Button size="sm" variant={filter === 'out' ? 'default' : 'outline'} onClick={() => setFilter('out')}>{es ? 'Agotados' : 'Out'}</Button>
      </div>
      {filtered.length === 0 ? <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">{es ? 'Sin productos en este filtro' : 'No products in this filter'}</CardContent></Card> : (
        <div className="space-y-1.5">
          {filtered.map(p => (
            <Card key={p.id} className={p.stock === 0 ? 'border-destructive' : ''}>
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.marketplace_vendors?.name} · {p.total_sold || 0} {es ? 'vendidos' : 'sold'}</p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${p.stock === 0 ? 'text-destructive' : p.stock <= p.low_stock_threshold ? 'text-warning' : 'text-foreground'}`}>{p.stock}</p>
                  <p className="text-[10px] text-muted-foreground">{es ? 'mín' : 'min'} {p.low_stock_threshold}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* =================== AUDIT TAB =================== */
function AuditTab({ es }: { es: boolean }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from('marketplace_audit_log').select('*, profiles!actor_id(name)').order('created_at', { ascending: false }).limit(200);
      setLogs(data || []);
      setLoading(false);
    })();
  }, []);
  if (loading) return <Loader2 className="w-5 h-5 animate-spin" />;
  if (logs.length === 0) return <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">{es ? 'Sin registros de auditoría' : 'No audit logs'}</CardContent></Card>;
  return (
    <div className="space-y-1">
      {logs.map(l => (
        <Card key={l.id} className="bg-muted/30">
          <CardContent className="p-2.5">
            <div className="flex items-start justify-between gap-2 text-xs">
              <div className="flex-1 min-w-0">
                <span className="font-mono text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{l.action}</span>
                <span className="ml-2 text-muted-foreground">{l.profiles?.name || l.actor_role || (l.actor_id ? l.actor_id.slice(0,8) : 'system')}</span>
                {l.metadata && Object.keys(l.metadata).length > 0 && (
                  <pre className="mt-1 text-[10px] text-muted-foreground whitespace-pre-wrap break-all">{JSON.stringify(l.metadata, null, 0).slice(0, 200)}</pre>
                )}
              </div>
              <span className="text-muted-foreground whitespace-nowrap text-[10px]">{new Date(l.created_at).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
