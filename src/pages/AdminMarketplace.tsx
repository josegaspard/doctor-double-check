import React, { useState, useEffect } from 'react';
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
import { Plus, Pencil, Trash2, Search, Package, Store, Tag, ShoppingCart, Loader2, Check, X } from 'lucide-react';

export default function AdminMarketplace() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language } = useLanguage();
  const es = language === 'es';

  useEffect(() => { if (role && role !== 'admin') navigate('/'); }, [role, navigate]);

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            {es ? 'Marketplace - Material Médico' : 'Marketplace - Medical Supplies'}
          </h1>
          <p className="text-sm text-muted-foreground">{es ? 'Administra productos, proveedores, categorías y pedidos' : 'Manage products, vendors, categories and orders'}</p>
        </div>

        <Tabs defaultValue="products">
          <TabsList className="w-full grid grid-cols-4 mb-4">
            <TabsTrigger value="products" className="text-xs sm:text-sm gap-1"><Package className="w-3.5 h-3.5 hidden sm:inline" />{es ? 'Productos' : 'Products'}</TabsTrigger>
            <TabsTrigger value="vendors" className="text-xs sm:text-sm gap-1"><Store className="w-3.5 h-3.5 hidden sm:inline" />{es ? 'Proveedores' : 'Vendors'}</TabsTrigger>
            <TabsTrigger value="categories" className="text-xs sm:text-sm gap-1"><Tag className="w-3.5 h-3.5 hidden sm:inline" />{es ? 'Categorías' : 'Categories'}</TabsTrigger>
            <TabsTrigger value="orders" className="text-xs sm:text-sm gap-1"><ShoppingCart className="w-3.5 h-3.5 hidden sm:inline" />{es ? 'Pedidos' : 'Orders'}</TabsTrigger>
          </TabsList>

          <TabsContent value="products"><ProductsTab es={es} /></TabsContent>
          <TabsContent value="vendors"><VendorsTab es={es} /></TabsContent>
          <TabsContent value="categories"><CategoriesTab es={es} /></TabsContent>
          <TabsContent value="orders"><OrdersTab es={es} /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function ProductsTab({ es }: { es: boolean }) {
  const [products, setProducts] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', category: '', price: '', vendor_id: '', image_url: '', stock: '0', is_active: true });
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    setLoading(true);
    const [{ data: p }, { data: v }] = await Promise.all([
      supabase.from('marketplace_products').select('*, marketplace_vendors(name)').order('created_at', { ascending: false }),
      supabase.from('marketplace_vendors').select('id, name').eq('status', 'approved'),
    ]);
    setProducts((p as any[]) || []); setVendors((v as any[]) || []); setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.vendor_id) { toast.error(es ? 'Nombre y proveedor requeridos' : 'Name and vendor required'); return; }
    setSaving(true);
    const payload = { name: form.name, description: form.description || null, category: form.category || null, price: parseFloat(form.price) || 0, vendor_id: form.vendor_id, image_url: form.image_url || null, stock: parseInt(form.stock) || 0, is_active: form.is_active };
    if (editingId) {
      await supabase.from('marketplace_products').update(payload as any).eq('id', editingId);
    } else {
      await supabase.from('marketplace_products').insert(payload as any);
    }
    setSaving(false); setDialogOpen(false); fetch(); toast.success(es ? 'Guardado' : 'Saved');
  };

  const handleDelete = async (id: string) => {
    if (!confirm(es ? '¿Eliminar?' : 'Delete?')) return;
    await supabase.from('marketplace_products').delete().eq('id', id);
    fetch(); toast.success(es ? 'Eliminado' : 'Deleted');
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
            <Card key={p.id}>
              <CardContent className="p-3 flex items-center gap-3">
                {p.image_url && <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-lg object-cover" />}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{(p as any).marketplace_vendors?.name} · ${p.price} MXN · Stock: {p.stock}</p>
                </div>
                <Badge variant={p.is_active ? 'default' : 'secondary'} className="text-[10px]">{p.is_active ? (es ? 'Activo' : 'Active') : (es ? 'Inactivo' : 'Inactive')}</Badge>
                <Button variant="ghost" size="icon" onClick={() => { setEditingId(p.id); setForm({ name: p.name, description: p.description || '', category: p.category || '', price: p.price.toString(), vendor_id: p.vendor_id, image_url: p.image_url || '', stock: p.stock.toString(), is_active: p.is_active }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </CardContent>
            </Card>
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

function VendorsTab({ es }: { es: boolean }) {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', website: '', phone: '', location: '', logo_url: '', status: 'approved' });
  const [saving, setSaving] = useState(false);

  const fetch = async () => { setLoading(true); const { data } = await supabase.from('marketplace_vendors').select('*').order('created_at', { ascending: false }); setVendors((data as any[]) || []); setLoading(false); };
  useEffect(() => { fetch(); }, []);

  const handleSave = async () => {
    if (!form.name) { toast.error(es ? 'Nombre requerido' : 'Name required'); return; }
    setSaving(true);
    const payload = { name: form.name, description: form.description || null, website: form.website || null, phone: form.phone || null, location: form.location || null, logo_url: form.logo_url || null, status: form.status };
    if (editingId) await supabase.from('marketplace_vendors').update(payload as any).eq('id', editingId);
    else await supabase.from('marketplace_vendors').insert(payload as any);
    setSaving(false); setDialogOpen(false); fetch(); toast.success(es ? 'Guardado' : 'Saved');
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('marketplace_vendors').update({ status } as any).eq('id', id);
    fetch(); toast.success(es ? 'Estado actualizado' : 'Status updated');
  };

  const handleDelete = async (id: string) => {
    if (!confirm(es ? '¿Eliminar?' : 'Delete?')) return;
    await supabase.from('marketplace_vendors').delete().eq('id', id);
    fetch(); toast.success(es ? 'Eliminado' : 'Deleted');
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setEditingId(null); setForm({ name: '', description: '', website: '', phone: '', location: '', logo_url: '', status: 'approved' }); setDialogOpen(true); }} className="gap-1.5">
          <Plus className="w-4 h-4" /> {es ? 'Agregar Proveedor' : 'Add Vendor'}
        </Button>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <div className="space-y-2">
          {vendors.map(v => (
            <Card key={v.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {v.logo_url ? <img src={v.logo_url} alt={v.name} className="w-full h-full object-cover rounded-lg" /> : v.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{v.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{v.location || v.website || ''}</p>
                </div>
                <Badge variant={v.status === 'approved' ? 'default' : v.status === 'pending' ? 'secondary' : 'destructive'} className="text-[10px]">{v.status}</Badge>
                {v.status === 'pending' && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => updateStatus(v.id, 'approved')}><Check className="w-4 h-4 text-green-600" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => updateStatus(v.id, 'rejected')}><X className="w-4 h-4 text-destructive" /></Button>
                  </>
                )}
                <Button variant="ghost" size="icon" onClick={() => { setEditingId(v.id); setForm({ name: v.name, description: v.description || '', website: v.website || '', phone: v.phone || '', location: v.location || '', logo_url: v.logo_url || '', status: v.status }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </CardContent>
            </Card>
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
            <div>
              <Label>{es ? 'Estado' : 'Status'}</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">{es ? 'Aprobado' : 'Approved'}</SelectItem>
                  <SelectItem value="pending">{es ? 'Pendiente' : 'Pending'}</SelectItem>
                  <SelectItem value="rejected">{es ? 'Rechazado' : 'Rejected'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (es ? 'Guardar' : 'Save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoriesTab({ es }: { es: boolean }) {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name_es: '', name_en: '', icon: 'Package', sort_order: '0', is_active: true });
  const [saving, setSaving] = useState(false);

  const fetch = async () => { setLoading(true); const { data } = await supabase.from('marketplace_categories').select('*').order('sort_order'); setCategories((data as any[]) || []); setLoading(false); };
  useEffect(() => { fetch(); }, []);

  const handleSave = async () => {
    if (!form.name_es || !form.name_en) { toast.error(es ? 'Nombres requeridos' : 'Names required'); return; }
    setSaving(true);
    const payload = { name_es: form.name_es, name_en: form.name_en, icon: form.icon, sort_order: parseInt(form.sort_order) || 0, is_active: form.is_active };
    if (editingId) await supabase.from('marketplace_categories').update(payload as any).eq('id', editingId);
    else await supabase.from('marketplace_categories').insert(payload as any);
    setSaving(false); setDialogOpen(false); fetch(); toast.success(es ? 'Guardado' : 'Saved');
  };

  const handleDelete = async (id: string) => {
    if (!confirm(es ? '¿Eliminar?' : 'Delete?')) return;
    await supabase.from('marketplace_categories').delete().eq('id', id);
    fetch();
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setEditingId(null); setForm({ name_es: '', name_en: '', icon: 'Package', sort_order: '0', is_active: true }); setDialogOpen(true); }} className="gap-1.5">
          <Plus className="w-4 h-4" /> {es ? 'Agregar Categoría' : 'Add Category'}
        </Button>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <div className="space-y-2">
          {categories.map(c => (
            <Card key={c.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold">{c.sort_order}</div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{es ? c.name_es : c.name_en}</p>
                  <p className="text-xs text-muted-foreground">{c.icon}</p>
                </div>
                <Badge variant={c.is_active ? 'default' : 'secondary'} className="text-[10px]">{c.is_active ? (es ? 'Activo' : 'Active') : (es ? 'Inactivo' : 'Inactive')}</Badge>
                <Button variant="ghost" size="icon" onClick={() => { setEditingId(c.id); setForm({ name_es: c.name_es, name_en: c.name_en, icon: c.icon, sort_order: c.sort_order.toString(), is_active: c.is_active }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </CardContent>
            </Card>
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

function OrdersTab({ es }: { es: boolean }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from('marketplace_orders').select('*, marketplace_products(name), marketplace_vendors(name)').order('created_at', { ascending: false });
    setOrders((data as any[]) || []); setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('marketplace_orders').update({ status } as any).eq('id', id);
    fetch(); toast.success(es ? 'Estado actualizado' : 'Status updated');
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800', paid: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800', delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : orders.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">{es ? 'No hay pedidos aún' : 'No orders yet'}</p>
      ) : (
        <div className="space-y-2">
          {orders.map(o => (
            <Card key={o.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{(o as any).marketplace_products?.name || 'Producto eliminado'}</p>
                  <p className="text-xs text-muted-foreground">
                    {(o as any).marketplace_vendors?.name} · {es ? 'Cant' : 'Qty'}: {o.quantity} · ${o.total_amount} MXN
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(o.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[o.status] || ''}`}>{o.status}</span>
                <Select value={o.status} onValueChange={v => updateStatus(o.id, v)}>
                  <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['pending', 'paid', 'shipped', 'delivered', 'cancelled'].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
