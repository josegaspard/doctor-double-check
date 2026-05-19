import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, RefreshCcw, Search, Loader2, User, DollarSign, Calendar,
  AlertCircle, CheckCircle, History, Clock, XCircle, MessageSquare,
  CreditCard, Building2, Wallet, Download, FileSpreadsheet, FileText,
  ChevronRight, Ban,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';

interface Transaction {
  id: string; user_id: string; type: string; amount: number; description: string;
  status: string; created_at: string; metadata: any;
  user_name?: string; user_email?: string; user_avatar?: string;
}

interface RefundRequest {
  id: string; user_id: string; transaction_id: string; amount: number; reason: string;
  status: string; admin_notes: string | null; created_at: string;
  reviewed_at: string | null; reviewed_by: string | null;
  refund_method: string | null; stripe_refund_id: string | null;
  bank_transfer_reference: string | null; bank_transfer_date: string | null;
  estimated_completion_date: string | null;
  user_has_stripe: boolean; user_has_bank_account: boolean;
  user_name?: string; user_email?: string; user_avatar?: string;
  tx_description?: string; tx_metadata?: any;
}

interface BankAccount {
  bank_name: string; clabe: string; clabe_last4: string; account_holder_name: string; rfc: string | null;
}

const statusConfig: Record<string, { labelKey: string; color: string; icon: React.ReactNode }> = {
  pending: { labelKey: 'adminRefunds.status.pending', color: 'bg-warning/10 text-warning border-warning/30', icon: <Clock className="w-3 h-3" /> },
  approved: { labelKey: 'adminRefunds.status.approved', color: 'bg-success/10 text-success border-success/30', icon: <CheckCircle className="w-3 h-3" /> },
  processed: { labelKey: 'adminRefunds.status.processed', color: 'bg-success/10 text-success border-success/30', icon: <CheckCircle className="w-3 h-3" /> },
  rejected: { labelKey: 'adminRefunds.status.rejected', color: 'bg-destructive/10 text-destructive border-destructive/30', icon: <XCircle className="w-3 h-3" /> },
  pending_transfer: { labelKey: 'adminRefunds.status.pendingTransfer', color: 'bg-warning/10 text-warning border-warning/30', icon: <Building2 className="w-3 h-3" /> },
  transferred: { labelKey: 'adminRefunds.status.transferred', color: 'bg-info/10 text-info border-info/30', icon: <CreditCard className="w-3 h-3" /> },
  completed: { labelKey: 'adminRefunds.status.completed', color: 'bg-success/10 text-success border-success/30', icon: <CheckCircle className="w-3 h-3" /> },
  awaiting_bank_details: { labelKey: 'adminRefunds.status.awaitingBankDetails', color: 'bg-accent/10 text-accent border-accent/30', icon: <AlertCircle className="w-3 h-3" /> },
};

const methodConfig: Record<string, { labelKey: string; icon: React.ReactNode }> = {
  stripe: { labelKey: 'adminRefunds.method.stripe', icon: <CreditCard className="w-3 h-3" /> },
  bank_transfer: { labelKey: 'adminRefunds.method.bankTransfer', icon: <Building2 className="w-3 h-3" /> },
  wallet: { labelKey: 'adminRefunds.method.wallet', icon: <Wallet className="w-3 h-3" /> },
};

