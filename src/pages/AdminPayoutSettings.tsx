import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Settings, 
  Loader2, 
  Save,
  DollarSign,
  Calendar,
  Percent,
  FileText,
  Play,
} from 'lucide-react';
import { toast } from 'sonner';

interface PayoutSettings {
  payout_frequency: string;
  payout_day: number;
  commission_percentage: number;
  minimum_payout_amount: number;
  auto_payout_enabled: boolean;
  require_invoice: boolean;
}

export default function AdminPayoutSettings() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [settings, setSettings] = useState<PayoutSettings>({
    payout_frequency: 'weekly',
    payout_day: 1,
    commission_percentage: 20,
    minimum_payout_amount: 100,
    auto_payout_enabled: true,
    require_invoice: true,
  });

  useEffect(() => {
    if (role !== 'admin') {
      navigate('/');
      toast.error(language === 'es' ? 'Acceso denegado' : 'Access denied');
      return;
    }
    fetchSettings();
  }, [role, navigate, language]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('payout_settings')
        .select('*')
        .eq('id', 'default')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setSettings({
          payout_frequency: data.payout_frequency || 'weekly',
          payout_day: data.payout_day || 1,
          commission_percentage: data.commission_percentage || 20,
          minimum_payout_amount: data.minimum_payout_amount || 100,
          auto_payout_enabled: data.auto_payout_enabled ?? true,
          require_invoice: data.require_invoice ?? true,
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('payout_settings')
        .upsert({
          id: 'default',
          ...settings,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success(language === 'es' ? 'Configuración guardada' : 'Settings saved');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error(error.message || (language === 'es' ? 'Error al guardar' : 'Error saving'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleProcessPayouts = async () => {
    if (!confirm(language === 'es' 
      ? '¿Procesar todos los pagos pendientes ahora?' 
      : 'Process all pending payouts now?')) return;

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-doctor-payouts');
      
      if (error) throw error;

      if (data?.processed > 0) {
        toast.success(language === 'es' 
          ? `${data.processed} pagos procesados` 
          : `${data.processed} payouts processed`);
      } else {
        toast.info(language === 'es' 
          ? 'No hay pagos pendientes para procesar' 
          : 'No pending payouts to process');
      }
    } catch (error: any) {
      console.error('Error processing payouts:', error);
      toast.error(error.message || (language === 'es' ? 'Error al procesar' : 'Error processing'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="w-6 h-6" />
            {language === 'es' ? 'Configuración de Pagos' : 'Payout Settings'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === 'es' 
              ? 'Configura cómo y cuándo se procesan los pagos a doctores' 
              : 'Configure how and when doctor payments are processed'}
          </p>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {language === 'es' ? 'Frecuencia de Pagos' : 'Payout Frequency'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{language === 'es' ? 'Frecuencia' : 'Frequency'}</Label>
                  <Select
                    value={settings.payout_frequency}
                    onValueChange={(v) => setSettings(s => ({ ...s, payout_frequency: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{language === 'es' ? 'Diario' : 'Daily'}</SelectItem>
                      <SelectItem value="weekly">{language === 'es' ? 'Semanal' : 'Weekly'}</SelectItem>
                      <SelectItem value="biweekly">{language === 'es' ? 'Quincenal' : 'Biweekly'}</SelectItem>
                      <SelectItem value="monthly">{language === 'es' ? 'Mensual' : 'Monthly'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {settings.payout_frequency !== 'daily' && (
                  <div className="space-y-2">
                    <Label>
                      {settings.payout_frequency === 'weekly' 
                        ? (language === 'es' ? 'Día de la semana' : 'Day of week')
                        : (language === 'es' ? 'Día del mes' : 'Day of month')}
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={settings.payout_frequency === 'weekly' ? 7 : 28}
                      value={settings.payout_day}
                      onChange={(e) => setSettings(s => ({ ...s, payout_day: parseInt(e.target.value) || 1 }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      {settings.payout_frequency === 'weekly'
                        ? (language === 'es' ? '1 = Lunes, 7 = Domingo' : '1 = Monday, 7 = Sunday')
                        : (language === 'es' ? 'Día del mes (1-28)' : 'Day of month (1-28)')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="w-5 h-5" />
                  {language === 'es' ? 'Comisiones y Límites' : 'Commission & Limits'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{language === 'es' ? 'Comisión de plataforma (%)' : 'Platform commission (%)'}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.commission_percentage}
                    onChange={(e) => setSettings(s => ({ ...s, commission_percentage: parseFloat(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === 'es' 
                      ? 'Porcentaje que se descuenta de las ganancias del doctor'
                      : 'Percentage deducted from doctor earnings'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{language === 'es' ? 'Monto mínimo de pago (MXN)' : 'Minimum payout amount (MXN)'}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={settings.minimum_payout_amount}
                    onChange={(e) => setSettings(s => ({ ...s, minimum_payout_amount: parseFloat(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === 'es' 
                      ? 'Los pagos solo se procesan cuando el saldo supera este monto'
                      : 'Payouts only processed when balance exceeds this amount'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  {language === 'es' ? 'Automatización' : 'Automation'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{language === 'es' ? 'Pagos automáticos' : 'Automatic payouts'}</Label>
                    <p className="text-sm text-muted-foreground">
                      {language === 'es' 
                        ? 'Procesar pagos automáticamente según la frecuencia'
                        : 'Process payouts automatically based on frequency'}
                    </p>
                  </div>
                  <Switch
                    checked={settings.auto_payout_enabled}
                    onCheckedChange={(v) => setSettings(s => ({ ...s, auto_payout_enabled: v }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      {language === 'es' ? 'Requerir factura' : 'Require invoice'}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {language === 'es' 
                        ? 'Solo procesar pagos si el doctor tiene factura aprobada'
                        : 'Only process payouts if doctor has approved invoice'}
                    </p>
                  </div>
                  <Switch
                    checked={settings.require_invoice}
                    onCheckedChange={(v) => setSettings(s => ({ ...s, require_invoice: v }))}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={handleSave} 
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{language === 'es' ? 'Guardando...' : 'Saving...'}</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" />{language === 'es' ? 'Guardar Cambios' : 'Save Changes'}</>
                )}
              </Button>
              <Button 
                onClick={handleProcessPayouts} 
                disabled={isProcessing}
                variant="outline"
                className="flex-1"
              >
                {isProcessing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{language === 'es' ? 'Procesando...' : 'Processing...'}</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" />{language === 'es' ? 'Procesar Pagos Ahora' : 'Process Payouts Now'}</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
