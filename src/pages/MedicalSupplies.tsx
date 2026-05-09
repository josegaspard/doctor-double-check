import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useFeaturedListings } from '@/hooks/useFeaturedListings';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { Package, Search, Loader2, ShoppingCart, Store, Phone, Globe, MapPin, Sparkles, SlidersHorizontal, X, ArrowUpDown, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type SortMode = 'featured' | 'price_asc' | 'price_desc' | 'name' | 'newest';

export default function MedicalSupplies() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const es = language === 'es';
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterVendor, setFilterVendor] = useState('all');
  const [filterInStock, setFilterInStock] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
  const [sortMode, setSortMode] = useState<SortMode>('featured');
  const [tab, setTab] = useState('products');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [purchasing, setPurchasing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [shippingDialog, setShippingDialog] = useState(false);
  const [shippingForm, setShippingForm] = useState({ name: '', phone: '', city: '', state: '', zip: '', notes: '' });
  const [pendingProduct, setPendingProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const { featuredIds, featuredMap, trackImpression, trackClick } = useFeaturedListings('product');
  const impressionTrackerRef = useRef(new Set());

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [{ data: p }, { data: c }, { data: v }] = await Promise.all([
        supabase.from('marketplace_products').select('*, marketplace_vendors(name, logo_url, website, phone, location)').eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('marketplace_categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('marketplace_vendors').select('*').eq('status', 'approved').order('name'),
      ]);
      setProducts(p || []); setCategories(c || []); setVendors(v || []); setLoading(false);
    };
    fetchAll();
  }, []);

  useEffect(() => {
    if (loading) return;
    products.forEach(p => {
      if (featuredIds.has(p.id) && !impressionTrackerRef.current.has(p.id)) {
        impressionTrackerRef.current.add(p.id);
        trackImpression(p.id);
      }
    });
  }, [products, featuredIds, loading, trackImpression]);

  const maxPrice = useMemo(() => Math.max(...products.map(p => p.price || 0), 1000), [products]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filterCat !== 'all') c++;
    if (filterVendor !== 'all') c++;
    if (filterInStock) c++;
    if (priceRange[0] > 0 || priceRange[1] < maxPrice) c++;
    if (sortMode !== 'featured') c++;
    return c;
  }, [filterCat, filterVendor, filterInStock, priceRange, sortMode, maxPrice]);

  const clearFilters = () => {
    setFilterCat('all'); setFilterVendor('all'); setFilterInStock(false);
    setPriceRange([0, maxPrice]); setSortMode('featured'); setSearch('');
  };

  const startPurchase = (product) => {
    if (!user) { toast.error(es ? 'Inicia sesión para comprar' : 'Log in to purchase'); return; }
    setPendingProduct(product);
    setQuantity(1);
    setSelectedProduct(null);
    setShippingDialog(true);
  };

  const handlePurchase = async () => {
    if (!pendingProduct || !shippingForm.name || !shippingForm.city) {
      toast.error(es ? 'Nombre y ciudad son obligatorios' : 'Name and city are required');
      return;
    }
    setPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-marketplace-checkout', {
        body: {
          product_id: pendingProduct.id,
          quantity,
          shipping: shippingForm,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
        toast.success(es ? 'Redirigiendo al pago...' : 'Redirecting to payment...');
        setShippingDialog(false);
        setPendingProduct(null);
        setShippingForm({ name: '', phone: '', city: '', state: '', zip: '', notes: '' });
      } else {
        throw new Error(data?.error || 'No checkout URL returned');
      }
    } catch (err) { toast.error(err.message); }
    setPurchasing(false);
  };

  const handleProductClick = (product) => {
    if (featuredIds.has(product.id)) trackClick(product.id);
    setSelectedProduct(product);
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (filterCat !== 'all' && p.category !== filterCat) return false;
      if (filterVendor !== 'all' && p.vendor_id !== filterVendor) return false;
      if (filterInStock && p.stock <= 0) return false;
      if (p.price < priceRange[0] || p.price > priceRange[1]) return false;
      if (search) {
        const s = search.toLowerCase();
        return p.name.toLowerCase().includes(s) || (p.description || '').toLowerCase().includes(s) || (p.marketplace_vendors?.name || '').toLowerCase().includes(s);
      }
      return true;
    }).sort((a, b) => {
      const aF = featuredIds.has(a.id) ? (featuredMap[a.id]?.priority || 1) : 0;
      const bF = featuredIds.has(b.id) ? (featuredMap[b.id]?.priority || 1) : 0;
      if (sortMode === 'featured') { if (aF !== bF) return bF - aF; return 0; }
      if (sortMode === 'price_asc') return a.price - b.price;
      if (sortMode === 'price_desc') return b.price - a.price;
      if (sortMode === 'name') return a.name.localeCompare(b.name);
      if (sortMode === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return bF - aF;
    });
  }, [products, filterCat, filterVendor, filterInStock, priceRange, search, sortMode, featuredIds, featuredMap]);

  const FilterPanel = () => (
    <div className="space-y-6">
      {/* Category */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">{es ? 'Categoría' : 'Category'}</p>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={es ? 'Todas' : 'All'} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{es ? 'Todas' : 'All'}</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={es ? c.name_es : c.name_en}>{es ? c.name_es : c.name_en}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <hr className="border-border/50" />

      {/* Vendor */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">{es ? 'Proveedor' : 'Vendor'}</p>
        <Select value={filterVendor} onValueChange={setFilterVendor}>
          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={es ? 'Todos' : 'All'} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{es ? 'Todos' : 'All'}</SelectItem>
            {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <hr className="border-border/50" />

      {/* Price range */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">{es ? 'Rango de precio' : 'Price Range'}</p>
        <div className="flex gap-2 mb-2">
          <Input type="number" placeholder="Min" value={priceRange[0] || ''} onChange={e => setPriceRange([Number(e.target.value) || 0, priceRange[1]])} className="h-8 text-xs" />
          <Input type="number" placeholder="Max" value={priceRange[1] || ''} onChange={e => setPriceRange([priceRange[0], Number(e.target.value) || maxPrice])} className="h-8 text-xs" />
        </div>
        <Slider value={priceRange} onValueChange={([a, b]) => setPriceRange([a, b])} min={0} max={maxPrice} step={50} className="py-2" />
        <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
          <span>${priceRange[0].toLocaleString()}</span>
          <span>${priceRange[1].toLocaleString()}</span>
        </div>
      </div>

      <hr className="border-border/50" />

      {/* In stock */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{es ? 'Solo en stock' : 'In stock only'}</p>
        <Switch checked={filterInStock} onCheckedChange={setFilterInStock} />
      </div>

      <hr className="border-border/50" />

      {/* Sort */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">{es ? 'Ordenar por' : 'Sort by'}</p>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            { value: 'featured', label: es ? 'Destacados' : 'Featured' },
            { value: 'price_asc', label: es ? 'Precio ↑' : 'Price ↑' },
            { value: 'price_desc', label: es ? 'Precio ↓' : 'Price ↓' },
            { value: 'name', label: es ? 'Nombre' : 'Name' },
            { value: 'newest', label: es ? 'Recientes' : 'Newest' },
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
            <X className="w-3.5 h-3.5" /> {es ? 'Limpiar filtros' : 'Clear filters'} ({activeFilterCount})
          </Button>
        </>
      )}
    </div>
  );

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        {/* Hero */}
        <div className="mb-6 rounded-2xl border-2 border-primary/40 bg-card shadow-xl dark:bg-[hsl(223,55%,18%)] p-5 sm:p-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0"><Package className="w-6 h-6 text-primary" /></div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">{es ? 'Material Médico' : 'Medical Supplies'}</h1>
              <p className="text-sm text-muted-foreground">{es ? 'Marketplace de insumos y equipos médicos' : 'Medical equipment & supplies marketplace'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" />{products.length} {es ? 'productos' : 'products'}</span>
            <span className="flex items-center gap-1"><Store className="w-3.5 h-3.5" />{vendors.length} {es ? 'proveedores' : 'vendors'}</span>
          </div>
          <div className="mt-4 flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => navigate('/vendor/dashboard')} className="text-xs gap-1"><Store className="w-3.5 h-3.5" />{es ? '¿Eres proveedor? Vende aquí' : 'Are you a vendor? Sell here'}</Button>
            {user && <Button variant="default" size="sm" onClick={() => navigate('/my-orders')} className="text-xs gap-1"><ClipboardList className="w-3.5 h-3.5" />{es ? 'Mis Compras' : 'My Orders'}</Button>}
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <Button variant={tab === 'products' ? 'default' : 'outline'} size="sm" onClick={() => setTab('products')} className="gap-1.5"><Package className="w-4 h-4" />{es ? 'Productos' : 'Products'}</Button>
          <Button variant={tab === 'vendors' ? 'default' : 'outline'} size="sm" onClick={() => setTab('vendors')} className="gap-1.5"><Store className="w-4 h-4" />{es ? 'Proveedores' : 'Vendors'}</Button>
        </div>

        {tab === 'products' && (
          <>
            {/* Search + Filter bar */}
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder={es ? 'Buscar productos...' : 'Search products...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>}
              </div>
              <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="h-10 w-10 relative sm:hidden flex-shrink-0">
                    <SlidersHorizontal className="w-4 h-4" />
                    {activeFilterCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center">{activeFilterCount}</span>}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
                  <SheetHeader><SheetTitle>{es ? 'Filtros y Ordenar' : 'Filters & Sort'}</SheetTitle></SheetHeader>
                  <div className="mt-4 overflow-y-auto max-h-[calc(85vh-100px)] pb-6"><FilterPanel /></div>
                  <div className="pt-3 border-t">
                    <Button onClick={() => setFiltersOpen(false)} className="w-full">{es ? `Ver ${filteredProducts.length} resultados` : `Show ${filteredProducts.length} results`}</Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Mobile filter chips */}
            {activeFilterCount > 0 && (
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1 sm:hidden">
                {filterCat !== 'all' && <Badge variant="secondary" className="text-[10px] gap-1 flex-shrink-0 cursor-pointer" onClick={() => setFilterCat('all')}>{filterCat} <X className="w-2.5 h-2.5" /></Badge>}
                {filterVendor !== 'all' && <Badge variant="secondary" className="text-[10px] gap-1 flex-shrink-0 cursor-pointer" onClick={() => setFilterVendor('all')}>{vendors.find(v => v.id === filterVendor)?.name} <X className="w-2.5 h-2.5" /></Badge>}
                {filterInStock && <Badge variant="secondary" className="text-[10px] gap-1 flex-shrink-0 cursor-pointer" onClick={() => setFilterInStock(false)}>En stock <X className="w-2.5 h-2.5" /></Badge>}
              </div>
            )}

            <div className="flex gap-6">
              {/* Desktop sidebar */}
              <aside className="hidden sm:block w-60 flex-shrink-0 sticky top-20 self-start">
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-4 h-4 text-primary" />
                    {es ? 'Filtros' : 'Filters'}
                  </h3>
                  <FilterPanel />
                </div>
              </aside>

              {/* Main content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-3">
                  {es ? `${filteredProducts.length} producto${filteredProducts.length !== 1 ? 's' : ''}` : `${filteredProducts.length} product${filteredProducts.length !== 1 ? 's' : ''}`}
                </p>

                {loading ? (
                  <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : (
                  <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
                    {filteredProducts.map(p => {
                      const isFeatured = featuredIds.has(p.id);
                      const featuredLabel = isFeatured ? (es ? featuredMap[p.id]?.label_es : featuredMap[p.id]?.label_en) : null;
                      return (
                        <Card key={p.id} className={`overflow-hidden hover:shadow-lg transition-all cursor-pointer group ${isFeatured ? 'ring-2 ring-yellow-400/60 shadow-yellow-100/50' : ''}`} onClick={() => handleProductClick(p)}>
                          <div className="relative aspect-square overflow-hidden bg-muted">
                            {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> : <div className="w-full h-full flex items-center justify-center"><Package className="w-12 h-12 text-muted-foreground/30" /></div>}
                            {isFeatured && <Badge className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-[9px] gap-1 shadow-lg"><Sparkles className="w-3 h-3" /> {featuredLabel}</Badge>}
                            {p.stock <= 5 && p.stock > 0 && <Badge variant="destructive" className="absolute top-2 right-2 text-[9px]">{es ? 'Últimas unidades' : 'Low stock'}</Badge>}
                            {p.stock === 0 && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Badge variant="destructive">{es ? 'Agotado' : 'Sold out'}</Badge></div>}
                          </div>
                          <CardContent className="p-3">
                            <p className="font-medium text-xs sm:text-sm line-clamp-2 mb-1 min-h-[2rem]">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground mb-2 truncate">{p.marketplace_vendors?.name}</p>
                            <div className="flex items-end justify-between">
                              <div><p className="text-sm sm:text-base font-bold text-primary">${p.price.toLocaleString()}</p><p className="text-[9px] text-muted-foreground">{p.currency}</p></div>
                              <Button size="sm" variant="default" className="h-7 text-xs gap-1 px-2"><ShoppingCart className="w-3 h-3" />{es ? 'Comprar' : 'Buy'}</Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
                {!loading && filteredProducts.length === 0 && <p className="text-center text-muted-foreground py-12">{es ? 'No se encontraron productos' : 'No products found'}</p>}
              </div>
            </div>
          </>
        )}

        {tab === 'vendors' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vendors.map(v => (
              <Card key={v.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden">{v.logo_url ? <img src={v.logo_url} alt={v.name} className="w-full h-full object-cover" /> : v.name.slice(0, 2).toUpperCase()}</div>
                    <div className="min-w-0"><h3 className="font-semibold text-sm truncate">{v.name}</h3>{v.location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{v.location}</p>}</div>
                  </div>
                  {v.description && <p className="text-xs text-muted-foreground line-clamp-3 mb-3">{v.description}</p>}
                  <div className="flex gap-2">
                    {v.website && <Button size="sm" variant="outline" className="flex-1 text-xs gap-1" asChild><a href={v.website} target="_blank" rel="noopener noreferrer"><Globe className="w-3.5 h-3.5" />{es ? 'Sitio web' : 'Website'}</a></Button>}
                    {v.phone && <Button size="sm" variant="outline" className="flex-1 text-xs gap-1" asChild><a href={`tel:${v.phone}`}><Phone className="w-3.5 h-3.5" />{es ? 'Llamar' : 'Call'}</a></Button>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Product detail dialog */}
        <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            {selectedProduct && (<>
              <DialogHeader><DialogTitle className="text-base">{selectedProduct.name}</DialogTitle></DialogHeader>
              {selectedProduct.image_url && <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full aspect-video object-cover rounded-lg mb-3" />}
              {featuredIds.has(selectedProduct.id) && <Badge className="bg-yellow-400 text-yellow-900 text-[10px] gap-1 w-fit mb-2"><Sparkles className="w-3 h-3" /> {es ? featuredMap[selectedProduct.id]?.label_es : featuredMap[selectedProduct.id]?.label_en}</Badge>}
              {selectedProduct.description && <p className="text-sm text-muted-foreground mb-3">{selectedProduct.description}</p>}
              {selectedProduct.category && <Badge variant="outline" className="mb-3">{selectedProduct.category}</Badge>}
              <div className="bg-muted/50 rounded-lg p-3 mb-3">
                <div className="flex items-center gap-2 mb-1"><Store className="w-4 h-4 text-primary" /><span className="font-medium text-sm">{selectedProduct.marketplace_vendors?.name}</span></div>
                {selectedProduct.marketplace_vendors?.location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{selectedProduct.marketplace_vendors.location}</p>}
              </div>
              <div className="flex items-end justify-between mb-3">
                <div><p className="text-2xl font-bold text-primary">${selectedProduct.price.toLocaleString()}</p><p className="text-xs text-muted-foreground">{selectedProduct.currency}</p></div>
                <p className="text-xs text-muted-foreground">Stock: {selectedProduct.stock}</p>
              </div>
              {/* Quantity selector */}
              <div className="flex items-center gap-3 mb-4 bg-muted/50 rounded-lg p-3">
                <span className="text-xs font-medium">{es ? 'Cantidad' : 'Quantity'}:</span>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>-</Button>
                  <span className="w-8 text-center font-semibold">{quantity}</span>
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQuantity(Math.min(selectedProduct.stock, quantity + 1))} disabled={quantity >= selectedProduct.stock}>+</Button>
                </div>
                {quantity > 1 && <span className="text-xs text-muted-foreground ml-auto">= ${(selectedProduct.price * quantity).toLocaleString()}</span>}
              </div>
              <Button onClick={() => startPurchase(selectedProduct)} disabled={purchasing || selectedProduct.stock === 0} className="w-full gap-2">
                {purchasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                {selectedProduct.stock === 0 ? (es ? 'Agotado' : 'Sold out') : (es ? 'Comprar Ahora' : 'Buy Now')}
              </Button>
            </>)}
          </DialogContent>
        </Dialog>

        {/* Shipping Address Dialog */}
        <Dialog open={shippingDialog} onOpenChange={setShippingDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{es ? 'Dirección de Envío' : 'Shipping Address'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{es ? 'Nombre completo' : 'Full name'} *</Label><Input value={shippingForm.name} onChange={e => setShippingForm(f => ({ ...f, name: e.target.value }))} placeholder="Juan Pérez" /></div>
              <div><Label>{es ? 'Teléfono' : 'Phone'}</Label><Input value={shippingForm.phone} onChange={e => setShippingForm(f => ({ ...f, phone: e.target.value }))} placeholder="+52 55 1234 5678" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>{es ? 'Ciudad' : 'City'} *</Label><Input value={shippingForm.city} onChange={e => setShippingForm(f => ({ ...f, city: e.target.value }))} placeholder="CDMX" /></div>
                <div><Label>{es ? 'Estado' : 'State'}</Label><Input value={shippingForm.state} onChange={e => setShippingForm(f => ({ ...f, state: e.target.value }))} placeholder="CDMX" /></div>
              </div>
              <div><Label>{es ? 'Código postal' : 'ZIP'}</Label><Input value={shippingForm.zip} onChange={e => setShippingForm(f => ({ ...f, zip: e.target.value }))} placeholder="06600" /></div>
              <div><Label>{es ? 'Notas de entrega' : 'Delivery notes'}</Label><Textarea value={shippingForm.notes} onChange={e => setShippingForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder={es ? 'Instrucciones adicionales...' : 'Additional instructions...'} /></div>
              
              {pendingProduct && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <p className="text-sm font-medium">{pendingProduct.name}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-lg font-bold text-primary">${(pendingProduct.price * quantity).toLocaleString()}</p>
                    <span className="text-xs text-muted-foreground">{pendingProduct.currency}</span>
                  </div>
                  {quantity > 1 && <p className="text-[10px] text-muted-foreground">{quantity} × ${pendingProduct.price.toLocaleString()}</p>}
                </div>
              )}

              <Button onClick={handlePurchase} disabled={purchasing || !shippingForm.name || !shippingForm.city} className="w-full gap-2">
                {purchasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                {es ? 'Proceder al Pago' : 'Proceed to Payment'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
