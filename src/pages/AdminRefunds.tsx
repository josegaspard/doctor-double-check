import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  ArrowLeft,
  RefreshCcw,
  Search,
  Loader2,
  User,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

interface Transaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
  metadata: any;
  user_name?: string;
  user_email?: string;
  user_avatar?: string;
}

export default function AdminRefunds() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language } = useLanguage();
  const locale = language === 'es' ? es : enUS;
  
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refundHistory, setRefundHistory] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('eligible');

  useEffect(() => {
    if (role && role !== 'admin') {
      navigate('/');
      toast.error(language === 'es' ? 'Acceso denegado' : 'Access denied');
      return;
    }
    loadTransactions();
  }, [role, navigate, language]);

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      // Fetch eligible transactions (purchases and topups that are paid and not yet refunded)
      const { data: txData } = await supabase
        .from('wallet_transactions')
        .select('*')
        .in('type', ['purchase', 'topup'])
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .limit(200);

      // Fetch refund history
      const { data: refundData } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('type', 'refund')
        .order('created_at', { ascending: false })
        .limit(200);

      const allUserIds = new Set<string>();
      txData?.forEach(tx => allUserIds.add(tx.user_id));
      refundData?.forEach(tx => allUserIds.add(tx.user_id));

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .in('id', [...allUserIds]);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const mapTx = (tx: any): Transaction => ({
        ...tx,
        user_name: profileMap.get(tx.user_id)?.name,
        user_email: profileMap.get(tx.user_id)?.email,
        user_avatar: profileMap.get(tx.user_id)?.avatar_url,
      });

      setTransactions((txData || []).map(mapTx));
      setRefundHistory((refundData || []).map(mapTx));
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error(language === 'es' ? 'Error al cargar transacciones' : 'Error loading transactions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenRefund = (tx: Transaction) => {
    setSelectedTx(tx);
    setRefundAmount(Math.abs(tx.amount).toString());
    setRefundReason('');
  };

  const handleProcessRefund = async () => {
    if (!selectedTx) return;
    
    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(language === 'es' ? 'Monto inválido' : 'Invalid amount');
      return;
    }

    if (amount > Math.abs(selectedTx.amount)) {
      toast.error(language === 'es' ? 'El monto no puede exceder la transacción original' : 'Amount cannot exceed original transaction');
      return;
    }

    setIsProcessing(true);
    try {
      const metadata = selectedTx.metadata as Record<string, any> | null;
      const { data, error } = await supabase.functions.invoke('admin-refund', {
        body: {
          transaction_id: selectedTx.id,
          user_id: selectedTx.user_id,
          amount: amount,
          reason: refundReason,
          stripe_payment_intent_id: metadata?.stripe_session_id || null,
        }
      });

      if (error) throw error;

      toast.success(language === 'es' ? 'Reembolso procesado exitosamente' : 'Refund processed successfully');
      setSelectedTx(null);
      loadTransactions();
    } catch (error: any) {
      console.error('Error processing refund:', error);
      toast.error(error.message || (language === 'es' ? 'Error al procesar reembolso' : 'Error processing refund'));
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      tx.user_name?.toLowerCase().includes(query) ||
      tx.user_email?.toLowerCase().includes(query) ||
      tx.description.toLowerCase().includes(query) ||
      tx.id.toLowerCase().includes(query)
    );
  });

  const filteredRefunds = refundHistory.filter(tx => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      tx.user_name?.toLowerCase().includes(query) ||
      tx.user_email?.toLowerCase().includes(query) ||
      tx.description.toLowerCase().includes(query)
    );
  });

  const totalRefunded = refundHistory.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin')}
          className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          {language === 'es' ? 'Volver al panel' : 'Back to dashboard'}
        </Button>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
              <RefreshCcw className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">
                {language === 'es' ? 'Gestión de Reembolsos' : 'Refund Management'}
              </h1>
              <p className="text-muted-foreground">
                {language === 'es' 
                  ? 'Procesa reembolsos y acredita saldo a usuarios' 
                  : 'Process refunds and credit user balances'}
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><DollarSign className="w-5 h-5 text-primary" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">{language === 'es' ? 'Transacciones elegibles' : 'Eligible transactions'}</p>
                  <p className="text-xl font-bold">{transactions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10"><RefreshCcw className="w-5 h-5 text-destructive" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">{language === 'es' ? 'Reembolsos procesados' : 'Refunds processed'}</p>
                  <p className="text-xl font-bold">{refundHistory.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10"><DollarSign className="w-5 h-5 text-warning" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">{language === 'es' ? 'Total reembolsado' : 'Total refunded'}</p>
                  <p className="text-xl font-bold">${totalRefunded.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={language === 'es' ? 'Buscar por usuario, email o descripción...' : 'Search by user, email or description...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="eligible" className="gap-2">
                <DollarSign className="w-4 h-4" />
                {language === 'es' ? 'Elegibles' : 'Eligible'}
                <Badge variant="secondary" className="ml-1">{transactions.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="w-4 h-4" />
                {language === 'es' ? 'Historial' : 'History'}
                {refundHistory.length > 0 && <Badge variant="outline" className="ml-1">{refundHistory.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="eligible">
              {filteredTransactions.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8 text-muted-foreground">
                    {language === 'es' ? 'No hay transacciones elegibles' : 'No eligible transactions'}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredTransactions.map((tx) => (
                    <div 
                      key={tx.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarImage src={tx.user_avatar || undefined} />
                          <AvatarFallback><User className="w-4 h-4" /></AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{tx.user_name || 'Usuario'}</p>
                          <p className="text-sm text-muted-foreground">{tx.user_email}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(tx.created_at), 'dd MMM yyyy, HH:mm', { locale })}
                            <Badge variant={tx.type === 'topup' ? 'verified' : 'secondary'} className="text-xs">
                              {tx.type === 'topup' ? (language === 'es' ? 'Recarga' : 'Top-up') : (language === 'es' ? 'Compra' : 'Purchase')}
                            </Badge>
                          </div>
                          <p className="text-xs mt-1 truncate max-w-[300px]">{tx.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className={`font-bold ${tx.amount > 0 ? 'text-success' : 'text-foreground'}`}>
                            ${Math.abs(tx.amount).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenRefund(tx)}
                        >
                          <RefreshCcw className="w-4 h-4 mr-2" />
                          {language === 'es' ? 'Reembolsar' : 'Refund'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history">
              {filteredRefunds.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8 text-muted-foreground">
                    {language === 'es' ? 'No hay reembolsos registrados' : 'No refunds recorded'}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredRefunds.map((tx) => {
                    const meta = tx.metadata as Record<string, any> | null;
                    return (
                      <div 
                        key={tx.id} 
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarImage src={tx.user_avatar || undefined} />
                            <AvatarFallback><User className="w-4 h-4" /></AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{tx.user_name || 'Usuario'}</p>
                            <p className="text-sm text-muted-foreground">{tx.user_email}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(tx.created_at), 'dd MMM yyyy, HH:mm', { locale })}
                              {meta?.stripe_refund_id && (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Stripe
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs mt-1 truncate max-w-[300px] text-muted-foreground">{tx.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-success">+${Math.abs(tx.amount).toLocaleString()}</p>
                          <Badge variant="verified" className="text-xs gap-1">
                            <CheckCircle className="w-3 h-3" />
                            {language === 'es' ? 'Procesado' : 'Processed'}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Refund Dialog */}
        <Dialog open={!!selectedTx} onOpenChange={() => setSelectedTx(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {language === 'es' ? 'Procesar Reembolso' : 'Process Refund'}
              </DialogTitle>
              <DialogDescription>
                {language === 'es' 
                  ? 'El monto se acreditará a la billetera del usuario'
                  : 'The amount will be credited to the user\'s wallet'}
              </DialogDescription>
            </DialogHeader>

            {selectedTx && (
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={selectedTx.user_avatar || undefined} />
                      <AvatarFallback><User className="w-4 h-4" /></AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{selectedTx.user_name}</p>
                      <p className="text-sm text-muted-foreground">{selectedTx.user_email}</p>
                    </div>
                  </div>
                  <p className="text-sm">{selectedTx.description}</p>
                  <p className="text-lg font-bold mt-2">${Math.abs(selectedTx.amount).toLocaleString()}</p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">
                    {language === 'es' ? 'Monto a reembolsar' : 'Refund amount'}
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      className="pl-10"
                      placeholder="0.00"
                      max={Math.abs(selectedTx.amount)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === 'es' ? `Máximo: $${Math.abs(selectedTx.amount).toLocaleString()}` : `Max: $${Math.abs(selectedTx.amount).toLocaleString()}`}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">
                    {language === 'es' ? 'Motivo del reembolso' : 'Refund reason'}
                  </label>
                  <Textarea
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder={language === 'es' ? 'Ej: Servicio no prestado, error de cobro...' : 'E.g.: Service not provided, billing error...'}
                    rows={3}
                  />
                </div>

                <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground">
                    {language === 'es' 
                      ? 'Esta acción no se puede deshacer. El saldo se acreditará inmediatamente a la billetera del usuario y se le notificará.'
                      : 'This action cannot be undone. The balance will be credited immediately to the user\'s wallet and they will be notified.'}
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedTx(null)}>
                {language === 'es' ? 'Cancelar' : 'Cancel'}
              </Button>
              <Button 
                onClick={handleProcessRefund} 
                disabled={isProcessing}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isProcessing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{language === 'es' ? 'Procesando...' : 'Processing...'}</>
                ) : (
                  <><RefreshCcw className="w-4 h-4 mr-2" />{language === 'es' ? 'Procesar Reembolso' : 'Process Refund'}</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
