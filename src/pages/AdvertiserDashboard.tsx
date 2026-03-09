import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAdConfig, useAdPlacements } from '@/hooks/useAds';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Megaphone, Plus, Eye, MousePointerClick, DollarSign,
  Loader2, BarChart3, ArrowLeft, Calendar, Users,
  Upload, Image as ImageIcon, TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';

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

const statusLabels: Record<string, string> = {
  draft: 'Borrador',
  pending_payment: 'Pago Pendiente',
  pending_review: 'En Revisión',
  active: 'Activa',
  paused: 'Pausada',
  completed: 'Completada',
  rejected: 'Rechazada',
};

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_payment: 'bg-warning/20 text-warning',
  pending_review: 'bg-info/20 text-info',
  active: 'bg-success/20 text-success',
  paused: 'bg-muted text-muted-foreground',
  completed: 'bg-primary/20 text-primary',
  rejected: 'bg-destructive/20 text-destructive',
};

export default function AdvertiserDashboard() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const { config } = useAdConfig();
  const { placements } = useAdPlacements();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignStats, setCampaignStats] = useState<Record<string, CampaignStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Create form
  const [form, setForm] = useState({
    name: '',
    budget: config.min_budget,
    start_date: '',
    end_date: '',
    target_roles: ['patient', 'resident', 'doctor'] as string[],
    target_language: '',
    placement_ids: [] as string[],
  });

  const es = language === 'es';

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  const fetchCampaigns = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);

    const { data } = await supabase
      .from('ad_campaigns' as any)
      .select('*')
      .eq('advertiser_id', user.id)
      .order('created_at', { ascending: false });
    setCampaigns((data as any[]) || []);

    if (data && data.length > 0) {
      const ids = data.map((c: any) => c.id);
      const { data: events } = await supabase
        .from('ad_events' as any)
        .select('campaign_id, event_type')
        .in('campaign_id', ids);

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

  const toggleRole = (role: string) => {
    setForm(f => ({
      ...f,
      target_roles: f.target_roles.includes(role)
        ? f.target_roles.filter(r => r !== role)
        : [...f.target_roles, role],
    }));
  };

  const togglePlacement = (id: string) => {
    setForm(f => ({
      ...f,
      placement_ids: f.placement_ids.includes(id)
        ? f.placement_ids.filter(p => p !== id)
        : [...f.placement_ids, id],
    }));
  };

  const estimatedImpressions = Math.floor((form.budget / config.cpm_rate) * 1000);
  const estimatedClicks = Math.floor(form.budget / config.cpc_rate);

  const createCampaign = async () => {
    if (!form.name || form.budget < config.min_budget) {
      toast.error(es ? 'Completa todos los campos requeridos' : 'Complete all required fields');
      return;
    }
    setIsCreating(true);

    const { error } = await supabase.from('ad_campaigns' as any).insert({
      advertiser_id: user?.id,
      name: form.name,
      budget: form.budget,
      target_impressions: estimatedImpressions,
      target_clicks: estimatedClicks,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      target_roles: form.target_roles,
      target_language: form.target_language || null,
      placement_ids: form.placement_ids,
      status: 'draft',
    } as any);

    setIsCreating(false);
    if (error) { toast.error('Error al crear campaña'); return; }
    toast.success(es ? 'Campaña creada. Sube tus creativos y paga para activarla.' : 'Campaign created. Upload creatives and pay to activate.');
    setShowCreate(false);
    setForm({ name: '', budget: config.min_budget, start_date: '', end_date: '', target_roles: ['patient', 'resident', 'doctor'], target_language: '', placement_ids: [] });
    fetchCampaigns();
  };

  // Totals
  const totalImpressions = Object.values(campaignStats).reduce((sum, s) => sum + s.impressions, 0);
  const totalClicks = Object.values(campaignStats).reduce((sum, s) => sum + s.clicks, 0);
  const totalSpent = campaigns.reduce((sum, c) => sum + Number(c.spent), 0);

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
              {es ? 'Mis Campañas' : 'My Campaigns'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {es ? 'Gestiona y monitorea tus campañas publicitarias' : 'Manage and monitor your ad campaigns'}
            </p>
          </div>
          <Button className="gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{es ? 'Nueva Campaña' : 'New Campaign'}</span>
          </Button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card>
            <CardContent className="p-3 text-center">
              <Eye className="w-5 h-5 text-info mx-auto mb-1" />
              <p className="text-lg font-bold text-info">{totalImpressions.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{es ? 'Impresiones' : 'Impressions'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <MousePointerClick className="w-5 h-5 text-warning mx-auto mb-1" />
              <p className="text-lg font-bold text-warning">{totalClicks.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Clics</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <DollarSign className="w-5 h-5 text-success mx-auto mb-1" />
              <p className="text-lg font-bold text-success">${totalSpent.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{es ? 'Gastado' : 'Spent'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Create Campaign Form */}
        {showCreate && (
          <Card className="mb-6 border-primary/30">
            <CardHeader>
              <CardTitle className="text-base">{es ? 'Nueva Campaña' : 'New Campaign'}</CardTitle>
              <CardDescription>{es ? 'Configura tu campaña publicitaria' : 'Set up your ad campaign'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">{es ? 'Nombre de la campaña' : 'Campaign name'}</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={es ? 'Mi campaña' : 'My campaign'} />
              </div>

              <div>
                <Label className="text-xs">{es ? 'Presupuesto (MXN)' : 'Budget (MXN)'}</Label>
                <Input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: Number(e.target.value) }))} min={config.min_budget} />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Mínimo: ${config.min_budget.toLocaleString()} · ~{estimatedImpressions.toLocaleString()} imp · ~{estimatedClicks.toLocaleString()} clics
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{es ? 'Fecha inicio' : 'Start date'}</Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">{es ? 'Fecha fin' : 'End date'}</Label>
                  <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>

              <div>
                <Label className="text-xs mb-2 block">{es ? 'Audiencia objetivo' : 'Target audience'}</Label>
                <div className="flex flex-wrap gap-2">
                  {['patient', 'resident', 'doctor'].map(role => (
                    <label key={role} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Checkbox
                        checked={form.target_roles.includes(role)}
                        onCheckedChange={() => toggleRole(role)}
                      />
                      <span className="capitalize">{role === 'patient' ? (es ? 'Pacientes' : 'Patients') : role === 'resident' ? (es ? 'Residentes' : 'Residents') : (es ? 'Doctores' : 'Doctors')}</span>
                    </label>
                  ))}
                </div>
              </div>

              {placements.filter(p => p.is_active).length > 0 && (
                <div>
                  <Label className="text-xs mb-2 block">{es ? 'Placements' : 'Placements'}</Label>
                  <div className="flex flex-wrap gap-2">
                    {placements.filter(p => p.is_active).map(p => (
                      <label key={p.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <Checkbox
                          checked={form.placement_ids.includes(p.id)}
                          onCheckedChange={() => togglePlacement(p.id)}
                        />
                        <span>{p.display_name} ({p.width}×{p.height})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button onClick={createCampaign} disabled={isCreating} className="gap-2">
                  {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {es ? 'Crear Campaña' : 'Create Campaign'}
                </Button>
                <Button variant="outline" onClick={() => setShowCreate(false)}>
                  {es ? 'Cancelar' : 'Cancel'}
                </Button>
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
            <p className="text-sm text-muted-foreground mb-4">
              {es ? 'Crea tu primera campaña publicitaria' : 'Create your first ad campaign'}
            </p>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              {es ? 'Crear Campaña' : 'Create Campaign'}
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {campaigns.map(campaign => {
              const stats = campaignStats[campaign.id] || { impressions: 0, clicks: 0 };
              const ctr = stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(2) : '0.00';

              return (
                <Card key={campaign.id}>
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
                        <p className="text-[10px] text-muted-foreground">{es ? 'Impresiones' : 'Imp'}</p>
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
                      <span className="flex items-center gap-0.5">
                        <Users className="w-3 h-3" />
                        {(campaign.target_roles || []).join(', ')}
                      </span>
                      {campaign.start_date && (
                        <span className="flex items-center gap-0.5">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(campaign.start_date), 'dd/MM/yy')}
                        </span>
                      )}
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
