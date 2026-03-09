import React, { useState, useMemo, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  Filter,
  Loader2,
  Receipt,
  TrendingUp,
  TrendingDown,
  FileText,
  RefreshCcw,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { toast } from 'sonner';

/** Translate DB-stored Spanish descriptions to English */
function translateDescription(desc: string, lang: string): string {
  if (lang === 'es') return desc;
  // Pattern-based translation for known DB descriptions
  const patterns: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
    [/^Consulta médica por chat$/, 'Medical chat consultation'],
    [/^Ganancia por consulta médica$/, 'Medical consultation earning'],
    [/^Recarga via Stripe - (.+)$/, (m) => `Top-up via Stripe - ${m[1]}`],
    [/^Recarga de saldo$/, 'Balance top-up'],
    [/^Expansión de almacenamiento: (.+)$/, (m) => `Storage expansion: ${m[1]}`],
    [/^Grabación: (.+)$/, (m) => `Recording: ${m[1]}`],
    [/^Solicitud aprobada: (.+)$/, (m) => `Approved request: ${m[1]}`],
    [/^Segunda Opinión con (.+)$/, (m) => `Second Opinion with ${m[1]}`],
    [/^Bono por código de referido$/, 'Referral code bonus'],
    [/^Bono por referido exitoso$/, 'Successful referral bonus'],
    [/^Expansión de almacenamiento: (.+?) \(Stripe\)$/, (m) => `Storage expansion: ${m[1]} (Stripe)`],
  ];
  for (const [re, replacement] of patterns) {
    const match = desc.match(re);
    if (match) {
      return typeof replacement === 'function' ? replacement(match) : replacement;
    }
  }
  return desc;
}

type FilterType = 'all' | 'topup' | 'purchase' | 'earning' | 'refund';

