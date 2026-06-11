import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Star, Plus, Pencil, Trash2, Loader2, Eye, MousePointerClick, DollarSign, BarChart3, Building2, Package, TrendingUp, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

interface FeaturedListing {
  id: string;
  listing_type: string;
  listing_id: string;
  is_active: boolean;
  priority: number;
  start_date: string | null;
  end_date: string | null;
  budget: number;
  spent: number;
  cpc_rate: number;
  cpm_rate: number;
  label_es: string;
  label_en: string;
  created_at: string;
  // joined
  listing_name?: string;
}

interface EventStats {
  featured_id: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cost: number;
}

export default function AdminFeatured() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language, t } = useLanguage();
  const es = language === 'es';

  useEffect(() => { if (role && role !== 'admin') navigate('/'); }, [role, navigate]);
  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
        <Button variant="back" size="sm" onClick={() => navigate('/admin')} className="mb-3 -ml-2 text-white hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('autoI18n.clAdminFeat1')}
        </Button>
        <div className="mb-6 rounded-2xl bg-white border-2 border-primary/30 shadow-md p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 shadow">
              <Star className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-secondary truncate">
                {t('autoI18n.clAdminFeat2')}
              </h1>
              <p className="text-xs sm:text-sm text-secondary/70">
                {t('autoI18n.clAdminFeat3')}
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="listings">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="listings" className="text-xs sm:text-sm gap-1">
              <Star className="w-3.5 h-3.5 hidden sm:inline" />{t('autoI18n.clAdminFeat4')}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs sm:text-sm gap-1">
              <BarChart3 className="w-3.5 h-3.5 hidden sm:inline" />{t('autoI18n.clAdminFeat5')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="listings"><ListingsTab es={es} /></TabsContent>
          <TabsContent value="analytics"><AnalyticsTab es={es} /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function ListingsTab({ es }: { es: boolean }) {
  const { t } = useLanguage();
  const [listings, setListings] = useState<FeaturedListing[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [eventStats, setEventStats] = useState<Record<string, EventStats>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('all');
  const [form, setForm] = useState({
    listing_type: 'hospital', listing_id: '', is_active: true, priority: '1',
    start_date: '', end_date: '', budget: '0', cpc_rate: '5', cpm_rate: '50',
    label_es: 'Destacado', label_en: 'Featured',
  });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: fl }, { data: h }, { data: p }, { data: events }] = await Promise.all([
      supabase.from('featured_listings').select('*').order('priority', { ascending: false }),
      supabase.from('hospitals').select('id, name').order('name'),
      supabase.from('marketplace_products').select('id, name').order('name'),
      supabase.from('featured_events').select('featured_id, event_type'),
    ]);

    const hospitalMap = Object.fromEntries((h || []).map(x => [x.id, x.name]));
    const productMap = Object.fromEntries((p || []).map(x => [x.id, x.name]));
    setHospitals(h || []);
    setProducts(p || []);

    const enriched = (fl || []).map(f => ({
      ...f,
      listing_name: f.listing_type === 'hospital' ? hospitalMap[f.listing_id] : productMap[f.listing_id],
    }));
    setListings(enriched);

    // Aggregate event stats
    const statsMap: Record<string, EventStats> = {};
    (events || []).forEach(ev => {
      if (!statsMap[ev.featured_id]) statsMap[ev.featured_id] = { featured_id: ev.featured_id, impressions: 0, clicks: 0, ctr: 0, cost: 0 };
      if (ev.event_type === 'impression') statsMap[ev.featured_id].impressions++;
      else if (ev.event_type === 'click') statsMap[ev.featured_id].clicks++;
    });
    // Calculate CTR and cost
    enriched.forEach(f => {
      const s = statsMap[f.id];
      if (s) {
        s.ctr = s.impressions > 0 ? (s.clicks / s.impressions) * 100 : 0;
        s.cost = (s.impressions / 1000) * f.cpm_rate + s.clicks * f.cpc_rate;
      }
    });
    setEventStats(statsMap);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!form.listing_id) { toast.error(t('autoI18n.clAdminFeat6')); return; }
    setSaving(true);
    const payload = {
      listing_type: form.listing_type,
      listing_id: form.listing_id,
      is_active: form.is_active,
      priority: parseInt(form.priority) || 1,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      budget: parseFloat(form.budget) || 0,
      cpc_rate: parseFloat(form.cpc_rate) || 5,
      cpm_rate: parseFloat(form.cpm_rate) || 50,
      label_es: form.label_es,
      label_en: form.label_en,
    };

    if (editingId) {
      const { error } = await supabase.from('featured_listings').update(payload).eq('id', editingId);
      if (error) toast.error(error.message); else toast.success(t('autoI18n.clAdminFeat7'));
    } else {
      const { error } = await supabase.from('featured_listings').insert(payload);
      if (error) toast.error(error.message); else toast.success(t('autoI18n.clAdminFeat8'));
    }

    // Sync is_featured flag
    if (form.listing_type === 'hospital') {
      await supabase.from('hospitals').update({ is_featured: form.is_active }).eq('id', form.listing_id);
    } else {
      await supabase.from('marketplace_products').update({ is_featured: form.is_active }).eq('id', form.listing_id);
    }

    setSaving(false);
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (listing: FeaturedListing) => {
    if (!confirm(t('autoI18n.clAdminFeat9'))) return;
    await supabase.from('featured_listings').delete().eq('id', listing.id);
    // Remove featured flag
    if (listing.listing_type === 'hospital') {
      await supabase.from('hospitals').update({ is_featured: false }).eq('id', listing.listing_id);
    } else {
      await supabase.from('marketplace_products').update({ is_featured: false }).eq('id', listing.listing_id);
    }
    fetchData();
    toast.success(t('autoI18n.clAdminFeat10'));
  };

  const toggleActive = async (listing: FeaturedListing) => {
    const newActive = !listing.is_active;
    await supabase.from('featured_listings').update({ is_active: newActive }).eq('id', listing.id);
    if (listing.listing_type === 'hospital') {
      await supabase.from('hospitals').update({ is_featured: newActive }).eq('id', listing.listing_id);
    } else {
      await supabase.from('marketplace_products').update({ is_featured: newActive }).eq('id', listing.listing_id);
    }
    fetchData();
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ listing_type: 'hospital', listing_id: '', is_active: true, priority: '1', start_date: '', end_date: '', budget: '0', cpc_rate: '5', cpm_rate: '50', label_es: 'Destacado', label_en: 'Featured' });
    setDialogOpen(true);
  };

  const openEdit = (l: FeaturedListing) => {
    setEditingId(l.id);
    setForm({
      listing_type: l.listing_type, listing_id: l.listing_id, is_active: l.is_active,
      priority: l.priority.toString(), start_date: l.start_date ? l.start_date.slice(0, 10) : '',
      end_date: l.end_date ? l.end_date.slice(0, 10) : '', budget: l.budget.toString(),
      cpc_rate: l.cpc_rate.toString(), cpm_rate: l.cpm_rate.toString(),
      label_es: l.label_es, label_en: l.label_en,
    });
    setDialogOpen(true);
  };

  const filtered = listings.filter(l => filterType === 'all' || l.listing_type === filterType);
  const itemOptions = form.listing_type === 'hospital' ? hospitals : products;

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('autoI18n.clAdminFeat11')}</SelectItem>
            <SelectItem value="hospital">{t('autoI18n.clAdminFeat12')}</SelectItem>
            <SelectItem value="product">{t('autoI18n.clAdminFeat13')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="w-4 h-4" /> {t('autoI18n.clAdminFeat14')}
        </Button>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <div className="space-y-3">
          {filtered.map(l => {
            const stats = eventStats[l.id];
            return (
              <Card key={l.id} className={`${!l.is_active ? 'opacity-60' : ''} border-l-4 ${l.listing_type === 'hospital' ? 'border-l-primary' : 'border-l-secondary'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      {l.listing_type === 'hospital' ? <Building2 className="w-4 h-4 text-primary" /> : <Package className="w-4 h-4 text-secondary" />}
                      <div>
                        <p className="font-semibold text-sm">{l.listing_name || t('autoI18n.clAdminFeat15')}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[9px]">{l.listing_type === 'hospital' ? t('autoI18n.clAdminFeat16') : t('autoI18n.clAdminFeat17')}</Badge>
                          <Badge variant={l.is_active ? 'default' : 'secondary'} className="text-[9px]">{l.is_active ? t('autoI18n.clAdminFeat18') : t('autoI18n.clAdminFeat19')}</Badge>
                          <span className="text-[10px] text-muted-foreground">P:{l.priority}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(l)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => toggleActive(l)}>
                        <span className={`w-2 h-2 rounded-full ${l.is_active ? 'bg-success' : 'bg-muted-foreground'}`} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(l)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </div>

                  {/* Metrics row */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <Eye className="w-3.5 h-3.5 mx-auto mb-0.5 text-primary" />
                      <p className="text-xs font-bold">{stats?.impressions || 0}</p>
                      <p className="text-[9px] text-muted-foreground">{t('autoI18n.clAdminFeat20')}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <MousePointerClick className="w-3.5 h-3.5 mx-auto mb-0.5 text-success" />
                      <p className="text-xs font-bold">{stats?.clicks || 0}</p>
                      <p className="text-[9px] text-muted-foreground">{t('autoI18n.clAdminFeat21')}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <TrendingUp className="w-3.5 h-3.5 mx-auto mb-0.5 text-warning" />
                      <p className="text-xs font-bold">{(stats?.ctr || 0).toFixed(1)}%</p>
                      <p className="text-[9px] text-muted-foreground">CTR</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <DollarSign className="w-3.5 h-3.5 mx-auto mb-0.5 text-primary" />
                      <p className="text-xs font-bold">${(stats?.cost || 0).toFixed(0)}</p>
                      <p className="text-[9px] text-muted-foreground">{t('autoI18n.clAdminFeat22')}</p>
                    </div>
                  </div>

                  {/* Budget bar */}
                  {l.budget > 0 && (
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>{t('autoI18n.clAdminFeat23')}: ${l.budget}</span>
                        <span>{t('autoI18n.clAdminFeat24')}: ${(stats?.cost || 0).toFixed(0)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, ((stats?.cost || 0) / l.budget) * 100)}%` }} />
                      </div>
                    </div>
                  )}

                  {(l.start_date || l.end_date) && (
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {l.start_date && format(new Date(l.start_date), 'dd/MM/yyyy')}
                      {l.start_date && l.end_date && ' → '}
                      {l.end_date && format(new Date(l.end_date), 'dd/MM/yyyy')}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">{t('autoI18n.clAdminFeat25')}</p>}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t('autoI18n.clAdminFeat26') : t('autoI18n.clAdminFeat27')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t('autoI18n.clAdminFeat28')}</Label>
              <Select value={form.listing_type} onValueChange={v => setForm(f => ({ ...f, listing_type: v, listing_id: '' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hospital">{t('autoI18n.clAdminFeat16')}</SelectItem>
                  <SelectItem value="product">{t('autoI18n.clAdminFeat17')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('autoI18n.clAdminFeat29')} *</Label>
              <Select value={form.listing_id} onValueChange={v => setForm(f => ({ ...f, listing_id: v }))}>
                <SelectTrigger><SelectValue placeholder={t('autoI18n.clAdminFeat30')} /></SelectTrigger>
                <SelectContent>
                  {itemOptions.map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t('autoI18n.clAdminFeat31')}</Label><Input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} /></div>
              <div><Label>{t('autoI18n.clAdminFeat32')}</Label><Input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>CPC (MXN)</Label><Input type="number" step="0.01" value={form.cpc_rate} onChange={e => setForm(f => ({ ...f, cpc_rate: e.target.value }))} /></div>
              <div><Label>CPM (MXN)</Label><Input type="number" step="0.01" value={form.cpm_rate} onChange={e => setForm(f => ({ ...f, cpm_rate: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t('autoI18n.clAdminFeat33')}</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div><Label>{t('autoI18n.clAdminFeat34')}</Label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t('autoI18n.clAdminFeat35')}</Label><Input value={form.label_es} onChange={e => setForm(f => ({ ...f, label_es: e.target.value }))} /></div>
              <div><Label>{t('autoI18n.clAdminFeat36')}</Label><Input value={form.label_en} onChange={e => setForm(f => ({ ...f, label_en: e.target.value }))} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>{t('autoI18n.clAdminFeat18')}</Label>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('autoI18n.clAdminFeat37')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnalyticsTab({ es }: { es: boolean }) {
  const { t } = useLanguage();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7d');

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      const daysAgo = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const since = new Date(Date.now() - daysAgo * 86400000).toISOString();

      const [{ data: listings }, { data: events }] = await Promise.all([
        supabase.from('featured_listings').select('id, listing_type, listing_id, cpc_rate, cpm_rate, budget'),
        supabase.from('featured_events').select('featured_id, event_type, created_at').gte('created_at', since),
      ]);

      // Get names
      const hospitalIds = (listings || []).filter(l => l.listing_type === 'hospital').map(l => l.listing_id);
      const productIds = (listings || []).filter(l => l.listing_type === 'product').map(l => l.listing_id);

      const [{ data: hospitalNames }, { data: productNames }] = await Promise.all([
        hospitalIds.length ? supabase.from('hospitals').select('id, name').in('id', hospitalIds) : { data: [] },
        productIds.length ? supabase.from('marketplace_products').select('id, name').in('id', productIds) : { data: [] },
      ]);

      const nameMap = Object.fromEntries([...(hospitalNames || []), ...(productNames || [])].map(x => [x.id, x.name]));

      const statsMap: Record<string, { impressions: number; clicks: number; daily: Record<string, { imp: number; clk: number }> }> = {};
      (events || []).forEach(ev => {
        if (!statsMap[ev.featured_id]) statsMap[ev.featured_id] = { impressions: 0, clicks: 0, daily: {} };
        const day = ev.created_at.slice(0, 10);
        if (!statsMap[ev.featured_id].daily[day]) statsMap[ev.featured_id].daily[day] = { imp: 0, clk: 0 };
        if (ev.event_type === 'impression') { statsMap[ev.featured_id].impressions++; statsMap[ev.featured_id].daily[day].imp++; }
        else { statsMap[ev.featured_id].clicks++; statsMap[ev.featured_id].daily[day].clk++; }
      });

      const rows = (listings || []).map(l => {
        const s = statsMap[l.id] || { impressions: 0, clicks: 0, daily: {} };
        const cost = (s.impressions / 1000) * l.cpm_rate + s.clicks * l.cpc_rate;
        return {
          id: l.id,
          name: nameMap[l.listing_id] || '—',
          type: l.listing_type,
          impressions: s.impressions,
          clicks: s.clicks,
          ctr: s.impressions > 0 ? ((s.clicks / s.impressions) * 100).toFixed(1) : '0.0',
          cost: cost.toFixed(0),
          budget: l.budget,
          dailyData: s.daily,
        };
      }).sort((a, b) => b.impressions - a.impressions);

      setData(rows);
      setLoading(false);
    };
    fetchAnalytics();
  }, [period]);

  const totals = data.reduce((acc, r) => ({
    impressions: acc.impressions + r.impressions,
    clicks: acc.clicks + r.clicks,
    cost: acc.cost + parseFloat(r.cost),
  }), { impressions: 0, clicks: 0, cost: 0 });

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {['7d', '30d', '90d'].map(p => (
          <Button key={p} variant={period === p ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => setPeriod(p)}>
            {p === '7d' ? t('autoI18n.clAdminFeat38') : p === '30d' ? t('autoI18n.clAdminFeat39') : t('autoI18n.clAdminFeat40')}
          </Button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <Eye className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{totals.impressions.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{t('autoI18n.clAdminFeat41')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <MousePointerClick className="w-5 h-5 mx-auto mb-1 text-success" />
            <p className="text-lg font-bold">{totals.clicks.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{t('autoI18n.clAdminFeat42')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">${totals.cost.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">{t('autoI18n.clAdminFeat43')}</p>
          </CardContent>
        </Card>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div> : (
        <div className="space-y-2">
          {data.map(row => (
            <Card key={row.id}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {row.type === 'hospital' ? <Building2 className="w-4 h-4 text-primary flex-shrink-0" /> : <Package className="w-4 h-4 text-secondary flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{row.name}</p>
                    <Badge variant="outline" className="text-[9px]">{row.type === 'hospital' ? t('autoI18n.clAdminFeat16') : t('autoI18n.clAdminFeat17')}</Badge>
                  </div>
                  <div className="flex gap-4 text-xs text-right">
                    <div><p className="font-bold">{row.impressions}</p><p className="text-[9px] text-muted-foreground">{t('autoI18n.clAdminFeat44')}</p></div>
                    <div><p className="font-bold">{row.clicks}</p><p className="text-[9px] text-muted-foreground">{t('autoI18n.clAdminFeat21')}</p></div>
                    <div><p className="font-bold">{row.ctr}%</p><p className="text-[9px] text-muted-foreground">CTR</p></div>
                    <div><p className="font-bold">${row.cost}</p><p className="text-[9px] text-muted-foreground">{t('autoI18n.clAdminFeat22')}</p></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {data.length === 0 && <p className="text-center text-muted-foreground py-8">{t('autoI18n.clAdminFeat45')}</p>}
        </div>
      )}
    </div>
  );
}
