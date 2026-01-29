import React, { useState, useMemo } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
} from '@/components/ui/dialog';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  Filter,
  Loader2,
  Receipt,
  Calendar,
  TrendingUp,
  TrendingDown,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type FilterType = 'all' | 'topup' | 'purchase' | 'earning' | 'refund';

export function TransactionHistory() {
  const { t } = useLanguage();
  const { transactions, isLoading } = useWallet();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedTx, setSelectedTx] = useState<typeof transactions[0] | null>(null);

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(tx => tx.type === filterType);
    }

    // Filter by search term
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
        return <Badge variant="outline" className="bg-success/10 text-success border-success/30">Recarga</Badge>;
      case 'purchase':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Compra</Badge>;
      case 'earning':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">Ganancia</Badge>;
      case 'refund':
        return <Badge variant="outline" className="bg-info/10 text-info border-info/30">Reembolso</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="outline" className="text-success">Completado</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-warning">Pendiente</Badge>;
      case 'failed':
        return <Badge variant="destructive">Fallido</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Historial de Transacciones
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
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
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="topup">Recargas</SelectItem>
                  <SelectItem value="purchase">Compras</SelectItem>
                  <SelectItem value="earning">Ganancias</SelectItem>
                  <SelectItem value="refund">Reembolsos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-3 bg-success/10 rounded-lg text-center">
              <TrendingUp className="w-5 h-5 text-success mx-auto mb-1" />
              <p className="text-lg font-bold text-success">+${stats.deposits.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Recargas</p>
            </div>
            <div className="p-3 bg-muted rounded-lg text-center">
              <TrendingDown className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
              <p className="text-lg font-bold">-${stats.purchases.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Compras</p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-lg text-center">
              <TrendingUp className="w-5 h-5 text-amber-600 mx-auto mb-1" />
              <p className="text-lg font-bold text-amber-600">+${stats.earnings.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Ganancias</p>
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
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedTx(tx)}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      tx.amount > 0 ? 'bg-success/20' : 'bg-muted'
                    }`}>
                      {getTypeIcon(tx.type, tx.amount)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{tx.description}</p>
                        {getTypeBadge(tx.type)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          {format(tx.createdAt, 'dd MMM yyyy, HH:mm', { locale: es })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`font-semibold ${tx.amount > 0 ? 'text-success' : 'text-foreground'}`}>
                        {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toLocaleString()}
                      </span>
                      <div className="mt-1">
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
              <p className="text-muted-foreground">No se encontraron transacciones</p>
              {filterType !== 'all' && (
                <Button variant="link" onClick={() => setFilterType('all')}>
                  Ver todas las transacciones
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Detail Dialog */}
      <Dialog open={!!selectedTx} onOpenChange={() => setSelectedTx(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Detalle de Transacción
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
                </div>
              </div>

              <div className="space-y-3 bg-muted/50 rounded-lg p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Descripción</span>
                  <span className="font-medium text-right max-w-[60%]">{selectedTx.description}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fecha</span>
                  <span>{format(selectedTx.createdAt, 'dd MMMM yyyy, HH:mm:ss', { locale: es })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ID de Transacción</span>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