export function TransactionHistory() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const dateLocale = language === 'es' ? es : enUS;
  const { transactions, isLoading } = useWallet();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedTx, setSelectedTx] = useState<typeof transactions[0] | null>(null);

  // Refund request state
  const [refundDialog, setRefundDialog] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);
  const [pendingRefundTxIds, setPendingRefundTxIds] = useState<Set<string>>(new Set());

  // Load existing refund requests for current user
  useEffect(() => {
    const loadRefundRequests = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('refund_requests' as any)
        .select('transaction_id, status')
        .eq('user_id', user.id)
        .in('status', ['pending', 'approved']);
      if (data) {
        setPendingRefundTxIds(new Set((data as any[]).map((r: any) => r.transaction_id)));
      }
    };
    loadRefundRequests();
  }, [user?.id]);

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];
    if (filterType !== 'all') {
      filtered = filtered.filter(tx => tx.type === filterType);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(tx => 
        tx.description.toLowerCase().includes(term) ||
        tx.id.toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [transactions, filterType, searchTerm]);

  const stats = useMemo(() => {
    const deposits = transactions.filter(t => t.type === 'topup').reduce((sum, t) => sum + t.amount, 0);
    const purchases = transactions.filter(t => t.type === 'purchase').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const earnings = transactions.filter(t => t.type === 'earning').reduce((sum, t) => sum + t.amount, 0);
    return { deposits, purchases, earnings };
  }, [transactions]);

  const getTypeIcon = (type: string, amount: number) => {
    if (amount > 0) {
      return <ArrowDownLeft className="w-5 h-5 text-success" />;
    }
    return <ArrowUpRight className="w-5 h-5 text-muted-foreground" />;
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'topup':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/30">{t('transactions.topup')}</Badge>;
      case 'purchase':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">{t('transactions.purchase')}</Badge>;
      case 'earning':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">{t('transactions.earning')}</Badge>;
      case 'refund':
        return <Badge variant="outline" className="bg-info/10 text-info border-info/30">{t('transactions.refund')}</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="outline" className="text-success">{t('transactions.completed')}</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-warning">{t('transactions.pending')}</Badge>;
      case 'failed':
        return <Badge variant="destructive">{t('transactions.failed')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const canRequestRefund = (tx: typeof transactions[0]) => {
    return (tx.type === 'purchase' || tx.type === 'topup') && 
           tx.status === 'paid' && 
           !pendingRefundTxIds.has(tx.id);
  };

  const handleRequestRefund = async () => {
    if (!selectedTx || !user?.id || !refundReason.trim()) return;
    setIsSubmittingRefund(true);
    try {
      const { error } = await supabase.from('refund_requests' as any).insert({
        user_id: user.id,
        transaction_id: selectedTx.id,
        amount: Math.abs(selectedTx.amount),
        reason: refundReason.trim(),
      } as any);
      if (error) throw error;
      setPendingRefundTxIds(prev => new Set([...prev, selectedTx.id]));
      toast.success(t('wallet.refundSent'));
      setRefundDialog(false);
      setRefundReason('');
    } catch (error: any) {
      toast.error(error.message || t('wallet.refundError'));
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              {t('transactions.title')}
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('wallet.searchTransactions')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
                <SelectTrigger className="w-32">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  <SelectItem value="topup">{t('transactions.topups')}</SelectItem>
                  <SelectItem value="purchase">{t('transactions.purchases')}</SelectItem>
                  <SelectItem value="earning">{t('transactions.earnings')}</SelectItem>
                  <SelectItem value="refund">{t('transactions.refunds')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
            <div className="p-2 sm:p-3 bg-success/10 rounded-lg text-center">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-success mx-auto mb-0.5 sm:mb-1" />
              <p className="text-[11px] sm:text-lg font-bold text-success">+${stats.deposits.toLocaleString()}</p>
              <p className="text-[9px] sm:text-xs text-muted-foreground">{t('transactions.topups')}</p>
            </div>
            <div className="p-2 sm:p-3 bg-muted rounded-lg text-center">
              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground mx-auto mb-0.5 sm:mb-1" />
              <p className="text-[11px] sm:text-lg font-bold">-${stats.purchases.toLocaleString()}</p>
              <p className="text-[9px] sm:text-xs text-muted-foreground">{t('transactions.purchases')}</p>
            </div>
            <div className="p-2 sm:p-3 bg-amber-500/10 rounded-lg text-center">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 mx-auto mb-0.5 sm:mb-1" />
              <p className="text-[11px] sm:text-lg font-bold text-amber-600">+${stats.earnings.toLocaleString()}</p>
              <p className="text-[9px] sm:text-xs text-muted-foreground">{t('transactions.earnings')}</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTransactions.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredTransactions.map(tx => (
                  <div 
                    key={tx.id} 
                    className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedTx(tx)}
                  >
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${
                      tx.amount > 0 ? 'bg-success/20' : 'bg-muted'
                    }`}>
                      {getTypeIcon(tx.type, tx.amount)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs sm:text-sm truncate">{translateDescription(tx.description, language)}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] sm:text-xs text-muted-foreground">
                          {format(tx.createdAt, 'dd MMM, HH:mm', { locale: dateLocale })}
                        </span>
                        <span className="hidden sm:inline">{getTypeBadge(tx.type)}</span>
                        {pendingRefundTxIds.has(tx.id) && (
                          <Badge variant="warning" className="text-[10px] px-1.5 py-0">{t('wallet.refundRequested')}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`font-semibold text-sm sm:text-base ${tx.amount > 0 ? 'text-success' : 'text-foreground'}`}>
                        {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toLocaleString()}
                      </span>
                      <div className="mt-0.5">
                        {getStatusBadge(tx.status)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{t('transactions.noTransactions')}</p>
              {filterType !== 'all' && (
                <Button variant="link" onClick={() => setFilterType('all')}>
                  {t('transactions.viewAll')}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Detail Dialog */}
      <Dialog open={!!selectedTx && !refundDialog} onOpenChange={() => setSelectedTx(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              {t('transactions.detail')}
            </DialogTitle>
          </DialogHeader>

          {selectedTx && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${
                  selectedTx.amount > 0 ? 'bg-success/20' : 'bg-muted'
                }`}>
                  {getTypeIcon(selectedTx.type, selectedTx.amount)}
                </div>
                <p className={`text-3xl font-bold ${selectedTx.amount > 0 ? 'text-success' : ''}`}>
                  {selectedTx.amount > 0 ? '+' : ''}${Math.abs(selectedTx.amount).toLocaleString()} MXN
                </p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  {getTypeBadge(selectedTx.type)}
                  {getStatusBadge(selectedTx.status)}
                  {pendingRefundTxIds.has(selectedTx.id) && (
                    <Badge variant="warning">{t('wallet.refundRequested')}</Badge>
                  )}
                </div>
              </div>

              <div className="space-y-3 bg-muted/50 rounded-lg p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('transactions.description')}</span>
                  <span className="font-medium text-right max-w-[60%]">{selectedTx.description}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('transactions.date')}</span>
                  <span>{format(selectedTx.createdAt, 'dd MMMM yyyy, HH:mm:ss', { locale: dateLocale })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('transactions.transactionId')}</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{selectedTx.id.slice(0, 8)}...</code>
                </div>
                {selectedTx.metadata && Object.keys(selectedTx.metadata).length > 0 && (
                  <>
                    <div className="border-t my-2" />
                    <p className="text-xs text-muted-foreground font-medium">Metadata</p>
                    {Object.entries(selectedTx.metadata).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{key}</span>
                        <span className="font-mono">{String(value).slice(0, 20)}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Refund Request Button */}
              {canRequestRefund(selectedTx) && (
                <Button
                  variant="outline"
                  className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => setRefundDialog(true)}
                >
                   <RefreshCcw className="w-4 h-4" />
                   {t('wallet.requestRefund')}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refund Request Dialog */}
      <Dialog open={refundDialog} onOpenChange={(open) => { if (!open) setRefundDialog(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCcw className="w-5 h-5 text-destructive" />
              {t('wallet.refundTitle')}
            </DialogTitle>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p className="text-muted-foreground">{selectedTx.description}</p>
                <p className="text-lg font-bold mt-1">${Math.abs(selectedTx.amount).toLocaleString()} MXN</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('wallet.refundReason')}</label>
                <Textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder={t('wallet.refundReasonPlaceholder')}
                  rows={3}
                />
              </div>
              <div className="flex items-start gap-2 p-3 bg-info/10 border border-info/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-info shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>{t('wallet.refundCardNote')}</p>
                  <p>{t('wallet.refundBankNote')}</p>
                  <p>{t('wallet.refundAdminNote')}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog(false)}>{t('common.cancel')}</Button>
            <Button 
              onClick={handleRequestRefund}
              disabled={isSubmittingRefund || !refundReason.trim()}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isSubmittingRefund ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
              {t('wallet.submitRefund')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
