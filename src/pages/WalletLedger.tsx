import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowDownCircle, ArrowUpCircle, ArrowLeft, Receipt, Wallet as WalletIcon } from 'lucide-react';
import { ReceiptModal, type ReceiptTransaction } from '@/components/wallet/ReceiptModal';

type StatusFilter = 'all' | 'initiated' | 'paid' | 'failed';
type TypeFilter = 'all' | 'topup' | 'purchase' | 'earning' | 'refund';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const statusBadge: Record<string, string> = {
  paid: 'bg-success/10 text-success border-success/20',
  initiated: 'bg-muted text-muted-foreground border-border',
  pending: 'bg-muted text-muted-foreground border-border',
  failed: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function WalletLedger() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { transactions, isLoading } = useWallet();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selectedTx, setSelectedTx] = useState<ReceiptTransaction | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const filtered = useMemo(() => {
    return (transactions ?? [])
      .filter((t: any) => statusFilter === 'all' || t.status === statusFilter)
      .filter((t: any) => typeFilter === 'all' || t.type === typeFilter)
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [transactions, statusFilter, typeFilter]);

  if (!user) return <Navigate to="/login" replace />;

  const openReceipt = (tx: any) => {
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

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-3xl">
        <div className="flex items-center gap-2 mb-4 sm:mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/wallet')} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Wallet
          </Button>
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Movimientos
          </h1>
        </div>

        <Card className="mb-4">
          <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Estado</label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger data-testid="filter-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="initiated">Iniciada</SelectItem>
                  <SelectItem value="paid">Pagada</SelectItem>
                  <SelectItem value="failed">Fallida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
                <SelectTrigger data-testid="filter-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="topup">Recarga</SelectItem>
                  <SelectItem value="purchase">Compra</SelectItem>
                  <SelectItem value="earning">Ganancia</SelectItem>
                  <SelectItem value="refund">Reembolso</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Cargando…</p>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <WalletIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No hay movimientos con estos filtros.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2" data-testid="ledger-list">
            {filtered.map((tx: any) => {
              const positive = Number(tx.amount) >= 0;
              const Icon = positive ? ArrowUpCircle : ArrowDownCircle;
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
                        {positive ? '+' : ''}${Math.abs(Number(tx.amount)).toLocaleString('es-MX')}
                      </span>
                      <Badge className={statusBadge[tx.status ?? 'paid'] ?? statusBadge.paid} variant="outline">
                        {tx.status ?? 'paid'}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openReceipt(tx)}
                      data-testid={`view-receipt-${tx.id}`}
                    >
                      Recibo
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
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
