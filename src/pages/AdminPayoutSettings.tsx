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
}

const dayNames = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function AdminPayoutSettings() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [settings, setSettings] = useState<PayoutSettings>({
    payout_frequency: 'weekly', payout_day: 1, commission_percentage: 20,
    commission_consultation: null, commission_recording: null, commission_live: null,
    commission_chat: null, commission_content: null,
    minimum_payout_amount: 100, auto_payout_enabled: true, require_invoice: true,
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
        });
      }
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('payout_settings').upsert({ id: 'default', ...settings, updated_at: new Date().toISOString() });
      if (error) throw error;
      toast.success('Configuración guardada');
    } catch (error: any) { toast.error(error.message); } finally { setIsSaving(false); }
  };

  const handleProcessPayouts = async () => {
    if (!confirm('¿Procesar todos los pagos pendientes vía Stripe ahora?\n\nSolo se procesarán doctores con cuenta Stripe configurada.')) return;
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-doctor-payouts');
      if (error) throw error;
      if (data?.processed > 0) toast.success(`${data.processed} pagos procesados`);
      else toast.info('No hay pagos Stripe pendientes');
    } catch (error: any) { toast.error(error.message); } finally { setIsProcessing(false); }
  };

  const getPayoutPreview = () => {
    if (settings.payout_frequency === 'daily') return 'Pagos se procesan todos los días';
    if (settings.payout_frequency === 'weekly') return `Próximo pago: ${dayNames[settings.payout_day] || 'Lunes'} de cada semana`;
    if (settings.payout_frequency === 'biweekly') return `Cada 2 semanas, día ${settings.payout_day}`;
    return `Día ${settings.payout_day} de cada mes`;
  };

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="hidden sm:inline-flex mb-4 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" />Volver al panel
        </Button>

        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2"><Settings className="w-6 h-6" />Configuración de Pagos</h1>
          <p className="text-muted-foreground mt-1">Configura cómo y cuándo se procesan los pagos a doctores</p>
        </div>

        {isLoading ? (
          <Card><CardContent className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></CardContent></Card>
        ) : (
          <div className="space-y-6">
            {/* Stripe Info Banner */}
            <Alert className="border-info/30 bg-info/5">
              <Info className="w-4 h-4 text-info" />
              <AlertDescription className="text-sm">
                <strong>Pagos automáticos</strong> solo aplican para doctores con cuenta <Badge variant="outline" className="text-xs gap-1 mx-1"><CreditCard className="w-3 h-3" />Stripe Connect</Badge> verificada.
                Los doctores sin Stripe deben pagarse manualmente desde <strong>"Gestión de Pagos"</strong> vía <Badge variant="outline" className="text-xs gap-1 mx-1"><Building className="w-3 h-3" />transferencia bancaria</Badge>.
              </AlertDescription>
            </Alert>

            {/* Frequency */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5" />Frecuencia de Pagos</CardTitle>
                <CardDescription>{getPayoutPreview()}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Frecuencia</Label>
                  <Select value={settings.payout_frequency} onValueChange={(v) => setSettings(s => ({ ...s, payout_frequency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diario</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="biweekly">Quincenal</SelectItem>
                      <SelectItem value="monthly">Mensual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {settings.payout_frequency !== 'daily' && (
                  <div className="space-y-2">
                    <Label>{settings.payout_frequency === 'weekly' ? 'Día de la semana' : 'Día del mes'}</Label>
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
                <CardTitle className="flex items-center gap-2"><Percent className="w-5 h-5" />Comisiones y Límites</CardTitle>
                <CardDescription>Configura la comisión que cobra la plataforma por cada tipo de servicio</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Comisión general (%)</Label>
                  <Input type="number" min={0} max={100} value={settings.commission_percentage} onChange={(e) => setSettings(s => ({ ...s, commission_percentage: parseFloat(e.target.value) || 0 }))} />
                  <p className="text-xs text-muted-foreground">Se aplica cuando no hay comisión específica por tipo</p>
                </div>

                <Separator />

                <div>
                  <Label className="text-sm font-semibold mb-3 block">Comisiones por tipo de servicio</Label>
                  <p className="text-xs text-muted-foreground mb-4">Deja vacío para usar la comisión general ({settings.commission_percentage}%)</p>
                  <div className="space-y-3">
                    {[
                      { key: 'commission_consultation' as const, label: 'Orientaciones médicas / Consultas', icon: '💬' },
                      { key: 'commission_recording' as const, label: 'Videos / Grabaciones premium', icon: '🎥' },
                      { key: 'commission_live' as const, label: 'Lives (si monetizados)', icon: '📡' },
                      { key: 'commission_chat' as const, label: 'Chat con doctores', icon: '💬' },
                      { key: 'commission_content' as const, label: 'Contenido descargable', icon: '📄' },
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
                  <Label>Monto mínimo de pago (MXN)</Label>
                  <Input type="number" min={0} value={settings.minimum_payout_amount} onChange={(e) => setSettings(s => ({ ...s, minimum_payout_amount: parseFloat(e.target.value) || 0 }))} />
                  <p className="text-xs text-muted-foreground">Los pagos solo se procesan cuando el saldo supera este monto</p>
                </div>
              </CardContent>
            </Card>

            {/* Automation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5" />Automatización</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-primary" />
                      Pagos automáticos vía Stripe
                    </Label>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Solo aplica para doctores con Stripe Connect verificado
                    </p>
                  </div>
                  <Switch checked={settings.auto_payout_enabled} onCheckedChange={(v) => setSettings(s => ({ ...s, auto_payout_enabled: v }))} />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Requerir factura aprobada
                    </Label>
                    <p className="text-sm text-muted-foreground mt-0.5">Solo procesar pagos si el doctor tiene factura aprobada</p>
                  </div>
                  <Switch checked={settings.require_invoice} onCheckedChange={(v) => setSettings(s => ({ ...s, require_invoice: v }))} />
                </div>

                {!settings.auto_payout_enabled && (
                  <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                    Con pagos automáticos desactivados, deberás procesar cada pago manualmente desde "Gestión de Pagos a Doctores".
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</> : <><Save className="w-4 h-4 mr-2" />Guardar Cambios</>}
              </Button>
              <Button onClick={handleProcessPayouts} disabled={isProcessing} variant="outline" className="flex-1">
                {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando...</> : <><Play className="w-4 h-4 mr-2" />Procesar Pagos Stripe Ahora</>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
