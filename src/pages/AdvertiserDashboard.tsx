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
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  Megaphone, Plus, Eye, MousePointerClick, DollarSign,
  Loader2, BarChart3, ArrowLeft, Calendar, Users,
  Upload, Image as ImageIcon, TrendingUp, FileDown, CreditCard,
  Trash2, ExternalLink, Wallet, Lightbulb, Target,
  Monitor, Smartphone, Layout, Play, PanelLeft, Percent,
} from 'lucide-react';
import { format, subDays } from 'date-fns';

interface Campaign {
  id: string; name: string; status: string; budget: number; spent: number;
  target_impressions: number; target_clicks: number;
  start_date: string | null; end_date: string | null;
  target_roles: string[]; target_language: string | null;
  placement_ids: string[]; created_at: string;
}
interface CampaignStats { impressions: number; clicks: number; }
interface Creative {
  id: string; campaign_id: string; placement_id: string;
  media_url: string; media_type: string; click_url: string;
  alt_text: string | null; is_active: boolean;
}
interface DailyEvent { date: string; impressions: number; clicks: number; }

interface PlacementDef {
  id: string; name: string; display_name: string; width: number; height: number;
  format: string; is_active: boolean; description: string | null;
}

function getStatusLabels(t: (p: string) => string): Record<string, string> {
  return {
    draft: t('ads.draft'), pending_payment: t('ads.pendingPayment'),
    pending_review: t('ads.pendingReview'), active: t('ads.active'),
    paused: t('ads.paused'), completed: t('ads.completed'), rejected: t('ads.rejected'),
  };
}
const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground', pending_payment: 'bg-warning/20 text-warning',
  pending_review: 'bg-info/20 text-info', active: 'bg-success/20 text-success',
  paused: 'bg-muted text-muted-foreground', completed: 'bg-primary/20 text-primary',
  rejected: 'bg-destructive/20 text-destructive',
};

// Categorize placements into visual groups
function categorizePlacements(placements: PlacementDef[], t: (p: string) => string) {
  const categories = [
    {
      key: 'banners', icon: Layout,
      label: t('ads.catBanners'), desc: t('ads.catBannersDesc'),
      filter: (p: PlacementDef) => p.format === 'banner' && p.height <= 100,
    },
    {
      key: 'sidebar', icon: PanelLeft,
      label: t('ads.catSidebar'), desc: t('ads.catSidebarDesc'),
      filter: (p: PlacementDef) => p.format === 'banner' && p.height > 100,
    },
    {
      key: 'interstitial', icon: Monitor,
      label: t('ads.catInterstitial'), desc: t('ads.catInterstitialDesc'),
      filter: (p: PlacementDef) => p.format === 'interstitial',
    },
    {
      key: 'preroll', icon: Play,
      label: t('ads.catPreroll'), desc: t('ads.catPrerollDesc'),
      filter: (p: PlacementDef) => p.format === 'preroll',
    },
  ];

  return categories.map(cat => ({
    ...cat,
    placements: placements.filter(p => p.is_active && cat.filter(p)),
  })).filter(cat => cat.placements.length > 0);
}

// Mini visual mockup of placement dimensions
function PlacementMockup({ width, height, format: fmt }: { width: number; height: number; format: string }) {
  const isVertical = height > width;
  const maxW = fmt === 'interstitial' ? 40 : fmt === 'preroll' ? 60 : isVertical ? 20 : 80;
  const maxH = fmt === 'interstitial' ? 60 : fmt === 'preroll' ? 34 : isVertical ? 50 : 16;

  return (
    <div
      className="rounded border-2 border-dashed border-primary/30 bg-primary/5 flex items-center justify-center text-[9px] text-primary/60 font-mono"
      style={{ width: maxW, height: maxH }}
    >
      {fmt === 'preroll' ? '▶' : fmt === 'interstitial' ? '📱' : 'AD'}
    </div>
  );
}

