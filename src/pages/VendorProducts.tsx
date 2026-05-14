import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Package, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Vendor {
  id: string;
  name: string;
  status: string;
}
interface Product {
  id: string;
  vendor_id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  currency: string;
  image_url: string | null;
  stock: number;
  is_active: boolean;
  is_featured: boolean;
}

const empty = { name: '', description: '', category: '', price: '', currency: 'MXN', image_url: '', stock: '0', is_active: true };

export default function VendorProducts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    const { data: v } = await supabase
      .from('marketplace_vendors')
      .select('id, name, status')
      .eq('user_id', user.id)
      .maybeSingle();
    setVendor((v as any) || null);
    if (v && (v as any).status === 'approved') {
      const { data: p } = await supabase
        .from('marketplace_products')
        .select('*')
        .eq('vendor_id', (v as any).id)
        .order('created_at', { ascending: false });
      setProducts((p as any[]) || []);
    } else {
      setProducts([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const openCreate = () => {
    setEditingId(null);
    setForm(empty);
    setDialogOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description || '',
      category: p.category || '',
      price: p.price.toString(),
      currency: p.currency || 'MXN',
      image_url: p.image_url || '',
      stock: (p.stock || 0).toString(),
      is_active: p.is_active,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!vendor) return;
    if (!form.name || !form.price) {
      toast.error('Nombre y precio son requeridos');
      return;
    }
    setSaving(true);
    const payload = {
      vendor_id: vendor.id,
      name: form.name,
      description: form.description || null,
      category: form.category || null,
      price: parseFloat(form.price),
      currency: form.currency,
      image_url: form.image_url || null,
      stock: parseInt(form.stock || '0', 10),
      is_active: form.is_active,
    };
    const { error } = editingId
      ? await supabase.from('marketplace_products').update(payload as any).eq('id', editingId)
      : await supabase.from('marketplace_products').insert(payload as any);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingId ? 'Producto actualizado' : 'Producto creado');
    setDialogOpen(false);
    fetchAll();
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar producto?')) return;
    const { error } = await supabase.from('marketplace_products').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Eliminado'); fetchAll(); }
  };

  const toggleActive = async (p: Product) => {
    const { error } = await supabase.from('marketplace_products').update({ is_active: !p.is_active } as any).eq('id', p.id);
    if (error) toast.error(error.message);
    else fetchAll();
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </MainLayout>
    );
  }

  if (!vendor) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8 max-w-lg">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Package className="w-5 h-5" /> Aún no eres vendedor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Para publicar productos en el marketplace de Medical Masters debes registrarte primero como vendor y esperar la aprobación del equipo.</p>
              <Button onClick={() => navigate('/vendor')}>Registrarme como vendor</Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (vendor.status !== 'approved') {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8 max-w-lg">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertCircle className="w-5 h-5 text-warning" /> Cuenta de vendor en revisión</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Tu solicitud como <strong>{vendor.name}</strong> está en revisión por el equipo de Medical Masters. Te notificaremos por correo cuando sea aprobada.</p>
              <Badge variant="secondary">Estado: {vendor.status}</Badge>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Package className="w-6 h-6 text-primary" />
              Mis productos
            </h1>
            <p className="text-sm text-muted-foreground">Gestiona el inventario de <strong>{vendor.name}</strong> en el marketplace.</p>
          </div>
          <Button onClick={openCreate} className="gap-1.5"><Plus className="w-4 h-4" />Agregar producto</Button>
        </div>

        {products.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Aún no has agregado productos. Da clic en "Agregar producto" para empezar.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {products.map((p) => (
              <Card key={p.id} className={!p.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-3">
                  {p.image_url && (
                    <img src={p.image_url} alt={p.name} className="w-full h-32 object-cover rounded-md mb-3" />
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm line-clamp-2 flex-1">{p.name}</h3>
                    <Badge variant={p.is_active ? 'default' : 'secondary'} className="text-[10px]">{p.is_active ? 'Activo' : 'Inactivo'}</Badge>
                  </div>
                  {p.category && <p className="text-[11px] text-muted-foreground mt-1">{p.category}</p>}
                  <div className="flex items-baseline gap-2 mt-2">
                    <p className="text-lg font-bold text-primary">${Number(p.price).toFixed(2)}</p>
                    <span className="text-[11px] text-muted-foreground">{p.currency}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Stock: <strong>{p.stock}</strong></p>
                  <div className="flex items-center gap-1 mt-3">
                    <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={() => toggleActive(p)}>
                      <span className={`w-2 h-2 rounded-full ${p.is_active ? 'bg-success' : 'bg-muted-foreground'}`} />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-destructive" onClick={() => remove(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Descripción</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Precio *</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
                <div><Label>Moneda</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Stock</Label><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
                <div><Label>Categoría</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Insumos, Equipo, etc" /></div>
              </div>
              <div><Label>URL de imagen</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." /></div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Activo (visible en marketplace)</Label>
              </div>
              <Button onClick={save} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? 'Guardar cambios' : 'Crear producto'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
