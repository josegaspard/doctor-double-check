import React, { useState, useEffect } from 'react';
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft, RefreshCcw, Search, Loader2, User, DollarSign, Calendar,
  AlertCircle, CheckCircle, History, Clock, XCircle, MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

interface Transaction {
  id: string; user_id: string; type: string; amount: number; description: string;
  status: string; created_at: string; metadata: any;
  user_name?: string; user_email?: string; user_avatar?: string;
}

interface RefundRequest {
  id: string; user_id: string; transaction_id: string; amount: number; reason: string;
  status: string; admin_notes: string | null; created_at: string;
  reviewed_at: string | null; reviewed_by: string | null;
  user_name?: string; user_email?: string; user_avatar?: string;
  tx_description?: string;
}

export default function AdminRefunds() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { language } = useLanguage();
  const locale = language === 'es' ? es : enUS;
  
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refundHistory, setRefundHistory] = useState<Transaction[]>([]);
  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('requests');

  // Review request dialog
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; request: RefundRequest | null; action: 'approve' | 'reject' | null }>({ open: false, request: null, action: null });
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    if (role && role !== 'admin') { navigate('/'); return; }
    loadTransactions();
  }, [role]);

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      const [{ data: txData }, { data: refundData }, { data: requestsData }] = await Promise.all([
        supabase.from('wallet_transactions').select('*').in('type', ['purchase', 'topup']).eq('status', 'paid').order('created_at', { ascending: false }).limit(200),
        supabase.from('wallet_transactions').select('*').eq('type', 'refund').order('created_at', { ascending: false }).limit(200),
        supabase.from('refund_requests' as any).select('*').order('created_at', { ascending: false }).limit(200),
      ]);

      const allUserIds = new Set<string>();
      txData?.forEach(tx => allUserIds.add(tx.user_id));
      refundData?.forEach(tx => allUserIds.add(tx.user_id));
      (requestsData as any[])?.forEach((r: any) => allUserIds.add(r.user_id));

      const { data: profiles } = await supabase.from('profiles').select('id, name, email, avatar_url').in('id', [...allUserIds]);
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const mapTx = (tx: any): Transaction => ({
        ...tx, user_name: profileMap.get(tx.user_id)?.name, user_email: profileMap.get(tx.user_id)?.email, user_avatar: profileMap.get(tx.user_id)?.avatar_url,
      });

      setTransactions((txData || []).map(mapTx));
      setRefundHistory((refundData || []).map(mapTx));

      // Map refund requests with user info and tx description
      const txMap = new Map((txData || []).map(t => [t.id, t.description]));
      setRefundRequests(((requestsData || []) as any[]).map((r: any) => ({
        ...r,
        user_name: profileMap.get(r.user_id)?.name,
        user_email: profileMap.get(r.user_id)?.email,
        user_avatar: profileMap.get(r.user_id)?.avatar_url,
        tx_description: txMap.get(r.transaction_id) || '',
      })));
    } catch (error) {
      console.error('Error loading transactions:', error);
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
    if (isNaN(amount) || amount <= 0 || amount > Math.abs(selectedTx.amount)) {
      toast.error('Monto inválido');
      return;
    }
    setIsProcessing(true);
    try {
      const metadata = selectedTx.metadata as Record<string, any> | null;
      const { error } = await supabase.functions.invoke('admin-refund', {
        body: { transaction_id: selectedTx.id, user_id: selectedTx.user_id, amount, reason: refundReason, stripe_payment_intent_id: metadata?.stripe_session_id || null },
      });
      if (error) throw error;
      toast.success('Reembolso procesado');
      setSelectedTx(null);
      loadTransactions();
    } catch (error: any) {
      toast.error(error.message || 'Error al procesar reembolso');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReviewRequest = async () => {
    if (!reviewDialog.request || !reviewDialog.action) return;
    setIsProcessing(true);
    try {
      const req = reviewDialog.request;
      if (reviewDialog.action === 'approve') {
        // Process refund via edge function
        const { error } = await supabase.functions.invoke('admin-refund', {
          body: { transaction_id: req.transaction_id, user_id: req.user_id, amount: req.amount, reason: `Solicitud aprobada: ${req.reason}` },
        });
        if (error) throw error;
      }

      // Update request status
      await supabase.from('refund_requests' as any).update({
        status: reviewDialog.action === 'approve' ? 'processed' : 'rejected',
        admin_notes: adminNotes || null,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      } as any).eq('id', req.id);

      // Notify user
      await supabase.from('notifications').insert({
        user_id: req.user_id,
        type: 'system' as any,
        title: reviewDialog.action === 'approve' ? '✅ Reembolso aprobado' : '❌ Solicitud de reembolso rechazada',
        message: reviewDialog.action === 'approve'
          ? `Tu solicitud de reembolso por $${req.amount.toLocaleString()} MXN ha sido aprobada y el saldo fue acreditado.`
          : `Tu solicitud de reembolso fue rechazada.${adminNotes ? ` Motivo: ${adminNotes}` : ''}`,
        data: { refund_request_id: req.id },
      });

      toast.success(reviewDialog.action === 'approve' ? 'Solicitud aprobada y reembolso procesado' : 'Solicitud rechazada');
      setReviewDialog({ open: false, request: null, action: null });
      setAdminNotes('');
      loadTransactions();
    } catch (error: any) {
      toast.error(error.message || 'Error');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return tx.user_name?.toLowerCase().includes(q) || tx.user_email?.toLowerCase().includes(q) || tx.description.toLowerCase().includes(q);
  });

  const filteredRefunds = refundHistory.filter(tx => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return tx.user_name?.toLowerCase().includes(q) || tx.user_email?.toLowerCase().includes(q) || tx.description.toLowerCase().includes(q);
  });

  const pendingRequests = refundRequests.filter(r => r.status === 'pending');
  const processedRequests = refundRequests.filter(r => r.status !== 'pending');
  const totalRefunded = refundHistory.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="mb-4 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {language === 'es' ? 'Volver al panel' : 'Back'}
        </Button>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
              <RefreshCcw className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold">{language === 'es' ? 'Gestión de Reembolsos' : 'Refund Management'}</h1>
              <p className="text-muted-foreground">{language === 'es' ? 'Solicitudes de usuarios y reembolsos manuales' : 'User requests and manual refunds'}</p>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card><CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10"><MessageSquare className="w-5 h-5 text-warning" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Solicitudes pendientes</p>
                <p className="text-xl font-bold">{pendingRequests.length}</p>
              </div>
            </div>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><DollarSign className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Transacciones elegibles</p>
                <p className="text-xl font-bold">{transactions.length}</p>
              </div>
            </div>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10"><RefreshCcw className="w-5 h-5 text-destructive" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Reembolsos procesados</p>
                <p className="text-xl font-bold">{refundHistory.length}</p>
              </div>
            </div>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10"><DollarSign className="w-5 h-5 text-success" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total reembolsado</p>
                <p className="text-xl font-bold">${totalRefunded.toLocaleString()}</p>
              </div>
            </div>
          </CardContent></Card>
        </div>

        {/* Search */}
        <Card className="mb-6"><CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por usuario, email o descripción..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        </CardContent></Card>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 flex-wrap">
              <TabsTrigger value="requests" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Solicitudes
                {pendingRequests.length > 0 && <Badge variant="destructive" className="ml-1">{pendingRequests.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="eligible" className="gap-2">
                <DollarSign className="w-4 h-4" />
                Elegibles
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="w-4 h-4" />
                Historial
              </TabsTrigger>
            </TabsList>

            {/* User Refund Requests Tab */}
            <TabsContent value="requests">
              {pendingRequests.length === 0 && processedRequests.length === 0 ? (
                <Card><CardContent className="text-center py-8 text-muted-foreground">No hay solicitudes de reembolso</CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.length > 0 && (
                    <>
                      <h3 className="text-sm font-semibold text-muted-foreground">Pendientes ({pendingRequests.length})</h3>
                      {pendingRequests.map((req) => (
                        <Card key={req.id} className="border-l-4 border-l-warning">
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Avatar><AvatarImage src={req.user_avatar || undefined} /><AvatarFallback><User className="w-4 h-4" /></AvatarFallback></Avatar>
                                <div className="min-w-0">
                                  <p className="font-medium">{req.user_name || 'Usuario'}</p>
                                  <p className="text-xs text-muted-foreground">{req.user_email}</p>
                                  <p className="text-sm mt-1 font-semibold">${req.amount.toLocaleString()} MXN</p>
                                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {format(new Date(req.created_at), 'dd MMM yyyy, HH:mm', { locale })}
                                  </p>
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground mb-1">Motivo:</p>
                                <p className="text-sm bg-muted/50 p-2 rounded">{req.reason}</p>
                                {req.tx_description && <p className="text-xs text-muted-foreground mt-1">Transacción: {req.tx_description}</p>}
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <Button size="sm" onClick={() => { setReviewDialog({ open: true, request: req, action: 'approve' }); setAdminNotes(''); }}>
                                  <CheckCircle className="w-4 h-4 mr-1" />Aprobar
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => { setReviewDialog({ open: true, request: req, action: 'reject' }); setAdminNotes(''); }}>
                                  <XCircle className="w-4 h-4 mr-1" />Rechazar
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  )}
                  {processedRequests.length > 0 && (
                    <>
                      <h3 className="text-sm font-semibold text-muted-foreground mt-6">Procesadas ({processedRequests.length})</h3>
                      {processedRequests.slice(0, 20).map((req) => (
                        <Card key={req.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                              <Avatar><AvatarImage src={req.user_avatar || undefined} /><AvatarFallback><User className="w-4 h-4" /></AvatarFallback></Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium">{req.user_name}</p>
                                <p className="text-xs text-muted-foreground">{req.reason}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold">${req.amount.toLocaleString()}</p>
                                {req.status === 'processed' ? (
                                  <Badge variant="verified" className="gap-1"><CheckCircle className="w-3 h-3" />Aprobado</Badge>
                                ) : (
                                  <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Rechazado</Badge>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Eligible Tab */}
            <TabsContent value="eligible">
              {filteredTransactions.length === 0 ? (
                <Card><CardContent className="text-center py-8 text-muted-foreground">No hay transacciones elegibles</CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {filteredTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <Avatar><AvatarImage src={tx.user_avatar || undefined} /><AvatarFallback><User className="w-4 h-4" /></AvatarFallback></Avatar>
                        <div>
                          <p className="font-medium">{tx.user_name || 'Usuario'}</p>
                          <p className="text-sm text-muted-foreground">{tx.user_email}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(tx.created_at), 'dd MMM yyyy, HH:mm', { locale })}
                            <Badge variant={tx.type === 'topup' ? 'verified' : 'secondary'} className="text-xs">
                              {tx.type === 'topup' ? 'Recarga' : 'Compra'}
                            </Badge>
                          </div>
                          <p className="text-xs mt-1 truncate max-w-[300px]">{tx.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className={`font-bold ${tx.amount > 0 ? 'text-success' : ''}`}>${Math.abs(tx.amount).toLocaleString()}</p>
                        <Button variant="outline" size="sm" onClick={() => handleOpenRefund(tx)}>
                          <RefreshCcw className="w-4 h-4 mr-2" />Reembolsar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history">
              {filteredRefunds.length === 0 ? (
                <Card><CardContent className="text-center py-8 text-muted-foreground">No hay reembolsos registrados</CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {filteredRefunds.map((tx) => {
                    const meta = tx.metadata as Record<string, any> | null;
                    return (
                      <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <Avatar><AvatarImage src={tx.user_avatar || undefined} /><AvatarFallback><User className="w-4 h-4" /></AvatarFallback></Avatar>
                          <div>
                            <p className="font-medium">{tx.user_name || 'Usuario'}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(tx.created_at), 'dd MMM yyyy, HH:mm', { locale })}
                              {meta?.stripe_refund_id && <Badge variant="outline" className="text-xs gap-1"><CheckCircle className="w-3 h-3" />Stripe</Badge>}
                            </div>
                            <p className="text-xs mt-1 truncate max-w-[300px] text-muted-foreground">{tx.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-success">+${Math.abs(tx.amount).toLocaleString()}</p>
                          <Badge variant="verified" className="text-xs gap-1"><CheckCircle className="w-3 h-3" />Procesado</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Admin Direct Refund Dialog */}
        <Dialog open={!!selectedTx} onOpenChange={() => setSelectedTx(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Procesar Reembolso</DialogTitle>
              <DialogDescription>El monto se acreditará a la billetera del usuario</DialogDescription>
            </DialogHeader>
            {selectedTx && (
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar className="w-10 h-10"><AvatarImage src={selectedTx.user_avatar || undefined} /><AvatarFallback><User className="w-4 h-4" /></AvatarFallback></Avatar>
                    <div><p className="font-medium">{selectedTx.user_name}</p><p className="text-sm text-muted-foreground">{selectedTx.user_email}</p></div>
                  </div>
                  <p className="text-sm">{selectedTx.description}</p>
                  <p className="text-lg font-bold mt-2">${Math.abs(selectedTx.amount).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Monto a reembolsar</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="pl-10" max={Math.abs(selectedTx.amount)} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Motivo</label>
                  <Textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Ej: Servicio no prestado..." rows={3} />
                </div>
                <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                  <p className="text-sm">Esta acción no se puede deshacer.</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedTx(null)}>Cancelar</Button>
              <Button onClick={handleProcessRefund} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90">
                {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
                Procesar Reembolso
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Review Request Dialog */}
        <Dialog open={reviewDialog.open} onOpenChange={(open) => !isProcessing && setReviewDialog({ ...reviewDialog, open })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{reviewDialog.action === 'approve' ? '✅ Aprobar Solicitud' : '❌ Rechazar Solicitud'}</DialogTitle>
            </DialogHeader>
            {reviewDialog.request && (
              <div className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                  <p><strong>Usuario:</strong> {reviewDialog.request.user_name}</p>
                  <p><strong>Monto:</strong> ${reviewDialog.request.amount.toLocaleString()} MXN</p>
                  <p><strong>Motivo:</strong> {reviewDialog.request.reason}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notas del admin (opcional)</label>
                  <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Notas adicionales..." rows={2} />
                </div>
                {reviewDialog.action === 'approve' && (
                  <div className="flex items-start gap-2 p-3 bg-info/10 border border-info/20 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-info shrink-0 mt-0.5" />
                    <p className="text-xs">Al aprobar, el monto se acreditará automáticamente a la billetera del usuario.</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewDialog({ open: false, request: null, action: null })} disabled={isProcessing}>Cancelar</Button>
              <Button variant={reviewDialog.action === 'approve' ? 'default' : 'destructive'} onClick={handleReviewRequest} disabled={isProcessing}>
                {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {reviewDialog.action === 'approve' ? 'Confirmar Aprobación' : 'Confirmar Rechazo'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
