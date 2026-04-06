// @ts-nocheck
// Full rewrite: DB-driven marketplace with purchase flow
import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Package, Search, Loader2, ShoppingCart, Store, Phone, Globe, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
  const [tab, setTab] = useState('products');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [purchasing, setPurchasing] = useState(false);

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

  const handlePurchase = async (product) => {
    if (!user) { toast.error(es ? 'Inicia sesión para comprar' : 'Log in to purchase'); return; }
    setPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-marketplace-checkout', {
        body: { product_id: product.id, quantity: 1 },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
        toast.success(es ? 'Redirigiendo al pago...' : 'Redirecting to payment...');
        setSelectedProduct(null);
      } else {
        throw new Error(data?.error || 'No checkout URL returned');
      }
    } catch (err) { toast.error(err.message); }
    setPurchasing(false);
  };

  const filteredProducts = products.filter(p => {
    if (filterCat !== 'all' && p.category !== filterCat) return false;
    if (search) { const s = search.toLowerCase(); return p.name.toLowerCase().includes(s) || (p.description || '').toLowerCase().includes(s) || (p.marketplace_vendors?.name || '').toLowerCase().includes(s); }
    return true;
  });

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent p-5 sm:p-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center"><Package className="w-6 h-6 text-primary" /></div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{es ? 'Material Médico' : 'Medical Supplies'}</h1>
              <p className="text-sm text-muted-foreground">{es ? 'Marketplace de insumos y equipos médicos' : 'Medical equipment & supplies marketplace'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" />{products.length} {es ? 'productos' : 'products'}</span>
            <span className="flex items-center gap-1"><Store className="w-3.5 h-3.5" />{vendors.length} {es ? 'proveedores' : 'vendors'}</span>
          </div>
          <div className="mt-4"><Button variant="ghost" size="sm" onClick={() => navigate('/vendor/dashboard')} className="text-xs gap-1"><Store className="w-3.5 h-3.5" />{es ? '¿Eres proveedor? Vende aquí' : 'Are you a vendor? Sell here'}</Button></div>
        </div>

        <div className="flex gap-2 mb-4">
          <Button variant={tab === 'products' ? 'default' : 'outline'} size="sm" onClick={() => setTab('products')} className="gap-1.5"><Package className="w-4 h-4" />{es ? 'Productos' : 'Products'}</Button>
          <Button variant={tab === 'vendors' ? 'default' : 'outline'} size="sm" onClick={() => setTab('vendors')} className="gap-1.5"><Store className="w-4 h-4" />{es ? 'Proveedores' : 'Vendors'}</Button>
        </div>

        {tab === 'products' && (
          <>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder={es ? 'Buscar productos...' : 'Search products...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder={es ? 'Categoría' : 'Category'} /></SelectTrigger>
                <SelectContent><SelectItem value="all">{es ? 'Todas' : 'All'}</SelectItem>{categories.map(c => <SelectItem key={c.id} value={es ? c.name_es : c.name_en}>{es ? c.name_es : c.name_en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
              <Button variant={filterCat === 'all' ? 'default' : 'outline'} size="sm" className="flex-shrink-0 text-xs" onClick={() => setFilterCat('all')}>{es ? 'Todos' : 'All'}</Button>
              {categories.map(c => <Button key={c.id} variant={filterCat === (es ? c.name_es : c.name_en) ? 'default' : 'outline'} size="sm" className="flex-shrink-0 text-xs whitespace-nowrap" onClick={() => setFilterCat(es ? c.name_es : c.name_en)}>{es ? c.name_es : c.name_en}</Button>)}
            </div>
            {loading ? <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {filteredProducts.map(p => (
                  <Card key={p.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => setSelectedProduct(p)}>
                    <div className="relative aspect-square overflow-hidden bg-muted">
                      {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> : <div className="w-full h-full flex items-center justify-center"><Package className="w-12 h-12 text-muted-foreground/30" /></div>}
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
                ))}
              </div>
            )}
            {!loading && filteredProducts.length === 0 && <p className="text-center text-muted-foreground py-12">{es ? 'No se encontraron productos' : 'No products found'}</p>}
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

        <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            {selectedProduct && (<>
              <DialogHeader><DialogTitle className="text-base">{selectedProduct.name}</DialogTitle></DialogHeader>
              {selectedProduct.image_url && <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full aspect-video object-cover rounded-lg mb-3" />}
              {selectedProduct.description && <p className="text-sm text-muted-foreground mb-3">{selectedProduct.description}</p>}
              {selectedProduct.category && <Badge variant="outline" className="mb-3">{selectedProduct.category}</Badge>}
              <div className="bg-muted/50 rounded-lg p-3 mb-3">
                <div className="flex items-center gap-2 mb-1"><Store className="w-4 h-4 text-primary" /><span className="font-medium text-sm">{selectedProduct.marketplace_vendors?.name}</span></div>
                {selectedProduct.marketplace_vendors?.location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{selectedProduct.marketplace_vendors.location}</p>}
                <div className="flex gap-2 mt-2">
                  {selectedProduct.marketplace_vendors?.website && <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" asChild><a href={selectedProduct.marketplace_vendors.website} target="_blank" rel="noopener noreferrer"><Globe className="w-3 h-3" />Web</a></Button>}
                  {selectedProduct.marketplace_vendors?.phone && <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" asChild><a href={`tel:${selectedProduct.marketplace_vendors.phone}`}><Phone className="w-3 h-3" />{selectedProduct.marketplace_vendors.phone}</a></Button>}
                </div>
              </div>
              <div className="flex items-end justify-between mb-4"><div><p className="text-2xl font-bold text-primary">${selectedProduct.price.toLocaleString()}</p><p className="text-xs text-muted-foreground">{selectedProduct.currency}</p></div><p className="text-xs text-muted-foreground">Stock: {selectedProduct.stock}</p></div>
              <Button onClick={() => handlePurchase(selectedProduct)} disabled={purchasing || selectedProduct.stock === 0} className="w-full gap-2">{purchasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}{selectedProduct.stock === 0 ? (es ? 'Agotado' : 'Sold out') : (es ? 'Comprar Ahora' : 'Buy Now')}</Button>
            </>)}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
