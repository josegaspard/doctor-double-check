import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowDownCircle, ArrowUpCircle, ArrowLeft, Receipt, Wallet as WalletIcon, Loader2 } from 'lucide-react';
import { ReceiptModal, type ReceiptTransaction } from '@/components/wallet/ReceiptModal';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';

type StatusFilter = 'all' | 'initiated' | 'paid' | 'failed';
type TypeFilter = 'all' | 'topup' | 'purchase' | 'earning' | 'refund';

const PAGE_SIZE = 50;

interface LedgerRow {
  id: string;
  created_at: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  metadata: Record<string, any> | null;
}

const statusBadge: Record<string, string> = {
  paid: 'bg-success/10 text-success border-success/20',
  initiated: 'bg-muted text-muted-foreground border-border',
  pending: 'bg-muted text-muted-foreground border-border',
  failed: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function WalletLedger() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selectedTx, setSelectedTx] = useState<ReceiptTransaction | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const formatDate = useCallback(
    (iso: string) => new Date(iso).toLocaleString(language === 'en' ? 'en-US' : 'es-MX', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
    [language]
  );

  const fetchPage = useCallback(
    async (nextPage: number, replace = false) => {
      if (!user?.id) return;
      setIsLoading(true);
      const from = nextPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      try {
        const { data, error } = await supabase
          .from('wallet_transactions')
          .select('id, created_at, type, amount, status, description, metadata')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(from, to);
        if (error) throw error;
        const newRows = (data ?? []) as LedgerRow[];
        setHasMore(newRows.length === PAGE_SIZE);
        setRows((prev) => (replace ? newRows : [...prev, ...newRows]));
      } catch (err) {
        logger.error('[WalletLedger] fetch failed', err);
      } finally {
        setIsLoading(false);
      }
    },
    [user?.id]
  );

  useEffect(() => {
    setRows([]);
    setPage(0);
    setHasMore(true);
    fetchPage(0, true);
  }, [fetchPage]);

  const filtered = useMemo(() => {
    return rows
      .filter((t) => statusFilter === 'all' || t.status === statusFilter)
      .filter((t) => typeFilter === 'all' || t.type === typeFilter);
  }, [rows, statusFilter, typeFilter]);

  if (!user) return <Navigate to="/login" replace />;

  const openReceipt = (tx: LedgerRow) => {
    setSelectedTx({
      id: tx.id,
      created_at: tx.created_at,
      type: tx.type,
      amount: Number(tx.amount),
      status: tx.status ?? 'paid',
      description: tx.description,
      metadata: tx.metadata,
    });
    setReceiptOpen(true);
  };

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPage(next);
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-3xl">
        <div className="flex items-center gap-2 mb-4 sm:mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/wallet')} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Wallet
          </Button>
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            {t('walletLedger.title')}
          </h1>
        </div>

        <Card className="mb-4">
          <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">{t('receipt.status')}</label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger data-testid="filter-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('walletLedger.filterAll')}</SelectItem>
                  <SelectItem value="initiated">{t('walletLedger.statusPending')}</SelectItem>
                  <SelectItem value="paid">{t('walletLedger.statusPaid')}</SelectItem>
                  <SelectItem value="failed">{t('walletLedger.statusFailed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">{t('receipt.type')}</label>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
                <SelectTrigger data-testid="filter-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('walletLedger.filterAll')}</SelectItem>
                  <SelectItem value="topup">{t('walletLedger.filterTopup')}</SelectItem>
                  <SelectItem value="purchase">{t('walletLedger.filterPurchase')}</SelectItem>
                  <SelectItem value="earning">{t('walletLedger.filterEarning')}</SelectItem>
                  <SelectItem value="refund">{t('walletLedger.filterRefund')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isLoading && rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{t('walletLedger.loading')}</p>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <WalletIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>{t('walletLedger.empty')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2" data-testid="ledger-list">
            {filtered.map((tx) => {
              const positive = Number(tx.amount) >= 0;
              const Icon = positive ? ArrowUpCircle : ArrowDownCircle;
              const statusKey = tx.status ?? 'paid';
              const statusLabel =
                statusKey === 'paid' ? t('walletLedger.statusPaid')
                : statusKey === 'failed' ? t('walletLedger.statusFailed')
                : t('walletLedger.statusPending');
              return (
                <Card key={tx.id} data-testid={`ledger-row-${tx.id}`}>
                  <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${positive ? 'bg-success/10' : 'bg-destructive/10'}`}>
                      <Icon className={`w-5 h-5 ${positive ? 'text-success' : 'text-destructive'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {tx.description ?? tx.type}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-sm font-bold ${positive ? 'text-success' : 'text-destructive'}`}>
                        {positive ? '+' : ''}${Math.abs(Number(tx.amount)).toLocaleString(language === 'en' ? 'en-US' : 'es-MX')}
                      </span>
                      <Badge className={statusBadge[statusKey] ?? statusBadge.paid} variant="outline">
                        {statusLabel}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openReceipt(tx)}
                      data-testid={`view-receipt-${tx.id}`}
                    >
                      {t('walletLedger.viewReceipt')}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}

            {hasMore && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={loadMore}
                  disabled={isLoading}
                  data-testid="ledger-load-more"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('walletLedger.loading').replace('…', '')}
                  {!isLoading && '...'}
                </Button>
              </div>
            )}
          </div>
        )}

        <ReceiptModal
          open={receiptOpen}
          onOpenChange={setReceiptOpen}
          transaction={selectedTx}
        />
      </div>
    </MainLayout>
  );
}
