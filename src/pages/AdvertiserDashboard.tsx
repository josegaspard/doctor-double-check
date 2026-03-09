import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdConfig, useAdPlacements } from '@/hooks/useAds';
import { supabase } from '@/integrations/supabase/client';
import { exportToCSV, exportToPDF, campaignsToTableHTML } from '@/lib/exportAdData';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import {
  Megaphone, Plus, Eye, MousePointerClick, DollarSign,
  Loader2, BarChart3, ArrowLeft, Calendar, Users,
  Upload, Image as ImageIcon, TrendingUp, FileDown, CreditCard,
  Trash2, ExternalLink,
} from 'lucide-react';
import { format, subDays } from 'date-fns';

interface Campaign {
  id: string;
  name: string;
  status: string;
  budget: number;
  spent: number;
  target_impressions: number;
  target_clicks: number;
  start_date: string | null;
  end_date: string | null;
  target_roles: string[];
  target_language: string | null;
  placement_ids: string[];
  created_at: string;
}

interface CampaignStats {
  impressions: number;
  clicks: number;
}

interface Creative {
  id: string;
  campaign_id: string;
  placement_id: string;
  media_url: string;
  media_type: string;
  click_url: string;
  alt_text: string | null;
  is_active: boolean;
}

interface DailyEvent {
  date: string;
  impressions: number;
  clicks: number;
}

function getStatusLabels(t: (path: string) => string): Record<string, string> {
  return {
    draft: t('ads.draft'), pending_payment: t('ads.pendingPayment'), pending_review: t('ads.pendingReview'),
    active: t('ads.active'), paused: t('ads.paused'), completed: t('ads.completed'), rejected: t('ads.rejected'),
  };
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground', pending_payment: 'bg-warning/20 text-warning',
  pending_review: 'bg-info/20 text-info', active: 'bg-success/20 text-success',
  paused: 'bg-muted text-muted-foreground', completed: 'bg-primary/20 text-primary',
  rejected: 'bg-destructive/20 text-destructive',
};

