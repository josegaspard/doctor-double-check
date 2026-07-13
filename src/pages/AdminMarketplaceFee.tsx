import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  ArrowLeft, Loader2, Percent, Store, CheckCircle, XCircle, Clock,
  DollarSign, User, Mail, Phone, MapPin, Building, FileText, ShieldCheck, AlertTriangle,
} from 'lucide-react';

interface VendorRow {
  id: string;
  user_id: string;
  name: string | null;
  description: string | null;
  website: string | null;
  phone: string | null;
  location: string | null;
  status: string;
  legal_name: string | null;
  tax_id: string | null;
  payout_email: string | null;
  notes: string | null;
  terms_accepted_at: string | null;
  created_at: string;
  profile?: { name: string | null; email: string | null };
  doctor?: { specialty: string | null; cedula_profesional: string | null; status: string | null } | null;
}

interface InterestRow {
  id: string;
  fee_amount: number;
  fee_rate: number;
  product_price: number;
  currency: string;
  status: string;       // ordered | completed | cancelled (+legacy paid/pending_payment/expired)
  fee_status: string;   // none | pending | paid — fee del VENDEDOR al concretar
  created_at: string;
  completed_at: string | null;
  paid_at: string | null;
  product?: { name: string | null } | null;
  vendor?: { name: string | null } | null;
}

