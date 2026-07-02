import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Store, Loader2, HandHeart, ShieldCheck, Clock, Tag, Plus, PackagePlus, Lock, CheckCircle,
  Search, SlidersHorizontal, X, Sparkles, Package, Boxes, ClipboardList, MessageCircle, XCircle,
  BadgeDollarSign,
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string | null;
  image_url: string | null;
  vendor_id: string;
  category: string | null;
  stock: number;
  brand_id: string | null;
  reserved_by: string | null;
  reserved_until: string | null;
  vendorName?: string | null;
  brandName?: string | null;
  created_at?: string;
}

type SortMode = 'newest' | 'price_asc' | 'price_desc' | 'name';

interface OrderRow {
  id: string;
  status: string;          // ordered | completed | cancelled
  fee_status: string;      // none | pending | paid (fee del VENDEDOR)
  fee_amount: number;
  product_price: number;
  currency: string;
  created_at: string;
  completed_at: string | null;
  product_id: string;
  buyer_id: string;
  productName?: string | null;
  vendorName?: string | null;
  buyerName?: string | null;
}

export default function MedicalMarketplace() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const sb = supabase as any; // tablas/columnas nuevas aún no tipadas (migración con token)

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [feeRate, setFeeRate] = useState(0.1);

  // Estado del vendedor (verificación de negocio)
  const [vendor, setVendor] = useState<{ id: string; status: string } | null>(null);

  // Diálogo "Estoy interesado" (orden de compra SIN pago)
  const [interestProduct, setInterestProduct] = useState<Product | null>(null);
  const [interestTerms, setInterestTerms] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Órdenes de compra (comprador y vendedor)
  const [myOrders, setMyOrders] = useState<OrderRow[]>([]);
  const [vendorOrders, setVendorOrders] = useState<OrderRow[]>([]);
  const [actingOrderId, setActingOrderId] = useState<string | null>(null);
  const [payingFeeId, setPayingFeeId] = useState<string | null>(null);

  // Diálogo "Quiero vender"
  const [sellOpen, setSellOpen] = useState(false);
  const [sellTerms, setSellTerms] = useState(false);
  const [sellForm, setSellForm] = useState({ name: '', phone: '', location: '', legal_name: '', tax_id: '' });
  const [submittingSell, setSubmittingSell] = useState(false);

  // Diálogo "Publicar producto" (vendedor aprobado)
  const [pubOpen, setPubOpen] = useState(false);
  const [pubForm, setPubForm] = useState({ name: '', price: '', description: '', image_url: '' });
  const [publishing, setPublishing] = useState(false);

  // ===== Filtros =====
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterBrand, setFilterBrand] = useState('all');
  const [filterInStock, setFilterInStock] = useState(false);
  const [filterAvailable, setFilterAvailable] = useState(false); // ocultar apartados
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quick, setQuick] = useState<string>(''); // chip rápido activo

  const canUse = role === 'doctor' || role === 'resident' || role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: cfg } = await sb.from('marketplace_config').select('fee_rate').eq('id', true).maybeSingle();
      if (cfg?.fee_rate != null) setFeeRate(Number(cfg.fee_rate));

      const { data: prods } = await sb.from('marketplace_products')
        .select('id, name, description, price, currency, image_url, vendor_id, category, stock, brand_id, reserved_by, reserved_until, created_at, marketplace_vendors(name), marketplace_brands(name)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      setProducts((prods || []).map((p: any) => ({ ...p, vendorName: p.marketplace_vendors?.name, brandName: p.marketplace_brands?.name })));

      if (user?.id) {
        const { data: v } = await sb.from('marketplace_vendors').select('id, status').eq('user_id', user.id).maybeSingle();
        setVendor(v || null);

        // Mis órdenes como comprador (activas o concretadas)
        // OJO: hint de FK obligatorio — product_interests↔marketplace_products tiene
        // dos relaciones (product_id y reserved_interest_id) y PostgREST no desambigua solo.
        const orderCols = 'id, status, fee_status, fee_amount, product_price, currency, created_at, completed_at, product_id, buyer_id, marketplace_products!product_interests_product_id_fkey(name), marketplace_vendors(name)';
        const { data: mine } = await sb.from('product_interests')
          .select(orderCols)
          .eq('buyer_id', user.id)
          .in('status', ['ordered', 'completed'])
          .order('created_at', { ascending: false });
        setMyOrders((mine || []).map((o: any) => ({ ...o, productName: o.marketplace_products?.name, vendorName: o.marketplace_vendors?.name })));

        // Órdenes recibidas sobre MIS productos (soy vendedor)
        if (v?.id) {
          const { data: vo } = await sb.from('product_interests')
            .select(orderCols)
            .eq('vendor_id', v.id)
            .in('status', ['ordered', 'completed'])
            .order('created_at', { ascending: false });
          const rows: OrderRow[] = (vo || []).map((o: any) => ({ ...o, productName: o.marketplace_products?.name }));
          const buyerIds = Array.from(new Set(rows.map(o => o.buyer_id)));
          if (buyerIds.length > 0) {
            const { data: bp } = await sb.from('profiles_public').select('id, name').in('id', buyerIds);
            const names = new Map((bp || []).map((p: any) => [p.id, p.name]));
            rows.forEach(o => { o.buyerName = names.get(o.buyer_id) || null; });
          }
          setVendorOrders(rows);
        } else {
          setVendorOrders([]);
        }
      }
    } catch (e) {
      console.error('[MedicalMarketplace] load', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { if (canUse) load(); else setLoading(false); }, [canUse, load]);

  // Opciones dinámicas para los selects (a partir de lo que realmente hay)
  const categories = useMemo(
    () => Array.from(new Set(products.map(p => p.category).filter(Boolean) as string[])).sort(),
    [products],
  );
  const brands = useMemo(() => {
    const m = new Map<string, string>();
    products.forEach(p => { if (p.brand_id && p.brandName) m.set(p.brand_id, p.brandName); });
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);
  const maxPrice = useMemo(() => Math.max(...products.map(p => p.price || 0), 1000), [products]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filterCat !== 'all') c++;
    if (filterBrand !== 'all') c++;
    if (filterInStock) c++;
    if (filterAvailable) c++;
    if (priceRange[0] > 0 || priceRange[1] < maxPrice) c++;
    if (search) c++;
    return c;
  }, [filterCat, filterBrand, filterInStock, filterAvailable, priceRange, search, maxPrice]);

  const clearFilters = () => {
    setFilterCat('all'); setFilterBrand('all'); setFilterInStock(false); setFilterAvailable(false);
    setPriceRange([0, maxPrice]); setSortMode('newest'); setSearch(''); setQuick('');
  };

  const isReservedNow = (p: Product) => !!(p.reserved_by && p.reserved_until && new Date(p.reserved_until) > new Date());

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (filterCat !== 'all' && p.category !== filterCat) return false;
      if (filterBrand !== 'all' && p.brand_id !== filterBrand) return false;
      if (filterInStock && (p.stock ?? 0) <= 0) return false;
      if (filterAvailable && isReservedNow(p)) return false;
      if (p.price < priceRange[0] || p.price > priceRange[1]) return false;
      if (search) {
        const s = search.toLowerCase();
        return p.name.toLowerCase().includes(s)
          || (p.description || '').toLowerCase().includes(s)
          || (p.vendorName || '').toLowerCase().includes(s)
          || (p.brandName || '').toLowerCase().includes(s);
      }
      return true;
    }).sort((a, b) => {
      if (sortMode === 'price_asc') return a.price - b.price;
      if (sortMode === 'price_desc') return b.price - a.price;
      if (sortMode === 'name') return a.name.localeCompare(b.name);
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [products, filterCat, filterBrand, filterInStock, filterAvailable, priceRange, search, sortMode]);

  // Chips rápidos inteligentes
  const applyQuick = (key: string) => {
    if (quick === key) { clearFilters(); return; }
    clearFilters();
    setQuick(key);
    if (key === 'available') setFilterAvailable(true);
    else if (key === 'instock') setFilterInStock(true);
    else if (key === 'budget') setPriceRange([0, 1000]);
    else if (key === 'mid') setPriceRange([1000, 10000]);
    else if (key === 'premium') setPriceRange([10000, maxPrice]);
    else if (key.startsWith('cat:')) setFilterCat(key.slice(4));
  };

  const topCats = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach(p => { if (p.category) counts.set(p.category, (counts.get(p.category) || 0) + 1); });
    return Array.from(counts, ([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 4);
  }, [products]);

  // "Estoy interesado" → orden de compra SIN pago: notifica al proveedor (y al
  // admin) y abre el chat para acordar los pormenores.
  const startInterest = async () => {
    if (!interestProduct || !interestTerms) return;
    setSendingId(interestProduct.id);
    try {
      const { data, error } = await supabase.functions.invoke('marketplace-order', {
        body: { action: 'create', product_id: interestProduct.id, terms_accepted: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setInterestProduct(null);
      toast({
        title: '📋 Orden de compra enviada',
        description: 'El proveedor ya fue notificado. Te abrimos el chat para acordar los detalles.',
      });
      navigate('/chat');
    } catch (e: any) {
      toast({ title: 'No se pudo enviar la orden', description: e.message || 'Error', variant: 'destructive' });
    } finally {
      setSendingId(null);
    }
  };

  // Vendedor concreta la venta (sin pago de por medio) o cualquiera cancela la orden.
  const orderAction = async (orderId: string, action: 'complete' | 'cancel') => {
    setActingOrderId(orderId);
    try {
      const { data, error } = await supabase.functions.invoke('marketplace-order', {
        body: { action, interest_id: orderId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast(action === 'complete'
        ? { title: '🤝 Venta concretada', description: 'Se notificó al comprador y al administrador. Recuerda pagar el fee de la plataforma.' }
        : { title: 'Orden cancelada', description: 'Se notificó a la otra parte.' });
      load();
    } catch (e: any) {
      toast({ title: 'No se pudo completar', description: e.message || 'Error', variant: 'destructive' });
    } finally {
      setActingOrderId(null);
    }
  };

  // El VENDEDOR paga el fee de la venta concretada (Stripe).
  const payFee = async (orderId: string) => {
    setPayingFeeId(orderId);
    try {
      const { data, error } = await supabase.functions.invoke('marketplace-order', {
        body: { action: 'pay_fee', interest_id: orderId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) { window.location.href = data.url; return; }
      throw new Error('No se recibió el enlace de pago');
    } catch (e: any) {
      toast({ title: 'No se pudo iniciar el pago del fee', description: e.message || 'Error', variant: 'destructive' });
    } finally {
      setPayingFeeId(null);
    }
  };

  // Retorno del checkout del fee del vendedor.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('fee_paid') === '1') {
      toast({ title: '✅ Fee pagado', description: 'Gracias. El pago puede tardar unos segundos en reflejarse.' });
      window.history.replaceState({}, '', '/marketplace');
    } else if (params.get('fee_canceled') === '1') {
      toast({ title: 'Pago de fee cancelado', description: 'Puedes reintentarlo desde tus órdenes.', variant: 'destructive' });
      window.history.replaceState({}, '', '/marketplace');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitSell = async () => {
    if (!sellTerms || !sellForm.name.trim()) {
      toast({ title: 'Faltan datos', description: 'Completa el nombre del negocio y acepta los términos.', variant: 'destructive' });
      return;
    }
    setSubmittingSell(true);
    try {
      const { error } = await sb.from('marketplace_vendors').insert({
        user_id: user!.id,
        name: sellForm.name.trim(),
        phone: sellForm.phone || null,
        location: sellForm.location || null,
        legal_name: sellForm.legal_name || null,
        tax_id: sellForm.tax_id || null,
        status: 'pending',
        terms_accepted_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast({ title: '✅ Solicitud enviada', description: 'Un administrador revisará tu verificación de negocio.' });
      setSellOpen(false);
      setSellTerms(false);
      load();
    } catch (e: any) {
      toast({ title: 'No se pudo enviar', description: e.message, variant: 'destructive' });
    } finally {
      setSubmittingSell(false);
    }
  };

  const publishProduct = async () => {
    const price = Number(pubForm.price);
    if (!pubForm.name.trim() || !Number.isFinite(price) || price <= 0) {
      toast({ title: 'Datos inválidos', description: 'Nombre y precio válido son obligatorios.', variant: 'destructive' });
      return;
    }
    setPublishing(true);
    try {
      const { error } = await sb.from('marketplace_products').insert({
        vendor_id: vendor!.id,
        name: pubForm.name.trim(),
        description: pubForm.description || null,
        price,
        currency: 'MXN',
        image_url: pubForm.image_url || null,
        is_active: true,
        stock: 1,
      });
      if (error) throw error;
      toast({ title: '✅ Producto publicado', description: 'Ya aparece en el marketplace.' });
      setPubOpen(false);
      setPubForm({ name: '', price: '', description: '', image_url: '' });
      load();
    } catch (e: any) {
      toast({ title: 'No se pudo publicar', description: e.message, variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  const feeFor = (price: number) => Math.round(price * feeRate * 100) / 100;
  const isReserved = (p: Product) => p.reserved_by && p.reserved_until && new Date(p.reserved_until) > new Date();
  const mine = (p: Product) => vendor && p.vendor_id === vendor.id;

  const filterPanel = (
    <div className="space-y-5">
      {/* Categoría */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Categoría</p>
        <Select value={filterCat} onValueChange={(v) => { setFilterCat(v); setQuick(''); }}>
          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Marca */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Marca</p>
        <Select value={filterBrand} onValueChange={(v) => { setFilterBrand(v); setQuick(''); }}>
          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las marcas</SelectItem>
            {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <hr className="border-border/50" />

      {/* Precio */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Precio (MXN)</p>
        <div className="flex gap-2 mb-2">
          <Input type="number" placeholder="Min" value={priceRange[0] || ''} onChange={e => { setPriceRange([Number(e.target.value) || 0, priceRange[1]]); setQuick(''); }} className="h-8 text-xs" />
          <Input type="number" placeholder="Max" value={priceRange[1] || ''} onChange={e => { setPriceRange([priceRange[0], Number(e.target.value) || maxPrice]); setQuick(''); }} className="h-8 text-xs" />
        </div>
        <Slider value={priceRange} onValueChange={([a, b]) => { setPriceRange([a, b]); setQuick(''); }} min={0} max={maxPrice} step={50} className="py-2" />
        <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
          <span>${priceRange[0].toLocaleString()}</span>
          <span>${priceRange[1].toLocaleString()}</span>
        </div>
      </div>

      <hr className="border-border/50" />

      {/* Unidades / disponibilidad */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Con unidades en stock</p>
        <Switch checked={filterInStock} onCheckedChange={(v) => { setFilterInStock(v); setQuick(''); }} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ocultar apartados</p>
        <Switch checked={filterAvailable} onCheckedChange={(v) => { setFilterAvailable(v); setQuick(''); }} />
      </div>

      <hr className="border-border/50" />

      {/* Ordenar */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Ordenar por</p>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            { value: 'newest', label: 'Recientes' },
            { value: 'price_asc', label: 'Precio ↑' },
            { value: 'price_desc', label: 'Precio ↓' },
            { value: 'name', label: 'Nombre' },
          ] as { value: SortMode; label: string }[]).map(s => (
            <button key={s.value} onClick={() => setSortMode(s.value)} className={`py-2 rounded-lg text-xs font-medium transition-all text-center ${sortMode === s.value ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-offset-1 ring-primary/20' : 'bg-muted/60 text-muted-foreground hover:bg-muted'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {activeFilterCount > 0 && (
        <>
          <hr className="border-border/50" />
          <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10">
            <X className="w-3.5 h-3.5" /> Limpiar filtros ({activeFilterCount})
          </Button>
        </>
      )}
    </div>
  );

  if (!canUse) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <Lock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">Marketplace exclusivo para profesionales</h2>
          <p className="text-muted-foreground">Solo doctores y residentes verificados pueden comprar y vender aquí.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
          <div className="flex items-center gap-2">
            <Store className="w-6 h-6 text-primary" />
            <h1 className="font-heading text-2xl font-bold">Marketplace médico</h1>
          </div>
          {/* CTA vendedor según su estado */}
          {!vendor && (
            <Button onClick={() => setSellOpen(true)} variant="outline" className="gap-2">
              <PackagePlus className="w-4 h-4" /> Quiero vender
            </Button>
          )}
          {vendor?.status === 'pending' && (
            <Badge variant="secondary" className="gap-1 h-9 px-3"><Clock className="w-3.5 h-3.5" /> Verificación en revisión</Badge>
          )}
          {vendor?.status === 'approved' && (
            <Button onClick={() => setPubOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Publicar producto</Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4">Compra y vende material entre colegas. Al mostrar interés se envía una orden de compra al proveedor y se abre el chat para acordar los pormenores — no pagas nada dentro de la plataforma.</p>

        {/* Búsqueda + botón filtros (móvil) */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar producto, marca o proveedor…" value={search} onChange={e => { setSearch(e.target.value); setQuick(''); }} className="pl-9 h-11 border-2 border-primary/30 shadow-sm focus-visible:ring-primary/40 focus-visible:border-primary" />
            {search && <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>}
          </div>
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button type="button" aria-label="Abrir filtros" variant="outline" size="icon" className="h-11 w-11 relative sm:hidden flex-shrink-0">
                <SlidersHorizontal className="w-4 h-4" />
                {activeFilterCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center">{activeFilterCount}</span>}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
              <SheetHeader><SheetTitle>Filtros y orden</SheetTitle></SheetHeader>
              <div className="mt-4 overflow-y-auto max-h-[calc(85vh-120px)] pb-6">{filterPanel}</div>
              <div className="pt-3 border-t">
                <Button type="button" onClick={() => setFiltersOpen(false)} className="w-full">Ver {filteredProducts.length} resultados</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Chips rápidos inteligentes */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
          {[
            { key: 'available', label: 'Disponibles ahora', icon: <Sparkles className="w-3 h-3" /> },
            { key: 'instock', label: 'Con stock', icon: <Boxes className="w-3 h-3" /> },
            { key: 'budget', label: 'Hasta $1,000', icon: <Tag className="w-3 h-3" /> },
            { key: 'mid', label: '$1,000 – $10,000', icon: <Tag className="w-3 h-3" /> },
            { key: 'premium', label: 'Equipo mayor +$10k', icon: <Tag className="w-3 h-3" /> },
            ...topCats.map(c => ({ key: `cat:${c.name}`, label: c.name, icon: <Package className="w-3 h-3" /> })),
          ].map(chip => (
            <button
              key={chip.key}
              type="button"
              onClick={() => applyQuick(chip.key)}
              className={`flex items-center gap-1 whitespace-nowrap flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
                quick === chip.key
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
              }`}
            >
              {chip.icon}{chip.label}
            </button>
          ))}
        </div>

        {/* Órdenes de compra recibidas (soy vendedor) */}
        {!loading && vendorOrders.length > 0 && (
          <Card className="mb-4 border-primary/30">
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-3"><ClipboardList className="w-4 h-4 text-primary" /> Órdenes de compra recibidas</h2>
              <div className="space-y-2">
                {vendorOrders.map(o => (
                  <div key={o.id} className="rounded-lg border border-border p-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{o.productName || 'Producto'}</p>
                      <p className="text-xs text-muted-foreground">
                        {o.buyerName || 'Comprador'} · ${Number(o.product_price).toLocaleString()} · {new Date(o.created_at).toLocaleDateString('es-MX')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {o.status === 'ordered' && (
                        <>
                          <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={() => navigate('/chat')}>
                            <MessageCircle className="w-3.5 h-3.5" /> Chat
                          </Button>
                          <Button type="button" size="sm" className="h-8 gap-1" disabled={actingOrderId === o.id} onClick={() => orderAction(o.id, 'complete')}>
                            {actingOrderId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} Concretar venta
                          </Button>
                          <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 text-destructive hover:text-destructive" disabled={actingOrderId === o.id} onClick={() => orderAction(o.id, 'cancel')}>
                            <XCircle className="w-3.5 h-3.5" /> Cancelar
                          </Button>
                        </>
                      )}
                      {o.status === 'completed' && o.fee_status === 'pending' && (
                        <>
                          <Badge variant="success" className="gap-1"><CheckCircle className="w-3 h-3" /> Venta concretada</Badge>
                          <Button type="button" size="sm" className="h-8 gap-1" disabled={payingFeeId === o.id} onClick={() => payFee(o.id)}>
                            {payingFeeId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeDollarSign className="w-3.5 h-3.5" />} Pagar fee ${Number(o.fee_amount).toLocaleString()}
                          </Button>
                        </>
                      )}
                      {o.status === 'completed' && o.fee_status === 'paid' && (
                        <Badge variant="success" className="gap-1"><CheckCircle className="w-3 h-3" /> Venta concretada · fee pagado</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mis órdenes como comprador */}
        {!loading && myOrders.length > 0 && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-3"><HandHeart className="w-4 h-4 text-primary" /> Mis órdenes de compra</h2>
              <div className="space-y-2">
                {myOrders.map(o => (
                  <div key={o.id} className="rounded-lg border border-border p-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{o.productName || 'Producto'}</p>
                      <p className="text-xs text-muted-foreground">
                        {o.vendorName || 'Proveedor'} · ${Number(o.product_price).toLocaleString()} · {new Date(o.created_at).toLocaleDateString('es-MX')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {o.status === 'ordered' ? (
                        <>
                          <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> Orden enviada</Badge>
                          <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={() => navigate('/chat')}>
                            <MessageCircle className="w-3.5 h-3.5" /> Chat
                          </Button>
                          <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 text-destructive hover:text-destructive" disabled={actingOrderId === o.id} onClick={() => orderAction(o.id, 'cancel')}>
                            <XCircle className="w-3.5 h-3.5" /> Cancelar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Badge variant="success" className="gap-1"><CheckCircle className="w-3 h-3" /> Venta concretada</Badge>
                          <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={() => navigate('/chat')}>
                            <MessageCircle className="w-3.5 h-3.5" /> Chat
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : products.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Aún no hay productos publicados.</CardContent></Card>
        ) : (
          <div className="flex gap-6">
            {/* Sidebar de filtros (desktop) */}
            <aside className="hidden sm:block w-56 flex-shrink-0 sticky top-20 self-start">
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-1.5"><SlidersHorizontal className="w-4 h-4 text-primary" /> Filtros</h3>
                {filterPanel}
              </div>
            </aside>

            {/* Resultados */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-3">{filteredProducts.length} {filteredProducts.length === 1 ? 'producto' : 'productos'}</p>
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-16 px-4">
                  <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4"><Package className="w-7 h-7 text-muted-foreground" /></div>
                  <p className="text-sm font-medium text-foreground mb-1">Ningún producto con esos filtros</p>
                  <Button type="button" variant="outline" size="sm" className="mt-3" onClick={clearFilters}>Limpiar filtros</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProducts.map(p => {
                    const reserved = isReserved(p);
                    return (
                      <Card key={p.id} className="overflow-hidden flex flex-col">
                        {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-40 object-cover" />}
                        <CardContent className="p-4 flex flex-col flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            {p.brandName && <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5"><Tag className="w-2.5 h-2.5" />{p.brandName}</Badge>}
                            {p.category && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{p.category}</Badge>}
                          </div>
                          <h3 className="font-semibold text-sm leading-tight">{p.name}</h3>
                          {p.vendorName && <p className="text-xs text-muted-foreground mt-0.5">{p.vendorName}</p>}
                          {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                          <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-lg font-bold">${Number(p.price).toLocaleString()}</span>
                            {mine(p) && <span className="text-[11px] text-muted-foreground flex items-center gap-0.5"><Tag className="w-3 h-3" /> fee al vender ${feeFor(Number(p.price)).toLocaleString()}</span>}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1"><Boxes className="w-3 h-3" /> {(p.stock ?? 0) > 0 ? `${p.stock} ${p.stock === 1 ? 'unidad' : 'unidades'}` : 'Sin unidades'}</p>
                          <div className="mt-auto pt-2">
                            {mine(p) ? (
                              <Badge variant="outline" className="w-full justify-center py-1">Tu producto</Badge>
                            ) : myOrders.some(o => o.product_id === p.id && o.status === 'ordered') ? (
                              <Button type="button" size="sm" variant="outline" className="w-full gap-1.5" onClick={() => navigate('/chat')}>
                                <MessageCircle className="w-4 h-4" /> Orden enviada — ver chat
                              </Button>
                            ) : reserved ? (
                              <Badge variant="secondary" className="w-full justify-center py-1 gap-1"><Clock className="w-3 h-3" /> Apartado</Badge>
                            ) : (
                              <Button type="button" size="sm" className="w-full gap-1.5" disabled={sendingId === p.id}
                                onClick={() => { setInterestProduct(p); setInterestTerms(false); }}>
                                {sendingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <HandHeart className="w-4 h-4" />} Estoy interesado
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Diálogo Estoy interesado */}
      <Dialog open={!!interestProduct} onOpenChange={(o) => !o && setInterestProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><HandHeart className="w-5 h-5 text-primary" /> Estoy interesado</DialogTitle>
            <DialogDescription>
              Se enviará una <b>orden de compra</b> al proveedor y se abrirá un chat para acordar los pormenores (entrega, forma de pago, etc.) directamente con él.
            </DialogDescription>
          </DialogHeader>
          {interestProduct && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>{interestProduct.name}</span><b>${Number(interestProduct.price).toLocaleString()}</b></div>
              <p className="text-xs text-muted-foreground pt-1">No se realiza ningún pago dentro de la plataforma. Todo lo acuerdas directamente con el proveedor por el chat.</p>
            </div>
          )}
          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox checked={interestTerms} onCheckedChange={(v) => setInterestTerms(!!v)} className="mt-0.5" />
            <span>Acepto los <b>términos y condiciones</b> de intermediación del marketplace.</span>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInterestProduct(null)}>Cancelar</Button>
            <Button disabled={!interestTerms || !!sendingId} onClick={startInterest} className="gap-2">
              {sendingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Enviar orden de compra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo Quiero vender (verificación de negocio) */}
      <Dialog open={sellOpen} onOpenChange={setSellOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Solicitar verificación de negocio</DialogTitle>
            <DialogDescription>Un administrador revisará tus datos. Al aprobarte podrás publicar productos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nombre del negocio *</Label><Input value={sellForm.name} onChange={e => setSellForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Teléfono</Label><Input value={sellForm.phone} onChange={e => setSellForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Ubicación</Label><Input value={sellForm.location} onChange={e => setSellForm(f => ({ ...f, location: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Razón social</Label><Input value={sellForm.legal_name} onChange={e => setSellForm(f => ({ ...f, legal_name: e.target.value }))} /></div>
              <div className="space-y-1"><Label>RFC / Tax ID</Label><Input value={sellForm.tax_id} onChange={e => setSellForm(f => ({ ...f, tax_id: e.target.value }))} /></div>
            </div>
            <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox checked={sellTerms} onCheckedChange={(v) => setSellTerms(!!v)} className="mt-0.5" />
              <span>Acepto los <b>términos y condiciones</b> para vendedores.</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSellOpen(false)}>Cancelar</Button>
            <Button disabled={submittingSell} onClick={submitSell} className="gap-2">
              {submittingSell ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Enviar solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo Publicar producto */}
      <Dialog open={pubOpen} onOpenChange={setPubOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PackagePlus className="w-5 h-5 text-primary" /> Publicar producto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nombre *</Label><Input value={pubForm.name} onChange={e => setPubForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Precio (MXN) *</Label><Input type="number" min={1} value={pubForm.price} onChange={e => setPubForm(f => ({ ...f, price: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Descripción</Label><Textarea rows={3} value={pubForm.description} onChange={e => setPubForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="space-y-1"><Label>URL de imagen</Label><Input value={pubForm.image_url} onChange={e => setPubForm(f => ({ ...f, image_url: e.target.value }))} /></div>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5"><Tag className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> Al concretar una venta pagarás a la plataforma un fee del {Math.round(feeRate * 100)}% del precio{pubForm.price && Number(pubForm.price) > 0 ? ` (≈ $${feeFor(Number(pubForm.price)).toLocaleString()})` : ''}. El comprador no paga nada aquí.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPubOpen(false)}>Cancelar</Button>
            <Button disabled={publishing} onClick={publishProduct} className="gap-2">
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
