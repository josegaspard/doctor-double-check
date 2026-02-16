import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowLeft,
  DollarSign,
  Loader2,
  CreditCard,
  Building,
  CheckCircle,
  Clock,
  XCircle,
  Send,
  Users,
  Percent,
  Calendar,
  Search,
  AlertTriangle,
  Banknote,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

interface DoctorPayoutInfo {
  user_id: string;
  name: string;
  avatar_url: string | null;
  specialty: string;
  pending_earnings: number;
  total_earnings: number;
  payouts_enabled: boolean;
  stripe_account_id: string | null;
  has_approved_invoice: boolean;
}

interface PayoutRecord {
  id: string;
  doctor_id: string;
  doctor_name?: string;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  stripe_transfer_id: string | null;
  error_message: string | null;
}

interface PayoutSettings {
  commission_percentage: number;
  minimum_payout_amount: number;
  require_invoice: boolean;
}

export default function AdminPayouts() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language } = useLanguage();
  const locale = language === 'es' ? es : enUS;
  
  const [isLoading, setIsLoading] = useState(true);
  const [doctors, setDoctors] = useState<DoctorPayoutInfo[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<PayoutRecord[]>([]);
  const [settings, setSettings] = useState<PayoutSettings>({ commission_percentage: 20, minimum_payout_amount: 100, require_invoice: true });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoctors, setSelectedDoctors] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('pending');
  
  // Payout dialog
  const [payoutDialog, setPayoutDialog] = useState<{ open: boolean; doctor: DoctorPayoutInfo | null; bulk: boolean }>({ open: false, doctor: null, bulk: false });
  const [payoutMethod, setPayoutMethod] = useState<'stripe' | 'manual'>('stripe');
  const [manualReference, setManualReference] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (role !== 'admin') { navigate('/'); return; }
    loadData();
  }, [role]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Fetch payout settings
      const { data: settingsData } = await supabase.from('payout_settings').select('*').eq('id', 'default').single();
      if (settingsData) {
        setSettings({
          commission_percentage: settingsData.commission_percentage || 20,
          minimum_payout_amount: settingsData.minimum_payout_amount || 100,
          require_invoice: settingsData.require_invoice ?? true,
        });
      }

      // Fetch all doctors with earnings info
      const { data: doctorProfiles } = await supabase
        .from('doctor_profiles')
        .select('user_id, specialty, pending_earnings, total_earnings, payouts_enabled, stripe_account_id')
        .eq('status', 'approved');

      if (doctorProfiles) {
        const doctorIds = doctorProfiles.map(d => d.user_id);
        
        // Fetch names
        const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url').in('id', doctorIds);
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        // Fetch approved invoices
        const { data: invoices } = await supabase
          .from('doctor_invoices')
          .select('doctor_id')
          .eq('status', 'approved')
          .in('doctor_id', doctorIds);
        const invoiceSet = new Set(invoices?.map(i => i.doctor_id) || []);

        const doctorList: DoctorPayoutInfo[] = doctorProfiles.map(dp => ({
          user_id: dp.user_id,
          name: profileMap.get(dp.user_id)?.name || 'Doctor',
          avatar_url: profileMap.get(dp.user_id)?.avatar_url || null,
          specialty: dp.specialty,
          pending_earnings: dp.pending_earnings || 0,
          total_earnings: dp.total_earnings || 0,
          payouts_enabled: dp.payouts_enabled || false,
          stripe_account_id: dp.stripe_account_id || null,
          has_approved_invoice: invoiceSet.has(dp.user_id),
        }));

        // Sort by pending earnings desc
        doctorList.sort((a, b) => b.pending_earnings - a.pending_earnings);
        setDoctors(doctorList);
      }

      // Fetch payout history
      const { data: payoutsData } = await supabase
        .from('doctor_payouts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (payoutsData) {
        const doctorIds = [...new Set(payoutsData.map(p => p.doctor_id))];
        const { data: names } = await supabase.from('profiles').select('id, name').in('id', doctorIds);
        const nameMap = new Map(names?.map(n => [n.id, n.name]) || []);

        setPayoutHistory(payoutsData.map(p => ({
          ...p,
          doctor_name: nameMap.get(p.doctor_id) || 'Doctor',
        })));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getNetAmount = (gross: number) => {
    const commission = gross * (settings.commission_percentage / 100);
    return gross - commission;
  };

  const toggleDoctor = (userId: string) => {
    setSelectedDoctors(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const selectAll = () => {
    const eligible = filteredDoctors.filter(d => d.pending_earnings > 0);
    if (selectedDoctors.size === eligible.length) {
      setSelectedDoctors(new Set());
    } else {
      setSelectedDoctors(new Set(eligible.map(d => d.user_id)));
    }
  };

  const openPayoutDialog = (doctor: DoctorPayoutInfo | null, bulk: boolean) => {
    setPayoutDialog({ open: true, doctor, bulk });
    setPayoutMethod(doctor?.stripe_account_id ? 'stripe' : 'manual');
    setManualReference('');
    setManualNotes('');
  };

  const handleProcessPayout = async () => {
    setIsProcessing(true);
    try {
      const doctorsToProcess = payoutDialog.bulk
        ? doctors.filter(d => selectedDoctors.has(d.user_id) && d.pending_earnings > 0)
        : payoutDialog.doctor ? [payoutDialog.doctor] : [];

      if (doctorsToProcess.length === 0) {
        toast.error(language === 'es' ? 'No hay doctores seleccionados' : 'No doctors selected');
        setIsProcessing(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const doctor of doctorsToProcess) {
        try {
          const netAmount = getNetAmount(doctor.pending_earnings);
          const method = doctor.stripe_account_id && payoutMethod === 'stripe' ? 'stripe' : 'manual';

          if (method === 'stripe') {
            // Use edge function for Stripe transfer
            const { data, error } = await supabase.functions.invoke('process-doctor-payouts', {
              body: { doctor_id: doctor.user_id, single: true },
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || 'Error processing');
          } else {
            // Manual payment - just record it in the database
            const { error: insertError } = await supabase.from('doctor_payouts').insert({
              doctor_id: doctor.user_id,
              amount: netAmount,
              status: 'paid',
              paid_at: new Date().toISOString(),
              period_end: new Date().toISOString().split('T')[0],
              stripe_transfer_id: manualReference ? `manual_${manualReference}` : `manual_${Date.now()}`,
            });
            if (insertError) throw insertError;

            // Update doctor pending earnings
            const { data: currentProfile } = await supabase
              .from('doctor_profiles')
              .select('total_earnings, pending_earnings')
              .eq('user_id', doctor.user_id)
              .single();

            await supabase.from('doctor_profiles').update({
              pending_earnings: 0,
              total_earnings: (currentProfile?.total_earnings || 0) + doctor.pending_earnings,
            }).eq('user_id', doctor.user_id);

            // Notify doctor
            await supabase.from('notifications').insert({
              user_id: doctor.user_id,
              type: 'system',
              title: '💰 Pago procesado',
              message: `Se ha registrado un pago de $${netAmount.toFixed(2)} MXN${manualNotes ? ` - ${manualNotes}` : ''}`,
              data: { amount: netAmount, method: 'manual', reference: manualReference },
            });
          }
          successCount++;
        } catch (err: any) {
          console.error(`Error paying doctor ${doctor.user_id}:`, err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(language === 'es' 
          ? `${successCount} pago(s) procesado(s)` 
          : `${successCount} payout(s) processed`);
      }
      if (errorCount > 0) {
        toast.error(language === 'es' 
          ? `${errorCount} pago(s) fallaron` 
          : `${errorCount} payout(s) failed`);
      }

      setPayoutDialog({ open: false, doctor: null, bulk: false });
      setSelectedDoctors(new Set());
      await loadData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredDoctors = doctors.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.specialty.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPending = doctors.reduce((sum, d) => sum + d.pending_earnings, 0);
  const totalNetPending = getNetAmount(totalPending);
  const doctorsWithBalance = doctors.filter(d => d.pending_earnings > 0).length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge variant="verified" className="gap-1"><CheckCircle className="w-3 h-3" />Pagado</Badge>;
      case 'processing': return <Badge variant="warning" className="gap-1"><Clock className="w-3 h-3" />Procesando</Badge>;
      case 'failed': return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Fallido</Badge>;
      default: return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />Pendiente</Badge>;
    }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="mb-4 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {language === 'es' ? 'Volver al panel' : 'Back to panel'}
        </Button>

        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Banknote className="w-6 h-6" />
            {language === 'es' ? 'Gestión de Pagos a Doctores' : 'Doctor Payouts Management'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === 'es' ? 'Paga a doctores por Stripe o registro manual bancario' : 'Pay doctors via Stripe or manual bank transfer'}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-warning/10"><Clock className="w-5 h-5 text-warning" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">{language === 'es' ? 'Total Bruto Pendiente' : 'Gross Pending'}</p>
                      <p className="text-xl font-bold">{formatCurrency(totalPending)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/10"><DollarSign className="w-5 h-5 text-success" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">{language === 'es' ? 'Total Neto a Pagar' : 'Net to Pay'}</p>
                      <p className="text-xl font-bold text-success">{formatCurrency(totalNetPending)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10"><Percent className="w-5 h-5 text-primary" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">{language === 'es' ? 'Comisión Plataforma' : 'Platform Commission'}</p>
                      <p className="text-xl font-bold">{settings.commission_percentage}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-info/10"><Users className="w-5 h-5 text-info" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">{language === 'es' ? 'Doctores con Saldo' : 'Doctors with Balance'}</p>
                      <p className="text-xl font-bold">{doctorsWithBalance}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="pending" className="gap-2">
                  <DollarSign className="w-4 h-4" />
                  {language === 'es' ? 'Pagos Pendientes' : 'Pending Payouts'}
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-2">
                  <History className="w-4 h-4" />
                  {language === 'es' ? 'Historial' : 'History'}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending">
                {/* Actions bar */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={language === 'es' ? 'Buscar doctor...' : 'Search doctor...'}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button variant="outline" onClick={selectAll} size="sm">
                    {selectedDoctors.size > 0 ? (language === 'es' ? 'Deseleccionar todo' : 'Deselect all') : (language === 'es' ? 'Seleccionar todos' : 'Select all')}
                  </Button>
                  {selectedDoctors.size > 0 && (
                    <Button onClick={() => openPayoutDialog(null, true)} className="gap-2">
                      <Send className="w-4 h-4" />
                      {language === 'es' ? `Pagar ${selectedDoctors.size} seleccionados` : `Pay ${selectedDoctors.size} selected`}
                    </Button>
                  )}
                </div>

                {/* Doctor list */}
                <div className="space-y-3">
                  {filteredDoctors.length === 0 ? (
                    <Card><CardContent className="text-center py-12 text-muted-foreground">
                      {language === 'es' ? 'No hay doctores con ganancias pendientes' : 'No doctors with pending earnings'}
                    </CardContent></Card>
                  ) : filteredDoctors.map(doctor => (
                    <Card key={doctor.user_id} className={`transition-colors ${selectedDoctors.has(doctor.user_id) ? 'border-primary bg-primary/5' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {doctor.pending_earnings > 0 && (
                            <Checkbox
                              checked={selectedDoctors.has(doctor.user_id)}
                              onCheckedChange={() => toggleDoctor(doctor.user_id)}
                            />
                          )}
                          
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                            {doctor.avatar_url ? (
                              <img src={doctor.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Users className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold truncate">{doctor.name}</p>
                              <Badge variant="outline" className="text-xs">{doctor.specialty}</Badge>
                              {doctor.stripe_account_id ? (
                                <Badge variant="verified" className="text-xs gap-1"><CreditCard className="w-3 h-3" />Stripe</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs gap-1"><Building className="w-3 h-3" />Manual</Badge>
                              )}
                              {!doctor.has_approved_invoice && settings.require_invoice && (
                                <Badge variant="warning" className="text-xs gap-1"><AlertTriangle className="w-3 h-3" />Sin factura</Badge>
                              )}
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0 space-y-1">
                            <div>
                              <p className="text-xs text-muted-foreground">{language === 'es' ? 'Bruto' : 'Gross'}</p>
                              <p className="font-semibold">{formatCurrency(doctor.pending_earnings)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">{language === 'es' ? 'Neto' : 'Net'}</p>
                              <p className="font-bold text-success">{formatCurrency(getNetAmount(doctor.pending_earnings))}</p>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            disabled={doctor.pending_earnings <= 0}
                            onClick={() => openPayoutDialog(doctor, false)}
                            className="flex-shrink-0"
                          >
                            <Send className="w-4 h-4 mr-1" />
                            {language === 'es' ? 'Pagar' : 'Pay'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="history">
                {payoutHistory.length === 0 ? (
                  <Card><CardContent className="text-center py-12 text-muted-foreground">
                    {language === 'es' ? 'No hay pagos registrados' : 'No payouts recorded'}
                  </CardContent></Card>
                ) : (
                  <div className="space-y-3">
                    {payoutHistory.map(payout => (
                      <Card key={payout.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold">{payout.doctor_name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(payout.created_at), 'dd MMM yyyy, HH:mm', { locale })}
                                {payout.stripe_transfer_id?.startsWith('manual_') ? (
                                  <Badge variant="secondary" className="text-xs"><Building className="w-3 h-3 mr-1" />Manual</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs"><CreditCard className="w-3 h-3 mr-1" />Stripe</Badge>
                                )}
                              </div>
                              {payout.error_message && (
                                <p className="text-xs text-destructive mt-1">{payout.error_message}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{formatCurrency(payout.amount)}</p>
                              {getStatusBadge(payout.status || 'pending')}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Payout Confirmation Dialog */}
        <Dialog open={payoutDialog.open} onOpenChange={(open) => !isProcessing && setPayoutDialog({ ...payoutDialog, open })}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-success" />
                {language === 'es' ? 'Confirmar Pago' : 'Confirm Payout'}
              </DialogTitle>
              <DialogDescription>
                {payoutDialog.bulk
                  ? (language === 'es' ? `Procesarás pagos para ${selectedDoctors.size} doctores` : `You'll process payouts for ${selectedDoctors.size} doctors`)
                  : (language === 'es' ? `Pago para ${payoutDialog.doctor?.name}` : `Payout for ${payoutDialog.doctor?.name}`)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Summary */}
              {!payoutDialog.bulk && payoutDialog.doctor && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{language === 'es' ? 'Bruto:' : 'Gross:'}</span>
                    <span>{formatCurrency(payoutDialog.doctor.pending_earnings)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{language === 'es' ? 'Comisión' : 'Commission'} ({settings.commission_percentage}%):</span>
                    <span className="text-destructive">-{formatCurrency(payoutDialog.doctor.pending_earnings * settings.commission_percentage / 100)}</span>
                  </div>
                  <hr className="border-border" />
                  <div className="flex justify-between font-bold">
                    <span>{language === 'es' ? 'Neto a pagar:' : 'Net to pay:'}</span>
                    <span className="text-success">{formatCurrency(getNetAmount(payoutDialog.doctor.pending_earnings))}</span>
                  </div>
                </div>
              )}

              {payoutDialog.bulk && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{language === 'es' ? 'Doctores:' : 'Doctors:'}</span>
                    <span>{selectedDoctors.size}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{language === 'es' ? 'Total bruto:' : 'Total gross:'}</span>
                    <span>{formatCurrency(doctors.filter(d => selectedDoctors.has(d.user_id)).reduce((s, d) => s + d.pending_earnings, 0))}</span>
                  </div>
                  <hr className="border-border" />
                  <div className="flex justify-between font-bold">
                    <span>{language === 'es' ? 'Total neto:' : 'Total net:'}</span>
                    <span className="text-success">{formatCurrency(getNetAmount(doctors.filter(d => selectedDoctors.has(d.user_id)).reduce((s, d) => s + d.pending_earnings, 0)))}</span>
                  </div>
                </div>
              )}

              {/* Payment method */}
              <div className="space-y-2">
                <Label>{language === 'es' ? 'Método de pago' : 'Payment method'}</Label>
                <Select value={payoutMethod} onValueChange={(v: 'stripe' | 'manual') => setPayoutMethod(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stripe">
                      <span className="flex items-center gap-2"><CreditCard className="w-4 h-4" />Stripe Connect</span>
                    </SelectItem>
                    <SelectItem value="manual">
                      <span className="flex items-center gap-2"><Building className="w-4 h-4" />{language === 'es' ? 'Transferencia bancaria manual' : 'Manual bank transfer'}</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {payoutMethod === 'manual' && (
                <>
                  <div className="space-y-2">
                    <Label>{language === 'es' ? 'Referencia de transferencia' : 'Transfer reference'}</Label>
                    <Input
                      placeholder={language === 'es' ? 'Ej: TRF-2026-0001' : 'E.g. TRF-2026-0001'}
                      value={manualReference}
                      onChange={(e) => setManualReference(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'es' ? 'Notas (opcional)' : 'Notes (optional)'}</Label>
                    <Textarea
                      placeholder={language === 'es' ? 'Notas sobre el pago...' : 'Payment notes...'}
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                </>
              )}

              {payoutMethod === 'stripe' && !payoutDialog.bulk && payoutDialog.doctor && !payoutDialog.doctor.stripe_account_id && (
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm text-warning-foreground flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {language === 'es' 
                    ? 'Este doctor no tiene cuenta Stripe configurada. Usa transferencia manual.' 
                    : 'This doctor has no Stripe account. Use manual transfer.'}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPayoutDialog({ open: false, doctor: null, bulk: false })} disabled={isProcessing}>
                {language === 'es' ? 'Cancelar' : 'Cancel'}
              </Button>
              <Button onClick={handleProcessPayout} disabled={isProcessing || (payoutMethod === 'stripe' && !payoutDialog.bulk && !payoutDialog.doctor?.stripe_account_id)}>
                {isProcessing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{language === 'es' ? 'Procesando...' : 'Processing...'}</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" />{language === 'es' ? 'Confirmar Pago' : 'Confirm Payout'}</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
