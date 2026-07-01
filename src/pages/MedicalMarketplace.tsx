import { useState, useEffect, useCallback } from 'react';
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Store, Loader2, HandHeart, ShieldCheck, Clock, Tag, Plus, PackagePlus, Lock, CheckCircle,
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string | null;
  image_url: string | null;
  vendor_id: string;
  reserved_by: string | null;
  reserved_until: string | null;
  vendorName?: string | null;
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

  // Diálogo "Estoy interesado"
  const [interestProduct, setInterestProduct] = useState<Product | null>(null);
  const [interestTerms, setInterestTerms] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  // Diálogo "Quiero vender"
  const [sellOpen, setSellOpen] = useState(false);
  const [sellTerms, setSellTerms] = useState(false);
  const [sellForm, setSellForm] = useState({ name: '', phone: '', location: '', legal_name: '', tax_id: '' });
  const [submittingSell, setSubmittingSell] = useState(false);

  // Diálogo "Publicar producto" (vendedor aprobado)
  const [pubOpen, setPubOpen] = useState(false);
  const [pubForm, setPubForm] = useState({ name: '', price: '', description: '', image_url: '' });
  const [publishing, setPublishing] = useState(false);

  const canUse = role === 'doctor' || role === 'resident' || role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: cfg } = await sb.from('marketplace_config').select('fee_rate').eq('id', true).maybeSingle();
      if (cfg?.fee_rate != null) setFeeRate(Number(cfg.fee_rate));

      const { data: prods } = await sb.from('marketplace_products')
        .select('id, name, description, price, currency, image_url, vendor_id, reserved_by, reserved_until, marketplace_vendors(name)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      setProducts((prods || []).map((p: any) => ({ ...p, vendorName: p.marketplace_vendors?.name })));

      if (user?.id) {
        const { data: v } = await sb.from('marketplace_vendors').select('id, status').eq('user_id', user.id).maybeSingle();
        setVendor(v || null);
      }
    } catch (e) {
      console.error('[MedicalMarketplace] load', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { if (canUse) load(); else setLoading(false); }, [canUse, load]);

  const startInterest = async () => {
    if (!interestProduct || !interestTerms) return;
    setPayingId(interestProduct.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-marketplace-interest-fee', {
        body: { product_id: interestProduct.id, terms_accepted: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) { window.location.href = data.url; return; }
      throw new Error('No se recibió el enlace de pago');
    } catch (e: any) {
      toast({ title: 'No se pudo continuar', description: e.message || 'Error', variant: 'destructive' });
    } finally {
      setPayingId(null);
    }
  };

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
      <div className="container mx-auto px-4 py-6 max-w-5xl">
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
        <p className="text-sm text-muted-foreground mb-6">Compra y vende material entre colegas. Al mostrar interés pagas una cuota de intermediación y se te abre el chat con el proveedor para cerrar el trato.</p>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : products.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Aún no hay productos publicados.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map(p => {
              const reserved = isReserved(p);
              return (
                <Card key={p.id} className="overflow-hidden flex flex-col">
                  {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-40 object-cover" />}
                  <CardContent className="p-4 flex flex-col flex-1">
                    <h3 className="font-semibold text-sm leading-tight">{p.name}</h3>
                    {p.vendorName && <p className="text-xs text-muted-foreground mt-0.5">{p.vendorName}</p>}
                    {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-lg font-bold">${Number(p.price).toLocaleString()}</span>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-0.5"><Tag className="w-3 h-3" /> fee ${feeFor(Number(p.price)).toLocaleString()}</span>
                    </div>
                    <div className="mt-3 pt-1">
                      {mine(p) ? (
                        <Badge variant="outline" className="w-full justify-center py-1">Tu producto</Badge>
                      ) : reserved ? (
                        <Badge variant="secondary" className="w-full justify-center py-1 gap-1"><Clock className="w-3 h-3" /> Apartado</Badge>
                      ) : (
                        <Button size="sm" className="w-full gap-1.5" disabled={payingId === p.id}
                          onClick={() => { setInterestProduct(p); setInterestTerms(false); }}>
                          {payingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <HandHeart className="w-4 h-4" />} Estoy interesado
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

      {/* Diálogo Estoy interesado */}
      <Dialog open={!!interestProduct} onOpenChange={(o) => !o && setInterestProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><HandHeart className="w-5 h-5 text-primary" /> Estoy interesado</DialogTitle>
            <DialogDescription>
              Para desbloquear el contacto con el proveedor pagas una <b>cuota de intermediación</b>. El producto queda apartado para ti y se abre el chat para cerrar la venta.
            </DialogDescription>
          </DialogHeader>
          {interestProduct && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>{interestProduct.name}</span><b>${Number(interestProduct.price).toLocaleString()}</b></div>
              <div className="flex justify-between text-primary"><span>Cuota de la plataforma</span><b>${feeFor(Number(interestProduct.price)).toLocaleString()}</b></div>
              <p className="text-xs text-muted-foreground pt-1">El precio del producto lo pagas directamente al proveedor por fuera. Solo la cuota se cobra aquí.</p>
            </div>
          )}
          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox checked={interestTerms} onCheckedChange={(v) => setInterestTerms(!!v)} className="mt-0.5" />
            <span>Acepto los <b>términos y condiciones</b> de intermediación y que la cuota no es reembolsable una vez abierto el contacto.</span>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInterestProduct(null)}>Cancelar</Button>
            <Button disabled={!interestTerms || !!payingId} onClick={startInterest} className="gap-2">
              {payingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Pagar cuota y contactar
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