export default function AdminMarketplaceFee() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  // Las tablas/columnas del marketplace de fee aún no están en los tipos generados de
  // Supabase (la migración se aplica con el token). Cast a any para no romper el tsc;
  // se puede regenerar tipos con `supabase gen types` tras aplicar la migración.
  const sb = supabase as any;

  const [loading, setLoading] = useState(true);
  const [migrationMissing, setMigrationMissing] = useState(false);

  const [feePct, setFeePct] = useState('10');
  const [reserveHours, setReserveHours] = useState('72');
  const [savingCfg, setSavingCfg] = useState(false);

  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [interests, setInterests] = useState<InterestRow[]>([]);
  const [pendingProducts, setPendingProducts] = useState<any[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);

  // Campanilla al usuario afectado (RLS: el admin puede insertar notificaciones type=system).
  const notifyUser = async (userId: string, title: string, message: string, url: string) => {
    try {
      await sb.from('notifications').insert({ user_id: userId, type: 'system', title, message, data: { url } });
    } catch (e) {
      console.error('[AdminMarketplaceFee] notify error', e);
    }
  };

  useEffect(() => {
    if (user && user.role !== 'admin') {
      toast({ title: t('autoI18n.admFee1'), description: t('autoI18n.admFee2'), variant: 'destructive' });
      navigate('/');
    }
  }, [user, navigate, toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Config global del fee
      const { data: cfg, error: cfgErr } = await sb
        .from('marketplace_config').select('fee_rate, reserve_hours').eq('id', true).maybeSingle();
      if (cfgErr && /does not exist|schema cache|relation/i.test(cfgErr.message)) {
        setMigrationMissing(true);
        setLoading(false);
        return;
      }
      if (cfg) {
        setFeePct(String(Math.round(Number(cfg.fee_rate) * 10000) / 100));
        setReserveHours(String(cfg.reserve_hours ?? 72));
      }

      // Vendedores (solicitudes de verificación de negocio)
      const { data: vs } = await sb
        .from('marketplace_vendors')
        .select('id, user_id, name, description, website, phone, location, status, legal_name, tax_id, payout_email, notes, terms_accepted_at, created_at')
        .order('created_at', { ascending: false });
      const vendorsWithInfo: VendorRow[] = await Promise.all((vs || []).map(async (v: any) => {
        const { data: prof } = await sb.from('profiles').select('name, email').eq('id', v.user_id).maybeSingle();
        const { data: doc } = await sb.from('doctor_profiles').select('specialty, cedula_profesional, status').eq('user_id', v.user_id).maybeSingle();
        return { ...v, profile: prof || undefined, doctor: doc || null };
      }));
      setVendors(vendorsWithInfo);

      // Órdenes de compra / ventas concretadas / fees
      const { data: ints } = await sb
        .from('product_interests')
        .select('id, fee_amount, fee_rate, product_price, currency, status, fee_status, created_at, completed_at, paid_at, marketplace_products!product_interests_product_id_fkey(name), marketplace_vendors(name)')
        .order('created_at', { ascending: false })
        .limit(100);
      setInterests((ints || []).map((i: any) => ({
        ...i, product: i.marketplace_products || null, vendor: i.marketplace_vendors || null,
      })));

      // Productos pendientes de aprobación del super admin
      const { data: pp } = await sb
        .from('marketplace_products')
        .select('id, name, description, price, currency, image_url, category, stock, created_at, approval_status, marketplace_vendors(id, name, user_id)')
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: true });
      setPendingProducts(pp || []);
    } catch (e) {
      console.error('[AdminMarketplaceFee] load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user?.role === 'admin') load(); }, [user, load]);

  const saveConfig = async () => {
    const pct = Number(feePct);
    const hrs = Number(reserveHours);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      toast({ title: t('autoI18n.admFee3'), description: t('autoI18n.admFee4'), variant: 'destructive' });
      return;
    }
    setSavingCfg(true);
    try {
      const { error } = await sb.from('marketplace_config').update({
        fee_rate: Math.round(pct * 100) / 10000,
        reserve_hours: Number.isFinite(hrs) && hrs > 0 ? Math.round(hrs) : 72,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      }).eq('id', true);
      if (error) throw error;
      toast({ title: t('autoI18n.admFee5'), description: `${t('autoI18n.admFee6')} ${pct}% ${t('autoI18n.admFee7')}` });
    } catch (e: any) {
      toast({ title: t('autoI18n.admFee8'), description: e.message, variant: 'destructive' });
    } finally {
      setSavingCfg(false);
    }
  };

  const setVendorStatus = async (v: VendorRow, status: 'approved' | 'pending' | 'rejected') => {
    let note: string | null = null;
    if (status === 'rejected') {
      note = window.prompt(t('autoI18n.admFee22')) || null;
      if (note === null) return; // canceló el prompt
    }
    setActingId(v.id);
    try {
      const payload: any = { status };
      if (status === 'rejected') payload.notes = note;
      const { error } = await sb.from('marketplace_vendors').update(payload).eq('id', v.id);
      if (error) throw error;
      toast({
        title: status === 'approved' ? t('autoI18n.admFee9') : status === 'rejected' ? t('autoI18n.admFee10') : t('autoI18n.admFee11'),
        description: `${v.name || v.profile?.name || t('autoI18n.admFee15')} — ${status === 'approved' ? t('autoI18n.admFee12') : status === 'rejected' ? t('autoI18n.admFee13') : t('autoI18n.admFee14')}`,
      });
      // Notificar al postulante el resultado de su solicitud.
      if (v.user_id) {
        if (status === 'approved') {
          await notifyUser(v.user_id, t('autoI18n.admFee16'),
            `${t('autoI18n.admFee17')} "${v.name || ''}" ${t('autoI18n.admFee18')}`,
            '/vendor/dashboard');
        } else if (status === 'rejected') {
          await notifyUser(v.user_id, t('autoI18n.admFee19'),
            `${note ? `${t('autoI18n.admFee20')} ${note}. ` : ''}${t('autoI18n.admFee21')}`,
            '/vendor/dashboard');
        }
      }
      setVendors(prev => prev.map(x => x.id === v.id ? { ...x, status, notes: status === 'rejected' ? note : x.notes } : x));
    } catch (e: any) {
      toast({ title: t('autoI18n.admFee38'), description: e.message, variant: 'destructive' });
    } finally {
      setActingId(null);
    }
  };

  // Aprobar / rechazar PRODUCTOS cargados por los proveedores.
  const setProductApproval = async (p: any, status: 'approved' | 'rejected') => {
    let note: string | null = null;
    if (status === 'rejected') {
      note = window.prompt(t('autoI18n.admFee22')) || null;
      if (note === null) return;
    }
    setActingId(p.id);
    try {
      const { error } = await sb.from('marketplace_products').update({
        approval_status: status,
        approval_note: note,
        approved_at: status === 'approved' ? new Date().toISOString() : null,
        approved_by: user?.id,
      }).eq('id', p.id);
      if (error) throw error;
      toast({
        title: status === 'approved' ? t('autoI18n.admFee23') : t('autoI18n.admFee24'),
        description: `"${p.name}" ${status === 'approved' ? t('autoI18n.admFee25') : t('autoI18n.admFee26')}`,
      });
      const vendorUserId = p.marketplace_vendors?.user_id;
      if (vendorUserId) {
        if (status === 'approved') {
          await notifyUser(vendorUserId, t('autoI18n.admFee23'),
            `${t('autoI18n.admFee27')} "${p.name}" ${t('autoI18n.admFee28')}`, '/vendor/dashboard');
        } else {
          await notifyUser(vendorUserId, t('autoI18n.admFee24'),
            `${t('autoI18n.admFee27')} "${p.name}" ${t('autoI18n.admFee29')}${note ? ` ${t('autoI18n.admFee20')} ${note}.` : ''} ${t('autoI18n.admFee30')}`, '/vendor/dashboard');
        }
      }
      setPendingProducts(prev => prev.filter((x: any) => x.id !== p.id));
    } catch (e: any) {
      toast({ title: t('autoI18n.admFee38'), description: e.message, variant: 'destructive' });
    } finally {
      setActingId(null);
    }
  };

  const statusBadge = (s: string) => {
    if (s === 'approved') return <Badge variant="success" className="gap-1"><CheckCircle className="w-3 h-3" />{t('autoI18n.admFee31')}</Badge>;
    if (s === 'rejected') return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />{t('autoI18n.admFee32')}</Badge>;
    return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />{t('autoI18n.admFee33')}</Badge>;
  };

  // Admin también puede concretar/cancelar una orden (vía edge function, notifica a todos).
  const adminOrderAction = async (i: InterestRow, action: 'complete' | 'cancel') => {
    setActingId(i.id);
    try {
      const { data, error } = await supabase.functions.invoke('marketplace-order', {
        body: { action, interest_id: i.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast(action === 'complete'
        ? { title: t('autoI18n.admFee34'), description: t('autoI18n.admFee35') }
        : { title: t('autoI18n.admFee36'), description: t('autoI18n.admFee37') });
      load();
    } catch (e: any) {
      toast({ title: t('autoI18n.admFee38'), description: e.message, variant: 'destructive' });
    } finally {
      setActingId(null);
    }
  };

  const pendingVendors = vendors.filter(v => v.status !== 'approved');
  const approvedVendors = vendors.filter(v => v.status === 'approved');
  const feesPaid = interests.filter(i => i.fee_status === 'paid').reduce((a, i) => a + Number(i.fee_amount || 0), 0);
  const feesPending = interests.filter(i => i.status === 'completed' && i.fee_status === 'pending').reduce((a, i) => a + Number(i.fee_amount || 0), 0);
  const activeOrders = interests.filter(i => i.status === 'ordered').length;
  const completedSales = interests.filter(i => i.status === 'completed').length;

  const orderStatusBadge = (i: InterestRow) => {
    if (i.status === 'ordered') return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />{t('autoI18n.admFee39')}</Badge>;
    if (i.status === 'completed' || i.status === 'paid') return <Badge variant="success" className="gap-1"><CheckCircle className="w-3 h-3" />{t('autoI18n.admFee40')}</Badge>;
    if (i.status === 'cancelled' || i.status === 'expired') return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />{t('autoI18n.admFee41')}</Badge>;
    return <Badge variant="secondary">{i.status}</Badge>;
  };
  const feeBadge = (i: InterestRow) => {
    if (i.fee_status === 'paid') return <Badge variant="success" className="gap-1 text-[10px]">{t('autoI18n.admFee42')}</Badge>;
    if (i.status === 'completed' && i.fee_status === 'pending') return <Badge variant="secondary" className="gap-1 text-[10px] bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700">{t('autoI18n.admFee43')}</Badge>;
    return null;
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <button onClick={() => navigate('/admin')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> {t('autoI18n.admFee44')}
        </button>
        <div className="flex items-center gap-2 mb-1">
          <Store className="w-6 h-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold">{t('autoI18n.admFee45')}</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">{t('autoI18n.admFee46')}</p>

        {migrationMissing && (
          <Card className="mb-6 border-warning/40 bg-warning/5">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-foreground">{t('autoI18n.admFee47')}</p>
                <p className="text-muted-foreground">{t('autoI18n.admFee48')} <code className="bg-muted px-1 rounded">supabase db push</code> {t('autoI18n.admFee49')}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-6">
            {/* 1. Config del fee */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Percent className="w-4 h-4 text-primary" />{t('autoI18n.admFee50')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fee">{t('autoI18n.admFee51')}</Label>
                    <div className="relative">
                      <Input id="fee" type="number" min={0} max={100} step={0.5} value={feePct} onChange={e => setFeePct(e.target.value)} className="pr-8" />
                      <Percent className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>
                    <p className="text-xs text-muted-foreground">{t('autoI18n.admFee52')}</p>
                  </div>
                </div>
                <Button onClick={saveConfig} disabled={savingCfg} className="gap-2">
                  {savingCfg ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {t('autoI18n.admFee53')}
                </Button>
              </CardContent>
            </Card>

            {/* 2. Verificación de vendedores */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />{t('autoI18n.admFee54')}
                  {pendingVendors.length > 0 && <Badge variant="secondary">{pendingVendors.length} {t('autoI18n.admFee55')}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {vendors.length === 0 && <p className="text-sm text-muted-foreground py-2">{t('autoI18n.admFee56')}</p>}
                {[...pendingVendors, ...approvedVendors].map(v => (
                  <div key={v.id} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm">{v.name || v.profile?.name || t('autoI18n.admFee57')}</h3>
                          {statusBadge(v.status)}
                          {v.doctor?.status === 'approved' && <Badge variant="outline" className="gap-1 text-[10px]"><ShieldCheck className="w-3 h-3" />{t('autoI18n.admFee58')}</Badge>}
                        </div>
                        {v.description && <p className="text-xs text-muted-foreground mt-0.5">{v.description}</p>}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {v.status !== 'approved' ? (
                          <>
                            <Button size="sm" className="gap-1.5 h-8" disabled={actingId === v.id} onClick={() => setVendorStatus(v, 'approved')}>
                              {actingId === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}{t('autoI18n.admFee59')}
                            </Button>
                            {v.status !== 'rejected' && (
                              <Button size="sm" variant="ghost" className="gap-1.5 h-8 text-destructive hover:text-destructive" disabled={actingId === v.id} onClick={() => setVendorStatus(v, 'rejected')}>
                                <XCircle className="w-3.5 h-3.5" />{t('autoI18n.admFee60')}
                              </Button>
                            )}
                          </>
                        ) : (
                          <Button size="sm" variant="outline" className="gap-1.5 h-8" disabled={actingId === v.id} onClick={() => setVendorStatus(v, 'pending')}>
                            <Clock className="w-3.5 h-3.5" />{t('autoI18n.admFee61')}
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* Información COMPLETA que ingresó el doctor/vendedor */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground bg-muted/40 rounded-md p-2.5">
                      <span className="flex items-center gap-1.5"><User className="w-3 h-3" /><b className="text-foreground/70">{t('autoI18n.admFee62')}</b> {v.profile?.name || '—'}</span>
                      <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" /><b className="text-foreground/70">{t('autoI18n.admFee63')}</b> {v.profile?.email || '—'}</span>
                      {v.doctor?.specialty && <span className="flex items-center gap-1.5"><FileText className="w-3 h-3" /><b className="text-foreground/70">{t('autoI18n.admFee64')}</b> {v.doctor.specialty}</span>}
                      {v.doctor?.cedula_profesional && <span className="flex items-center gap-1.5"><FileText className="w-3 h-3" /><b className="text-foreground/70">{t('autoI18n.admFee65')}</b> {v.doctor.cedula_profesional}</span>}
                      {v.legal_name && <span className="flex items-center gap-1.5"><Building className="w-3 h-3" /><b className="text-foreground/70">{t('autoI18n.admFee66')}</b> {v.legal_name}</span>}
                      {v.tax_id && <span className="flex items-center gap-1.5"><FileText className="w-3 h-3" /><b className="text-foreground/70">{t('autoI18n.admFee67')}</b> {v.tax_id}</span>}
                      {v.phone && <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" /><b className="text-foreground/70">{t('autoI18n.admFee68')}</b> {v.phone}</span>}
                      {v.location && <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /><b className="text-foreground/70">{t('autoI18n.admFee69')}</b> {v.location}</span>}
                      {v.payout_email && <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" /><b className="text-foreground/70">{t('autoI18n.admFee70')}</b> {v.payout_email}</span>}
                      {v.website && <span className="flex items-center gap-1.5 truncate"><FileText className="w-3 h-3" /><b className="text-foreground/70">{t('autoI18n.admFee71')}</b> {v.website}</span>}
                      <span className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3" /><b className="text-foreground/70">{t('autoI18n.admFee72')}</b> {v.terms_accepted_at ? t('autoI18n.admFee73') : t('autoI18n.admFee74')}</span>
                    </div>
                    {v.notes && <p className="text-xs text-muted-foreground"><b className="text-foreground/70">{t('autoI18n.admFee75')}</b> {v.notes}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 3. Productos por aprobar (cargados por proveedores) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Store className="w-4 h-4 text-primary" />{t('autoI18n.admFee76')}
                  {pendingProducts.length > 0 && <Badge variant="secondary">{pendingProducts.length} {t('autoI18n.admFee55')}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingProducts.length === 0 && <p className="text-sm text-muted-foreground py-2">{t('autoI18n.admFee77')}</p>}
                {pendingProducts.map((p: any) => (
                  <div key={p.id} className="rounded-lg border border-border p-3 flex items-start gap-3 flex-wrap">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-16 h-16 rounded-lg object-cover border border-border flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"><Store className="w-6 h-6 text-muted-foreground" /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.marketplace_vendors?.name || t('autoI18n.admFee15')} · ${Number(p.price).toLocaleString()} {p.currency || 'MXN'} · {t('autoI18n.admFee78')} {p.stock}
                        {p.category ? ` · ${p.category}` : ''}
                      </p>
                      {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button type="button" size="sm" className="gap-1.5 h-8" disabled={actingId === p.id} onClick={() => setProductApproval(p, 'approved')}>
                        {actingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}{t('autoI18n.admFee59')}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="gap-1.5 h-8 text-destructive hover:text-destructive" disabled={actingId === p.id} onClick={() => setProductApproval(p, 'rejected')}>
                        <XCircle className="w-3.5 h-3.5" />{t('autoI18n.admFee60')}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 4. Órdenes de compra, ventas concretadas y fees */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" />{t('autoI18n.admFee79')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 mb-4 flex-wrap">
                  <div><p className="text-2xl font-bold text-success">${feesPaid.toLocaleString()}</p><p className="text-xs text-muted-foreground">{t('autoI18n.admFee80')}</p></div>
                  <div><p className="text-2xl font-bold text-amber-700 dark:text-amber-400">${feesPending.toLocaleString()}</p><p className="text-xs text-muted-foreground">{t('autoI18n.admFee81')}</p></div>
                  <div><p className="text-2xl font-bold">{completedSales}</p><p className="text-xs text-muted-foreground">{t('autoI18n.admFee82')}</p></div>
                  <div><p className="text-2xl font-bold">{activeOrders}</p><p className="text-xs text-muted-foreground">{t('autoI18n.admFee83')}</p></div>
                </div>
                {interests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('autoI18n.admFee84')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {interests.map(i => (
                      <div key={i.id} className="flex items-center justify-between gap-2 text-xs border-b border-border/60 py-1.5 flex-wrap">
                        <span className="min-w-0 truncate">{i.product?.name || t('autoI18n.admFee85')} <span className="text-muted-foreground">· {i.vendor?.name || t('autoI18n.admFee15')}</span></span>
                        <span className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                          <span className="text-muted-foreground">{t('autoI18n.admFee86')} {Math.round(Number(i.fee_rate) * 100)}% {t('autoI18n.admFee87')} ${Number(i.product_price).toLocaleString()} = <b className="text-foreground">${Number(i.fee_amount).toLocaleString()}</b></span>
                          {orderStatusBadge(i)}
                          {feeBadge(i)}
                          {i.status === 'ordered' && (
                            <>
                              <Button type="button" size="sm" className="h-6 px-2 text-[10px] gap-1" disabled={actingId === i.id} onClick={() => adminOrderAction(i, 'complete')}>
                                {actingId === i.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}{t('autoI18n.admFee88')}
                              </Button>
                              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-1 text-destructive hover:text-destructive" disabled={actingId === i.id} onClick={() => adminOrderAction(i, 'cancel')}>
                                <XCircle className="w-3 h-3" />{t('autoI18n.admFee89')}
                              </Button>
                            </>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
