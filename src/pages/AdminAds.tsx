import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdConfig, useAdPlacements } from '@/hooks/useAds';
import { supabase } from '@/integrations/supabase/client';
import { exportToCSV, exportToPDF, campaignsToTableHTML } from '@/lib/exportAdData';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import {
  Megaphone, Settings, LayoutGrid, BarChart3, Loader2,
  CheckCircle, XCircle, Pause, Play, Eye, MousePointerClick,
  DollarSign, TrendingUp, ArrowLeft, Users, Calendar,
  FileDown, ExternalLink, Image as ImageIcon, Trash2,
} from 'lucide-react';
import { format, subDays } from 'date-fns';

interface Campaign {
  id: string;
  advertiser_id: string;
  name: string;
  status: string;
  budget: number;
  spent: number;
  target_impressions: number;
  target_clicks: number;
  start_date: string | null;
  end_date: string | null;
  target_roles: string[];
  created_at: string;
}

interface CampaignStats { impressions: number; clicks: number; }
interface DailyEvent { date: string; impressions: number; clicks: number; }
interface Creative { id: string; campaign_id: string; placement_id: string; media_url: string; media_type: string; click_url: string; alt_text: string | null; is_active: boolean; }

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground', pending_payment: 'bg-warning/20 text-warning',
  pending_review: 'bg-info/20 text-info', active: 'bg-success/20 text-success',
  paused: 'bg-muted text-muted-foreground', completed: 'bg-primary/20 text-primary',
  rejected: 'bg-destructive/20 text-destructive',
};

function getStatusLabels(t: (path: string) => string): Record<string, string> {
  return {
    draft: t('ads.draft'), pending_payment: t('ads.pendingPayment'), pending_review: t('ads.pendingReview'),
    active: t('ads.active'), paused: t('ads.paused'), completed: t('ads.completed'), rejected: t('ads.rejected'),
  };
}

