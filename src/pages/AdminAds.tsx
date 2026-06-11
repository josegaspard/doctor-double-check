import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import {
  Megaphone, Settings, LayoutGrid, BarChart3, Loader2,
  CheckCircle, XCircle, Pause, Play, Eye, MousePointerClick,
  DollarSign, TrendingUp, ArrowLeft, Users, Calendar,
  FileDown, ExternalLink, Image as ImageIcon, Trash2, Wallet,
  Plus, Upload, Monitor, Smartphone, Layout, PanelLeft,
  Percent, Save, Pencil,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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
  target_language: string | null;
  placement_ids: string[];
  created_at: string;
}

interface CampaignStats { impressions: number; clicks: number; }
interface DailyEvent { date: string; impressions: number; clicks: number; }
interface Creative { id: string; campaign_id: string; placement_id: string; media_url: string; media_type: string; click_url: string; alt_text: string | null; is_active: boolean; }
interface AdvertiserProfile { id: string; name: string; email: string; avatar_url: string | null; }

interface PlacementDef {
  id: string; name: string; display_name: string; width: number; height: number;
  format: string; is_active: boolean; description: string | null;
}

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

function categorizePlacements(placements: PlacementDef[], t: (p: string) => string) {
  const categories = [
    { key: 'banners', icon: Layout, label: t('ads.catBanners'), desc: t('ads.catBannersDesc'), filter: (p: PlacementDef) => p.format === 'banner' && p.height <= 100 },
    { key: 'sidebar', icon: PanelLeft, label: t('ads.catSidebar'), desc: t('ads.catSidebarDesc'), filter: (p: PlacementDef) => p.format === 'banner' && p.height > 100 },
    { key: 'interstitial', icon: Monitor, label: t('ads.catInterstitial'), desc: t('ads.catInterstitialDesc'), filter: (p: PlacementDef) => p.format === 'interstitial' },
    { key: 'preroll', icon: Play, label: t('ads.catPreroll'), desc: t('ads.catPrerollDesc'), filter: (p: PlacementDef) => p.format === 'preroll' },
  ];
  return categories.map(cat => ({ ...cat, placements: placements.filter(p => p.is_active && cat.filter(p)) })).filter(cat => cat.placements.length > 0);
}

