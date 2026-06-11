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
  Trash2,
  Upload,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Video,
  MessageSquare,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  bank_name: string | null;
  clabe_last4: string | null;
  clabe: string | null;
  account_holder_name: string | null;
  rfc: string | null;
  bank_branch: string | null;
  payment_method: string | null;
  has_processing_payout: boolean;
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
  const { language, t } = useLanguage() as any;
  const locale = language === 'es' ? es : enUS;

  const [isLoading, setIsLoading] = useState(true);
  const [doctors, setDoctors] = useState<DoctorPayoutInfo[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<PayoutRecord[]>([]);
  const [settings, setSettings] = useState<PayoutSettings>({ commission_percentage: 20, minimum_payout_amount: 100, require_invoice: true });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoctors, setSelectedDoctors] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('pending');

  // Expandable detail
  const [expandedDoctor, setExpandedDoctor] = useState<string | null>(null);
  const [doctorBreakdown, setDoctorBreakdown] = useState<Record<string, { source: string; amount: number; date: string; description: string }[]>>({});
  const [loadingBreakdown, setLoadingBreakdown] = useState<string | null>(null);

  // Payout dialog
  const [payoutDialog, setPayoutDialog] = useState<{ open: boolean; doctor: DoctorPayoutInfo | null; bulk: boolean }>({ open: false, doctor: null, bulk: false });
  const [payoutMethod, setPayoutMethod] = useState<'stripe' | 'manual'>('stripe');
  const [manualReference, setManualReference] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [stripeError, setStripeError] = useState(false);

  // All transactions tab
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txTypeFilter, setTxTypeFilter] = useState<string>('all');
  const [txSearch, setTxSearch] = useState('');
  const [txProfileMap, setTxProfileMap] = useState<Map<string, { name: string; avatar_url: string | null }>>(new Map());

  // Helper for simple key + params interpolation when t doesn't support params
  const tt = (key: string, params?: Record<string, string | number>): string => {
    let s = typeof t === 'function' ? t(key, params) : key;
    if (typeof s !== 'string') s = String(s);
    if (params) {
      Object.keys(params).forEach(k => {
        s = s.split(`{${k}}`).join(String(params[k]));
      });
    }
    return s;
  };

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

      // Fetch only doctors with actual pending earnings (> 0)
      const { data: doctorProfiles } = await supabase
        .from('doctor_profiles')
        .select('user_id, specialty, pending_earnings, total_earnings, payouts_enabled, stripe_account_id')
        .eq('status', 'approved')
        .gt('pending_earnings', 0);

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

        // FIX #6: Fetch bank details for admin visibility
        const { data: bankAccounts } = await supabase
          .from('doctor_bank_accounts')
          .select('*')
          .in('doctor_id', doctorIds);
        const bankMap = new Map(bankAccounts?.map(b => [b.doctor_id, b as any]) || []);

        // FIX #3: Fetch existing processing payouts
        const { data: processingPayouts } = await supabase
          .from('doctor_payouts')
          .select('doctor_id')
          .eq('status', 'processing')
          .in('doctor_id', doctorIds);
        const processingSet = new Set(processingPayouts?.map(p => p.doctor_id) || []);

        const doctorList: DoctorPayoutInfo[] = doctorProfiles.map(dp => {
          const bank = bankMap.get(dp.user_id);
          return {
            user_id: dp.user_id,
            name: profileMap.get(dp.user_id)?.name || tt('adminPayoutsPage.fallback.doctor'),
            avatar_url: profileMap.get(dp.user_id)?.avatar_url || null,
            specialty: dp.specialty,
            pending_earnings: dp.pending_earnings || 0,
            total_earnings: dp.total_earnings || 0,
            payouts_enabled: dp.payouts_enabled || false,
            stripe_account_id: dp.stripe_account_id || null,
            has_approved_invoice: invoiceSet.has(dp.user_id),
            bank_name: bank?.bank_name || null,
            clabe_last4: bank?.clabe_last4 || null,
            clabe: bank?.clabe || null,
            account_holder_name: bank?.account_holder_name || null,
            rfc: bank?.rfc || null,
            bank_branch: bank?.bank_branch || null,
            payment_method: bank?.payment_method || null,
            has_processing_payout: processingSet.has(dp.user_id),
          };
        });

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
          doctor_name: nameMap.get(p.doctor_id) || tt('adminPayoutsPage.fallback.doctor'),
        })));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load all wallet transactions for admin
  const loadAllTransactions = async () => {
    setTxLoading(true);
    try {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) { console.error('Error loading transactions:', error); return; }
      if (!data) return;

      setAllTransactions(data);

      // Fetch profile names
      const userIds = [...new Set(data.map((t: any) => t.user_id))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url').in('id', userIds);
        setTxProfileMap(new Map(profiles?.map(p => [p.id, { name: p.name, avatar_url: p.avatar_url }]) || []));
      }
    } catch (err) {
      console.error('Unexpected error loading transactions:', err);
    } finally {
      setTxLoading(false);
    }
  };

  // Load transactions when tab switches
  useEffect(() => {
    if (activeTab === 'transactions' && allTransactions.length === 0) {
      loadAllTransactions();
    }
  }, [activeTab]);

  const filteredTransactions = allTransactions.filter(tx => {
    const matchesType = txTypeFilter === 'all' || tx.type === txTypeFilter;
    const userName = txProfileMap.get(tx.user_id)?.name || '';
    const matchesSearch = !txSearch || userName.toLowerCase().includes(txSearch.toLowerCase()) || tx.description?.toLowerCase().includes(txSearch.toLowerCase());
    return matchesType && matchesSearch;
  });

  const txTotals = filteredTransactions.reduce((acc, tx) => {
    acc[tx.type] = (acc[tx.type] || 0) + Number(tx.amount);
    return acc;
  }, {} as Record<string, number>);

  const exportTransactionsCSV = () => {
    const rows = filteredTransactions.map(tx => ({
      [tt('adminPayoutsPage.csv.colDate')]: format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm'),
      [tt('adminPayoutsPage.csv.colUser')]: txProfileMap.get(tx.user_id)?.name || tx.user_id,
      [tt('adminPayoutsPage.csv.colType')]: tx.type,
      [tt('adminPayoutsPage.csv.colAmount')]: tx.amount,
      [tt('adminPayoutsPage.csv.colDescription')]: tx.description,
      [tt('adminPayoutsPage.csv.colStatus')]: tx.status,
    }));
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csvRows = [
      headers.join(','),
      ...rows.map(row => headers.map(h => {
        const val = String((row as any)[h] ?? '');
        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(','))
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = tt('adminPayoutsPage.csv.fileName', { date: format(new Date(), 'yyyyMMdd') });
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTxTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      topup: tt('adminPayoutsPage.txType.topup'),
      purchase: tt('adminPayoutsPage.txType.purchase'),
      refund: tt('adminPayoutsPage.txType.refund'),
      subscription: tt('adminPayoutsPage.txType.subscription'),
      earning: tt('adminPayoutsPage.txType.earning'),
    };
    return labels[type] || type;
  };

  const getTxTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'topup': return 'info' as const;
      case 'purchase': return 'default' as const;
      case 'refund': return 'destructive' as const;
      case 'subscription': return 'verified' as const;
      case 'earning': return 'success' as const;
      default: return 'outline' as const;
    }
  };

  // pending_earnings YA es neto: la comisión por-tipo se aplica al concretarse
  // cada venta (ver credit_doctor_earnings + libro contable). El monto a pagar
  // es el saldo neto tal cual.
  const getNetAmount = (net: number) => net;

  const toggleDoctor = (userId: string) => {
    setSelectedDoctors(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedDoctors.size === filteredDoctors.length) {
      setSelectedDoctors(new Set());
    } else {
      setSelectedDoctors(new Set(filteredDoctors.map(d => d.user_id)));
    }
  };

  const openPayoutDialog = (doctor: DoctorPayoutInfo | null, bulk: boolean) => {
    setPayoutDialog({ open: true, doctor, bulk });
    setPayoutMethod(doctor?.stripe_account_id ? 'stripe' : 'manual');
    setManualReference('');
    setManualNotes('');
    setReceiptFile(null);
    setStripeError(false);
  };

  const handleProcessPayout = async () => {
    setIsProcessing(true);
    setStripeError(false);
    try {
      const doctorsToProcess = payoutDialog.bulk
        ? doctors.filter(d => selectedDoctors.has(d.user_id) && d.pending_earnings > 0)
        : payoutDialog.doctor ? [payoutDialog.doctor] : [];

      if (doctorsToProcess.length === 0) {
        toast.error(tt('adminPayoutsPage.toast.noSelection'));
        setIsProcessing(false);
        return;
      }

      // Check Stripe accounts for stripe method
      if (payoutMethod === 'stripe') {
        const noStripe = doctorsToProcess.filter(d => !d.stripe_account_id);
        if (noStripe.length > 0) {
          const names = noStripe.map(d => d.name).join(', ');
          toast.error(tt('adminPayoutsPage.toast.noStripeAccount', { names }));
          setStripeError(true);
          setIsProcessing(false);
          return;
        }
      }

      // El comprobante es OBLIGATORIO para pagos manuales (transferencia bancaria):
      // el doctor siempre debe recibir su comprobante por correo.
      if (payoutMethod === 'manual' && !receiptFile) {
        toast.error(t('autoI18n.adminPayouts1'));
        setIsProcessing(false);
        return;
      }

      // Upload receipt file via edge function (service role bypasses storage RLS)
      let receiptPath: string | null = null;
      if (payoutMethod === 'manual' && receiptFile) {
        try {
          const formData = new FormData();
          formData.append('file', receiptFile);

          const { data: session } = await supabase.auth.getSession();
          const token = session?.session?.access_token;

          const uploadRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-payout-receipt`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
              },
              body: formData,
            }
          );

          const uploadData = await uploadRes.json();
          if (!uploadRes.ok || uploadData.error) {
            throw new Error(uploadData.error || 'Upload failed');
          }
          receiptPath = uploadData.path;
        } catch (uploadErr: any) {
          console.error('Upload error:', uploadErr);
          toast.error(tt('adminPayoutsPage.toast.uploadError'));
          // Si el comprobante no se pudo subir, abortamos: nunca se registra
          // un pago manual sin su comprobante.
          setIsProcessing(false);
          return;
        }
      }

      let successCount = 0;
      let errorCount = 0;

      for (const doctor of doctorsToProcess) {
        try {
          if (doctor.has_processing_payout) {
            toast.warning(tt('adminPayoutsPage.toast.alreadyProcessing', { name: doctor.name }));
            errorCount++;
            continue;
          }

          const netAmount = getNetAmount(doctor.pending_earnings);
          const method = doctor.stripe_account_id && payoutMethod === 'stripe' ? 'stripe' : 'manual';

          if (method === 'stripe') {
            const { data, error } = await supabase.functions.invoke('process-doctor-payouts', {
              body: { doctor_id: doctor.user_id, single: true },
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || 'Error processing');
          } else {
            // SECURITY (2026-05-11): admin-only edge function does the
            // insert+RPC+notification atomically with admin JWT gate.
            const { data: payoutData, error: payoutErr } = await supabase.functions.invoke(
              'admin-record-manual-payout',
              {
                body: {
                  doctor_id: doctor.user_id,
                  net_amount: netAmount,
                  gross_amount: doctor.pending_earnings,
                  reference: manualReference || undefined,
                  notes: manualNotes || undefined,
                },
              }
            );
            if (payoutErr) throw payoutErr;
            if (!payoutData?.success) throw new Error(payoutData?.error || 'Error processing manual payout');
          }

          // Email al doctor SOLO para pagos manuales: el path Stripe
          // (process-doctor-payouts) ya envía su propio correo — así se
          // evita el doble email a los pagos por Stripe.
          if (method === 'manual') {
            try {
              const { data: doctorProfile } = await supabase
                .from('profiles')
                .select('email, name')
                .eq('id', doctor.user_id)
                .single();

              if (doctorProfile?.email) {
                await supabase.functions.invoke('send-payout-email', {
                  body: {
                    doctor_email: doctorProfile.email,
                    doctor_name: doctorProfile.name,
                    amount: getNetAmount(doctor.pending_earnings),
                    method,
                    reference: manualReference || undefined,
                    notes: manualNotes || undefined,
                    receipt_url: receiptPath || undefined,
                  },
                });
              }
            } catch (emailErr) {
              console.error('Email notification failed:', emailErr);
            }
          }

          successCount++;
        } catch (err: any) {
          console.error(`Error paying doctor ${doctor.user_id}:`, err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(tt('adminPayoutsPage.toast.payoutsProcessed', { count: successCount }));
      }
      if (errorCount > 0) {
        toast.error(tt('adminPayoutsPage.toast.payoutsFailed', { count: errorCount }));
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

  const handleDeleteSelected = async () => {
    const selectedList = doctors.filter(d => selectedDoctors.has(d.user_id));
    const names = selectedList.map(d => `${d.name} ($${d.pending_earnings.toFixed(2)})`).join('\n');
    if (!confirm(tt('adminPayoutsPage.confirm.deleteRecords', { count: selectedDoctors.size, names }))) return;

    // Immediately remove from UI BEFORE async operations
    const deletedIds = new Set(selectedList.map(d => d.user_id));
    setDoctors(prev => prev.filter(d => !deletedIds.has(d.user_id)));
    setSelectedDoctors(new Set());

    setIsProcessing(true);
    try {
      let successCount = 0;
      for (const doctor of selectedList) {
        // Reset pending earnings to 0
        const { error } = await supabase
          .from('doctor_profiles')
          .update({ pending_earnings: 0 })
          .eq('user_id', doctor.user_id);

        // Also delete any "pending" payout records for this doctor
        await supabase
          .from('doctor_payouts')
          .delete()
          .eq('doctor_id', doctor.user_id)
          .eq('status', 'pending');

        if (!error) successCount++;
      }

      toast.success(tt('adminPayoutsPage.toast.recordsCleared', { count: successCount }));

      // Do NOT call loadData() here — it would re-fetch all approved doctors
      // and bring back the ones we just "deleted" (they still exist with pending_earnings=0)
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleDoctorDetail = async (doctorId: string) => {
    if (expandedDoctor === doctorId) {
      setExpandedDoctor(null);
      return;
    }
    setExpandedDoctor(doctorId);
    if (!doctorBreakdown[doctorId]) {
      setLoadingBreakdown(doctorId);
      try {
        const items: { source: string; amount: number; date: string; description: string }[] = [];

        // 1. Purchases on doctor's recordings
        const { data: recordings } = await supabase
          .from('recordings')
          .select('id, title')
          .eq('doctor_id', doctorId);

        if (recordings && recordings.length > 0) {
          const recIds = recordings.map(r => r.id);
          const recMap = new Map(recordings.map(r => [r.id, r.title]));
          const { data: purchases } = await supabase
            .from('purchases')
            .select('amount, created_at, recording_id')
            .in('recording_id', recIds)
            .order('created_at', { ascending: false });

          purchases?.forEach(p => {
            items.push({
              source: 'recording',
              amount: Number(p.amount),
              date: p.created_at,
              description: recMap.get(p.recording_id) || tt('adminPayoutsPage.breakdown.recordingFallback'),
            });
          });
        }

        // 2. Subscriptions to this doctor
        const { data: subs } = await supabase
          .from('subscriptions')
          .select('price_paid, created_at, tier')
          .eq('creator_id', doctorId)
          .order('created_at', { ascending: false });

        subs?.forEach(s => {
          items.push({
            source: 'subscription',
            amount: Number(s.price_paid),
            date: s.created_at,
            description: tt('adminPayoutsPage.breakdown.subscriptionDesc', { tier: s.tier }),
          });
        });

        // 3. Consultations (completed)
        const { data: consults } = await supabase
          .from('consultations')
          .select('id, started_at, status')
          .eq('doctor_id', doctorId)
          .eq('status', 'completed')
          .order('started_at', { ascending: false })
          .limit(50);

        const { data: dpData } = await supabase
          .from('doctor_profiles')
          .select('consultation_fee')
          .eq('user_id', doctorId)
          .single();
        const fee = dpData?.consultation_fee || 0;

        consults?.forEach(c => {
          if (fee > 0) {
            items.push({
              source: 'consultation',
              amount: Number(fee),
              date: c.started_at,
              description: tt('adminPayoutsPage.breakdown.consultationDesc'),
            });
          }
        });

        // 4. Wallet transactions as additional source
        const { data: walletTxs } = await supabase
          .from('wallet_transactions')
          .select('amount, description, created_at, metadata')
          .eq('user_id', doctorId)
          .eq('type', 'earning')
          .eq('status', 'paid')
          .order('created_at', { ascending: false })
          .limit(50);

        walletTxs?.forEach(tx => {
          items.push({
            source: (tx.metadata as any)?.source || 'other',
            amount: tx.amount,
            date: tx.created_at,
            description: tx.description,
          });
        });

        // Sort all items by date descending
        items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setDoctorBreakdown(prev => ({ ...prev, [doctorId]: items }));
      } catch (err) {
        console.error('Error loading breakdown:', err);
      } finally {
        setLoadingBreakdown(null);
      }
    }
  };

  const getBreakdownSummary = (doctorId: string) => {
    const items = doctorBreakdown[doctorId] || [];
    const bySource: Record<string, number> = {};
    items.forEach(i => {
      bySource[i.source] = (bySource[i.source] || 0) + i.amount;
    });
    return bySource;
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'consultation': return <MessageSquare className="w-3.5 h-3.5 text-info" />;
      case 'recording': return <Video className="w-3.5 h-3.5 text-primary" />;
      case 'subscription':
      case 'subscription_renewal': return <Users className="w-3.5 h-3.5 text-warning" />;
      default: return <DollarSign className="w-3.5 h-3.5 text-success" />;
    }
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      consultation: tt('adminPayoutsPage.source.consultation'),
      recording: tt('adminPayoutsPage.source.recording'),
      subscription: tt('adminPayoutsPage.source.subscription'),
      subscription_renewal: tt('adminPayoutsPage.source.subscriptionRenewal'),
    };
    return labels[source] || tt('adminPayoutsPage.source.other');
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
      case 'paid': return <Badge variant="verified" className="gap-1"><CheckCircle className="w-3 h-3" />{tt('adminPayoutsPage.status.paid')}</Badge>;
      case 'processing': return <Badge variant="warning" className="gap-1"><Clock className="w-3 h-3" />{tt('adminPayoutsPage.status.processing')}</Badge>;
      case 'failed': return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />{tt('adminPayoutsPage.status.failed')}</Badge>;
      default: return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />{tt('adminPayoutsPage.status.pending')}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <Button variant="back" size="sm" onClick={() => navigate('/admin')} className="mb-4 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {tt('adminPayoutsPage.backToPanel')}
        </Button>

        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Banknote className="w-6 h-6" />
            {tt('adminPayoutsPage.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tt('adminPayoutsPage.subtitle')}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/10"><DollarSign className="w-5 h-5 text-success" /></div>
                    <div>
                      <p className="text-sm text-muted-foreground">{tt('adminPayoutsPage.summary.netToPay')}</p>
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
                      <p className="text-sm text-muted-foreground">{tt('adminPayoutsPage.summary.platformCommission')}</p>
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
                      <p className="text-sm text-muted-foreground">{tt('adminPayoutsPage.summary.doctorsWithBalance')}</p>
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
                  {tt('adminPayoutsPage.tabs.pending')}
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-2">
                  <History className="w-4 h-4" />
                  {tt('adminPayoutsPage.tabs.history')}
                </TabsTrigger>
                <TabsTrigger value="transactions" className="gap-2">
                  <CreditCard className="w-4 h-4" />
                  {tt('adminPayoutsPage.tabs.transactions')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending">
                {/* Actions bar */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={tt('adminPayoutsPage.search.doctorPlaceholder')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button variant="outline" onClick={selectAll} size="sm">
                    {selectedDoctors.size > 0 ? tt('adminPayoutsPage.actions.deselectAll') : tt('adminPayoutsPage.actions.selectAll')}
                  </Button>
                  {selectedDoctors.size > 0 && (
                    <>
                      <Button onClick={() => openPayoutDialog(null, true)} className="gap-2">
                        <Send className="w-4 h-4" />
                        {tt('adminPayoutsPage.actions.paySelected', { count: selectedDoctors.size })}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={handleDeleteSelected} className="gap-2">
                        <Trash2 className="w-4 h-4" />
                        {tt('adminPayoutsPage.actions.deleteSelected', { count: selectedDoctors.size })}
                      </Button>
                    </>
                  )}
                </div>

                {/* Doctor list */}
                <div className="space-y-3">
                  {filteredDoctors.length === 0 ? (
                    <Card><CardContent className="text-center py-12 text-muted-foreground">
                      {tt('adminPayoutsPage.empty.noPendingDoctors')}
                    </CardContent></Card>
                  ) : filteredDoctors.map(doctor => (
                    <Card key={doctor.user_id} className={`transition-colors ${selectedDoctors.has(doctor.user_id) ? 'border-primary bg-primary/5' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <Checkbox
                            checked={selectedDoctors.has(doctor.user_id)}
                            onCheckedChange={() => toggleDoctor(doctor.user_id)}
                          />

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
                              ) : null}
                              {(doctor.clabe || doctor.bank_name) ? (
                                <Badge variant="secondary" className="text-xs gap-1"><Building className="w-3 h-3" />{doctor.bank_name || tt('adminPayoutsPage.doctor.bankFallback')}</Badge>
                              ) : null}
                              {!doctor.stripe_account_id && !doctor.clabe && (
                                <Badge variant="warning" className="text-xs gap-1"><AlertTriangle className="w-3 h-3" />{tt('adminPayoutsPage.doctor.noMethod')}</Badge>
                              )}
                              {doctor.has_processing_payout && (
                                <Badge variant="warning" className="text-xs gap-1"><Clock className="w-3 h-3" />{tt('adminPayoutsPage.doctor.processingBadge')}</Badge>
                              )}
                              {!doctor.has_approved_invoice && settings.require_invoice && (
                                <Badge variant="warning" className="text-xs gap-1"><AlertTriangle className="w-3 h-3" />{tt('adminPayoutsPage.doctor.noInvoice')}</Badge>
                              )}
                            </div>
                            {(doctor.bank_name || doctor.clabe_last4) && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {doctor.account_holder_name && <span>{doctor.account_holder_name} · </span>}
                                {doctor.bank_name && <span>{doctor.bank_name} </span>}
                                {doctor.clabe_last4 && <span>CLABE: ****{doctor.clabe_last4}</span>}
                                {doctor.rfc && <span> · RFC: {doctor.rfc}</span>}
                              </p>
                            )}
                          </div>

                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-muted-foreground">{tt('adminPayoutsPage.doctor.net')}</p>
                            <p className="font-bold text-success">{formatCurrency(doctor.pending_earnings)}</p>
                          </div>

                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              disabled={doctor.pending_earnings <= 0 || doctor.has_processing_payout}
                              onClick={() => openPayoutDialog(doctor, false)}
                            >
                              <Send className="w-4 h-4 mr-1" />
                              {doctor.has_processing_payout ? tt('adminPayoutsPage.doctor.processing') : tt('adminPayoutsPage.doctor.pay')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleDoctorDetail(doctor.user_id)}
                              className="text-xs gap-1"
                            >
                              {expandedDoctor === doctor.user_id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              {tt('adminPayoutsPage.doctor.detail')}
                            </Button>
                          </div>
                        </div>

                        {/* Expandable breakdown */}
                        {expandedDoctor === doctor.user_id && (
                          <div className="mt-4 pt-4 border-t border-border">
                            {loadingBreakdown === doctor.user_id ? (
                              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                            ) : (
                              <>
                                {/* Summary by source */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                  {Object.entries(getBreakdownSummary(doctor.user_id)).map(([source, total]) => (
                                    <div key={source} className="p-3 rounded-lg bg-muted/50 flex items-center gap-2">
                                      {getSourceIcon(source)}
                                      <div>
                                        <p className="text-xs text-muted-foreground">{getSourceLabel(source)}</p>
                                        <p className="font-semibold text-sm">{formatCurrency(total)}</p>
                                      </div>
                                    </div>
                                  ))}
                                  {Object.keys(getBreakdownSummary(doctor.user_id)).length === 0 && (
                                    <p className="text-sm text-muted-foreground col-span-4">
                                      {tt('adminPayoutsPage.empty.noEarnings')}
                                    </p>
                                  )}
                                </div>

                                {/* Recent transactions */}
                                {(doctorBreakdown[doctor.user_id] || []).length > 0 && (
                                  <div className="space-y-1 max-h-48 overflow-y-auto">
                                    <p className="text-xs font-medium text-muted-foreground mb-2">
                                      {tt('adminPayoutsPage.doctor.recentTransactions')}
                                    </p>
                                    {(doctorBreakdown[doctor.user_id] || []).slice(0, 15).map((tx, i) => (
                                      <div key={i} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-muted/30">
                                        {getSourceIcon(tx.source)}
                                        <span className="flex-1 truncate text-muted-foreground">{tx.description}</span>
                                        <span className="text-muted-foreground">{format(new Date(tx.date), 'dd/MM/yy', { locale })}</span>
                                        <span className="font-medium">{formatCurrency(tx.amount)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="history">
                {payoutHistory.length === 0 ? (
                  <Card><CardContent className="text-center py-12 text-muted-foreground">
                    {tt('adminPayoutsPage.empty.noPayouts')}
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
                                  <Badge variant="secondary" className="text-xs"><Building className="w-3 h-3 mr-1" />{tt('adminPayoutsPage.history.manualBadge')}</Badge>
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

              <TabsContent value="transactions">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={tt('adminPayoutsPage.transactions.searchPlaceholder')}
                      value={txSearch}
                      onChange={(e) => setTxSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={txTypeFilter} onValueChange={setTxTypeFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder={tt('adminPayoutsPage.transactions.type')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{tt('adminPayoutsPage.transactions.typeAll')}</SelectItem>
                      <SelectItem value="topup">{tt('adminPayoutsPage.transactions.typeTopups')}</SelectItem>
                      <SelectItem value="purchase">{tt('adminPayoutsPage.transactions.typePurchases')}</SelectItem>
                      <SelectItem value="earning">{tt('adminPayoutsPage.transactions.typeEarnings')}</SelectItem>
                      <SelectItem value="subscription">{tt('adminPayoutsPage.transactions.typeSubscriptions')}</SelectItem>
                      <SelectItem value="refund">{tt('adminPayoutsPage.transactions.typeRefunds')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={exportTransactionsCSV} className="gap-1.5">
                    <Banknote className="w-4 h-4" />
                    {tt('adminPayoutsPage.transactions.exportCsv')}
                  </Button>
                </div>

                {/* Totals summary */}
                {Object.keys(txTotals).length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                    {Object.entries(txTotals).map(([type, total]) => (
                      <div key={type} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                        <p className="text-xs text-muted-foreground">{getTxTypeLabel(type)}</p>
                        <p className="font-bold text-sm">{formatCurrency(total as number)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {txLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : filteredTransactions.length === 0 ? (
                  <Card><CardContent className="text-center py-12 text-muted-foreground">
                    {tt('adminPayoutsPage.empty.noTransactions')}
                  </CardContent></Card>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left p-3 font-medium text-muted-foreground">{tt('adminPayoutsPage.transactions.colDate')}</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">{tt('adminPayoutsPage.transactions.colUser')}</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">{tt('adminPayoutsPage.transactions.colType')}</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">{tt('adminPayoutsPage.transactions.colDescription')}</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">{tt('adminPayoutsPage.transactions.colAmount')}</th>
                            <th className="text-center p-3 font-medium text-muted-foreground">{tt('adminPayoutsPage.transactions.colStatus')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTransactions.map(tx => {
                            const profile = txProfileMap.get(tx.user_id);
                            return (
                              <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                                <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                                  {format(new Date(tx.created_at), 'dd MMM yyyy, HH:mm', { locale })}
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                      {profile?.avatar_url ? (
                                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                                      )}
                                    </div>
                                    <span className="text-sm truncate max-w-[150px]">{profile?.name || tx.user_id.slice(0, 8)}</span>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <Badge variant={getTxTypeBadgeVariant(tx.type)} className="text-xs">
                                    {getTxTypeLabel(tx.type)}
                                  </Badge>
                                </td>
                                <td className="p-3 text-sm text-muted-foreground truncate max-w-[200px]">{tx.description}</td>
                                <td className="p-3 text-right font-semibold whitespace-nowrap">
                                  <span className={tx.type === 'refund' ? 'text-destructive' : tx.type === 'earning' || tx.type === 'topup' ? 'text-success' : ''}>
                                    {tx.type === 'refund' ? '-' : ''}{formatCurrency(Math.abs(tx.amount))}
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  {getStatusBadge(tx.status)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-3 bg-muted/30 border-t text-xs text-muted-foreground text-right">
                      {tt('adminPayoutsPage.transactions.showing', { count: filteredTransactions.length })}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Payout Confirmation Dialog */}
        <Dialog open={payoutDialog.open} onOpenChange={(open) => !isProcessing && setPayoutDialog({ ...payoutDialog, open })}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-success" />
                {tt('adminPayoutsPage.dialog.title')}
              </DialogTitle>
              <DialogDescription>
                {payoutDialog.bulk
                  ? tt('adminPayoutsPage.dialog.descBulk', { count: selectedDoctors.size })
                  : tt('adminPayoutsPage.dialog.descSingle', { name: payoutDialog.doctor?.name || '' })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Summary */}
              {!payoutDialog.bulk && payoutDialog.doctor && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex justify-between font-bold">
                    <span>{tt('adminPayoutsPage.dialog.netToPayLabel')}</span>
                    <span className="text-success">{formatCurrency(payoutDialog.doctor.pending_earnings)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{tt('adminPayoutsPage.dialog.commissionNote')}</p>
                </div>
              )}

              {payoutDialog.bulk && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{tt('adminPayoutsPage.dialog.doctorsLabel')}</span>
                    <span>{selectedDoctors.size}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>{tt('adminPayoutsPage.dialog.totalNetLabel')}</span>
                    <span className="text-success">{formatCurrency(doctors.filter(d => selectedDoctors.has(d.user_id)).reduce((s, d) => s + d.pending_earnings, 0))}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{tt('adminPayoutsPage.dialog.commissionNote')}</p>
                </div>
              )}

              {/* Payment method */}
              <div className="space-y-2">
                <Label>{tt('adminPayoutsPage.dialog.paymentMethod')}</Label>
                <Select value={payoutMethod} onValueChange={(v: 'stripe' | 'manual') => setPayoutMethod(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stripe">
                      <span className="flex items-center gap-2"><CreditCard className="w-4 h-4" />Stripe Connect</span>
                    </SelectItem>
                    <SelectItem value="manual">
                      <span className="flex items-center gap-2"><Building className="w-4 h-4" />{tt('adminPayoutsPage.dialog.manualTransfer')}</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {payoutMethod === 'manual' && (
                <>
                  {/* Show full bank details for the doctor */}
                  {!payoutDialog.bulk && payoutDialog.doctor && (payoutDialog.doctor.clabe || payoutDialog.doctor.bank_name) && (
                    <div className="p-4 bg-info/10 border border-info/20 rounded-lg space-y-2">
                      <p className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Building className="w-4 h-4" />
                        {tt('adminPayoutsPage.dialog.bankDetailsTitle')}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {payoutDialog.doctor.account_holder_name && (
                          <div><span className="text-muted-foreground">{tt('adminPayoutsPage.dialog.holder')}</span> <span className="font-medium">{payoutDialog.doctor.account_holder_name}</span></div>
                        )}
                        {payoutDialog.doctor.bank_name && (
                          <div><span className="text-muted-foreground">{tt('adminPayoutsPage.dialog.bank')}</span> <span className="font-medium">{payoutDialog.doctor.bank_name}</span></div>
                        )}
                        {payoutDialog.doctor.clabe && (
                          <div className="col-span-2"><span className="text-muted-foreground">CLABE:</span> <span className="font-mono font-medium">{payoutDialog.doctor.clabe}</span></div>
                        )}
                        {payoutDialog.doctor.rfc && (
                          <div><span className="text-muted-foreground">RFC:</span> <span className="font-medium">{payoutDialog.doctor.rfc}</span></div>
                        )}
                        {payoutDialog.doctor.bank_branch && (
                          <div><span className="text-muted-foreground">{tt('adminPayoutsPage.dialog.branch')}</span> <span className="font-medium">{payoutDialog.doctor.bank_branch}</span></div>
                        )}
                      </div>
                    </div>
                  )}
                  {!payoutDialog.bulk && payoutDialog.doctor && !payoutDialog.doctor.clabe && !payoutDialog.doctor.bank_name && (
                    <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-warning" />
                      {tt('adminPayoutsPage.dialog.noBankWarning')}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>{tt('adminPayoutsPage.dialog.transferReference')}</Label>
                    <Input
                      placeholder={tt('adminPayoutsPage.dialog.transferReferencePlaceholder')}
                      value={manualReference}
                      onChange={(e) => setManualReference(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{tt('adminPayoutsPage.dialog.receipt')}</Label>
                    <div className="flex items-center gap-2 min-w-0 w-full max-w-full">
                      <label className="flex items-center gap-2 px-3 py-2 border border-input rounded-md cursor-pointer hover:bg-muted transition-colors text-sm flex-1 min-w-0 overflow-hidden">
                        <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate flex-1 min-w-0 block" title={receiptFile?.name || ''} style={{ wordBreak: 'break-all' }}>
                          {receiptFile ? receiptFile.name : tt('adminPayoutsPage.dialog.selectFile')}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          className="hidden"
                          onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                        />
                      </label>
                      {receiptFile && (
                        <Button variant="ghost" size="sm" onClick={() => setReceiptFile(null)} className="flex-shrink-0">
                          <XCircle className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tt('adminPayoutsPage.dialog.receiptHelp')}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>{tt('adminPayoutsPage.dialog.notes')}</Label>
                    <Textarea
                      placeholder={tt('adminPayoutsPage.dialog.notesPlaceholder')}
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                </>
              )}

              {stripeError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-foreground flex items-start gap-2">
                  <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-destructive" />
                  {tt('adminPayoutsPage.dialog.stripeErrorMsg')}
                </div>
              )}

              {payoutMethod === 'stripe' && !payoutDialog.bulk && payoutDialog.doctor && !payoutDialog.doctor.stripe_account_id && !stripeError && (
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm text-foreground flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-warning" />
                  {tt('adminPayoutsPage.dialog.stripeWarningMsg')}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPayoutDialog({ open: false, doctor: null, bulk: false })} disabled={isProcessing}>
                {tt('adminPayoutsPage.dialog.cancel')}
              </Button>
              <Button onClick={handleProcessPayout} disabled={isProcessing}>
                {isProcessing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{tt('adminPayoutsPage.dialog.processing')}</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" />{tt('adminPayoutsPage.dialog.confirmPayout')}</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