export default function AdminAds() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language, t } = useLanguage();
  const { config, refetch: refetchConfig } = useAdConfig();
  const { placements, refetch: refetchPlacements } = useAdPlacements();
  const statusLabels = getStatusLabels(t);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignStats, setCampaignStats] = useState<Record<string, CampaignStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dailyEvents, setDailyEvents] = useState<DailyEvent[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenue: number }[]>([]);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [campaignCreatives, setCampaignCreatives] = useState<Creative[]>([]);

  const [configForm, setConfigForm] = useState({ is_active: false, cpm_rate: 50, cpc_rate: 5, min_budget: 500, max_file_size_kb: 2048 });
  const [newPlacement, setNewPlacement] = useState({ name: '', display_name: '', description: '', width: 728, height: 90, format: 'banner' });
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalImpressions, setTotalImpressions] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);

  useEffect(() => { if (role && role !== 'admin') navigate('/'); }, [role, navigate]);
  useEffect(() => {
    setConfigForm({ is_active: config.is_active, cpm_rate: config.cpm_rate, cpc_rate: config.cpc_rate, min_budget: config.min_budget, max_file_size_kb: config.max_file_size_kb });
  }, [config]);

  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase.from('ad_campaigns' as any).select('*').order('created_at', { ascending: false });
    setCampaigns((data as any[]) || []);

    if (data && data.length > 0) {
      const ids = data.map((c: any) => c.id);
      const { data: events } = await supabase.from('ad_events' as any).select('campaign_id, event_type').in('campaign_id', ids);
      const stats: Record<string, CampaignStats> = {};
      (events as any[] || []).forEach((e: any) => {
        if (!stats[e.campaign_id]) stats[e.campaign_id] = { impressions: 0, clicks: 0 };
        if (e.event_type === 'impression') stats[e.campaign_id].impressions++;
        else if (e.event_type === 'click') stats[e.campaign_id].clicks++;
      });
      setCampaignStats(stats);
    }

    const { data: payments } = await supabase.from('ad_payments' as any).select('amount, created_at').eq('status', 'paid');
    const paidPayments = (payments as any[]) || [];
    setTotalRevenue(paidPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0));

    // Monthly revenue
    const monthMap: Record<string, number> = {};
    paidPayments.forEach((p: any) => {
      const m = p.created_at.substring(0, 7);
      monthMap[m] = (monthMap[m] || 0) + Number(p.amount);
    });
    setMonthlyRevenue(Object.entries(monthMap).sort().map(([month, revenue]) => ({ month, revenue })));

    const { count: impCount } = await supabase.from('ad_events' as any).select('*', { count: 'exact', head: true }).eq('event_type', 'impression');
    setTotalImpressions(impCount || 0);
    const { count: clickCount } = await supabase.from('ad_events' as any).select('*', { count: 'exact', head: true }).eq('event_type', 'click');
    setTotalClicks(clickCount || 0);

    // Daily events last 30 days
    const since = subDays(new Date(), 30).toISOString();
    const { data: dailyEvts } = await supabase.from('ad_events' as any).select('event_type, created_at').gte('created_at', since).order('created_at');
    const dayMap: Record<string, DailyEvent> = {};
    (dailyEvts as any[] || []).forEach((e: any) => {
      const d = e.created_at.substring(0, 10);
      if (!dayMap[d]) dayMap[d] = { date: d, impressions: 0, clicks: 0 };
      if (e.event_type === 'impression') dayMap[d].impressions++;
      else dayMap[d].clicks++;
    });
    setDailyEvents(Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date)));

    setIsLoading(false);
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  // Load creatives for expanded campaign
  useEffect(() => {
    if (!expandedCampaign) { setCampaignCreatives([]); return; }
    (async () => {
      const { data } = await supabase.from('ad_creatives' as any).select('*').eq('campaign_id', expandedCampaign);
      setCampaignCreatives((data as any[]) || []);
    })();
  }, [expandedCampaign]);

  const saveConfig = async () => {
    setIsSaving(true);
    const { error } = await supabase.from('ad_config' as any).update({ ...configForm, updated_at: new Date().toISOString() } as any).eq('id', 'default');
    setIsSaving(false);
    if (error) { toast.error(t('ads.configError')); return; }
    toast.success(t('ads.configSaved'));
    refetchConfig();
  };

  const updateCampaignStatus = async (id: string, status: string) => {
    await supabase.from('ad_campaigns' as any).update({ status } as any).eq('id', id);
    toast.success(`${t('ads.campaignStatus')} ${statusLabels[status] || status}`);
    fetchCampaigns();
  };

  const toggleCreativeActive = async (id: string, is_active: boolean) => {
    await supabase.from('ad_creatives' as any).update({ is_active } as any).eq('id', id);
    setCampaignCreatives(c => c.map(cr => cr.id === id ? { ...cr, is_active } : cr));
    toast.success(is_active ? t('ads.creativeActivated') : t('ads.creativeDeactivated'));
  };

  const addPlacement = async () => {
    if (!newPlacement.name || !newPlacement.display_name) return;
    await supabase.from('ad_placements' as any).insert({ ...newPlacement, sort_order: placements.length + 1 } as any);
    toast.success(t('ads.placementCreated'));
    setNewPlacement({ name: '', display_name: '', description: '', width: 728, height: 90, format: 'banner' });
    refetchPlacements();
  };

  const togglePlacement = async (id: string, is_active: boolean) => {
    await supabase.from('ad_placements' as any).update({ is_active } as any).eq('id', id);
    refetchPlacements();
  };

  const handleExportCSV = () => {
    const rows = campaigns.map(c => {
      const s = campaignStats[c.id] || { impressions: 0, clicks: 0 };
      return { Campaña: c.name, Estado: statusLabels[c.status] || c.status, Budget: c.budget, Impresiones: s.impressions, Clics: s.clicks, CTR: s.impressions > 0 ? ((s.clicks / s.impressions) * 100).toFixed(2) + '%' : '0%', Creada: c.created_at.substring(0, 10) };
    });
    exportToCSV(rows, `admin_campanas_${format(new Date(), 'yyyyMMdd')}`);
  };

  const handleExportPDF = () => {
    const rows = campaigns.map(c => {
      const s = campaignStats[c.id] || { impressions: 0, clicks: 0 };
      return { name: c.name, status: statusLabels[c.status] || c.status, budget: c.budget, impressions: s.impressions, clicks: s.clicks, ctr: s.impressions > 0 ? ((s.clicks / s.impressions) * 100).toFixed(2) : '0.00' };
    });
    exportToPDF('Reporte Admin - Campañas Publicitarias', campaignsToTableHTML(rows, totalRevenue));
  };

  if (role !== 'admin') return null;
  const es = language === 'es';

  const chartConfig = { impressions: { label: t('ads.impressions'), color: 'hsl(var(--info))' }, clicks: { label: t('ads.clicks'), color: 'hsl(var(--warning))' } };
  const revenueChartConfig = { revenue: { label: es ? 'Ingresos' : 'Revenue', color: 'hsl(var(--success))' } };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-heading text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-primary" />
              {t('ads.management')}
            </h1>
            <p className="text-muted-foreground text-sm">{t('ads.managementSubtitle')}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleExportCSV} title="CSV"><FileDown className="w-4 h-4" /></Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleExportPDF} title="PDF"><ExternalLink className="w-4 h-4" /></Button>
          </div>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:flex mb-4">
            <TabsTrigger value="dashboard" className="gap-1.5 text-xs sm:text-sm"><BarChart3 className="w-3.5 h-3.5" />Dashboard</TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-1.5 text-xs sm:text-sm"><Megaphone className="w-3.5 h-3.5" />{t('ads.campaigns')}</TabsTrigger>
            <TabsTrigger value="placements" className="gap-1.5 text-xs sm:text-sm"><LayoutGrid className="w-3.5 h-3.5" />{t('ads.placements')}</TabsTrigger>
            <TabsTrigger value="config" className="gap-1.5 text-xs sm:text-sm"><Settings className="w-3.5 h-3.5" />{t('ads.config')}</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: t('ads.totalRevenue'), value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-success' },
                { label: t('ads.activeCampaigns'), value: campaigns.filter(c => c.status === 'active').length, icon: Megaphone, color: 'text-primary' },
                { label: t('ads.impressions'), value: totalImpressions.toLocaleString(), icon: Eye, color: 'text-info' },
                { label: t('ads.clicks'), value: totalClicks.toLocaleString(), icon: MousePointerClick, color: 'text-warning' },
              ].map((stat, i) => (
                <Card key={i}><CardContent className="p-4 text-center">
                  <stat.icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </CardContent></Card>
              ))}
            </div>

            {totalImpressions > 0 && (
              <Card className="mb-6">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm">{t('ads.globalCtr')}</span>
                  </div>
                  <p className="text-3xl font-bold text-primary">{((totalClicks / totalImpressions) * 100).toFixed(2)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{totalClicks} {t('ads.clicksImpressions').replace('/', ` / ${totalImpressions} `)}</p>
                </CardContent>
              </Card>
            )}

            {/* Daily chart */}
            {dailyEvents.length > 0 && (
              <Card className="mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    {t('ads.impressionsClicks')} ({t('ads.last30Days')})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[220px] w-full">
                    <BarChart data={dailyEvents}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.substring(5)} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="impressions" fill="var(--color-impressions)" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="clicks" fill="var(--color-clicks)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {/* Monthly revenue chart */}
            {monthlyRevenue.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-success" />
                    {t('ads.monthlyRevenue')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={revenueChartConfig} className="h-[200px] w-full">
                    <LineChart data={monthlyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : campaigns.length === 0 ? (
              <Card className="p-8 text-center">
                <Megaphone className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">{t('ads.noCampaigns')}</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {campaigns.map(campaign => {
                  const stats = campaignStats[campaign.id] || { impressions: 0, clicks: 0 };
                  const ctr = stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(2) : '0.00';
                  const isExpanded = expandedCampaign === campaign.id;

                  return (
                    <Card key={campaign.id}>
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedCampaign(isExpanded ? null : campaign.id)}>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-sm truncate">{campaign.name}</h3>
                              <Badge className={`text-[10px] ${statusColors[campaign.status] || ''}`}>
                                {statusLabels[campaign.status] || campaign.status}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />${Number(campaign.budget).toLocaleString()}</span>
                              <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{stats.impressions.toLocaleString()} imp</span>
                              <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" />{stats.clicks} clics ({ctr}%)</span>
                              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{(campaign.target_roles || []).join(', ')}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {campaign.status === 'pending_review' && (
                              <>
                                <Button size="sm" variant="default" className="gap-1 text-xs" onClick={() => updateCampaignStatus(campaign.id, 'active')}>
                                  <CheckCircle className="w-3.5 h-3.5" /> {t('ads.approve')}
                                </Button>
                                <Button size="sm" variant="destructive" className="gap-1 text-xs" onClick={() => updateCampaignStatus(campaign.id, 'rejected')}>
                                  <XCircle className="w-3.5 h-3.5" /> {t('ads.reject')}
                                </Button>
                              </>
                            )}
                            {campaign.status === 'active' && (
                              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => updateCampaignStatus(campaign.id, 'paused')}>
                                <Pause className="w-3.5 h-3.5" /> {t('ads.pause')}
                              </Button>
                            )}
                            {campaign.status === 'paused' && (
                              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => updateCampaignStatus(campaign.id, 'active')}>
                                <Play className="w-3.5 h-3.5" /> {t('ads.reactivate')}
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Expanded: show creatives */}
                        {isExpanded && (
                          <div className="mt-4 pt-3 border-t border-border">
                            <h4 className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                              <ImageIcon className="w-3.5 h-3.5" /> {t('ads.creatives')} ({campaignCreatives.length})
                            </h4>
                            {campaignCreatives.length === 0 ? (
                              <p className="text-xs text-muted-foreground">{t('ads.noCreatives')}</p>
                            ) : (
                              <div className="space-y-2">
                                {campaignCreatives.map(cr => {
                                  const pl = placements.find(p => p.id === cr.placement_id);
                                  return (
                                    <div key={cr.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                                      {cr.media_type === 'video' ? (
                                        <video src={cr.media_url} className="w-16 h-12 object-cover rounded" muted />
                                      ) : (
                                        <img src={cr.media_url} alt={cr.alt_text || ''} className="w-16 h-12 object-cover rounded" />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">{pl?.display_name || 'Placement'}</p>
                                        <p className="text-[10px] text-muted-foreground truncate">{cr.click_url}</p>
                                      </div>
                                      <Switch checked={cr.is_active} onCheckedChange={v => toggleCreativeActive(cr.id, v)} />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Placements Tab */}
          <TabsContent value="placements">
            <div className="space-y-3 mb-6">
              {placements.map(p => (
                <Card key={p.id}><CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{p.display_name}</p>
                    <p className="text-xs text-muted-foreground">{p.name} · {p.width}×{p.height}px · {p.format}</p>
                    {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                  </div>
                  <Switch checked={p.is_active} onCheckedChange={v => togglePlacement(p.id, v)} />
                </CardContent></Card>
              ))}
            </div>
            <Card>
               <CardHeader><CardTitle className="text-base">{t('ads.newPlacement')}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">{t('ads.nameSlug')}</Label><Input value={newPlacement.name} onChange={e => setNewPlacement(p => ({ ...p, name: e.target.value }))} placeholder="hero_banner" /></div>
                  <div><Label className="text-xs">{t('ads.displayName')}</Label><Input value={newPlacement.display_name} onChange={e => setNewPlacement(p => ({ ...p, display_name: e.target.value }))} placeholder="Hero Banner" /></div>
                  <div><Label className="text-xs">{t('ads.width')}</Label><Input type="number" value={newPlacement.width} onChange={e => setNewPlacement(p => ({ ...p, width: parseInt(e.target.value) || 728 }))} /></div>
                  <div><Label className="text-xs">{t('ads.height')}</Label><Input type="number" value={newPlacement.height} onChange={e => setNewPlacement(p => ({ ...p, height: parseInt(e.target.value) || 90 }))} /></div>
                </div>
                <Input value={newPlacement.description} onChange={e => setNewPlacement(p => ({ ...p, description: e.target.value }))} placeholder={t('ads.description') + '...'} />
                <Button onClick={addPlacement} disabled={!newPlacement.name || !newPlacement.display_name}>{t('ads.createPlacement')}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Config Tab */}
          <TabsContent value="config">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Configuración Global</CardTitle>
                <CardDescription>Controla el sistema de publicidad</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <div><Label className="font-semibold">Sistema de Publicidad</Label><p className="text-xs text-muted-foreground">Activa o desactiva toda la publicidad</p></div>
                  <Switch checked={configForm.is_active} onCheckedChange={v => setConfigForm(f => ({ ...f, is_active: v }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-xs">CPM (por 1,000 impresiones)</Label><Input type="number" value={configForm.cpm_rate} onChange={e => setConfigForm(f => ({ ...f, cpm_rate: Number(e.target.value) }))} /></div>
                  <div><Label className="text-xs">CPC (por clic)</Label><Input type="number" value={configForm.cpc_rate} onChange={e => setConfigForm(f => ({ ...f, cpc_rate: Number(e.target.value) }))} /></div>
                  <div><Label className="text-xs">Presupuesto Mínimo</Label><Input type="number" value={configForm.min_budget} onChange={e => setConfigForm(f => ({ ...f, min_budget: Number(e.target.value) }))} /></div>
                  <div><Label className="text-xs">Tamaño Máx. Archivo (KB)</Label><Input type="number" value={configForm.max_file_size_kb} onChange={e => setConfigForm(f => ({ ...f, max_file_size_kb: Number(e.target.value) }))} /></div>
                </div>
                <Button onClick={saveConfig} disabled={isSaving} className="gap-2">
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Guardar Configuración
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