function PlacementMockup({ width, height, format: fmt }: { width: number; height: number; format: string }) {
  const isVertical = height > width;
  const maxW = fmt === 'interstitial' ? 40 : fmt === 'preroll' ? 60 : isVertical ? 20 : 80;
  const maxH = fmt === 'interstitial' ? 60 : fmt === 'preroll' ? 34 : isVertical ? 50 : 16;
  return (
    <div className="rounded border-2 border-dashed border-primary/30 bg-primary/5 flex items-center justify-center text-[9px] text-primary/60 font-mono" style={{ width: maxW, height: maxH }}>
      {fmt === 'preroll' ? '▶' : fmt === 'interstitial' ? '📱' : 'AD'}
    </div>
  );
}

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
            <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30 shrink-0">{t('ads.creativeActive')}</Badge>
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
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">{t('autoI18n.clAdminAds1')}</label>
              <div className="flex gap-1.5">
                <Input placeholder="https://..." value={editUrl} onChange={e => setEditUrl(e.target.value)} className="text-xs h-8 flex-1" />
                <Button size="sm" className="h-8 px-3 text-xs" disabled={isSavingUrl || editUrl === existingCreative.click_url || !editUrl.trim()} onClick={handleSaveUrl}>
                  {isSavingUrl ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" className="hidden" accept="image/*,video/*,.gif" onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /> : (
                <>
                  <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-[11px] text-muted-foreground">{t('ads.dragOrClickUpload')}</p>
                </>
              )}
            </div>
            <Input placeholder={t('autoI18n.clAdminAds2')} value={clickUrl} onChange={e => onClickUrlChange(e.target.value)} className="text-xs h-8" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminAds() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
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
  const [advertiserProfiles, setAdvertiserProfiles] = useState<Record<string, AdvertiserProfile>>({});
  const [configForm, setConfigForm] = useState({ is_active: false, cpm_rate: 50, cpc_rate: 5, min_budget: 500, max_file_size_kb: 2048 });
  const [newPlacement, setNewPlacement] = useState({ name: '', display_name: '', description: '', width: 728, height: 90, format: 'banner' });
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalImpressions, setTotalImpressions] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);

  // Create campaign state
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', budget: 500, start_date: '', end_date: '',
    target_roles: ['patient', 'resident', 'doctor'] as string[],
    target_language: '', placement_ids: [] as string[],
  });

  // Edit campaign state
  const [editingCampaign, setEditingCampaign] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Campaign>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Creative upload state
  const [uploadingPlacement, setUploadingPlacement] = useState<string | null>(null);
  const [clickUrls, setClickUrls] = useState<Record<string, string>>({});

  const es = language === 'es';

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
      const advertiserIds = [...new Set(data.map((c: any) => c.advertiser_id))];
      const [{ data: events }, { data: profiles }] = await Promise.all([
        supabase.from('ad_events' as any).select('campaign_id, event_type').in('campaign_id', ids),
        supabase.from('profiles_public').select('id, name, avatar_url').in('id', advertiserIds),
      ]);
      const stats: Record<string, CampaignStats> = {};
      (events as any[] || []).forEach((e: any) => {
        if (!stats[e.campaign_id]) stats[e.campaign_id] = { impressions: 0, clicks: 0 };
        if (e.event_type === 'impression') stats[e.campaign_id].impressions++;
        else if (e.event_type === 'click') stats[e.campaign_id].clicks++;
      });
      setCampaignStats(stats);
      const profileMap: Record<string, AdvertiserProfile> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
      setAdvertiserProfiles(profileMap);
    }

    const { data: payments } = await supabase.from('ad_payments' as any).select('amount, created_at').eq('status', 'paid');
    const paidPayments = (payments as any[]) || [];
    setTotalRevenue(paidPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0));
    const monthMap: Record<string, number> = {};
    paidPayments.forEach((p: any) => { const m = p.created_at.substring(0, 7); monthMap[m] = (monthMap[m] || 0) + Number(p.amount); });
    setMonthlyRevenue(Object.entries(monthMap).sort().map(([month, revenue]) => ({ month, revenue })));

    const { count: impCount } = await supabase.from('ad_events' as any).select('*', { count: 'exact', head: true }).eq('event_type', 'impression');
    setTotalImpressions(impCount || 0);
    const { count: clickCount } = await supabase.from('ad_events' as any).select('*', { count: 'exact', head: true }).eq('event_type', 'click');
    setTotalClicks(clickCount || 0);

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

  // ── Create Campaign ──
  const estimatedImpressions = Math.floor((createForm.budget / config.cpm_rate) * 1000);
  const estimatedClicks = Math.floor(createForm.budget / config.cpc_rate);
  const toggleCreateRole = (r: string) => setCreateForm(f => ({ ...f, target_roles: f.target_roles.includes(r) ? f.target_roles.filter(x => x !== r) : [...f.target_roles, r] }));
  const toggleCreatePlacement = (id: string) => setCreateForm(f => ({ ...f, placement_ids: f.placement_ids.includes(id) ? f.placement_ids.filter(x => x !== id) : [...f.placement_ids, id] }));

  const createCampaign = async () => {
    if (!createForm.name || createForm.budget < config.min_budget) { toast.error(t('ads.completeRequired')); return; }
    setIsCreating(true);
    const { error } = await supabase.from('ad_campaigns' as any).insert({
      advertiser_id: user?.id, name: createForm.name, budget: createForm.budget,
      target_impressions: estimatedImpressions, target_clicks: estimatedClicks,
      start_date: createForm.start_date || null, end_date: createForm.end_date || null,
      target_roles: createForm.target_roles, target_language: createForm.target_language || null,
      placement_ids: createForm.placement_ids, status: 'active',
    } as any);
    setIsCreating(false);
    if (error) { toast.error(t('ads.campaignCreateError')); return; }
    toast.success(t('ads.campaignCreated'));
    setShowCreate(false);
    setCreateForm({ name: '', budget: config.min_budget, start_date: '', end_date: '', target_roles: ['patient', 'resident', 'doctor'], target_language: '', placement_ids: [] });
    fetchCampaigns();
  };

  // ── Edit Campaign ──
  const startEditing = (campaign: Campaign) => {
    setEditingCampaign(campaign.id);
    setEditForm({
      name: campaign.name, budget: campaign.budget,
      start_date: campaign.start_date, end_date: campaign.end_date,
      target_roles: campaign.target_roles || [], target_language: campaign.target_language,
    });
  };

  const saveEditCampaign = async () => {
    if (!editingCampaign) return;
    setIsSavingEdit(true);
    const { error } = await supabase.from('ad_campaigns' as any).update({
      name: editForm.name, budget: editForm.budget,
      start_date: editForm.start_date || null, end_date: editForm.end_date || null,
      target_roles: editForm.target_roles, target_language: editForm.target_language || null,
      updated_at: new Date().toISOString(),
    } as any).eq('id', editingCampaign);
    setIsSavingEdit(false);
    if (error) { toast.error(t('autoI18n.clAdminAds3')); return; }
    toast.success(t('ads.campaignUpdated'));
    setEditingCampaign(null);
    fetchCampaigns();
  };

  // ── Delete Campaign ──
  const deleteCampaign = async (campaignId: string) => {
    if (!confirm(t('ads.confirmDeleteCampaign'))) return;
    // Delete creatives + storage files
    const { data: crs } = await supabase.from('ad_creatives' as any).select('id, media_url').eq('campaign_id', campaignId);
    if (crs && (crs as any[]).length > 0) {
      const paths = (crs as any[]).map((c: any) => {
        const match = c.media_url?.match(/\/ad-creatives\/(.+)$/);
        return match ? decodeURIComponent(match[1]) : null;
      }).filter(Boolean);
      if (paths.length > 0) await supabase.storage.from('ad-creatives').remove(paths as string[]);
      await supabase.from('ad_creatives' as any).delete().eq('campaign_id', campaignId);
    }
    await supabase.from('ad_campaigns' as any).delete().eq('id', campaignId);
    toast.success(t('ads.creativeDeleted'));
    setExpandedCampaign(null);
    fetchCampaigns();
  };

  // ── Creative Management ──
  const uploadCreative = async (file: File, placementId: string) => {
    if (!expandedCampaign || !user?.id) return;
    const url = clickUrls[placementId]?.trim() || '';
    const maxSize = config.max_file_size_kb * 1024;
    if (file.size > maxSize) { toast.error(`${t('ads.fileTooLarge')} (${t('ads.maxSize')} ${config.max_file_size_kb}KB)`); return; }
    setUploadingPlacement(placementId);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${expandedCampaign}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('ad-creatives').upload(path, file);
    if (upErr) { toast.error(t('ads.creativeUploadError')); setUploadingPlacement(null); return; }
    const { data: { publicUrl } } = supabase.storage.from('ad-creatives').getPublicUrl(path);
    const mediaType = file.type.startsWith('video') ? 'video' : file.type.includes('gif') ? 'gif' : 'image';
    const { error: insErr } = await supabase.from('ad_creatives' as any).insert({
      campaign_id: expandedCampaign, placement_id: placementId,
      media_url: publicUrl, media_type: mediaType, click_url: url, alt_text: file.name,
    } as any);
    setUploadingPlacement(null);
    if (insErr) { toast.error(t('ads.creativeSaveError')); return; }
    toast.success(t('ads.creativeUploaded'));
    setClickUrls(prev => ({ ...prev, [placementId]: '' }));
    const { data: crs } = await supabase.from('ad_creatives' as any).select('*').eq('campaign_id', expandedCampaign);
    setCampaignCreatives((crs as any[]) || []);
  };

  const deleteCreative = async (id: string) => {
    const creative = campaignCreatives.find(c => c.id === id);
    if (creative?.media_url) {
      const match = creative.media_url.match(/\/ad-creatives\/(.+)$/);
      if (match) await supabase.storage.from('ad-creatives').remove([decodeURIComponent(match[1])]);
    }
    await supabase.from('ad_creatives' as any).delete().eq('id', id);
    setCampaignCreatives(c => c.filter(cr => cr.id !== id));
    toast.success(t('ads.creativeDeleted'));
  };

  const updateCreativeClickUrl = async (creativeId: string, newUrl: string) => {
    const { error } = await supabase.from('ad_creatives' as any).update({ click_url: newUrl } as any).eq('id', creativeId);
    if (error) { toast.error(t('autoI18n.clAdminAds4')); return; }
    setCampaignCreatives(prev => prev.map(c => c.id === creativeId ? { ...c, click_url: newUrl } : c));
    toast.success(t('autoI18n.clAdminAds5'));
  };

  // ── Exports ──
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

  const chartConfig = { impressions: { label: t('ads.impressions'), color: 'hsl(var(--info))' }, clicks: { label: t('ads.clicks'), color: 'hsl(var(--warning))' } };
  const revenueChartConfig = { revenue: { label: t('autoI18n.clAdminAds6'), color: 'hsl(var(--success))' } };
  const categories = categorizePlacements(placements as PlacementDef[], t);

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="back" size="icon" onClick={() => navigate('/admin')}>
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
            {/* Create Campaign Button */}
            <Button className="w-full mb-4 gap-2" size="lg" onClick={() => setShowCreate(!showCreate)}>
              <Plus className="w-5 h-5" />
              {t('ads.adminCreateCampaign')}
            </Button>

            {/* Create Campaign Form */}
            {showCreate && (
              <Card className="mb-5 border-primary/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t('ads.adminCreateCampaign')}</CardTitle>
                  <CardDescription className="text-xs">{t('ads.createCampaignSubtitle')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">1. {t('autoI18n.clAdminAds7')}</p>
                    <div>
                      <Label className="text-xs">{t('ads.campaignName')}</Label>
                      <Input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder={t('autoI18n.clAdminAds8')} />
                    </div>
                    <div>
                      <Label className="text-xs">{t('ads.budget')}</Label>
                      <Input type="number" value={createForm.budget} onChange={e => setCreateForm(f => ({ ...f, budget: Number(e.target.value) }))} min={config.min_budget} />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {t('ads.minimum')}: ${config.min_budget.toLocaleString()} · ~{estimatedImpressions.toLocaleString()} {t('ads.estimatedImp')} · ~{estimatedClicks.toLocaleString()} {t('ads.estimatedClicks')}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label className="text-xs">{t('ads.startDate')}</Label><Input type="date" value={createForm.start_date} onChange={e => setCreateForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                      <div><Label className="text-xs">{t('ads.endDate')}</Label><Input type="date" value={createForm.end_date} onChange={e => setCreateForm(f => ({ ...f, end_date: e.target.value }))} /></div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-border/50">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">2. {t('ads.targetAudience')}</p>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { role: 'patient', label: t('ads.patients') },
                        { role: 'resident', label: t('ads.residents') },
                        { role: 'doctor', label: t('ads.doctors') },
                      ].map(({ role: r, label }) => (
                        <label key={r} className={`flex items-center gap-1.5 text-sm cursor-pointer rounded-lg border px-3 py-2 transition-colors ${createForm.target_roles.includes(r) ? 'border-primary bg-primary/5' : 'border-border'}`}>
                          <Checkbox checked={createForm.target_roles.includes(r)} onCheckedChange={() => toggleCreateRole(r)} />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

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
                            <label key={p.id} className={`flex items-center gap-2 text-xs cursor-pointer rounded-lg border p-2 transition-colors ${createForm.placement_ids.includes(p.id) ? 'border-primary bg-primary/5' : 'border-border/50'}`}>
                              <Checkbox checked={createForm.placement_ids.includes(p.id)} onCheckedChange={() => toggleCreatePlacement(p.id)} />
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
                    <Button variant="outline" onClick={() => setShowCreate(false)}>{t('autoI18n.clAdminAds9')}</Button>
                  </div>
                </CardContent>
              </Card>
            )}

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
                  const advertiser = advertiserProfiles[campaign.advertiser_id];
                  const calculatedSpent = (stats.impressions / 1000 * config.cpm_rate) + (stats.clicks * config.cpc_rate);
                  const remaining = Math.max(0, Number(campaign.budget) - calculatedSpent);
                  const isEditing = editingCampaign === campaign.id;

                  return (
                    <Card key={campaign.id}>
                      <CardContent className="p-4">
                        {/* Advertiser profile */}
                        {advertiser && (
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                            <Avatar className="w-7 h-7">
                              <AvatarImage src={advertiser.avatar_url || undefined} />
                              <AvatarFallback className="text-[10px]">{advertiser.name?.charAt(0) || '?'}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium truncate">{advertiser.name}</p>
                            </div>
                          </div>
                        )}
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
                              <span className="flex items-center gap-1 text-warning"><Wallet className="w-3 h-3" />${calculatedSpent.toFixed(0)} {t('autoI18n.clAdminAds10')}</span>
                              <span className="flex items-center gap-1 text-success"><DollarSign className="w-3 h-3" />${remaining.toFixed(0)} {t('autoI18n.clAdminAds11')}</span>
                              <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{stats.impressions.toLocaleString()} imp</span>
                              <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" />{stats.clicks} clics ({ctr}%)</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => startEditing(campaign)}>
                              <Pencil className="w-3.5 h-3.5" /> {t('ads.editCampaign')}
                            </Button>
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
                            <Button size="sm" variant="destructive" className="gap-1 text-xs" onClick={() => deleteCampaign(campaign.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Edit Campaign Inline Form */}
                        {isEditing && (
                          <div className="mt-4 pt-3 border-t border-border space-y-3">
                            <h4 className="text-xs font-semibold flex items-center gap-1.5">
                              <Pencil className="w-3.5 h-3.5" /> {t('ads.editCampaign')}
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">{t('ads.campaignName')}</Label>
                                <Input value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                              </div>
                              <div>
                                <Label className="text-xs">{t('ads.budget')}</Label>
                                <Input type="number" value={editForm.budget || 0} onChange={e => setEditForm(f => ({ ...f, budget: Number(e.target.value) }))} />
                              </div>
                              <div>
                                <Label className="text-xs">{t('ads.startDate')}</Label>
                                <Input type="date" value={editForm.start_date || ''} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} />
                              </div>
                              <div>
                                <Label className="text-xs">{t('ads.endDate')}</Label>
                                <Input type="date" value={editForm.end_date || ''} onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))} />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">{t('ads.targetAudience')}</Label>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {['patient', 'resident', 'doctor'].map(r => (
                                  <label key={r} className={`flex items-center gap-1.5 text-xs cursor-pointer rounded-lg border px-3 py-1.5 transition-colors ${(editForm.target_roles || []).includes(r) ? 'border-primary bg-primary/5' : 'border-border'}`}>
                                    <Checkbox checked={(editForm.target_roles || []).includes(r)} onCheckedChange={() => setEditForm(f => ({
                                      ...f, target_roles: (f.target_roles || []).includes(r) ? (f.target_roles || []).filter(x => x !== r) : [...(f.target_roles || []), r]
                                    }))} />
                                    <span className="capitalize">{r}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={saveEditCampaign} disabled={isSavingEdit} className="gap-1.5">
                                {isSavingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                {t('autoI18n.clAdminAds12')}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingCampaign(null)}>{t('autoI18n.clAdminAds13')}</Button>
                            </div>
                          </div>
                        )}

                        {/* Expanded: creatives management */}
                        {isExpanded && (
                          <div className="mt-4 pt-3 border-t border-border">
                            <h4 className="text-xs font-semibold flex items-center gap-1.5 mb-3">
                              <ImageIcon className="w-3.5 h-3.5" /> {t('ads.creatives')} ({campaignCreatives.length})
                              <span className="text-[10px] text-muted-foreground font-normal ml-1">
                                {t('ads.formats')}: {t('autoI18n.clAdminAds14')} · {t('ads.maxSize')}: {config.max_file_size_kb}KB
                              </span>
                            </h4>

                            {categories.map(cat => {
                              if (cat.placements.length === 0) return null;
                              return (
                                <div key={cat.key} className="mb-4">
                                  <div className="flex items-center gap-2 mb-2">
                                    <cat.icon className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-xs font-medium text-muted-foreground">{cat.label}</span>
                                    <span className="text-[10px] text-muted-foreground/70">— {cat.desc}</span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {cat.placements.map(pl => (
                                      <PlacementUploadCard
                                        key={pl.id}
                                        placement={pl}
                                        clickUrl={clickUrls[pl.id] || ''}
                                        onClickUrlChange={v => setClickUrls(prev => ({ ...prev, [pl.id]: v }))}
                                        onUpload={file => uploadCreative(file, pl.id)}
                                        isUploading={uploadingPlacement === pl.id}
                                        existingCreative={campaignCreatives.find(c => c.placement_id === pl.id) || null}
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
                <CardTitle className="text-base">{t('ads.globalConfig')}</CardTitle>
                <CardDescription>{t('ads.globalConfigDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <div><Label className="font-semibold">{t('ads.adSystem')}</Label><p className="text-xs text-muted-foreground">{t('ads.adSystemDesc')}</p></div>
                  <Switch checked={configForm.is_active} onCheckedChange={v => setConfigForm(f => ({ ...f, is_active: v }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-xs">{t('ads.cpm')}</Label><Input type="number" value={configForm.cpm_rate} onChange={e => setConfigForm(f => ({ ...f, cpm_rate: Number(e.target.value) }))} /></div>
                  <div><Label className="text-xs">{t('ads.cpc')}</Label><Input type="number" value={configForm.cpc_rate} onChange={e => setConfigForm(f => ({ ...f, cpc_rate: Number(e.target.value) }))} /></div>
                  <div><Label className="text-xs">{t('ads.minBudget')}</Label><Input type="number" value={configForm.min_budget} onChange={e => setConfigForm(f => ({ ...f, min_budget: Number(e.target.value) }))} /></div>
                  <div><Label className="text-xs">{t('ads.maxFileSize')}</Label><Input type="number" value={configForm.max_file_size_kb} onChange={e => setConfigForm(f => ({ ...f, max_file_size_kb: Number(e.target.value) }))} /></div>
                </div>
                <Button onClick={saveConfig} disabled={isSaving} className="gap-2">
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('ads.saveConfig')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
