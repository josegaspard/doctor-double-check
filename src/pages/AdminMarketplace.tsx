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
import { Plus, Pencil, Trash2, Search, Package, Store, Tag, ShoppingCart, Loader2, Check, X, Download, TrendingUp, DollarSign, Users, BarChart3, ChevronDown, ChevronUp, Truck, MapPin, Phone, Mail } from 'lucide-react';
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
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            {es ? 'Marketplace - Material Médico' : 'Marketplace - Medical Supplies'}
          </h1>
          <p className="text-sm text-muted-foreground">{es ? 'Administra productos, proveedores, categorías, pedidos y ventas' : 'Manage products, vendors, categories, orders and sales'}</p>
        </div>

        <Tabs defaultValue="products">
          <TabsList className="w-full grid grid-cols-5 mb-4">
            <TabsTrigger value="products" className="text-xs sm:text-sm gap-1"><Package className="w-3.5 h-3.5 hidden sm:inline" />{es ? 'Productos' : 'Products'}</TabsTrigger>
            <TabsTrigger value="vendors" className="text-xs sm:text-sm gap-1"><Store className="w-3.5 h-3.5 hidden sm:inline" />{es ? 'Proveedores' : 'Vendors'}</TabsTrigger>
            <TabsTrigger value="categories" className="text-xs sm:text-sm gap-1"><Tag className="w-3.5 h-3.5 hidden sm:inline" />{es ? 'Categorías' : 'Categories'}</TabsTrigger>
            <TabsTrigger value="orders" className="text-xs sm:text-sm gap-1"><ShoppingCart className="w-3.5 h-3.5 hidden sm:inline" />{es ? 'Pedidos' : 'Orders'}</TabsTrigger>
            <TabsTrigger value="sales" className="text-xs sm:text-sm gap-1"><TrendingUp className="w-3.5 h-3.5 hidden sm:inline" />{es ? 'Ventas' : 'Sales'}</TabsTrigger>
          </TabsList>

          <TabsContent value="products"><ProductsTab es={es} /></TabsContent>
          <TabsContent value="vendors"><VendorsTab es={es} /></TabsContent>
          <TabsContent value="categories"><CategoriesTab es={es} /></TabsContent>
          <TabsContent value="orders"><OrdersTab es={es} /></TabsContent>
          <TabsContent value="sales"><SalesTab es={es} /></TabsContent>
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
    const { data } = await supabase
      .from('marketplace_orders')
      .select('*, marketplace_products(name, image_url), marketplace_vendors(name), profiles:buyer_id(name, email)')
      .order('created_at', { ascending: false });
    setOrders((data as any[]) || []); setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

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
                      {/* Buyer info */}
                      <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                        <p className="text-xs font-semibold flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {es ? 'Comprador' : 'Buyer'}</p>
                        <p className="text-sm">{o.profiles?.name || 'N/A'}</p>
                        {o.profiles?.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> {o.profiles.email}</p>}
                      </div>

                      {/* Shipping info */}
                      {o.shipping_name && (
                        <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                          <p className="text-xs font-semibold flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {es ? 'Envío' : 'Shipping'}</p>
                          <p className="text-sm">{o.shipping_name}</p>
                          {o.shipping_phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {o.shipping_phone}</p>}
                          <p className="text-xs text-muted-foreground">{[o.shipping_city, o.shipping_state, o.shipping_zip].filter(Boolean).join(', ')}</p>
                          {o.shipping_notes && <p className="text-xs text-muted-foreground italic">💬 {o.shipping_notes}</p>}
                        </div>
                      )}

                      {/* Tracking number input */}
                      <div className="flex gap-2">
                        <Input
                          placeholder={es ? 'Número de rastreo...' : 'Tracking number...'}
                          value={trackingInput[o.id] ?? o.tracking_number ?? ''}
                          onChange={e => setTrackingInput(p => ({ ...p, [o.id]: e.target.value }))}
                          className="h-8 text-xs flex-1"
                        />
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => saveTracking(o.id)}>
                          <Truck className="w-3.5 h-3.5 mr-1" /> {es ? 'Guardar' : 'Save'}
                        </Button>
                      </div>

                      {/* Status change */}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">{es ? 'Cambiar estado:' : 'Change status:'}</Label>
                        <Select value={o.status} onValueChange={v => updateStatus(o.id, v)}>
                          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['pending', 'paid', 'shipped', 'delivered', 'cancelled'].map(s => (
                              <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {updatingId === o.id && <Loader2 className="w-4 h-4 animate-spin" />}
                      </div>

                      {/* Timestamps */}
                      <div className="text-[10px] text-muted-foreground space-y-0.5">
                        {o.paid_at && <p>✅ Pagado: {new Date(o.paid_at).toLocaleString()}</p>}
                        {o.shipped_at && <p>📦 Enviado: {new Date(o.shipped_at).toLocaleString()}</p>}
                        {o.delivered_at && <p>🎉 Entregado: {new Date(o.delivered_at).toLocaleString()}</p>}
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
