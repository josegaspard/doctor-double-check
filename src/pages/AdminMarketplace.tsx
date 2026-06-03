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
import { Plus, Pencil, Trash2, Search, Package, Store, Tag, ShoppingCart, Loader2, Check, X, Download, TrendingUp, DollarSign, Users, BarChart3, ChevronDown, ChevronUp, Truck, MapPin, Phone, Mail, ArrowLeft, FileText, Send, Clock, RotateCcw, AlertTriangle, CreditCard, ClipboardList, AlertCircle, Warehouse, Star, EyeOff, Eye as EyeIcon, Percent } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

export default function AdminMarketplace() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language, t } = useLanguage();
  const es = language === 'es';

  useEffect(() => { if (role && role !== 'admin') navigate('/'); }, [role, navigate]);
  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        <Button variant="back" size="sm" onClick={() => navigate('/admin')} className="mb-3 -ml-2 text-white hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('adminMarketplacePage.backToAdmin')}
        </Button>
        <div className="mb-6 rounded-2xl bg-white border-2 border-primary/30 shadow-md p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow">
              <Package className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-secondary truncate">
                {t('adminMarketplacePage.title')}
              </h1>
              <p className="text-xs sm:text-sm text-secondary/70">{t('adminMarketplacePage.subtitle')}</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="products">
          <TabsList className={`w-full grid grid-cols-4 ${FEATURE_FLAGS.marketplaceVendors ? 'sm:grid-cols-12' : 'sm:grid-cols-8'} mb-4 h-auto`}>
            <TabsTrigger value="products" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><Package className="w-3 h-3" /><span className="hidden sm:inline">{t('adminMarketplacePage.tabs.products')}</span></TabsTrigger>
            <TabsTrigger value="brands" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><Tag className="w-3 h-3" /><span className="hidden sm:inline">{t('adminMarketplacePage.tabs.brands')}</span></TabsTrigger>
            {FEATURE_FLAGS.marketplaceVendors && (
              <TabsTrigger value="vendors" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><Store className="w-3 h-3" /><span className="hidden sm:inline">{t('adminMarketplacePage.tabs.vendors')}</span></TabsTrigger>
            )}
            <TabsTrigger value="categories" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><Tag className="w-3 h-3" /><span className="hidden sm:inline">{t('adminMarketplacePage.tabs.categories')}</span></TabsTrigger>
            <TabsTrigger value="orders" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><ShoppingCart className="w-3 h-3" /><span className="hidden sm:inline">{t('adminMarketplacePage.tabs.orders')}</span></TabsTrigger>
            <TabsTrigger value="sales" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><TrendingUp className="w-3 h-3" /><span className="hidden sm:inline">{t('adminMarketplacePage.tabs.sales')}</span></TabsTrigger>
            <TabsTrigger value="refunds" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><RotateCcw className="w-3 h-3" /><span className="hidden sm:inline">{t('adminMarketplacePage.tabs.refunds')}</span></TabsTrigger>
            {FEATURE_FLAGS.marketplaceVendors && (
              <TabsTrigger value="disputes" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><AlertTriangle className="w-3 h-3" /><span className="hidden sm:inline">{t('adminMarketplacePage.tabs.disputes')}</span></TabsTrigger>
            )}
            {FEATURE_FLAGS.marketplaceVendors && (
              <TabsTrigger value="payouts" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><CreditCard className="w-3 h-3" /><span className="hidden sm:inline">{t('adminMarketplacePage.tabs.payouts')}</span></TabsTrigger>
            )}
            <TabsTrigger value="stock" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><Warehouse className="w-3 h-3" /><span className="hidden sm:inline">{t('adminMarketplacePage.tabs.stock')}</span></TabsTrigger>
            <TabsTrigger value="audit" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><ClipboardList className="w-3 h-3" /><span className="hidden sm:inline">{t('adminMarketplacePage.tabs.audit')}</span></TabsTrigger>
            <TabsTrigger value="reviews" className="text-[10px] sm:text-xs gap-1 px-1.5 py-1.5"><Star className="w-3 h-3" /><span className="hidden sm:inline">{t('adminMarketplacePage.tabs.reviews')}</span></TabsTrigger>
          </TabsList>

          <TabsContent value="products"><ProductsTab es={es} /></TabsContent>
          <TabsContent value="brands"><BrandsTab es={es} /></TabsContent>
          {FEATURE_FLAGS.marketplaceVendors && <TabsContent value="vendors"><VendorsTab es={es} /></TabsContent>}
          <TabsContent value="categories"><CategoriesTab es={es} /></TabsContent>
          <TabsContent value="orders"><OrdersTab es={es} /></TabsContent>
          <TabsContent value="sales"><SalesTab es={es} /></TabsContent>
          <TabsContent value="refunds"><RefundsTab es={es} /></TabsContent>
          {FEATURE_FLAGS.marketplaceVendors && <TabsContent value="disputes"><DisputesTab es={es} /></TabsContent>}
          {FEATURE_FLAGS.marketplaceVendors && <TabsContent value="payouts"><PayoutsTab es={es} /></TabsContent>}
          <TabsContent value="stock"><StockTab es={es} /></TabsContent>
          <TabsContent value="audit"><AuditTab es={es} /></TabsContent>
          <TabsContent value="reviews"><ReviewsTab es={es} /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

