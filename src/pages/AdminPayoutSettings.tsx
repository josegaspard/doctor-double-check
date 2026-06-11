import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Settings, Loader2, Save, DollarSign, Calendar, Percent, FileText, Play, ArrowLeft, Info, CreditCard, Building, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

interface PayoutSettings {
  payout_frequency: string; payout_day: number; commission_percentage: number;
  commission_consultation: number | null; commission_recording: number | null;
  commission_live: number | null; commission_chat: number | null; commission_content: number | null;
  minimum_payout_amount: number; auto_payout_enabled: boolean; require_invoice: boolean;
  stripe_fee_pct: number; stripe_fee_fixed: number;
}

export default function AdminPayoutSettings() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t } = useLanguage();

  const dayNames = [
    '',
    t('adminPayoutSettings.days.monday'),
    t('adminPayoutSettings.days.tuesday'),
    t('adminPayoutSettings.days.wednesday'),
    t('adminPayoutSettings.days.thursday'),
    t('adminPayoutSettings.days.friday'),
    t('adminPayoutSettings.days.saturday'),
    t('adminPayoutSettings.days.sunday'),
  ];

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [settings, setSettings] = useState<PayoutSettings>({
    payout_frequency: 'weekly', payout_day: 1, commission_percentage: 20,
    commission_consultation: null, commission_recording: null, commission_live: null,
    commission_chat: null, commission_content: null,
    minimum_payout_amount: 100, auto_payout_enabled: true, require_invoice: true,
    stripe_fee_pct: 3.6, stripe_fee_fixed: 3,
  });

  useEffect(() => {
    if (role !== 'admin') { navigate('/'); return; }
    fetchSettings();
  }, [role]);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('payout_settings').select('*').eq('id', 'default').single();
      if (data) {
        setSettings({
          payout_frequency: data.payout_frequency || 'weekly', payout_day: data.payout_day || 1,
          commission_percentage: data.commission_percentage || 20,
          commission_consultation: data.commission_consultation ?? null,
          commission_recording: data.commission_recording ?? null,
          commission_live: data.commission_live ?? null,
          commission_chat: data.commission_chat ?? null,
          commission_content: data.commission_content ?? null,
          minimum_payout_amount: data.minimum_payout_amount || 100,
          auto_payout_enabled: data.auto_payout_enabled ?? true,
          require_invoice: data.require_invoice ?? true,
          stripe_fee_pct: (data as any).stripe_fee_pct ?? 3.6,
          stripe_fee_fixed: (data as any).stripe_fee_fixed ?? 3,
        });
      }
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('payout_settings').upsert({ id: 'default', ...settings, updated_at: new Date().toISOString() } as any);
      if (error) throw error;
      toast.success(t('adminPayoutSettings.toast.saved'));
    } catch (error: any) { toast.error(error.message); } finally { setIsSaving(false); }
  };

  const handleProcessPayouts = async () => {
    if (!confirm(t('adminPayoutSettings.confirm.processPayouts'))) return;
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-doctor-payouts');
      if (error) throw error;
      if (data?.processed > 0) toast.success(t('adminPayoutSettings.toast.processed').replace('{{count}}', String(data.processed)));
      else toast.info(t('adminPayoutSettings.toast.noPending'));
    } catch (error: any) { toast.error(error.message); } finally { setIsProcessing(false); }
  };

  const getPayoutPreview = () => {
    if (settings.payout_frequency === 'daily') return t('adminPayoutSettings.preview.daily');
    if (settings.payout_frequency === 'weekly') return t('adminPayoutSettings.preview.weekly').replace('{{day}}', dayNames[settings.payout_day] || dayNames[1]);
    if (settings.payout_frequency === 'biweekly') return t('adminPayoutSettings.preview.biweekly').replace('{{day}}', String(settings.payout_day));
    return t('adminPayoutSettings.preview.monthly').replace('{{day}}', String(settings.payout_day));
  };

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Button variant="back" size="sm" onClick={() => navigate('/admin')} className="hidden sm:inline-flex mb-4 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" />{t('adminPayoutSettings.backToPanel')}
        </Button>

        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2"><Settings className="w-6 h-6" />{t('adminPayoutSettings.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('adminPayoutSettings.subtitle')}</p>
        </div>

        {isLoading ? (
          <Card><CardContent className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></CardContent></Card>
        ) : (
          <div className="space-y-6">
            {/* Stripe Info Banner */}
            <Alert className="border-info/30 bg-info/5">
              <Info className="w-4 h-4 text-info" />
              <AlertDescription className="text-sm">
                <strong>{t('adminPayoutSettings.banner.autoLead')}</strong>{t('adminPayoutSettings.banner.autoBody')}<Badge variant="outline" className="text-xs gap-1 mx-1"><CreditCard className="w-3 h-3" />{t('adminPayoutSettings.banner.stripeConnect')}</Badge>{t('adminPayoutSettings.banner.verifiedBody')}<strong>{t('adminPayoutSettings.banner.paymentMgmt')}</strong>{t('adminPayoutSettings.banner.viaBody')}<Badge variant="outline" className="text-xs gap-1 mx-1"><Building className="w-3 h-3" />{t('adminPayoutSettings.banner.bankTransfer')}</Badge>{t('adminPayoutSettings.banner.bankTransferSuffix')}
              </AlertDescription>
            </Alert>

            {/* Frequency */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5" />{t('adminPayoutSettings.frequency.title')}</CardTitle>
                <CardDescription>{getPayoutPreview()}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('adminPayoutSettings.frequency.label')}</Label>
                  <Select value={settings.payout_frequency} onValueChange={(v) => setSettings(s => ({ ...s, payout_frequency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{t('adminPayoutSettings.frequency.daily')}</SelectItem>
                      <SelectItem value="weekly">{t('adminPayoutSettings.frequency.weekly')}</SelectItem>
                      <SelectItem value="biweekly">{t('adminPayoutSettings.frequency.biweekly')}</SelectItem>
                      <SelectItem value="monthly">{t('adminPayoutSettings.frequency.monthly')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {settings.payout_frequency !== 'daily' && (
                  <div className="space-y-2">
                    <Label>{settings.payout_frequency === 'weekly' ? t('adminPayoutSettings.frequency.dayOfWeek') : t('adminPayoutSettings.frequency.dayOfMonth')}</Label>
                    {settings.payout_frequency === 'weekly' ? (
                      <Select value={String(settings.payout_day)} onValueChange={(v) => setSettings(s => ({ ...s, payout_day: parseInt(v) }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {dayNames.slice(1).map((name, i) => <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input type="number" min={1} max={28} value={settings.payout_day} onChange={(e) => setSettings(s => ({ ...s, payout_day: parseInt(e.target.value) || 1 }))} />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Commissions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Percent className="w-5 h-5" />{t('adminPayoutSettings.commissions.title')}</CardTitle>
                <CardDescription>{t('adminPayoutSettings.commissions.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('adminPayoutSettings.commissions.generalLabel')}</Label>
                  <Input type="number" min={0} max={100} value={settings.commission_percentage} onChange={(e) => setSettings(s => ({ ...s, commission_percentage: parseFloat(e.target.value) || 0 }))} />
                  <p className="text-xs text-muted-foreground">{t('adminPayoutSettings.commissions.generalHint')}</p>
                </div>

                <Separator />

                <div>
                  <Label className="text-sm font-semibold mb-3 block">{t('adminPayoutSettings.commissions.byTypeLabel')}</Label>
                  <p className="text-xs text-muted-foreground mb-4">{t('adminPayoutSettings.commissions.byTypeHint').replace('{{percent}}', String(settings.commission_percentage))}</p>
                  <div className="space-y-3">
                    {[
                      { key: 'commission_consultation' as const, label: t('adminPayoutSettings.commissions.items.consultation'), icon: '💬' },
                      { key: 'commission_recording' as const, label: t('adminPayoutSettings.commissions.items.recording'), icon: '🎥' },
                      { key: 'commission_live' as const, label: t('adminPayoutSettings.commissions.items.live'), icon: '📡' },
                      { key: 'commission_chat' as const, label: t('adminPayoutSettings.commissions.items.chat'), icon: '💬' },
                      { key: 'commission_content' as const, label: t('adminPayoutSettings.commissions.items.content'), icon: '📄' },
                    ].map(item => (
                      <div key={item.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                        <span className="text-lg w-6">{item.icon}</span>
                        <Label className="text-xs flex-1">{item.label}</Label>
                        <div className="w-20">
                          <Input type="number" min={0} max={100} placeholder={`${settings.commission_percentage}%`}
                            value={settings[item.key] ?? ''} onChange={(e) => setSettings(s => ({ ...s, [item.key]: e.target.value === '' ? null : parseFloat(e.target.value) }))}
                            className="text-sm h-8" />
                        </div>
                        <span className="text-xs text-muted-foreground w-4">%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>{t('adminPayoutSettings.commissions.minLabel')}</Label>
                  <Input type="number" min={0} value={settings.minimum_payout_amount} onChange={(e) => setSettings(s => ({ ...s, minimum_payout_amount: parseFloat(e.target.value) || 0 }))} />
                  <p className="text-xs text-muted-foreground">{t('adminPayoutSettings.commissions.minHint')}</p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Comisión de Stripe (estimada en contabilidad)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Porcentaje (%)</Label>
                      <Input type="number" min={0} max={100} step="0.1" value={settings.stripe_fee_pct} onChange={(e) => setSettings(s => ({ ...s, stripe_fee_pct: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Fijo por transacción (MXN)</Label>
                      <Input type="number" min={0} step="0.5" value={settings.stripe_fee_fixed} onChange={(e) => setSettings(s => ({ ...s, stripe_fee_fixed: parseFloat(e.target.value) || 0 }))} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Se usa para estimar el costo de Stripe en los asientos contables del marketplace (por defecto 3.6% + $3).</p>
                </div>
              </CardContent>
            </Card>

            {/* Automation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5" />{t('adminPayoutSettings.automation.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-primary" />
                      {t('adminPayoutSettings.automation.autoStripeLabel')}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {t('adminPayoutSettings.automation.autoStripeHint')}
                    </p>
                  </div>
                  <Switch checked={settings.auto_payout_enabled} onCheckedChange={(v) => setSettings(s => ({ ...s, auto_payout_enabled: v }))} />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      {t('adminPayoutSettings.automation.requireInvoiceLabel')}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-0.5">{t('adminPayoutSettings.automation.requireInvoiceHint')}</p>
                  </div>
                  <Switch checked={settings.require_invoice} onCheckedChange={(v) => setSettings(s => ({ ...s, require_invoice: v }))} />
                </div>

                {!settings.auto_payout_enabled && (
                  <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                    {t('adminPayoutSettings.automation.disabledWarning')}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('adminPayoutSettings.actions.saving')}</> : <><Save className="w-4 h-4 mr-2" />{t('adminPayoutSettings.actions.save')}</>}
              </Button>
              <Button onClick={handleProcessPayouts} disabled={isProcessing} variant="outline" className="flex-1">
                {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('adminPayoutSettings.actions.processing')}</> : <><Play className="w-4 h-4 mr-2" />{t('adminPayoutSettings.actions.processNow')}</>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