// Drag & drop upload zone per placement
function PlacementUploadCard({
  placement, clickUrl, onClickUrlChange, onUpload, isUploading, existingCreative, onDelete, onUpdateClickUrl, t, es,
}: {
  placement: PlacementDef; clickUrl: string; onClickUrlChange: (v: string) => void;
  onUpload: (file: File) => void; isUploading: boolean;
  existingCreative: Creative | null; onDelete: (id: string) => void;
  onUpdateClickUrl: (id: string, url: string) => void;
  t: (p: string) => string; es: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [editUrl, setEditUrl] = useState(existingCreative?.click_url || '');
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync editUrl when existingCreative changes
  useEffect(() => {
    if (existingCreative) setEditUrl(existingCreative.click_url || '');
  }, [existingCreative?.click_url]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onUpload(file);
  };

  const handleSaveUrl = async () => {
    if (!existingCreative || !editUrl.trim()) return;
    setIsSavingUrl(true);
    onUpdateClickUrl(existingCreative.id, editUrl.trim());
    setIsSavingUrl(false);
  };

  return (
    <Card className="border-border/60">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-3 mb-3">
          <PlacementMockup width={placement.width} height={placement.height} format={placement.format} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{placement.display_name}</p>
            <p className="text-[10px] text-muted-foreground">{placement.width}×{placement.height}px · {placement.format}</p>
          </div>
          {existingCreative && (
            <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30 shrink-0">
              {t('ads.creativeActive')}
            </Badge>
          )}
        </div>

        {existingCreative ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2">
              {existingCreative.media_type === 'video' ? (
                <video src={existingCreative.media_url} className="w-20 h-14 object-cover rounded" muted />
              ) : (
                <img src={existingCreative.media_url} alt="" className="w-20 h-14 object-cover rounded" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground">{existingCreative.media_type}</p>
              </div>
              <Button variant="ghost" size="icon" className="text-destructive h-7 w-7 shrink-0" onClick={() => onDelete(existingCreative.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                {es ? 'URL de destino' : 'Destination URL'}
              </label>
              <div className="flex gap-1.5">
                <Input
                  placeholder="https://..."
                  value={editUrl}
                  onChange={e => setEditUrl(e.target.value)}
                  className="text-xs h-8 flex-1"
                />
                <Button
                  size="sm" className="h-8 px-3 text-xs"
                  disabled={isSavingUrl || editUrl === existingCreative.click_url || !editUrl.trim()}
                  onClick={handleSaveUrl}
                >
                  {isSavingUrl ? <Loader2 className="w-3 h-3 animate-spin" /> : (es ? 'Guardar' : 'Save')}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef} type="file" className="hidden"
                accept="image/*,video/*,.gif"
                onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); }}
              />
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
              ) : (
                <>
                  <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-[11px] text-muted-foreground">{t('ads.dragOrClickUpload')}</p>
                </>
              )}
            </div>
            <Input
              placeholder={es ? 'URL de destino (opcional)' : 'Destination URL (optional)'}
              value={clickUrl}
              onChange={e => onClickUrlChange(e.target.value)}
              className="text-xs h-8"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
  const [uploadingPlacement, setUploadingPlacement] = useState<string | null>(null);
  const [clickUrls, setClickUrls] = useState<Record<string, string>>({});
  const [isPaying, setIsPaying] = useState(false);

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

  useEffect(() => {
    if (!selectedCampaign) return;
    (async () => {
      const { data: crs } = await supabase.from('ad_creatives' as any)
        .select('*').eq('campaign_id', selectedCampaign);
      setCreatives((crs as any[]) || []);
      const since = subDays(new Date(), 30).toISOString();
      const { data: evts } = await supabase.from('ad_events' as any)
        .select('event_type, created_at')
        .eq('campaign_id', selectedCampaign)
        .gte('created_at', since).order('created_at');
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
    const url = clickUrls[placementId]?.trim() || '';
    const maxSize = config.max_file_size_kb * 1024;
    if (file.size > maxSize) { toast.error(`${t('ads.fileTooLarge')} (${t('ads.maxSize')} ${config.max_file_size_kb}KB)`); return; }
    setUploadingPlacement(placementId);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${selectedCampaign}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('ad-creatives').upload(path, file);
    if (upErr) { toast.error(t('ads.creativeUploadError')); setUploadingPlacement(null); return; }
    const { data: { publicUrl } } = supabase.storage.from('ad-creatives').getPublicUrl(path);
    const mediaType = file.type.startsWith('video') ? 'video' : file.type.includes('gif') ? 'gif' : 'image';
    const { error: insErr } = await supabase.from('ad_creatives' as any).insert({
      campaign_id: selectedCampaign, placement_id: placementId,
      media_url: publicUrl, media_type: mediaType,
      click_url: url, alt_text: file.name,
    } as any);
    setUploadingPlacement(null);
    if (insErr) { toast.error(t('ads.creativeSaveError')); return; }
    toast.success(t('ads.creativeUploaded'));
    setClickUrls(prev => ({ ...prev, [placementId]: '' }));
    const { data: crs } = await supabase.from('ad_creatives' as any).select('*').eq('campaign_id', selectedCampaign);
    setCreatives((crs as any[]) || []);
  };

  const deleteCreative = async (id: string) => {
    const creative = creatives.find(c => c.id === id);
    if (creative?.media_url) {
      const match = creative.media_url.match(/\/ad-creatives\/(.+)$/);
      if (match) {
        const storagePath = decodeURIComponent(match[1]);
        await supabase.storage.from('ad-creatives').remove([storagePath]);
      }
    }
    await supabase.from('ad_creatives' as any).delete().eq('id', id);
    setCreatives(c => c.filter(cr => cr.id !== id));
    toast.success(t('ads.creativeDeleted'));
  };

  const updateCreativeClickUrl = async (creativeId: string, newUrl: string) => {
    const { error } = await supabase.from('ad_creatives' as any).update({ click_url: newUrl } as any).eq('id', creativeId);
    if (error) { toast.error(es ? 'Error al guardar URL' : 'Error saving URL'); return; }
    setCreatives(prev => prev.map(c => c.id === creativeId ? { ...c, click_url: newUrl } : c));
    toast.success(es ? 'URL actualizada' : 'URL updated');
  };

  const payCampaign = async (campaignId: string, amount: number) => {
    setIsPaying(true);
    const { data, error } = await supabase.functions.invoke('create-ad-checkout', { body: { campaign_id: campaignId, amount } });
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
    const totalS = campaigns.reduce((sum, c) => {
      const s = campaignStats[c.id] || { impressions: 0, clicks: 0 };
      return sum + (s.impressions / 1000 * config.cpm_rate) + (s.clicks * config.cpc_rate);
    }, 0);
    exportToPDF('Reporte de Campañas Publicitarias', campaignsToTableHTML(rows, totalS));
  };

  const totalBudget = campaigns.reduce((s, c) => s + Number(c.budget), 0);
  const totalImpressions = Object.values(campaignStats).reduce((s, st) => s + st.impressions, 0);
  const totalClicks = Object.values(campaignStats).reduce((s, st) => s + st.clicks, 0);
  const totalSpent = campaigns.reduce((sum, c) => {
    const s = campaignStats[c.id] || { impressions: 0, clicks: 0 };
    return sum + (s.impressions / 1000 * config.cpm_rate) + (s.clicks * config.cpc_rate);
  }, 0);
  const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';

  const campaign = selectedCampaign ? campaigns.find(c => c.id === selectedCampaign) : null;
  const chartConfig = {
    impressions: { label: t('ads.impressions'), color: 'hsl(var(--info))' },
    clicks: { label: t('ads.clicks'), color: 'hsl(var(--warning))' },
  };

  const categories = categorizePlacements(placements as PlacementDef[], t);

  // ─── CAMPAIGN DETAIL VIEW ─────────────────────────────────────
  if (selectedCampaign && campaign) {
    const stats = campaignStats[campaign.id] || { impressions: 0, clicks: 0 };
    const ctr = stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(2) : '0.00';
    const calculatedSpent = (stats.impressions / 1000 * config.cpm_rate) + (stats.clicks * config.cpc_rate);
    const remaining = Math.max(0, Number(campaign.budget) - calculatedSpent);
    const budgetUsedPct = Number(campaign.budget) > 0 ? Math.min(100, (calculatedSpent / Number(campaign.budget)) * 100) : 0;

    const exportCampaignPDF = () => {
      const tableHTML = `
        <div class="summary"><p>Campaña: <span>${campaign.name}</span></p>
        <p>Estado: <span>${statusLabels[campaign.status] || campaign.status}</span></p>
        <p>Presupuesto: <span>$${Number(campaign.budget).toLocaleString()} MXN</span></p>
        <p>Gastado: <span>$${calculatedSpent.toFixed(2)} MXN</span></p></div>
        <table><thead><tr><th>Métrica</th><th>Valor</th></tr></thead><tbody>
        <tr><td>Impresiones</td><td>${stats.impressions.toLocaleString()}</td></tr>
        <tr><td>Clics</td><td>${stats.clicks}</td></tr>
        <tr><td>CTR</td><td>${ctr}%</td></tr></tbody></table>`;
      exportToPDF(`Reporte - ${campaign.name}`, tableHTML);
    };

    return (
      <MainLayout>
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <Button variant="ghost" size="icon" onClick={() => setSelectedCampaign(null)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="font-heading text-lg sm:text-xl font-bold truncate">{campaign.name}</h1>
              <Badge className={`text-[10px] mt-0.5 ${statusColors[campaign.status] || ''}`}>
                {statusLabels[campaign.status] || campaign.status}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={exportCampaignPDF} title="PDF">
                <FileDown className="w-4 h-4" />
              </Button>
              {campaign.status === 'draft' && (
                <Button size="sm" className="gap-1.5" disabled={isPaying || creatives.length === 0}
                  onClick={() => payCampaign(campaign.id, campaign.budget)}>
                  {isPaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  {t('ads.payActivate')}
                </Button>
              )}
            </div>
          </div>

          {/* Budget Bar */}
          <Card className="mb-5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">{t('ads.campaignBalance')}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center">
                  <p className="text-base sm:text-lg font-bold">${Number(campaign.budget).toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">{t('ads.budget').replace(' (MXN)', '')}</p>
                </div>
                <div className="text-center">
                  <p className="text-base sm:text-lg font-bold text-warning">${calculatedSpent.toFixed(0)}</p>
                  <p className="text-[10px] text-muted-foreground">{t('ads.spent')}</p>
                </div>
                <div className="text-center">
                  <p className="text-base sm:text-lg font-bold text-success">${remaining.toFixed(0)}</p>
                  <p className="text-[10px] text-muted-foreground">{t('ads.remaining')}</p>
                </div>
              </div>
              <Progress value={budgetUsedPct} className="h-2" />
              <p className="text-[10px] text-muted-foreground mt-1 text-right">{budgetUsedPct.toFixed(1)}% {es ? 'usado' : 'used'}</p>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <Card><CardContent className="p-3 text-center">
              <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-info mx-auto mb-1" />
              <p className="text-base sm:text-lg font-bold text-info">{stats.impressions.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{t('ads.impressions')}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <MousePointerClick className="w-4 h-4 sm:w-5 sm:h-5 text-warning mx-auto mb-1" />
              <p className="text-base sm:text-lg font-bold text-warning">{stats.clicks}</p>
              <p className="text-[10px] text-muted-foreground">{t('ads.clicks')}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-success mx-auto mb-1" />
              <p className="text-base sm:text-lg font-bold text-success">{ctr}%</p>
              <p className="text-[10px] text-muted-foreground">CTR</p>
            </CardContent></Card>
          </div>

          {/* Performance Chart */}
          {dailyEvents.length > 0 && (
            <Card className="mb-5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  {t('ads.performanceLast30')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[180px] w-full">
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

          {/* Creatives — grouped by category */}
          <div className="mb-5">
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <ImageIcon className="w-4 h-4 text-primary" />
              {t('ads.creatives')}
              <span className="text-[10px] text-muted-foreground font-normal ml-1">
                {t('ads.formats')}: {es ? 'imagen, GIF, video' : 'image, GIF, video'} · {t('ads.maxSize')}: {config.max_file_size_kb}KB
              </span>
            </h2>

            {categories.map(cat => {
              const relevantPlacements = cat.placements;
              if (relevantPlacements.length === 0) return null;
              return (
                <div key={cat.key} className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <cat.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">{cat.label}</span>
                    <span className="text-[10px] text-muted-foreground/70">— {cat.desc}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {relevantPlacements.map(pl => (
                      <PlacementUploadCard
                        key={pl.id}
                        placement={pl}
                        clickUrl={clickUrls[pl.id] || ''}
                        onClickUrlChange={v => setClickUrls(prev => ({ ...prev, [pl.id]: v }))}
                        onUpload={file => uploadCreative(file, pl.id)}
                        isUploading={uploadingPlacement === pl.id}
                        existingCreative={creatives.find(c => c.placement_id === pl.id) || null}
                        onDelete={deleteCreative}
                        onUpdateClickUrl={updateCreativeClickUrl}
                        t={t} es={es}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recommendations */}
          <Card className="mb-5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-warning" />
                {es ? 'Recomendaciones' : 'Recommendations'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.impressions > 0 && stats.clicks === 0 && (
                <p className="text-xs text-muted-foreground">💡 {es ? 'Tu campaña tiene impresiones pero ningún clic. Mejora el diseño del creativo.' : 'Your campaign has impressions but no clicks. Improve your creative design.'}</p>
              )}
              {stats.impressions > 0 && Number(ctr) < 1 && stats.clicks > 0 && (
                <p className="text-xs text-muted-foreground">📊 {es ? 'CTR por debajo del 1%. Prueba diferentes ubicaciones.' : 'CTR below 1%. Try different placements.'}</p>
              )}
              {Number(ctr) >= 1 && (
                <p className="text-xs text-muted-foreground">🎯 {es ? '¡Buen CTR! Considera aumentar el presupuesto.' : 'Good CTR! Consider increasing the budget.'}</p>
              )}
              {creatives.length === 0 && (
                <p className="text-xs text-muted-foreground">🖼️ {es ? 'Sube creativos para que tu campaña muestre anuncios.' : 'Upload creatives to start showing ads.'}</p>
              )}
            </CardContent>
          </Card>

          {campaign.status === 'completed' && (
            <Card className="border-success/20 bg-success/5">
              <CardContent className="p-4 text-center">
                <Target className="w-8 h-8 text-success mx-auto mb-2" />
                <h3 className="font-semibold mb-1">{es ? '¡Campaña Finalizada!' : 'Campaign Completed!'}</h3>
                <p className="text-xs text-muted-foreground mb-3">{es ? 'Exporta los resultados y crea una nueva campaña.' : 'Export results and create a new campaign.'}</p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" size="sm" onClick={exportCampaignPDF} className="gap-1.5">
                    <FileDown className="w-3.5 h-3.5" /> PDF
                  </Button>
                  <Button size="sm" onClick={() => { setSelectedCampaign(null); setShowCreate(true); }} className="gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> {es ? 'Nueva Campaña' : 'New Campaign'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </MainLayout>
    );
  }

  // ─── CAMPAIGN LIST VIEW ─────────────────────────────────────
  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Button variant="ghost" size="icon" onClick={() => navigate('/advertising')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-heading text-lg sm:text-2xl font-bold flex items-center gap-2">
              <Megaphone className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              {t('ads.myCampaigns')}
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">{t('ads.myCampaignsSubtitle')}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleExportCSV} title="CSV">
              <FileDown className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleExportPDF} title="PDF">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Summary Stats — 5 cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
          <Card><CardContent className="p-3 text-center">
            <DollarSign className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-sm sm:text-base font-bold">${totalBudget.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{t('ads.totalInvested')}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <Wallet className="w-4 h-4 text-warning mx-auto mb-1" />
            <p className="text-sm sm:text-base font-bold text-warning">${totalSpent.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{t('ads.spent')}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <Eye className="w-4 h-4 text-info mx-auto mb-1" />
            <p className="text-sm sm:text-base font-bold text-info">{totalImpressions.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{t('ads.impressions')}</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <MousePointerClick className="w-4 h-4 text-success mx-auto mb-1" />
            <p className="text-sm sm:text-base font-bold text-success">{totalClicks.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{t('ads.clicks')}</p>
          </CardContent></Card>
          <Card className="col-span-2 sm:col-span-1"><CardContent className="p-3 text-center">
            <Percent className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-sm sm:text-base font-bold">{avgCTR}%</p>
            <p className="text-[10px] text-muted-foreground">{t('ads.avgCTR')}</p>
          </CardContent></Card>
        </div>

        {/* New Campaign CTA */}
        <Button className="w-full mb-5 gap-2" size="lg" onClick={() => setShowCreate(true)}>
          <Plus className="w-5 h-5" />
          {t('ads.newCampaign')}
        </Button>

        {/* Create Campaign Form */}
        {showCreate && (
          <Card className="mb-5 border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('ads.newCampaign')}</CardTitle>
              <CardDescription className="text-xs">{t('ads.createCampaignSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Section 1: Info básica */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">1. {es ? 'Información básica' : 'Basic info'}</p>
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
                  <div><Label className="text-xs">{t('ads.startDate')}</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                  <div><Label className="text-xs">{t('ads.endDate')}</Label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
                </div>
              </div>

              {/* Section 2: Audiencia */}
              <div className="space-y-3 pt-2 border-t border-border/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">2. {t('ads.targetAudience')}</p>
                <div className="flex flex-wrap gap-3">
                  {[
                    { role: 'patient', icon: Users, label: t('ads.patients') },
                    { role: 'resident', icon: Users, label: t('ads.residents') },
                    { role: 'doctor', icon: Users, label: t('ads.doctors') },
                  ].map(({ role, label }) => (
                    <label key={role} className={`flex items-center gap-1.5 text-sm cursor-pointer rounded-lg border px-3 py-2 transition-colors ${form.target_roles.includes(role) ? 'border-primary bg-primary/5' : 'border-border'}`}>
                      <Checkbox checked={form.target_roles.includes(role)} onCheckedChange={() => toggleRole(role)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Section 3: Ubicaciones */}
              <div className="space-y-3 pt-2 border-t border-border/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">3. {t('ads.placementsLabel')}</p>
                {categories.map(cat => (
                  <div key={cat.key} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <cat.icon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">{cat.label}</span>
                      <span className="text-[10px] text-muted-foreground/60">{cat.desc}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-5">
                      {cat.placements.map(p => (
                        <label key={p.id} className={`flex items-center gap-2 text-xs cursor-pointer rounded-lg border p-2 transition-colors ${form.placement_ids.includes(p.id) ? 'border-primary bg-primary/5' : 'border-border/50'}`}>
                          <Checkbox checked={form.placement_ids.includes(p.id)} onCheckedChange={() => togglePlacement(p.id)} />
                          <PlacementMockup width={p.width} height={p.height} format={p.format} />
                          <div className="min-w-0">
                            <span className="block truncate">{p.display_name}</span>
                            <span className="text-[10px] text-muted-foreground">{p.width}×{p.height}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-3 border-t border-border/50">
                <Button onClick={createCampaign} disabled={isCreating} className="gap-2 flex-1">
                  {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('ads.createCampaign')}
                </Button>
                <Button variant="outline" onClick={() => setShowCreate(false)}>{es ? 'Cancelar' : 'Cancel'}</Button>
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
            <h3 className="font-semibold mb-1">{t('ads.noCampaignsYet')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('ads.createFirst')}</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {campaigns.map(c => {
              const stats = campaignStats[c.id] || { impressions: 0, clicks: 0 };
              const ctr = stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(1) : '0';
              const calcSpent = (stats.impressions / 1000 * config.cpm_rate) + (stats.clicks * config.cpc_rate);
              const pct = Number(c.budget) > 0 ? Math.min(100, (calcSpent / Number(c.budget)) * 100) : 0;
              return (
                <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedCampaign(c.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm truncate">{c.name}</h3>
                        <Badge className={`text-[10px] mt-1 ${statusColors[c.status] || ''}`}>
                          {statusLabels[c.status] || c.status}
                        </Badge>
                      </div>
                      <span className="text-sm font-bold text-primary shrink-0">${Number(c.budget).toLocaleString()}</span>
                    </div>
                    {/* Budget progress */}
                    <div className="mb-2">
                      <Progress value={pct} className="h-1.5" />
                      <p className="text-[10px] text-muted-foreground mt-0.5">{pct.toFixed(0)}% {t('ads.spent').toLowerCase()}</p>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="rounded-lg bg-muted/50 p-1.5 text-center">
                        <p className="text-xs font-bold text-info">{stats.impressions.toLocaleString()}</p>
                        <p className="text-[9px] text-muted-foreground">{t('ads.impressions').substring(0, 3)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-1.5 text-center">
                        <p className="text-xs font-bold text-warning">{stats.clicks}</p>
                        <p className="text-[9px] text-muted-foreground">{t('ads.clicks')}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-1.5 text-center">
                        <p className="text-xs font-bold text-success">{ctr}%</p>
                        <p className="text-[9px] text-muted-foreground">CTR</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-1.5 text-center">
                        <p className="text-xs font-bold">${calcSpent.toFixed(0)}</p>
                        <p className="text-[9px] text-muted-foreground">{t('ads.spent')}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{(c.target_roles || []).join(', ')}</span>
                      {c.start_date && <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{format(new Date(c.start_date), 'dd/MM/yy')}</span>}
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
