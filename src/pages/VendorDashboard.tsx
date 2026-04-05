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
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Package, ShoppingCart, BarChart3, Loader2, Store } from 'lucide-react';

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
  const [registerDialog, setRegisterDialog] = useState(false);
  const [regForm, setRegForm] = useState({ name: '', description: '', website: '', phone: '', location: '' });

  useEffect(() => {
    if (!user) return;
    const fetchVendor = async () => {
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
    fetchVendor();
  }, [user]);

  const handleRegister = async () => {
    if (!regForm.name || !user) return;
    setSaving(true);
    const { error } = await supabase.from('marketplace_vendors').insert({
      user_id: user.id, name: regForm.name, description: regForm.description || null,
      website: regForm.website || null, phone: regForm.phone || null, location: regForm.location || null, status: 'pending',
    } as any);
    if (error) toast.error(error.message);
    else { toast.success(es ? 'Solicitud enviada. Un administrador la revisará.' : 'Request submitted. An admin will review it.'); setRegisterDialog(false); }
    setSaving(false);
  };

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
    if (!confirm(es ? '¿Eliminar?' : 'Delete?') || !vendor) return;
    await supabase.from('marketplace_products').delete().eq('id', id);
    const { data } = await supabase.from('marketplace_products').select('*').eq('vendor_id', vendor.id);
    setProducts((data as any[]) || []);
  };

  const updateOrderStatus = async (id: string, status: string) => {
    await supabase.from('marketplace_orders').update({ status } as any).eq('id', id);
    const { data } = await supabase.from('marketplace_orders').select('*, marketplace_products(name)').eq('vendor_id', vendor.id).order('created_at', { ascending: false });
    setOrders((data as any[]) || []); toast.success(es ? 'Actualizado' : 'Updated');
  };

  if (loading) return <MainLayout><div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></MainLayout>;

  if (!vendor) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12 max-w-md text-center">
          <Store className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-xl font-bold mb-2">{es ? '¿Quieres vender material médico?' : 'Want to sell medical supplies?'}</h1>
          <p className="text-muted-foreground mb-6 text-sm">{es ? 'Registra tu empresa o marca para empezar a vender en el marketplace.' : 'Register your company or brand to start selling on the marketplace.'}</p>
          <Button onClick={() => setRegisterDialog(true)} className="gap-2"><Plus className="w-4 h-4" />{es ? 'Registrar mi Empresa' : 'Register my Company'}</Button>
          <Dialog open={registerDialog} onOpenChange={setRegisterDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{es ? 'Registrar Empresa' : 'Register Company'}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>{es ? 'Nombre de la Empresa' : 'Company Name'} *</Label><Input value={regForm.name} onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><Label>{es ? 'Descripción' : 'Description'}</Label><Textarea value={regForm.description} onChange={e => setRegForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
                <div><Label>{es ? 'Sitio Web' : 'Website'}</Label><Input value={regForm.website} onChange={e => setRegForm(f => ({ ...f, website: e.target.value }))} /></div>
                <div><Label>{es ? 'Teléfono' : 'Phone'}</Label><Input value={regForm.phone} onChange={e => setRegForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div><Label>{es ? 'Ubicación' : 'Location'}</Label><Input value={regForm.location} onChange={e => setRegForm(f => ({ ...f, location: e.target.value }))} /></div>
                <Button onClick={handleRegister} disabled={saving} className="w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (es ? 'Enviar Solicitud' : 'Submit Request')}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </MainLayout>
    );
  }

  if (vendor.status === 'pending') {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12 max-w-md text-center">
          <Loader2 className="w-12 h-12 mx-auto text-primary mb-4 animate-spin" />
          <h1 className="text-xl font-bold mb-2">{es ? 'Solicitud en Revisión' : 'Application Under Review'}</h1>
          <p className="text-muted-foreground text-sm">{es ? 'Tu solicitud está siendo revisada por un administrador.' : 'Your application is being reviewed by an admin.'}</p>
        </div>
      </MainLayout>
    );
  }

  const totalRevenue = orders.filter(o => o.status === 'delivered' || o.status === 'paid').reduce((a, o) => a + (o.total_amount || 0), 0);

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Store className="w-6 h-6 text-primary" /> {vendor.name}
          </h1>
          <p className="text-sm text-muted-foreground">{es ? 'Panel de vendedor' : 'Vendor dashboard'}</p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{products.length}</p><p className="text-xs text-muted-foreground">{es ? 'Productos' : 'Products'}</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{orders.length}</p><p className="text-xs text-muted-foreground">{es ? 'Pedidos' : 'Orders'}</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">${totalRevenue.toLocaleString()}</p><p className="text-xs text-muted-foreground">{es ? 'Ingresos' : 'Revenue'}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="products">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="products" className="gap-1"><Package className="w-4 h-4" />{es ? 'Mis Productos' : 'My Products'}</TabsTrigger>
            <TabsTrigger value="orders" className="gap-1"><ShoppingCart className="w-4 h-4" />{es ? 'Pedidos' : 'Orders'}</TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <div className="flex justify-end mb-3">
              <Button onClick={() => { setEditingId(null); setForm({ name: '', description: '', category: '', price: '', image_url: '', stock: '0', is_active: true }); setDialogOpen(true); }} className="gap-1.5">
                <Plus className="w-4 h-4" /> {es ? 'Agregar Producto' : 'Add Product'}
              </Button>
            </div>
            <div className="space-y-2">
              {products.map(p => (
                <Card key={p.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    {p.image_url && <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-lg object-cover" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">${p.price} MXN · Stock: {p.stock}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => { setEditingId(p.id); setForm({ name: p.name, description: p.description || '', category: p.category || '', price: p.price.toString(), image_url: p.image_url || '', stock: p.stock.toString(), is_active: p.is_active }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </CardContent>
                </Card>
              ))}
              {products.length === 0 && <p className="text-center text-muted-foreground py-8">{es ? 'Aún no tienes productos' : 'No products yet'}</p>}
            </div>
          </TabsContent>

          <TabsContent value="orders">
            <div className="space-y-2">
              {orders.map(o => (
                <Card key={o.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{(o as any).marketplace_products?.name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {o.quantity} · ${o.total_amount} MXN · {new Date(o.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={o.status === 'delivered' ? 'default' : 'secondary'} className="text-[10px]">{o.status}</Badge>
                    {(o.status === 'paid') && <Button size="sm" variant="outline" onClick={() => updateOrderStatus(o.id, 'shipped')}>{es ? 'Enviar' : 'Ship'}</Button>}
                    {(o.status === 'shipped') && <Button size="sm" variant="outline" onClick={() => updateOrderStatus(o.id, 'delivered')}>{es ? 'Entregado' : 'Delivered'}</Button>}
                  </CardContent>
                </Card>
              ))}
              {orders.length === 0 && <p className="text-center text-muted-foreground py-8">{es ? 'Sin pedidos' : 'No orders'}</p>}
            </div>
          </TabsContent>
        </Tabs>

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