export default function AdminRefunds() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { language, t } = useLanguage();
  const locale = language === 'es' ? es : enUS;
  const isMobile = useIsMobile();
  
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('requests');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Direct refund dialog
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Approval dialog
  const [approvalDialog, setApprovalDialog] = useState<{ open: boolean; request: RefundRequest | null }>({ open: false, request: null });
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [adminNotes, setAdminNotes] = useState('');
  const [userBankAccount, setUserBankAccount] = useState<BankAccount | null>(null);

  // Bank transfer management
  const [transferRef, setTransferRef] = useState('');

  useEffect(() => {
    if (role && role !== 'admin') { navigate('/'); return; }
    loadData();
  }, [role]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [{ data: txData }, { data: requestsData }] = await Promise.all([
        supabase.from('wallet_transactions').select('*').in('type', ['purchase', 'topup']).eq('status', 'paid').order('created_at', { ascending: false }).limit(200),
        supabase.from('refund_requests' as any).select('*').order('created_at', { ascending: false }).limit(500),
      ]);

      const allUserIds = new Set<string>();
      txData?.forEach(tx => allUserIds.add(tx.user_id));
      (requestsData as any[])?.forEach((r: any) => allUserIds.add(r.user_id));

      const { data: profiles } = await supabase.from('profiles').select('id, name, email, avatar_url').in('id', [...allUserIds]);
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const mapTx = (tx: any): Transaction => ({
        ...tx, user_name: profileMap.get(tx.user_id)?.name, user_email: profileMap.get(tx.user_id)?.email, user_avatar: profileMap.get(tx.user_id)?.avatar_url,
      });

      setTransactions((txData || []).map(mapTx));

      // Map refund requests
      const txMap = new Map((txData || []).map(t => [t.id, { description: t.description, metadata: t.metadata }]));
      setRefundRequests(((requestsData || []) as any[]).map((r: any) => ({
        ...r,
        user_name: profileMap.get(r.user_id)?.name,
        user_email: profileMap.get(r.user_id)?.email,
        user_avatar: profileMap.get(r.user_id)?.avatar_url,
        tx_description: txMap.get(r.transaction_id)?.description || '',
        tx_metadata: txMap.get(r.transaction_id)?.metadata || null,
      })));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Detect stripe payment intent from original transaction
  const detectStripePI = (req: RefundRequest) => {
    const meta = req.tx_metadata;
    return meta?.stripe_session_id || meta?.stripe_payment_intent_id || null;
  };

  const openApprovalDialog = async (req: RefundRequest) => {
    const stripePI = detectStripePI(req);
    
    // Load user's bank account
    const { data: ba } = await supabase
      .from('user_bank_accounts' as any)
      .select('*')
      .eq('user_id', req.user_id)
      .single();
    
    setUserBankAccount(ba as any);
    setSelectedMethod(stripePI ? 'stripe' : (ba ? 'bank_transfer' : 'wallet'));
    setAdminNotes('');
    setApprovalDialog({ open: true, request: req });
  };

  const handleApproveRequest = async () => {
    const req = approvalDialog.request;
    if (!req || !selectedMethod) return;
    setIsProcessing(true);
    try {
      const stripePI = detectStripePI(req);

      const { data, error } = await supabase.functions.invoke('admin-refund', {
        body: {
          transaction_id: req.transaction_id,
          user_id: req.user_id,
          amount: req.amount,
          reason: `${t('adminRefunds.requestApprovedPrefix')}: ${req.reason}`,
          stripe_payment_intent_id: selectedMethod === 'stripe' ? stripePI : null,
          refund_method: selectedMethod,
          refund_request_id: req.id,
        },
      });
      if (error) throw error;

      toast.success(
        selectedMethod === 'stripe' ? t('adminRefunds.toast.stripeProcessed') :
        selectedMethod === 'bank_transfer' ? t('adminRefunds.toast.bankInitiated') :
        t('adminRefunds.toast.walletProcessed')
      );
      setApprovalDialog({ open: false, request: null });
      loadData();
    } catch (error: any) {
      toast.error(error.message || t('adminRefunds.toast.processError'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectRequest = async (req: RefundRequest) => {
    setIsProcessing(true);
    try {
      await supabase.from('refund_requests' as any).update({
        status: 'rejected',
        admin_notes: adminNotes || null,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      } as any).eq('id', req.id);

      await supabase.from('notifications').insert({
        user_id: req.user_id, type: 'system' as any,
        title: t('adminRefunds.notification.rejectedTitle'),
        message: `${t('adminRefunds.notification.rejectedMessage')}${adminNotes ? ` ${t('adminRefunds.notification.reasonPrefix')}: ${adminNotes}` : ''}`,
        data: { refund_request_id: req.id },
      });

      toast.success(t('adminRefunds.toast.requestRejected'));
      loadData();
    } catch (error: any) {
      toast.error(error.message || t('adminRefunds.toast.genericError'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkTransferred = async (req: RefundRequest) => {
    if (!transferRef.trim()) { toast.error(t('adminRefunds.toast.transferRefRequired')); return; }
    setIsProcessing(true);
    try {
      await supabase.from('refund_requests' as any).update({
        status: 'transferred',
        bank_transfer_reference: transferRef.trim(),
        bank_transfer_date: new Date().toISOString(),
      } as any).eq('id', req.id);

      await supabase.from('notifications').insert({
        user_id: req.user_id, type: 'system' as any,
        title: t('adminRefunds.notification.transferDoneTitle'),
        message: `${t('adminRefunds.notification.transferDoneMessagePrefix')} $${req.amount.toLocaleString()} ${t('adminRefunds.notification.transferDoneMessageSuffix')} ${transferRef.trim()}`,
        data: { refund_request_id: req.id },
      });

      toast.success(t('adminRefunds.toast.markedTransferred'));
      setTransferRef('');
      loadData();
    } catch (error: any) {
      toast.error(error.message || t('adminRefunds.toast.genericError'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkCompleted = async (req: RefundRequest) => {
    setIsProcessing(true);
    try {
      await supabase.from('refund_requests' as any).update({ status: 'completed' } as any).eq('id', req.id);

      await supabase.from('wallet_transactions').insert({
        user_id: req.user_id, type: 'refund', amount: req.amount,
        description: t('adminRefunds.bankRefundCompletedDescription'), status: 'paid',
        metadata: { refund_method: 'bank_transfer', refund_request_id: req.id, bank_transfer_reference: req.bank_transfer_reference },
      });

      toast.success(t('adminRefunds.toast.markedCompleted'));
      loadData();
    } catch (error: any) {
      toast.error(error.message || t('adminRefunds.toast.genericError'));
    } finally {
      setIsProcessing(false);
    }
  };

  // =========== FILTERING ===========
  const filterBySearch = (items: RefundRequest[]) => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(r => r.user_name?.toLowerCase().includes(q) || r.user_email?.toLowerCase().includes(q) || r.reason?.toLowerCase().includes(q));
  };

  const pendingRequests = useMemo(() => filterBySearch(refundRequests.filter(r => r.status === 'pending')), [refundRequests, searchQuery]);
  const stripeRefunds = useMemo(() => filterBySearch(refundRequests.filter(r => r.refund_method === 'stripe' && r.status !== 'pending')), [refundRequests, searchQuery]);
  const bankRefunds = useMemo(() => filterBySearch(refundRequests.filter(r => 
    r.refund_method === 'bank_transfer' && ['pending_transfer', 'transferred', 'completed', 'awaiting_bank_details'].includes(r.status)
  )), [refundRequests, searchQuery]);
  const walletRefunds = useMemo(() => filterBySearch(refundRequests.filter(r => r.refund_method === 'wallet' && r.status !== 'pending')), [refundRequests, searchQuery]);
  const allProcessed = useMemo(() => filterBySearch(refundRequests.filter(r => r.status !== 'pending')), [refundRequests, searchQuery]);

  // KPIs
  const totalStripe = stripeRefunds.reduce((s, r) => s + r.amount, 0);
  const totalBank = bankRefunds.reduce((s, r) => s + r.amount, 0);
  const totalWallet = walletRefunds.reduce((s, r) => s + r.amount, 0);
  const pendingBankCount = bankRefunds.filter(r => r.status === 'pending_transfer').length;

  // =========== EXPORTS ===========
  const getExportRows = () => {
    const source = selectedIds.size > 0 ? allProcessed.filter(r => selectedIds.has(r.id)) : allProcessed;
    return source;
  };

  const handleExportCSV = () => {
    const rows = getExportRows();
    if (rows.length === 0) { toast.error(t('adminRefunds.toast.noDataToExport')); return; }

    const headers = [
      t('adminRefunds.csv.date'),
      t('adminRefunds.csv.user'),
      t('adminRefunds.csv.email'),
      t('adminRefunds.csv.amount'),
      t('adminRefunds.csv.method'),
      t('adminRefunds.csv.status'),
      t('adminRefunds.csv.stripeRef'),
      t('adminRefunds.csv.bankRef'),
      t('adminRefunds.csv.reason'),
      t('adminRefunds.csv.adminNotes'),
    ];
    const csvRows = rows.map(r => [
      format(new Date(r.created_at), 'yyyy-MM-dd HH:mm'),
      r.user_name || '', r.user_email || '', r.amount.toString(),
      methodConfig[r.refund_method || 'wallet'] ? t(methodConfig[r.refund_method || 'wallet'].labelKey) : (r.refund_method || t('adminRefunds.method.wallet')),
      statusConfig[r.status] ? t(statusConfig[r.status].labelKey) : r.status,
      r.stripe_refund_id || '', r.bank_transfer_reference || '',
      `"${(r.reason || '').replace(/"/g, '""')}"`,
      `"${(r.admin_notes || '').replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t('adminRefunds.csv.fileName')}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} ${t('adminRefunds.toast.recordsExported')}`);
  };

  const handleExportPDF = () => {
    const rows = getExportRows();
    if (rows.length === 0) { toast.error(t('adminRefunds.toast.noDataToExport')); return; }

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) return;

    const pendingBankRows = rows.filter(r => r.status === 'pending_transfer' || r.status === 'awaiting_bank_details');

    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${t('adminRefunds.pdf.title')}</title>
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #333; font-size: 12px; }
      h1 { color: #163a83; font-size: 20px; margin-bottom: 4px; }
      .subtitle { color: #666; margin-bottom: 20px; }
      .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
      .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; }
      .kpi-value { font-size: 18px; font-weight: 700; }
      .kpi-label { color: #666; font-size: 11px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
      th { background: #f1f5f9; padding: 8px; text-align: left; font-size: 11px; border-bottom: 2px solid #e2e8f0; }
      td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
      .section-title { font-size: 14px; font-weight: 600; margin: 16px 0 8px; color: #163a83; }
      .stripe { color: #635bff; } .bank { color: #e65100; } .wallet { color: #0369a1; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <h1>${t('adminRefunds.pdf.header')}</h1>
    <p class="subtitle">${t('adminRefunds.pdf.generated')}: ${format(new Date(), 'dd MMMM yyyy, HH:mm', { locale })}</p>

    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-value">${rows.length}</div><div class="kpi-label">${t('adminRefunds.pdf.totalRefunds')}</div></div>
      <div class="kpi"><div class="kpi-value stripe">$${totalStripe.toLocaleString()}</div><div class="kpi-label">${t('adminRefunds.method.stripe')}</div></div>
      <div class="kpi"><div class="kpi-value bank">$${totalBank.toLocaleString()}</div><div class="kpi-label">${t('adminRefunds.kpi.bank')}</div></div>
      <div class="kpi"><div class="kpi-value wallet">$${totalWallet.toLocaleString()}</div><div class="kpi-label">${t('adminRefunds.method.wallet')}</div></div>
    </div>

    <p class="section-title">${t('adminRefunds.pdf.detailTitle')}</p>
    <table>
      <thead><tr><th>${t('adminRefunds.csv.date')}</th><th>${t('adminRefunds.csv.user')}</th><th>${t('adminRefunds.csv.amount')}</th><th>${t('adminRefunds.csv.method')}</th><th>${t('adminRefunds.csv.status')}</th><th>${t('adminRefunds.pdf.reference')}</th><th>${t('adminRefunds.csv.reason')}</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${format(new Date(r.created_at), 'dd/MM/yy')}</td>
        <td>${r.user_name || ''}<br/><small style="color:#999">${r.user_email || ''}</small></td>
        <td>$${r.amount.toLocaleString()}</td>
        <td>${methodConfig[r.refund_method || 'wallet'] ? t(methodConfig[r.refund_method || 'wallet'].labelKey) : t('adminRefunds.method.wallet')}</td>
        <td>${statusConfig[r.status] ? t(statusConfig[r.status].labelKey) : r.status}</td>
        <td style="font-family:monospace;font-size:10px;">${r.stripe_refund_id || r.bank_transfer_reference || '-'}</td>
        <td>${r.reason || ''}</td>
      </tr>`).join('')}</tbody>
    </table>

    ${pendingBankRows.length > 0 ? `
      <p class="section-title">${t('adminRefunds.pdf.pendingBankTitle')} (${pendingBankRows.length})</p>
      <table>
        <thead><tr><th>${t('adminRefunds.csv.user')}</th><th>${t('adminRefunds.csv.amount')}</th><th>${t('adminRefunds.csv.status')}</th><th>${t('adminRefunds.pdf.estimatedDate')}</th></tr></thead>
        <tbody>${pendingBankRows.map(r => `<tr>
          <td>${r.user_name || ''}</td>
          <td>$${r.amount.toLocaleString()}</td>
          <td>${statusConfig[r.status] ? t(statusConfig[r.status].labelKey) : r.status}</td>
          <td>${r.estimated_completion_date ? format(new Date(r.estimated_completion_date), 'dd/MM/yy') : '-'}</td>
        </tr>`).join('')}</tbody>
      </table>
    ` : ''}

    </body></html>`);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 500);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = statusConfig[status];
    const label = cfg ? t(cfg.labelKey) : status;
    const color = cfg ? cfg.color : 'bg-muted text-muted-foreground';
    const icon = cfg ? cfg.icon : null;
    return <Badge variant="outline" className={`gap-1 ${color}`}>{icon}{label}</Badge>;
  };

  const MethodBadge = ({ method }: { method: string | null }) => {
    const cfg = methodConfig[method || 'wallet'] || methodConfig.wallet;
    return <Badge variant="outline" className="gap-1">{cfg.icon}{t(cfg.labelKey)}</Badge>;
  };

  // =========== RENDER HELPERS ===========
  const renderRefundCard = (req: RefundRequest, showActions = false, showBankActions = false) => (
    <Card key={req.id} className={`${req.status === 'pending' ? 'border-l-4 border-l-warning' : req.status === 'pending_transfer' ? 'border-l-4 border-l-warning' : ''}`}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-3">
          {!isMobile && (
            <Checkbox checked={selectedIds.has(req.id)} onCheckedChange={() => toggleSelect(req.id)} className="mt-1" />
          )}
          <Avatar className="w-8 h-8 shrink-0"><AvatarImage src={req.user_avatar || undefined} /><AvatarFallback><User className="w-3 h-3" /></AvatarFallback></Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm">{req.user_name || t('adminRefunds.userFallback')}</p>
                <p className="text-xs text-muted-foreground truncate">{req.user_email}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-sm">${req.amount.toLocaleString()}</p>
                <div className="flex flex-wrap gap-1 justify-end mt-1">
                  <StatusBadge status={req.status} />
                  {req.refund_method && req.status !== 'pending' && <MethodBadge method={req.refund_method} />}
                </div>
              </div>
            </div>

            <div className="mt-2 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(req.created_at), 'dd MMM yyyy, HH:mm', { locale })}
              </p>
              <p className="text-xs bg-muted/50 p-2 rounded">{req.reason}</p>
              {req.tx_description && <p className="text-xs text-muted-foreground">{t('adminRefunds.card.txPrefix')}: {req.tx_description}</p>}
              {req.stripe_refund_id && <p className="text-xs font-mono text-muted-foreground">{t('adminRefunds.card.stripePrefix')}: {req.stripe_refund_id}</p>}
              {req.bank_transfer_reference && <p className="text-xs font-mono text-muted-foreground">{t('adminRefunds.card.refPrefix')}: {req.bank_transfer_reference}</p>}
              {req.estimated_completion_date && (
                <p className="text-xs text-muted-foreground">{t('adminRefunds.card.estimatedDate')}: {format(new Date(req.estimated_completion_date), 'dd MMM yyyy', { locale })}</p>
              )}
              {req.admin_notes && <p className="text-xs text-muted-foreground italic">{t('adminRefunds.card.adminPrefix')}: {req.admin_notes}</p>}
            </div>

            {/* Actions */}
            {showActions && req.status === 'pending' && (
              <div className="flex gap-2 mt-3 flex-wrap">
                <Button size="sm" onClick={() => openApprovalDialog(req)} className="gap-1">
                  <CheckCircle className="w-3 h-3" />{t('adminRefunds.actions.approve')}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => { setAdminNotes(''); handleRejectRequest(req); }} className="gap-1">
                  <XCircle className="w-3 h-3" />{t('adminRefunds.actions.reject')}
                </Button>
              </div>
            )}

            {showBankActions && req.status === 'pending_transfer' && (
              <div className="mt-3 space-y-2 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs font-medium">{t('adminRefunds.actions.markAsTransferred')}:</p>
                <div className="flex gap-2">
                  <Input placeholder={t('adminRefunds.actions.transferRefPlaceholder')} value={transferRef} onChange={(e) => setTransferRef(e.target.value)} className="text-sm h-8" />
                  <Button size="sm" onClick={() => handleMarkTransferred(req)} disabled={isProcessing} className="gap-1 shrink-0">
                    <CheckCircle className="w-3 h-3" />{t('adminRefunds.actions.transferred')}
                  </Button>
                </div>
              </div>
            )}

            {showBankActions && req.status === 'transferred' && (
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={() => handleMarkCompleted(req)} disabled={isProcessing} className="gap-1">
                  <CheckCircle className="w-3 h-3" />{t('adminRefunds.actions.markCompleted')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="mb-4 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" />{t('adminRefunds.backToPanel')}
        </Button>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
              <RefreshCcw className="w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
            </div>
            <div>
              <h1 className="font-heading text-xl sm:text-2xl font-bold">{t('adminRefunds.pageTitle')}</h1>
              <p className="text-sm text-muted-foreground">{t('adminRefunds.pageSubtitle')}</p>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Card><CardContent className="p-3 sm:pt-6 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-warning/10"><MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-warning" /></div>
              <div>
                <p className="text-[10px] sm:text-sm text-muted-foreground">{t('adminRefunds.kpi.pending')}</p>
                <p className="text-lg sm:text-xl font-bold">{pendingRequests.length}</p>
              </div>
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-3 sm:pt-6 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10"><CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-primary" /></div>
              <div>
                <p className="text-[10px] sm:text-sm text-muted-foreground">{t('adminRefunds.method.stripe')}</p>
                <p className="text-lg sm:text-xl font-bold">${totalStripe.toLocaleString()}</p>
              </div>
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-3 sm:pt-6 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-warning/10"><Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-warning" /></div>
              <div>
                <p className="text-[10px] sm:text-sm text-muted-foreground">{t('adminRefunds.kpi.bank')}</p>
                <p className="text-lg sm:text-xl font-bold">${totalBank.toLocaleString()}</p>
                {pendingBankCount > 0 && <p className="text-[10px] text-warning">{pendingBankCount} {t('adminRefunds.kpi.toTransfer')}</p>}
              </div>
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-3 sm:pt-6 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-info/10"><Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-info" /></div>
              <div>
                <p className="text-[10px] sm:text-sm text-muted-foreground">{t('adminRefunds.method.wallet')}</p>
                <p className="text-lg sm:text-xl font-bold">${totalWallet.toLocaleString()}</p>
              </div>
            </div>
          </CardContent></Card>
        </div>

        {/* Search + Export */}
        <Card className="mb-4 sm:mb-6"><CardContent className="p-3 sm:pt-6 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={t('adminRefunds.searchPlaceholder')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1 text-xs">
                <FileSpreadsheet className="w-3.5 h-3.5" />{t('adminRefunds.export.excel')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1 text-xs">
                <FileText className="w-3.5 h-3.5" />{t('adminRefunds.export.pdf')}
              </Button>
            </div>
          </div>
        </CardContent></Card>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="requests" className="gap-1 text-xs sm:text-sm">
                <MessageSquare className="w-3.5 h-3.5" />
                {!isMobile && t('adminRefunds.tabs.requests')}
                {pendingRequests.length > 0 && <Badge variant="destructive" className="ml-0.5 text-[10px] px-1.5">{pendingRequests.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="stripe" className="gap-1 text-xs sm:text-sm">
                <CreditCard className="w-3.5 h-3.5" />
                {!isMobile && t('adminRefunds.tabs.stripe')}
              </TabsTrigger>
              <TabsTrigger value="bank" className="gap-1 text-xs sm:text-sm">
                <Building2 className="w-3.5 h-3.5" />
                {!isMobile && t('adminRefunds.tabs.bank')}
                {pendingBankCount > 0 && <Badge variant="warning" className="ml-0.5 text-[10px] px-1.5">{pendingBankCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="wallet" className="gap-1 text-xs sm:text-sm">
                <Wallet className="w-3.5 h-3.5" />
                {!isMobile && t('adminRefunds.tabs.manual')}
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-1 text-xs sm:text-sm">
                <History className="w-3.5 h-3.5" />
                {!isMobile && t('adminRefunds.tabs.history')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="requests">
              {pendingRequests.length === 0 ? (
                <Card><CardContent className="text-center py-8 text-muted-foreground text-sm">{t('adminRefunds.empty.requests')}</CardContent></Card>
              ) : (
                <div className="space-y-3">{pendingRequests.map(r => renderRefundCard(r, true))}</div>
              )}
            </TabsContent>

            <TabsContent value="stripe">
              {stripeRefunds.length === 0 ? (
                <Card><CardContent className="text-center py-8 text-muted-foreground text-sm">{t('adminRefunds.empty.stripe')}</CardContent></Card>
              ) : (
                <div className="space-y-3">{stripeRefunds.map(r => renderRefundCard(r))}</div>
              )}
            </TabsContent>

            <TabsContent value="bank">
              {bankRefunds.length === 0 ? (
                <Card><CardContent className="text-center py-8 text-muted-foreground text-sm">{t('adminRefunds.empty.bank')}</CardContent></Card>
              ) : (
                <div className="space-y-3">{bankRefunds.map(r => renderRefundCard(r, false, true))}</div>
              )}
            </TabsContent>

            <TabsContent value="wallet">
              {walletRefunds.length === 0 ? (
                <Card><CardContent className="text-center py-8 text-muted-foreground text-sm">{t('adminRefunds.empty.wallet')}</CardContent></Card>
              ) : (
                <div className="space-y-3">{walletRefunds.map(r => renderRefundCard(r))}</div>
              )}
            </TabsContent>

            <TabsContent value="all">
              {allProcessed.length === 0 ? (
                <Card><CardContent className="text-center py-8 text-muted-foreground text-sm">{t('adminRefunds.empty.all')}</CardContent></Card>
              ) : (
                <div className="space-y-3">{allProcessed.map(r => renderRefundCard(r))}</div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Floating selection bar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-background/80 backdrop-blur-lg border rounded-xl px-4 py-3 shadow-lg flex items-center gap-3">
            <span className="text-sm font-medium">{selectedIds.size} {t('adminRefunds.selectedCount')}</span>
            <Button size="sm" variant="outline" onClick={handleExportCSV} className="gap-1">
              <FileSpreadsheet className="w-3.5 h-3.5" />{t('adminRefunds.export.csv')}
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportPDF} className="gap-1">
              <FileText className="w-3.5 h-3.5" />{t('adminRefunds.export.pdf')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Approval Dialog - Method Selection */}
        <Dialog open={approvalDialog.open} onOpenChange={(open) => !isProcessing && setApprovalDialog({ ...approvalDialog, open })}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success" />
                {t('adminRefunds.dialog.title')}
              </DialogTitle>
              <DialogDescription>{t('adminRefunds.dialog.description')}</DialogDescription>
            </DialogHeader>
            {approvalDialog.request && (
              <div className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                  <p><strong>{t('adminRefunds.dialog.userLabel')}:</strong> {approvalDialog.request.user_name}</p>
                  <p><strong>{t('adminRefunds.dialog.amountLabel')}:</strong> ${approvalDialog.request.amount.toLocaleString()} MXN</p>
                  <p><strong>{t('adminRefunds.dialog.reasonLabel')}:</strong> {approvalDialog.request.reason}</p>
                </div>

                {/* Method selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('adminRefunds.dialog.methodLabel')}</label>
                  <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {detectStripePI(approvalDialog.request) && (
                        <SelectItem value="stripe">
                          <span className="flex items-center gap-2"><CreditCard className="w-4 h-4" />{t('adminRefunds.dialog.methodStripe')}</span>
                        </SelectItem>
                      )}
                      <SelectItem value="bank_transfer">
                        <span className="flex items-center gap-2"><Building2 className="w-4 h-4" />{t('adminRefunds.dialog.methodBank')}</span>
                      </SelectItem>
                      <SelectItem value="wallet">
                        <span className="flex items-center gap-2"><Wallet className="w-4 h-4" />{t('adminRefunds.dialog.methodWallet')}</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Context info per method */}
                {selectedMethod === 'stripe' && (
                  <div className="flex items-start gap-2 p-3 bg-success/10 border border-success/20 rounded-lg">
                    <CreditCard className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    <p className="text-xs">{t('adminRefunds.dialog.stripeInfo')}</p>
                  </div>
                )}
                {selectedMethod === 'bank_transfer' && (
                  <div className="space-y-2">
                    {userBankAccount ? (
                      <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                        <p className="text-xs font-medium text-foreground">{t('adminRefunds.dialog.bankDataTitle')}:</p>
                        <p className="text-xs">{t('adminRefunds.dialog.bankName')}: <strong>{userBankAccount.bank_name}</strong></p>
                        <p className="text-xs font-mono">{t('adminRefunds.dialog.clabe')}: {userBankAccount.clabe}</p>
                        <p className="text-xs">{t('adminRefunds.dialog.holder')}: {userBankAccount.account_holder_name}</p>
                        {userBankAccount.rfc && <p className="text-xs">{t('adminRefunds.dialog.rfc')}: {userBankAccount.rfc}</p>}
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                        <p className="text-xs">{t('adminRefunds.dialog.noBankAccountWarning')}</p>
                      </div>
                    )}
                  </div>
                )}
                {selectedMethod === 'wallet' && (
                  <div className="flex items-start gap-2 p-3 bg-info/10 border border-info/20 rounded-lg">
                    <Wallet className="w-4 h-4 text-info shrink-0 mt-0.5" />
                    <p className="text-xs">{t('adminRefunds.dialog.walletInfo')}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('adminRefunds.dialog.adminNotesLabel')}</label>
                  <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder={t('adminRefunds.dialog.adminNotesPlaceholder')} rows={2} />
                </div>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setApprovalDialog({ open: false, request: null })} disabled={isProcessing}>{t('adminRefunds.dialog.cancel')}</Button>
              <Button onClick={handleApproveRequest} disabled={isProcessing || !selectedMethod}>
                {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('adminRefunds.dialog.confirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