export default function AdvertiserDashboard() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { language, t } = useLanguage();
  const { config } = useAdConfig();
  const { placements } = useAdPlacements();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignStats, setCampaignStats] = useState<Record<string, CampaignStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [dailyEvents, setDailyEvents] = useState<DailyEvent[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [clickUrl, setClickUrl] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '', budget: config.min_budget, start_date: '', end_date: '',
    target_roles: ['patient', 'resident', 'doctor'] as string[],
    target_language: '', placement_ids: [] as string[],
  });

  const es = language === 'es';
  const statusLabels = getStatusLabels(t);

  useEffect(() => { if (!isAuthenticated) navigate('/login'); }, [isAuthenticated, navigate]);

  const fetchCampaigns = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);

    const { data } = await supabase
      .from('ad_campaigns' as any).select('*')
      .eq('advertiser_id', user.id).order('created_at', { ascending: false });
    setCampaigns((data as any[]) || []);

    if (data && data.length > 0) {
      const ids = data.map((c: any) => c.id);
      const { data: events } = await supabase.from('ad_events' as any)
        .select('campaign_id, event_type').in('campaign_id', ids);
      const stats: Record<string, CampaignStats> = {};
      (events as any[] || []).forEach((e: any) => {
        if (!stats[e.campaign_id]) stats[e.campaign_id] = { impressions: 0, clicks: 0 };
        if (e.event_type === 'impression') stats[e.campaign_id].impressions++;
        else if (e.event_type === 'click') stats[e.campaign_id].clicks++;
      });
      setCampaignStats(stats);
    }
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  // Load creatives + daily stats when campaign selected
  useEffect(() => {
    if (!selectedCampaign) return;
    (async () => {
      const { data: crs } = await supabase.from('ad_creatives' as any)
        .select('*').eq('campaign_id', selectedCampaign);
      setCreatives((crs as any[]) || []);

      // Daily events last 30 days
      const since = subDays(new Date(), 30).toISOString();
      const { data: evts } = await supabase.from('ad_events' as any)
        .select('event_type, created_at')
        .eq('campaign_id', selectedCampaign)
        .gte('created_at', since)
        .order('created_at');

      const dayMap: Record<string, DailyEvent> = {};
      (evts as any[] || []).forEach((e: any) => {
        const d = e.created_at.substring(0, 10);
        if (!dayMap[d]) dayMap[d] = { date: d, impressions: 0, clicks: 0 };
        if (e.event_type === 'impression') dayMap[d].impressions++;
        else dayMap[d].clicks++;
      });
      setDailyEvents(Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date)));
    })();
  }, [selectedCampaign]);

  const toggleRole = (role: string) => setForm(f => ({ ...f, target_roles: f.target_roles.includes(role) ? f.target_roles.filter(r => r !== role) : [...f.target_roles, role] }));
  const togglePlacement = (id: string) => setForm(f => ({ ...f, placement_ids: f.placement_ids.includes(id) ? f.placement_ids.filter(p => p !== id) : [...f.placement_ids, id] }));

  const estimatedImpressions = Math.floor((form.budget / config.cpm_rate) * 1000);
  const estimatedClicks = Math.floor(form.budget / config.cpc_rate);

  const createCampaign = async () => {
    if (!form.name || form.budget < config.min_budget) { toast.error(t('ads.completeRequired')); return; }
    setIsCreating(true);
    const { error } = await supabase.from('ad_campaigns' as any).insert({
      advertiser_id: user?.id, name: form.name, budget: form.budget,
      target_impressions: estimatedImpressions, target_clicks: estimatedClicks,
      start_date: form.start_date || null, end_date: form.end_date || null,
      target_roles: form.target_roles, target_language: form.target_language || null,
      placement_ids: form.placement_ids, status: 'draft',
    } as any);
    setIsCreating(false);
    if (error) { toast.error(t('ads.campaignCreateError')); return; }
    toast.success(t('ads.campaignCreated'));
    setShowCreate(false);
    setForm({ name: '', budget: config.min_budget, start_date: '', end_date: '', target_roles: ['patient', 'resident', 'doctor'], target_language: '', placement_ids: [] });
    fetchCampaigns();
  };

  const uploadCreative = async (file: File, placementId: string) => {
    if (!selectedCampaign || !user?.id) return;
    const maxSize = config.max_file_size_kb * 1024;
    if (file.size > maxSize) { toast.error(`${t('ads.fileTooLarge')} (${t('ads.maxSize')} ${config.max_file_size_kb}KB)`); return; }

    setIsUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${selectedCampaign}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('ad-creatives').upload(path, file);
    if (upErr) { toast.error(t('ads.creativeUploadError')); setIsUploading(false); return; }

    const { data: { publicUrl } } = supabase.storage.from('ad-creatives').getPublicUrl(path);
    const mediaType = file.type.startsWith('video') ? 'video' : file.type.includes('gif') ? 'gif' : 'image';

    const { error: insErr } = await supabase.from('ad_creatives' as any).insert({
      campaign_id: selectedCampaign, placement_id: placementId,
      media_url: publicUrl, media_type: mediaType,
      click_url: clickUrl || '#', alt_text: file.name,
    } as any);
    setIsUploading(false);
    if (insErr) { toast.error(t('ads.creativeSaveError')); return; }
    toast.success(t('ads.creativeUploaded'));
    setClickUrl('');
    // Refresh creatives
    const { data: crs } = await supabase.from('ad_creatives' as any).select('*').eq('campaign_id', selectedCampaign);
    setCreatives((crs as any[]) || []);
  };

  const deleteCreative = async (id: string) => {
    await supabase.from('ad_creatives' as any).delete().eq('id', id);
    setCreatives(c => c.filter(cr => cr.id !== id));
    toast.success(t('ads.creativeDeleted'));
  };

  const payCampaign = async (campaignId: string, amount: number) => {
    setIsPaying(true);
    const { data, error } = await supabase.functions.invoke('create-ad-checkout', {
      body: { campaign_id: campaignId, amount },
    });
    setIsPaying(false);
    if (error || !data?.url) { toast.error(t('ads.checkoutError')); return; }
    window.open(data.url, '_blank');
  };

  const handleExportCSV = () => {
    const rows = campaigns.map(c => {
      const s = campaignStats[c.id] || { impressions: 0, clicks: 0 };
      return { Campaña: c.name, Estado: statusLabels[c.status] || c.status, Budget: c.budget, Impresiones: s.impressions, Clics: s.clicks, CTR: s.impressions > 0 ? ((s.clicks / s.impressions) * 100).toFixed(2) + '%' : '0%' };
    });
    exportToCSV(rows, `campanas_${format(new Date(), 'yyyyMMdd')}`);
  };

  const handleExportPDF = () => {
    const rows = campaigns.map(c => {
      const s = campaignStats[c.id] || { impressions: 0, clicks: 0 };
      return { name: c.name, status: statusLabels[c.status] || c.status, budget: c.budget, impressions: s.impressions, clicks: s.clicks, ctr: s.impressions > 0 ? ((s.clicks / s.impressions) * 100).toFixed(2) : '0.00' };
    });
    const totalSpent = campaigns.reduce((sum, c) => sum + Number(c.spent), 0);
    exportToPDF('Reporte de Campañas Publicitarias', campaignsToTableHTML(rows, totalSpent));
  };

  const totalImpressions = Object.values(campaignStats).reduce((sum, s) => sum + s.impressions, 0);
  const totalClicks = Object.values(campaignStats).reduce((sum, s) => sum + s.clicks, 0);
  const totalSpent = campaigns.reduce((sum, c) => sum + Number(c.spent), 0);

  const campaign = selectedCampaign ? campaigns.find(c => c.id === selectedCampaign) : null;

  const chartConfig = {
    impressions: { label: t('ads.impressions'), color: 'hsl(var(--info))' },
    clicks: { label: t('ads.clicks'), color: 'hsl(var(--warning))' },
  };

  // Campaign detail view
  if (selectedCampaign && campaign) {
    const stats = campaignStats[campaign.id] || { impressions: 0, clicks: 0 };
    const ctr = stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(2) : '0.00';

    return (
      <MainLayout>
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => setSelectedCampaign(null)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="font-heading text-lg sm:text-xl font-bold truncate">{campaign.name}</h1>
              <Badge className={`text-[10px] mt-0.5 ${statusColors[campaign.status] || ''}`}>
                {statusLabels[campaign.status] || campaign.status}
              </Badge>
            </div>
            {campaign.status === 'draft' && (
              <Button size="sm" className="gap-1.5" disabled={isPaying || creatives.length === 0}
                onClick={() => payCampaign(campaign.id, campaign.budget)}>
                {isPaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                {t('ads.payActivate')}
              </Button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Card><CardContent className="p-3 text-center">
              <Eye className="w-5 h-5 text-info mx-auto mb-1" />
              <p className="text-lg font-bold text-info">{stats.impressions.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{t('ads.impressions')}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <MousePointerClick className="w-5 h-5 text-warning mx-auto mb-1" />
              <p className="text-lg font-bold text-warning">{stats.clicks}</p>
              <p className="text-[10px] text-muted-foreground">{t('ads.clicks')}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <TrendingUp className="w-5 h-5 text-success mx-auto mb-1" />
              <p className="text-lg font-bold text-success">{ctr}%</p>
              <p className="text-[10px] text-muted-foreground">CTR</p>
            </CardContent></Card>
          </div>

          {/* Performance Chart */}
          {dailyEvents.length > 0 && (
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  {t('ads.performanceLast30')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
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

          {/* Creative Upload Section */}
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary" />
                {t('ads.creatives')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('ads.formats')}: {es ? 'imagen, GIF, video' : 'image, GIF, video'} · {t('ads.maxSize')}: {config.max_file_size_kb}KB
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing creatives */}
              {creatives.length > 0 && (
                <div className="space-y-2">
                  {creatives.map(cr => {
                    const pl = placements.find(p => p.id === cr.placement_id);
                    return (
                      <div key={cr.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                        {cr.media_type === 'video' ? (
                          <video src={cr.media_url} className="w-20 h-14 object-cover rounded" muted />
                        ) : (
                          <img src={cr.media_url} alt={cr.alt_text || ''} className="w-20 h-14 object-cover rounded" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{pl?.display_name || 'Placement'}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{cr.click_url}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => deleteCreative(cr.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Upload for each placement */}
              {placements.filter(p => p.is_active).map(pl => {
                const hasCreative = creatives.some(c => c.placement_id === pl.id);
                if (hasCreative) return null;
                return (
                  <div key={pl.id} className="border border-dashed border-border rounded-lg p-3">
                    <p className="text-xs font-medium mb-1">{pl.display_name} <span className="text-muted-foreground">({pl.width}×{pl.height}px)</span></p>
                    <div className="space-y-2">
                      <Input placeholder={t('ads.clickDestUrl')} value={clickUrl} onChange={e => setClickUrl(e.target.value)} className="text-xs h-8" />
                      <Button variant="outline" size="sm" className="gap-1.5 w-full text-xs" disabled={isUploading}
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*,video/*,.gif';
                          input.onchange = (e: any) => {
                            const file = e.target.files?.[0];
                            if (file) uploadCreative(file, pl.id);
                          };
                          input.click();
                        }}>
                        {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {t('ads.uploadCreative')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Campaign list view
  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/advertising')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-heading text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-primary" />
              {t('ads.myCampaigns')}
            </h1>
            <p className="text-muted-foreground text-sm">{t('ads.myCampaignsSubtitle')}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleExportCSV} title="CSV">
              <FileDown className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleExportPDF} title="PDF">
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button className="gap-2" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{es ? 'Nueva' : 'New'}</span>
            </Button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card><CardContent className="p-3 text-center">
            <Eye className="w-5 h-5 text-info mx-auto mb-1" />
             <p className="text-lg font-bold text-info">{totalImpressions.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{t('ads.impressions')}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <MousePointerClick className="w-5 h-5 text-warning mx-auto mb-1" />
            <p className="text-lg font-bold text-warning">{totalClicks.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{t('ads.clicks')}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <DollarSign className="w-5 h-5 text-success mx-auto mb-1" />
            <p className="text-lg font-bold text-success">${totalSpent.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{t('ads.spent')}</p>
          </CardContent></Card>
        </div>

        {/* Create Campaign Form */}
        {showCreate && (
          <Card className="mb-6 border-primary/30">
            <CardHeader>
              <CardTitle className="text-base">{t('ads.newCampaign')}</CardTitle>
              <CardDescription>{t('ads.createCampaignSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">{t('ads.campaignName')}</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={es ? 'Mi campaña' : 'My campaign'} />
              </div>
              <div>
                <Label className="text-xs">{t('ads.budget')}</Label>
                <Input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: Number(e.target.value) }))} min={config.min_budget} />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {t('ads.minimum')}: ${config.min_budget.toLocaleString()} · ~{estimatedImpressions.toLocaleString()} {t('ads.estimatedImp')} · ~{estimatedClicks.toLocaleString()} {t('ads.estimatedClicks')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('ads.startDate')}</Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">{t('ads.endDate')}</Label>
                  <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-2 block">{t('ads.targetAudience')}</Label>
                <div className="flex flex-wrap gap-2">
                  {['patient', 'resident', 'doctor'].map(role => (
                    <label key={role} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Checkbox checked={form.target_roles.includes(role)} onCheckedChange={() => toggleRole(role)} />
                      <span className="capitalize">{role === 'patient' ? t('ads.patients') : role === 'resident' ? t('ads.residents') : t('ads.doctors')}</span>
                    </label>
                  ))}
                </div>
              </div>
              {placements.filter(p => p.is_active).length > 0 && (
                <div>
                  <Label className="text-xs mb-2 block">Placements</Label>
                  <div className="flex flex-wrap gap-2">
                    {placements.filter(p => p.is_active).map(p => (
                      <label key={p.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <Checkbox checked={form.placement_ids.includes(p.id)} onCheckedChange={() => togglePlacement(p.id)} />
                        <span>{p.display_name} ({p.width}×{p.height})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button onClick={createCampaign} disabled={isCreating} className="gap-2">
                  {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('ads.createCampaign')}
                </Button>
                <Button variant="outline" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campaign List */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : campaigns.length === 0 ? (
          <Card className="p-8 text-center">
            <Megaphone className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <h3 className="font-semibold mb-1">{es ? 'Sin campañas aún' : 'No campaigns yet'}</h3>
            <p className="text-sm text-muted-foreground mb-4">{es ? 'Crea tu primera campaña publicitaria' : 'Create your first ad campaign'}</p>
            <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="w-4 h-4" />{es ? 'Crear Campaña' : 'Create Campaign'}</Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {campaigns.map(campaign => {
              const stats = campaignStats[campaign.id] || { impressions: 0, clicks: 0 };
              const ctr = stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(2) : '0.00';
              return (
                <Card key={campaign.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedCampaign(campaign.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-semibold text-sm">{campaign.name}</h3>
                        <Badge className={`text-[10px] mt-1 ${statusColors[campaign.status] || ''}`}>
                          {statusLabels[campaign.status] || campaign.status}
                        </Badge>
                      </div>
                      <span className="text-sm font-bold text-primary">${Number(campaign.budget).toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="rounded-lg bg-muted/50 p-2 text-center">
                        <p className="text-sm font-bold text-info">{stats.impressions.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">{es ? 'Imp' : 'Imp'}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2 text-center">
                        <p className="text-sm font-bold text-warning">{stats.clicks}</p>
                        <p className="text-[10px] text-muted-foreground">Clics</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2 text-center">
                        <p className="text-sm font-bold text-success">{ctr}%</p>
                        <p className="text-[10px] text-muted-foreground">CTR</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{(campaign.target_roles || []).join(', ')}</span>
                      {campaign.start_date && <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{format(new Date(campaign.start_date), 'dd/MM/yy')}</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