/* =================== PRODUCTS TAB =================== */
function ProductsTab({ es }: { es: boolean }) {
  const { t } = useLanguage();
  const [products, setProducts] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', category: '', price: '', brand_id: '', image_url: '', stock: '0', is_active: true });
  const [saving, setSaving] = useState(false);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [newBrand, setNewBrand] = useState({ name: '', description: '', logo_url: '' });
  const [savingBrand, setSavingBrand] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: p }, { data: b }] = await Promise.all([
      supabase.from('marketplace_products').select('*, marketplace_brands(name)').order('created_at', { ascending: false }),
      (supabase as any).from('marketplace_brands').select('id, name').eq('is_active', true).order('name'),
    ]);
    setProducts((p as any[]) || []); setBrands((b as any[]) || []); setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!form.name) { toast.error(t('adminMarketplacePage.common.nameRequired')); return; }
    setSaving(true);
    const payload: any = { name: form.name, description: form.description || null, category: form.category || null, price: parseFloat(form.price) || 0, brand_id: form.brand_id || null, image_url: form.image_url || null, stock: parseInt(form.stock) || 0, is_active: form.is_active };
    if (editingId) await supabase.from('marketplace_products').update(payload).eq('id', editingId);
    else await supabase.from('marketplace_products').insert(payload);
    setSaving(false); setDialogOpen(false); fetchData(); toast.success(t('adminMarketplacePage.common.saved'));
  };

  const handleCreateBrand = async () => {
    if (!newBrand.name.trim()) { toast.error(t('adminMarketplacePage.brands.nameRequired')); return; }
    setSavingBrand(true);
    const { data, error } = await (supabase as any).from('marketplace_brands').insert({
      name: newBrand.name.trim(),
      description: newBrand.description.trim() || null,
      logo_url: newBrand.logo_url.trim() || null,
      is_active: true,
    }).select('id, name').single();
    setSavingBrand(false);
    if (error) { toast.error(error.message); return; }
    setBrands(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setForm(f => ({ ...f, brand_id: data.id }));
    setNewBrand({ name: '', description: '', logo_url: '' });
    setBrandDialogOpen(false);
    toast.success(t('adminMarketplacePage.brands.created'));
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('adminMarketplacePage.common.confirmDelete'))) return;
    await supabase.from('marketplace_products').delete().eq('id', id);
    fetchData(); toast.success(t('adminMarketplacePage.common.deleted'));
  };

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('adminMarketplacePage.common.searchProduct')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => { setEditingId(null); setForm({ name: '', description: '', category: '', price: '', brand_id: '', image_url: '', stock: '0', is_active: true }); setDialogOpen(true); }} className="gap-1.5">
          <Plus className="w-4 h-4" /> {t('adminMarketplacePage.common.add')}
        </Button>
      </div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <div className="space-y-2">
          {filtered.map(p => (
            <Card key={p.id}><CardContent className="p-3 flex items-center gap-3">
              {p.image_url && <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-lg object-cover" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(p as any).marketplace_brands?.name ? `${(p as any).marketplace_brands.name} · ` : ''}${p.price} MXN · Stock: {p.stock}
                </p>
              </div>
              <Badge variant={p.is_active ? 'default' : 'secondary'} className="text-[10px]">{p.is_active ? t('adminMarketplacePage.common.active') : t('adminMarketplacePage.common.inactive')}</Badge>
              <Button variant="ghost" size="icon" onClick={() => { setEditingId(p.id); setForm({ name: p.name, description: p.description || '', category: p.category || '', price: p.price.toString(), brand_id: p.brand_id || '', image_url: p.image_url || '', stock: p.stock.toString(), is_active: p.is_active }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </CardContent></Card>
          ))}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">{t('adminMarketplacePage.common.noProducts')}</p>}
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? t('adminMarketplacePage.common.editProduct') : t('adminMarketplacePage.common.newProduct')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t('adminMarketplacePage.common.name')} *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>{t('adminMarketplacePage.common.description')}</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>{t('adminMarketplacePage.common.brand')}</Label>
                <button
                  type="button"
                  onClick={() => setBrandDialogOpen(true)}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> {t('adminMarketplacePage.brands.createNew')}
                </button>
              </div>
              <Select value={form.brand_id || '__none__'} onValueChange={v => setForm(f => ({ ...f, brand_id: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder={t('adminMarketplacePage.common.select')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{es ? 'Sin marca' : 'No brand'}</SelectItem>
                  {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t('adminMarketplacePage.common.pricemxn')}</Label><Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
              <div><Label>Stock</Label><Input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} /></div>
            </div>
            <div><Label>{t('adminMarketplacePage.common.category')}</Label><Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></div>
            <div><Label>{t('adminMarketplacePage.common.imageUrl')}</Label><Input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label>{t('adminMarketplacePage.common.active')}</Label></div>
            <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('adminMarketplacePage.common.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inline create-brand dialog */}
      <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('adminMarketplacePage.brands.newBrand')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t('adminMarketplacePage.common.name')} *</Label><Input value={newBrand.name} onChange={e => setNewBrand(b => ({ ...b, name: e.target.value }))} autoFocus /></div>
            <div><Label>{t('adminMarketplacePage.common.description')}</Label><Textarea value={newBrand.description} onChange={e => setNewBrand(b => ({ ...b, description: e.target.value }))} rows={2} /></div>
            <div><Label>{t('adminMarketplacePage.brands.logoUrl')}</Label><Input value={newBrand.logo_url} onChange={e => setNewBrand(b => ({ ...b, logo_url: e.target.value }))} placeholder="https://..." /></div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setBrandDialogOpen(false)} className="flex-1">{t('common.cancel')}</Button>
              <Button onClick={handleCreateBrand} disabled={savingBrand} className="flex-1">
                {savingBrand ? <Loader2 className="w-4 h-4 animate-spin" /> : t('adminMarketplacePage.common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =================== BRANDS TAB =================== */
function BrandsTab({ es }: { es: boolean }) {
  const { t } = useLanguage();
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', logo_url: '', is_active: true });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('marketplace_brands').select('*').order('created_at', { ascending: false });
    setBrands((data as any[]) || []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error(t('adminMarketplacePage.brands.nameRequired')); return; }
    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      logo_url: form.logo_url.trim() || null,
      is_active: form.is_active,
    };
    let res;
    if (editingId) {
      res = await (supabase as any).from('marketplace_brands').update(payload).eq('id', editingId);
    } else {
      res = await (supabase as any).from('marketplace_brands').insert(payload);
    }
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    setDialogOpen(false);
    fetchData();
    toast.success(t('adminMarketplacePage.common.saved'));
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('adminMarketplacePage.brands.confirmDelete'))) return;
    const { error } = await (supabase as any).from('marketplace_brands').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    fetchData(); toast.success(t('adminMarketplacePage.common.deleted'));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">{es ? 'Marcas registradas' : 'Registered brands'}</h3>
        <Button
          onClick={() => { setEditingId(null); setForm({ name: '', description: '', logo_url: '', is_active: true }); setDialogOpen(true); }}
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" /> {t('adminMarketplacePage.brands.newBrand')}
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : brands.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          {t('adminMarketplacePage.brands.empty')}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {brands.map(b => (
            <Card key={b.id}><CardContent className="p-3 flex items-center gap-3">
              {b.logo_url
                ? <img src={b.logo_url} alt={b.name} className="w-12 h-12 rounded-lg object-cover bg-muted" />
                : <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center"><Tag className="w-5 h-5 text-primary" /></div>
              }
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{b.name}</p>
                {b.description && <p className="text-xs text-muted-foreground line-clamp-1">{b.description}</p>}
              </div>
              <Badge variant={b.is_active ? 'default' : 'secondary'} className="text-[10px]">
                {b.is_active ? t('adminMarketplacePage.common.active') : t('adminMarketplacePage.common.inactive')}
              </Badge>
              <Button variant="ghost" size="icon" onClick={() => {
                setEditingId(b.id);
                setForm({ name: b.name, description: b.description || '', logo_url: b.logo_url || '', is_active: b.is_active });
                setDialogOpen(true);
              }}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </CardContent></Card>
          ))}
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? t('adminMarketplacePage.brands.editBrand') : t('adminMarketplacePage.brands.newBrand')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t('adminMarketplacePage.common.name')} *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus /></div>
            <div><Label>{t('adminMarketplacePage.common.description')}</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div><Label>{t('adminMarketplacePage.brands.logoUrl')}</Label><Input value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} placeholder="https://..." /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label>{t('adminMarketplacePage.common.active')}</Label></div>
            <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('adminMarketplacePage.common.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =================== VENDORS TAB =================== */
function VendorsTab({ es: _es }: { es: boolean }) {
  const { t } = useLanguage();
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', website: '', phone: '', location: '', logo_url: '', status: 'approved', commission_rate: '0.15', iva_rate: '0.16', legal_name: '', tax_id: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => { setLoading(true); const { data } = await supabase.from('marketplace_vendors').select('*').order('created_at', { ascending: false }); setVendors((data as any[]) || []); setLoading(false); };
  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!form.name) { toast.error(t('adminMarketplacePage.vendors.nameRequired')); return; }
    setSaving(true);
    const commission = Math.max(0, Math.min(1, parseFloat(form.commission_rate) || 0.15));
    const iva = Math.max(0, Math.min(1, parseFloat(form.iva_rate) || 0.16));
    const payload: any = { name: form.name, description: form.description || null, website: form.website || null, phone: form.phone || null, location: form.location || null, logo_url: form.logo_url || null, status: form.status, commission_rate: commission, iva_rate: iva, legal_name: form.legal_name || null, tax_id: form.tax_id || null };
    if (editingId) await supabase.from('marketplace_vendors').update(payload as any).eq('id', editingId);
    else await supabase.from('marketplace_vendors').insert(payload as any);
    setSaving(false); setDialogOpen(false); fetchData(); toast.success(t('adminMarketplacePage.common.saved'));
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('marketplace_vendors').update({ status } as any).eq('id', id);
    fetchData(); toast.success(t('adminMarketplacePage.vendors.statusUpdated'));
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('adminMarketplacePage.common.confirmDelete'))) return;
    await supabase.from('marketplace_vendors').delete().eq('id', id);
    fetchData(); toast.success(t('adminMarketplacePage.common.deleted'));
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setEditingId(null); setForm({ name: '', description: '', website: '', phone: '', location: '', logo_url: '', status: 'approved', commission_rate: '0.15', iva_rate: '0.16', legal_name: '', tax_id: '' }); setDialogOpen(true); }} className="gap-1.5"><Plus className="w-4 h-4" /> {t('adminMarketplacePage.vendors.addVendor')}</Button>
      </div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <div className="space-y-2">
          {vendors.map(v => (
            <Card key={v.id}><CardContent className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">{v.logo_url ? <img src={v.logo_url} alt={v.name} className="w-full h-full object-cover rounded-lg" /> : v.name.slice(0, 2).toUpperCase()}</div>
              <div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{v.name}</p><p className="text-xs text-muted-foreground truncate">{v.location || v.website || ''}</p></div>
              <Badge variant={v.status === 'approved' ? 'default' : v.status === 'pending' ? 'secondary' : 'destructive'} className="text-[10px]">{v.status}</Badge>
              {v.status === 'pending' && (<><Button variant="ghost" size="icon" onClick={() => updateStatus(v.id, 'approved')}><Check className="w-4 h-4 text-success" /></Button><Button variant="ghost" size="icon" onClick={() => updateStatus(v.id, 'rejected')}><X className="w-4 h-4 text-destructive" /></Button></>)}
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20" title={t('adminMarketplacePage.vendors.platformCommission')}>{((v.commission_rate || 0.15) * 100).toFixed(0)}%</span>
              <Button variant="ghost" size="icon" onClick={() => { setEditingId(v.id); setForm({ name: v.name, description: v.description || '', website: v.website || '', phone: v.phone || '', location: v.location || '', logo_url: v.logo_url || '', status: v.status, commission_rate: String(v.commission_rate ?? 0.15), iva_rate: String(v.iva_rate ?? 0.16), legal_name: v.legal_name || '', tax_id: v.tax_id || '' }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </CardContent></Card>
          ))}
          {vendors.length === 0 && <p className="text-center text-muted-foreground py-8">{t('adminMarketplacePage.vendors.noVendors')}</p>}
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? t('adminMarketplacePage.vendors.editVendor') : t('adminMarketplacePage.vendors.newVendor')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t('adminMarketplacePage.common.name')} *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>{t('adminMarketplacePage.common.description')}</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t('adminMarketplacePage.vendors.website')}</Label><Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} /></div>
              <div><Label>{t('adminMarketplacePage.vendors.phone')}</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div><Label>{t('adminMarketplacePage.vendors.location')}</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
            <div><Label>Logo URL</Label><Input value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div>
                <Label className="text-xs flex items-center gap-1"><Percent className="w-3 h-3" /> {t('adminMarketplacePage.vendors.platformCommission')}</Label>
                <div className="relative">
                  <Input type="number" step="0.01" min="0" max="1" value={form.commission_rate} onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))} className="pr-12" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">= {((parseFloat(form.commission_rate) || 0) * 100).toFixed(1)}%</span>
                </div>
              </div>
              <div>
                <Label className="text-xs">{t('adminMarketplacePage.vendors.vatRate')}</Label>
                <div className="relative">
                  <Input type="number" step="0.01" min="0" max="1" value={form.iva_rate} onChange={e => setForm(f => ({ ...f, iva_rate: e.target.value }))} className="pr-12" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">= {((parseFloat(form.iva_rate) || 0) * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t('adminMarketplacePage.vendors.legalName')}</Label><Input value={form.legal_name} onChange={e => setForm(f => ({ ...f, legal_name: e.target.value }))} /></div>
              <div><Label>RFC / Tax ID</Label><Input value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} /></div>
            </div>
            <div><Label>{t('adminMarketplacePage.vendors.status')}</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="approved">{t('adminMarketplacePage.vendors.approved')}</SelectItem><SelectItem value="pending">{t('adminMarketplacePage.vendors.pending')}</SelectItem><SelectItem value="rejected">{t('adminMarketplacePage.vendors.rejected')}</SelectItem></SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('adminMarketplacePage.common.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =================== CATEGORIES TAB =================== */
function CategoriesTab({ es }: { es: boolean }) {
  const { t } = useLanguage();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name_es: '', name_en: '', icon: 'Package', sort_order: '0', is_active: true });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => { setLoading(true); const { data } = await supabase.from('marketplace_categories').select('*').order('sort_order'); setCategories((data as any[]) || []); setLoading(false); };
  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!form.name_es || !form.name_en) { toast.error(t('adminMarketplacePage.categories.namesRequired')); return; }
    setSaving(true);
    const payload = { name_es: form.name_es, name_en: form.name_en, icon: form.icon, sort_order: parseInt(form.sort_order) || 0, is_active: form.is_active };
    if (editingId) await supabase.from('marketplace_categories').update(payload as any).eq('id', editingId);
    else await supabase.from('marketplace_categories').insert(payload as any);
    setSaving(false); setDialogOpen(false); fetchData(); toast.success(t('adminMarketplacePage.common.saved'));
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('adminMarketplacePage.common.confirmDelete'))) return;
    await supabase.from('marketplace_categories').delete().eq('id', id);
    fetchData();
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setEditingId(null); setForm({ name_es: '', name_en: '', icon: 'Package', sort_order: '0', is_active: true }); setDialogOpen(true); }} className="gap-1.5"><Plus className="w-4 h-4" /> {t('adminMarketplacePage.categories.addCategory')}</Button>
      </div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <div className="space-y-2">
          {categories.map(c => (
            <Card key={c.id}><CardContent className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold">{c.sort_order}</div>
              <div className="flex-1"><p className="font-medium text-sm">{es ? c.name_es : c.name_en}</p><p className="text-xs text-muted-foreground">{c.icon}</p></div>
              <Badge variant={c.is_active ? 'default' : 'secondary'} className="text-[10px]">{c.is_active ? t('adminMarketplacePage.common.active') : t('adminMarketplacePage.common.inactive')}</Badge>
              <Button variant="ghost" size="icon" onClick={() => { setEditingId(c.id); setForm({ name_es: c.name_es, name_en: c.name_en, icon: c.icon, sort_order: c.sort_order.toString(), is_active: c.is_active }); setDialogOpen(true); }}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </CardContent></Card>
          ))}
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingId ? t('adminMarketplacePage.categories.editCategory') : t('adminMarketplacePage.categories.newCategory')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t('adminMarketplacePage.categories.nameEs')} *</Label><Input value={form.name_es} onChange={e => setForm(f => ({ ...f, name_es: e.target.value }))} /></div>
            <div><Label>{t('adminMarketplacePage.categories.nameEn')} *</Label><Input value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t('adminMarketplacePage.categories.icon')}</Label><Input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} /></div>
              <div><Label>{t('adminMarketplacePage.categories.order')}</Label><Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label>{t('adminMarketplacePage.common.active')}</Label></div>
            <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('adminMarketplacePage.common.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =================== ORDERS TAB =================== */
function OrdersTab({ es }: { es: boolean }) {
  const { t } = useLanguage();
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
      toast.error(t('adminMarketplacePage.orders.errorLoading'));
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
  const [dispatchDialog, setDispatchDialog] = useState<{ orderId: string | null; days: number; tracking: string; carrier: string; trackingUrl: string }>({ orderId: null, days: 3, tracking: '', carrier: '', trackingUrl: '' });

  // Auto-fill tracking URL from carrier + tracking number (mejores carriers MX)
  const buildTrackingUrl = (carrier: string, num: string): string => {
    if (!num) return '';
    const lower = (carrier || '').toLowerCase().trim();
    if (lower.includes('estafeta')) return `https://www.estafeta.com/Herramientas/Rastreo?wayBill=${encodeURIComponent(num)}`;
    if (lower.includes('dhl')) return `https://www.dhl.com/mx-es/home/tracking.html?tracking-id=${encodeURIComponent(num)}`;
    if (lower.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(num)}`;
    if (lower.includes('ups')) return `https://www.ups.com/track?tracknum=${encodeURIComponent(num)}`;
    if (lower.includes('redpack')) return `https://www.redpack.com.mx/rastreo-de-envios/?guias=${encodeURIComponent(num)}`;
    if (lower.includes('paquetexpress') || lower.includes('paquete')) return `https://www.paquetexpress.com.mx/rastreo/buscador?numero=${encodeURIComponent(num)}`;
    if (lower.includes('99minutos') || lower.includes('99 minutos')) return `https://tracking.99minutos.com/${encodeURIComponent(num)}`;
    return '';
  };

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
          toast.success(t('adminMarketplacePage.orders.emailSent').replace('{status}', status));
        } catch (e) {
          console.error('Email send error:', e);
        }
      }
    }

    fetchData();
    setUpdatingId(null);
    toast.success(t('adminMarketplacePage.orders.statusUpdated'));
  };

  const saveTracking = async (id: string) => {
    const val = trackingInput[id];
    if (!val) return;
    await supabase.from('marketplace_orders').update({ tracking_number: val } as any).eq('id', id);
    fetchData();
    toast.success(t('adminMarketplacePage.orders.trackingSaved'));
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

    const finalTrackingUrl = dispatchDialog.trackingUrl || buildTrackingUrl(dispatchDialog.carrier, dispatchDialog.tracking) || null;

    const updates: any = {
      status: 'shipped',
      shipping_status: 'shipped',
      shipped_at: new Date().toISOString(),
      estimated_delivery: etaISO,
      tracking_number: dispatchDialog.tracking || order.tracking_number || null,
      courier_name: dispatchDialog.carrier || null,
      tracking_url: finalTrackingUrl,
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

    setDispatchDialog({ orderId: null, days: 3, tracking: '', carrier: '', trackingUrl: '' });
    fetchData();
    setUpdatingId(null);
    toast.success(t('adminMarketplacePage.orders.dispatched').replace('{eta}', eta.toLocaleDateString('es-MX')));
  };

  const openDispatch = (order: any) => {
    const days = getDefaultDays(order.shipping_city, order.shipping_state);
    setDispatchDialog({
      orderId: order.id,
      days,
      tracking: order.tracking_number || trackingInput[order.id] || '',
      carrier: order.courier_name || '',
      trackingUrl: order.tracking_url || '',
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
  h1{color:#227787;margin:0 0 4px}
  .muted{color:#64748b;font-size:12px}
  .box{border:1.5px solid #22778733;border-radius:10px;padding:14px;margin:14px 0;background:#fff}
  .box h2{margin:0 0 8px;font-size:13px;color:#227787;text-transform:uppercase;letter-spacing:.5px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  td{padding:6px 0;border-bottom:1px solid #22778714}
  td:last-child{text-align:right;font-weight:600}
  .total{font-size:18px;color:#227787;font-weight:700}
  .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;background:#227787;color:#fff}
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
  <button style="margin-top:16px;background:#227787;color:#fff;border:0;padding:10px 16px;border-radius:8px;cursor:pointer;font-weight:600" onclick="window.print()">Imprimir / Guardar PDF</button>
</body></html>`;
    const win = window.open('', '_blank', 'width=820,height=900');
    if (!win) { toast.error(t('adminMarketplacePage.orders.allowPopups')); return; }
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
    toast.success(t('adminMarketplacePage.orders.csvExported'));
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
          <p className="text-[10px] text-muted-foreground">{t('adminMarketplacePage.orders.totalRevenue')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <ShoppingCart className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-lg font-bold">{stats.today}</p>
          <p className="text-[10px] text-muted-foreground">{t('adminMarketplacePage.orders.ordersToday')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Package className="w-5 h-5 text-warning mx-auto mb-1" />
          <p className="text-lg font-bold">{stats.pending}</p>
          <p className="text-[10px] text-muted-foreground">{t('adminMarketplacePage.orders.pendingShip')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <BarChart3 className="w-5 h-5 text-secondary mx-auto mb-1" />
          <p className="text-lg font-bold">${Math.round(stats.avg).toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">{t('adminMarketplacePage.orders.avgOrder')}</p>
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
              {s === 'all' ? t('adminMarketplacePage.orders.all') : s.charAt(0).toUpperCase() + s.slice(1)}
              <span className="ml-1 opacity-60">({s === 'all' ? orders.length : orders.filter(o => o.status === s).length})</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder={t('adminMarketplacePage.orders.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} className="h-8 text-xs gap-1"><Download className="w-3.5 h-3.5" /> CSV</Button>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">{t('adminMarketplacePage.orders.noOrders')}</p>
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
                      <p className="font-medium text-sm truncate">{o.marketplace_products?.name || t('adminMarketplacePage.orders.productDeleted')}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {o.profiles?.name || t('adminMarketplacePage.orders.anonymous')} · {t('adminMarketplacePage.orders.qty')}: {o.quantity} · ${Number(o.total_amount).toLocaleString()} · {new Date(o.created_at).toLocaleDateString()}
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
                          <p className="text-xs font-semibold text-primary flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {t('adminMarketplacePage.orders.buyer')}</p>
                          <p className="text-sm text-secondary font-medium">{o.profiles?.name || 'N/A'}</p>
                          {o.profiles?.email && <p className="text-xs text-secondary/70 flex items-center gap-1 break-all"><Mail className="w-3 h-3 flex-shrink-0" /> {o.profiles.email}</p>}
                        </div>

                        {/* Shipping info */}
                        {(o.shipping_name || o.shipping_city) ? (
                          <div className="bg-secondary/8 border border-secondary/25 rounded-lg p-3 space-y-1">
                            <p className="text-xs font-semibold text-secondary flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {t('adminMarketplacePage.orders.shippingAddress')}</p>
                            {o.shipping_name && <p className="text-sm text-secondary font-medium">{o.shipping_name}</p>}
                            {o.shipping_phone && <p className="text-xs text-secondary/70 flex items-center gap-1"><Phone className="w-3 h-3" /> {o.shipping_phone}</p>}
                            <p className="text-xs text-secondary/70">{[o.shipping_city, o.shipping_state, o.shipping_zip].filter(Boolean).join(', ') || '—'}</p>
                            {o.shipping_notes && <p className="text-xs text-secondary/60 italic">📝 {o.shipping_notes}</p>}
                          </div>
                        ) : (
                          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-xs text-warning">
                            ⚠ {t('adminMarketplacePage.orders.noShippingAddress')}
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
                          <FileText className="w-3.5 h-3.5" /> {t('adminMarketplacePage.orders.downloadPDF')}
                        </Button>

                        {o.status === 'paid' && (
                          <Button
                            size="sm"
                            onClick={() => openDispatch(o)}
                            disabled={updatingId === o.id}
                            className="h-9 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow"
                          >
                            <Truck className="w-3.5 h-3.5" /> {t('adminMarketplacePage.orders.dispatchNow')}
                          </Button>
                        )}

                        {o.status === 'shipped' && (
                          <Button
                            size="sm"
                            onClick={() => updateStatus(o.id, 'delivered')}
                            disabled={updatingId === o.id}
                            className="h-9 text-xs gap-1.5 bg-secondary text-primary-foreground hover:bg-secondary/90"
                          >
                            <Check className="w-3.5 h-3.5" /> {t('adminMarketplacePage.orders.markDelivered')}
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
                            <DollarSign className="w-3.5 h-3.5" /> {t('adminMarketplacePage.orders.markPaid')}
                          </Button>
                        )}

                        {/* Status override avanzado */}
                        <div className="flex items-center gap-2 ml-auto">
                          <Label className="text-xs text-secondary/70">{t('adminMarketplacePage.orders.statusLabel')}</Label>
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
                        <Label className="text-xs text-secondary/70 whitespace-nowrap">{t('adminMarketplacePage.orders.trackingLabel')}</Label>
                        <Input
                          placeholder={t('adminMarketplacePage.orders.trackingPlaceholder')}
                          value={trackingInput[o.id] ?? o.tracking_number ?? ''}
                          onChange={e => setTrackingInput(p => ({ ...p, [o.id]: e.target.value }))}
                          className="h-8 text-xs flex-1"
                        />
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => saveTracking(o.id)}>
                          <Truck className="w-3.5 h-3.5 mr-1" /> {t('adminMarketplacePage.common.save')}
                        </Button>
                      </div>

                      {/* Timestamps */}
                      <div className="text-[10px] text-secondary/60 space-y-0.5 pt-2 border-t border-primary/15">
                        <p>🕒 {t('adminMarketplacePage.orders.created')}: {new Date(o.created_at).toLocaleString('es-MX')}</p>
                        {o.paid_at && <p>✅ {t('adminMarketplacePage.orders.paid')}: {new Date(o.paid_at).toLocaleString('es-MX')}</p>}
                        {o.shipped_at && <p>📦 {t('adminMarketplacePage.orders.shipped')}: {new Date(o.shipped_at).toLocaleString('es-MX')}</p>}
                        {o.estimated_delivery && <p>🚚 {t('adminMarketplacePage.orders.eta')}: {new Date(o.estimated_delivery).toLocaleDateString('es-MX')}</p>}
                        {o.delivered_at && <p>🎉 {t('adminMarketplacePage.orders.delivered')}: {new Date(o.delivered_at).toLocaleString('es-MX')}</p>}
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
      <Dialog open={!!dispatchDialog.orderId} onOpenChange={(open) => !open && setDispatchDialog({ orderId: null, days: 3, tracking: '', carrier: '', trackingUrl: '' })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-secondary">
              <Truck className="w-5 h-5 text-primary" />
              {t('adminMarketplacePage.orders.dispatchOrder')}
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
                    {o.shipping_name || o.profiles?.name || t('adminMarketplacePage.orders.noRecipient')}
                    {o.shipping_city ? ` · ${o.shipping_city}` : ''}
                    {o.shipping_state ? `, ${o.shipping_state}` : ''}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t('adminMarketplacePage.orders.willArriveDays')}</Label>
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
                      ? t('adminMarketplacePage.orders.etaWithZoneEs')
                          .replace('{date}', new Date(Date.now() + (dispatchDialog.days || 0) * 86400000).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }))
                          .replace('{zone}', o.shipping_state || o.shipping_city || t('adminMarketplacePage.orders.noZone'))
                      : t('adminMarketplacePage.orders.etaSimpleEn').replace('{date}', new Date(Date.now() + (dispatchDialog.days || 0) * 86400000).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }))}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t('adminMarketplacePage.orders.carrier')}</Label>
                  <Select value={dispatchDialog.carrier} onValueChange={(v) => setDispatchDialog(d => ({ ...d, carrier: v, trackingUrl: buildTrackingUrl(v, d.tracking) }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t('adminMarketplacePage.orders.selectCarrier')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Estafeta">Estafeta</SelectItem>
                      <SelectItem value="DHL">DHL</SelectItem>
                      <SelectItem value="FedEx">FedEx</SelectItem>
                      <SelectItem value="UPS">UPS</SelectItem>
                      <SelectItem value="Redpack">Redpack</SelectItem>
                      <SelectItem value="Paquetexpress">Paquetexpress</SelectItem>
                      <SelectItem value="99minutos">99minutos</SelectItem>
                      <SelectItem value="Otro">{t('adminMarketplacePage.orders.other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t('adminMarketplacePage.orders.trackingNumber')}</Label>
                  <Input
                    placeholder="Ej: 1234567890"
                    value={dispatchDialog.tracking}
                    onChange={(e) => setDispatchDialog(d => ({ ...d, tracking: e.target.value, trackingUrl: buildTrackingUrl(d.carrier, e.target.value) }))}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t('adminMarketplacePage.orders.trackingUrlLabel')}</Label>
                  <Input
                    placeholder="https://..."
                    value={dispatchDialog.trackingUrl}
                    onChange={(e) => setDispatchDialog(d => ({ ...d, trackingUrl: e.target.value }))}
                    className="h-9 text-sm font-mono text-[11px]"
                  />
                  {dispatchDialog.trackingUrl && (
                    <a href={dispatchDialog.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary underline inline-flex items-center gap-1">
                      <Truck className="w-3 h-3" /> {t('adminMarketplacePage.orders.openNewTab')}
                    </a>
                  )}
                </div>

                <div className="bg-secondary/8 border border-secondary/25 rounded-lg p-3 text-xs text-secondary/80">
                  <p className="font-semibold mb-1 text-secondary flex items-center gap-1"><Send className="w-3 h-3" /> {t('adminMarketplacePage.orders.onConfirm')}</p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    <li>{t('adminMarketplacePage.orders.confirmStatus')}</li>
                    <li>{t('adminMarketplacePage.orders.confirmEmail')}</li>
                    <li>{t('adminMarketplacePage.orders.confirmNotification')}</li>
                  </ul>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" onClick={() => setDispatchDialog({ orderId: null, days: 3, tracking: '', carrier: '', trackingUrl: '' })} disabled={updatingId === o.id}>
                    {t('adminMarketplacePage.orders.cancel')}
                  </Button>
                  <Button onClick={confirmDispatch} disabled={updatingId === o.id} className="gap-1.5">
                    {updatingId === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {t('adminMarketplacePage.orders.confirmDispatch')}
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
function SalesTab({ es: _es }: { es: boolean }) {
  const { t } = useLanguage();
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
    toast.success(t('adminMarketplacePage.sales.reportExported'));
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <DollarSign className="w-5 h-5 text-success mx-auto mb-1" />
          <p className="text-xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">{t('adminMarketplacePage.sales.totalSales')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Package className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-xl font-bold">{stats.totalUnits}</p>
          <p className="text-[10px] text-muted-foreground">{t('adminMarketplacePage.sales.unitsSold')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Users className="w-5 h-5 text-secondary mx-auto mb-1" />
          <p className="text-xl font-bold">{stats.uniqueBuyers}</p>
          <p className="text-[10px] text-muted-foreground">{t('adminMarketplacePage.sales.buyers')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <BarChart3 className="w-5 h-5 text-warning mx-auto mb-1" />
          <p className="text-xl font-bold">${Math.round(stats.avg).toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">{t('adminMarketplacePage.sales.avgOrder')}</p>
        </CardContent></Card>
      </div>

      {/* Monthly chart */}
      {monthlyData.length > 1 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-3">{t('adminMarketplacePage.sales.salesTrend')}</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, t('adminMarketplacePage.sales.revenue')]} />
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
            <p className="text-sm font-semibold">{t('adminMarketplacePage.sales.salesByVendor')}</p>
            <Button variant="outline" size="sm" onClick={exportAccounting} className="h-7 text-xs gap-1"><Download className="w-3 h-3" /> {t('adminMarketplacePage.sales.export')}</Button>
          </div>
          <div className="space-y-2">
            {vendorBreakdown.map((v, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{v.name}</p>
                  <p className="text-[10px] text-muted-foreground">{v.orders} {t('adminMarketplacePage.sales.orders')} · {v.units} {t('adminMarketplacePage.sales.units')}</p>
                </div>
                <p className="text-sm font-bold text-primary">${v.revenue.toLocaleString()}</p>
              </div>
            ))}
            {vendorBreakdown.length === 0 && <p className="text-center text-muted-foreground py-4">{t('adminMarketplacePage.sales.noData')}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Top products */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-semibold mb-3">{t('adminMarketplacePage.sales.topProducts')}</p>
          <div className="space-y-2">
            {topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                <span className="text-xs font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{p.units} {t('adminMarketplacePage.sales.units')}</p>
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
          <p className="text-sm font-semibold mb-3">{t('adminMarketplacePage.sales.byStatus')}</p>
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
function RefundsTab({ es: _es }: { es: boolean }) {
  const { t } = useLanguage();
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
    toast.success(actionDialog === 'approve' ? t('adminMarketplacePage.refunds.refundApproved') : t('adminMarketplacePage.refunds.refundRejected'));
    setActionDialog(null); setSelected(null); setNotes(''); setRejection(''); fetchData();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('adminMarketplacePage.orders.all')}</SelectItem>
            <SelectItem value="requested">{t('adminMarketplacePage.refunds.requested')}</SelectItem>
            <SelectItem value="approved">{t('adminMarketplacePage.refunds.approved')}</SelectItem>
            <SelectItem value="rejected">{t('adminMarketplacePage.refunds.rejected')}</SelectItem>
            <SelectItem value="refunded">{t('adminMarketplacePage.refunds.refunded')}</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={fetchData} disabled={loading}>{t('adminMarketplacePage.refunds.refresh')}</Button>
      </div>

      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : refunds.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">{t('adminMarketplacePage.refunds.noRefunds')}</CardContent></Card>
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
                    <p className="text-xs mt-1 line-clamp-2"><strong>{t('adminMarketplacePage.refunds.reason')}:</strong> {r.reason}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{Number(r.amount).toFixed(2)} {r.currency}</p>
                    {r.status === 'requested' && (
                      <div className="flex gap-1 mt-2">
                        <Button size="sm" variant="default" onClick={() => { setSelected(r); setActionDialog('approve'); }}>{t('adminMarketplacePage.refunds.approve')}</Button>
                        <Button size="sm" variant="destructive" onClick={() => { setSelected(r); setActionDialog('reject'); }}>{t('adminMarketplacePage.refunds.reject')}</Button>
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
          <DialogHeader><DialogTitle>{actionDialog === 'approve' ? t('adminMarketplacePage.refunds.approveRefund') : t('adminMarketplacePage.refunds.rejectRefund')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{selected && `${Number(selected.amount).toFixed(2)} ${selected.currency} — ${selected.marketplace_orders?.marketplace_products?.name || '—'}`}</p>
            {actionDialog === 'reject' && (
              <div>
                <Label className="text-xs">{t('adminMarketplacePage.refunds.rejectionReason')}</Label>
                <Textarea value={rejection} onChange={e => setRejection(e.target.value)} rows={3} />
              </div>
            )}
            <div>
              <Label className="text-xs">{t('adminMarketplacePage.refunds.internalNotes')}</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setActionDialog(null)}>{t('adminMarketplacePage.refunds.cancel')}</Button>
              <Button onClick={handleAction} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (actionDialog === 'approve' ? t('adminMarketplacePage.refunds.approveAndRefund') : t('adminMarketplacePage.refunds.reject'))}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =================== DISPUTES TAB =================== */
function DisputesTab({ es: _es }: { es: boolean }) {
  const { t } = useLanguage();
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
  if (disputes.length === 0) return <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">{t('adminMarketplacePage.disputes.noActive')}</CardContent></Card>;
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
                {d.evidence_due_by && <p className="text-xs text-warning mt-1">{t('adminMarketplacePage.disputes.evidenceDue')} {new Date(d.evidence_due_by).toLocaleDateString()}</p>}
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
  const { t } = useLanguage();
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
    const confirmMsg = es
      ? t('adminMarketplacePage.payouts.confirmPayAllEs')
          .replace('{count}', String(eligible.length))
          .replace('{total}', eligible.reduce((s: number,e: any)=>s+Number(e.available_amount),0).toFixed(2))
      : t('adminMarketplacePage.payouts.confirmPayAllEn').replace('{count}', String(eligible.length));
    if (!confirm(confirmMsg)) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('process-vendor-payouts', { body: {} });
    setBusy(false);
    if (error || !data?.ok) { toast.error(error?.message || data?.error || 'Error'); return; }
    toast.success(t('adminMarketplacePage.payouts.payoutsProcessed').replace('{count}', String(data.processed)));
    fetchData();
  };

  const handlePayOne = async (vendorId: string) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('process-vendor-payouts', { body: { vendorIds: [vendorId] } });
    setBusy(false);
    if (error || !data?.ok) { toast.error(error?.message || data?.error || 'Error'); return; }
    toast.success(t('adminMarketplacePage.payouts.payoutSent'));
    fetchData();
  };

  if (loading) return <Loader2 className="w-5 h-5 animate-spin" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{t('adminMarketplacePage.payouts.vendorBalances')}</p>
              <p className="text-xs text-muted-foreground">{eligible.length} {t('adminMarketplacePage.payouts.eligibleVendors')} · {eligible.reduce((s: number,e: any)=>s+Number(e.available_amount),0).toFixed(2)} MXN {t('adminMarketplacePage.payouts.available')}</p>
            </div>
            <Button onClick={handlePayAll} disabled={busy || eligible.length === 0}>
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              {t('adminMarketplacePage.payouts.payAllEligible')}
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
                    {b.payouts_enabled ? <Badge variant="verified" className="text-[10px]">Stripe OK</Badge> : <Badge variant="destructive" className="text-[10px]">{t('adminMarketplacePage.payouts.noStripe')}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('adminMarketplacePage.payouts.avail')}: <strong className="text-primary">{Number(b.available_amount).toFixed(2)}</strong> · {t('adminMarketplacePage.payouts.pend')}: {Number(b.pending_amount).toFixed(2)} · {t('adminMarketplacePage.payouts.totalPaid')}: {Number(b.total_paid).toFixed(2)}</p>
                </div>
                {b.payouts_enabled && Number(b.available_amount) > 0 && (
                  <Button size="sm" variant="outline" onClick={() => handlePayOne(b.vendor_id)} disabled={busy}>
                    {t('adminMarketplacePage.payouts.pay')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">{t('adminMarketplacePage.payouts.history')}</p>
        <div className="space-y-1.5">
          {payouts.map((p: any) => (
            <Card key={p.id} className="bg-muted/30">
              <CardContent className="p-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{p.marketplace_vendors?.name || '—'}</span>
                  <span className="text-muted-foreground"> · {p.earnings_count} {t('adminMarketplacePage.payouts.sales')}</span>
                  <span className="text-muted-foreground"> · {new Date(p.initiated_at).toLocaleDateString()}</span>
                </div>
                <div className="text-right">
                  <p className="font-bold">{Number(p.total_amount).toFixed(2)} {p.currency}</p>
                  <Badge variant={p.status === 'paid' ? 'verified' : p.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px]">{p.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          {payouts.length === 0 && <p className="text-xs text-muted-foreground">{t('adminMarketplacePage.payouts.noPayouts')}</p>}
        </div>
      </div>
    </div>
  );
}

/* =================== STOCK TAB =================== */
function StockTab({ es: _es }: { es: boolean }) {
  const { t } = useLanguage();
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
        <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>{t('adminMarketplacePage.stock.all')} ({products.length})</Button>
        <Button size="sm" variant={filter === 'low' ? 'default' : 'outline'} onClick={() => setFilter('low')}>{t('adminMarketplacePage.stock.low')}</Button>
        <Button size="sm" variant={filter === 'out' ? 'default' : 'outline'} onClick={() => setFilter('out')}>{t('adminMarketplacePage.stock.out')}</Button>
      </div>
      {filtered.length === 0 ? <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">{t('adminMarketplacePage.stock.noProductsFilter')}</CardContent></Card> : (
        <div className="space-y-1.5">
          {filtered.map(p => (
            <Card key={p.id} className={p.stock === 0 ? 'border-destructive' : ''}>
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.marketplace_vendors?.name} · {p.total_sold || 0} {t('adminMarketplacePage.stock.sold')}</p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${p.stock === 0 ? 'text-destructive' : p.stock <= p.low_stock_threshold ? 'text-warning' : 'text-foreground'}`}>{p.stock}</p>
                  <p className="text-[10px] text-muted-foreground">{t('adminMarketplacePage.stock.min')} {p.low_stock_threshold}</p>
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
function AuditTab({ es: _es }: { es: boolean }) {
  const { t } = useLanguage();
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
  if (logs.length === 0) return <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">{t('adminMarketplacePage.audit.noLogs')}</CardContent></Card>;
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

/* =================== REVIEWS TAB =================== */
function ReviewsTab({ es: _es }: { es: boolean }) {
  const { t } = useLanguage();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'visible' | 'hidden'>('all');

  const fetchData = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('product_reviews')
      .select('id, rating, title, body, verified_purchase, is_hidden, created_at, vendor_reply, vendor_reply_at, reviewer_id, marketplace_products(name, marketplace_vendors(name))')
      .order('created_at', { ascending: false })
      .limit(200);
    setReviews(data || []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    if (filter === 'visible') return reviews.filter(r => !r.is_hidden);
    if (filter === 'hidden') return reviews.filter(r => r.is_hidden);
    return reviews;
  }, [reviews, filter]);

  const toggleHide = async (r: any) => {
    const { error } = await (supabase as any).from('product_reviews').update({ is_hidden: !r.is_hidden }).eq('id', r.id);
    if (error) { toast.error(error.message); return; }
    toast.success(r.is_hidden ? t('adminMarketplacePage.reviews.reviewVisible') : t('adminMarketplacePage.reviews.reviewHidden'));
    fetchData();
  };

  const deleteReview = async (id: string) => {
    if (!confirm(t('adminMarketplacePage.reviews.confirmDelete'))) return;
    const { error } = await (supabase as any).from('product_reviews').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(t('adminMarketplacePage.reviews.reviewDeleted'));
    fetchData();
  };

  if (loading) return <Loader2 className="w-5 h-5 animate-spin" />;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>{t('adminMarketplacePage.reviews.all')} ({reviews.length})</Button>
        <Button size="sm" variant={filter === 'visible' ? 'default' : 'outline'} onClick={() => setFilter('visible')}>{t('adminMarketplacePage.reviews.visible')} ({reviews.filter(r => !r.is_hidden).length})</Button>
        <Button size="sm" variant={filter === 'hidden' ? 'default' : 'outline'} onClick={() => setFilter('hidden')}>{t('adminMarketplacePage.reviews.hidden')} ({reviews.filter(r => r.is_hidden).length})</Button>
      </div>
      {filtered.length === 0 ? <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">{t('adminMarketplacePage.reviews.noReviews')}</CardContent></Card> : (
        <div className="space-y-2">
          {filtered.map(r => (
            <Card key={r.id} className={r.is_hidden ? 'bg-muted/40 opacity-70' : ''}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <div className="flex">
                        {[1,2,3,4,5].map(n => (
                          <Star key={n} className={`w-3.5 h-3.5 ${n <= r.rating ? 'fill-warning text-warning' : 'text-muted-foreground/30'}`} />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                      {r.verified_purchase && <Badge variant="verified" className="text-[10px]">✓ {t('adminMarketplacePage.reviews.verifiedPurchase')}</Badge>}
                      {r.is_hidden && <Badge variant="destructive" className="text-[10px]">{t('adminMarketplacePage.reviews.hiddenBadge')}</Badge>}
                    </div>
                    {r.title && <p className="text-sm font-semibold">{r.title}</p>}
                    {r.body && <p className="text-xs text-muted-foreground line-clamp-3 mt-1">{r.body}</p>}
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      <strong>{r.marketplace_products?.name || '—'}</strong> · {r.marketplace_products?.marketplace_vendors?.name || '—'}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleHide(r)} title={r.is_hidden ? t('adminMarketplacePage.reviews.show') : t('adminMarketplacePage.reviews.hide')}>
                      {r.is_hidden ? <EyeIcon className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteReview(r.id)} title={t('adminMarketplacePage.reviews.delete')}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
