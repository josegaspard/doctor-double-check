import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useVault } from '@/contexts/VaultContext';
import { useChat } from '@/contexts/ChatContext';
import { useWallet } from '@/contexts/WalletContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  CheckCheck,
  FileText,
  Shield,
  DollarSign,
  Loader2,
  ArrowRight,
  CreditCard,
  Wallet,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';

interface DoubleCheckFlowProps {
  doctor: {
    userId: string;
    name: string;
    specialty: string;
    consultationFee: number;
  };
  isOpen: boolean;
  onClose: () => void;
}

export function DoubleCheckFlow({ doctor, isOpen, onClose }: DoubleCheckFlowProps) {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { files, grantAccess } = useVault();
  const { createSession } = useChat();
  const { balance, canAfford, getEffectivePrice, refreshWallet } = useWallet();
  
  const [step, setStep] = useState<'files' | 'confirm' | 'processing'>('files');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStripeProcessing, setIsStripeProcessing] = useState(false);

  const patientFiles = files.filter(f => f.patientId === user?.id);
  const discountedFee = getEffectivePrice(doctor.consultationFee);

  const toggleFile = (fileId: string) => {
    setSelectedFiles((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
  };

  const handleWalletPayment = async () => {
    if (!user) return;
    
    setStep('processing');
    setIsProcessing(true);

    try {
      // 0. Verify doctor is approved
      const { data: doctorProfile, error: doctorError } = await supabase
        .from('doctor_profiles_public')
        .select('status')
        .eq('user_id', doctor.userId)
        .single();

      if (doctorError || doctorProfile?.status !== 'approved') {
        throw new Error('El doctor no está disponible para Segunda Opinión');
      }

      // 1. Process wallet purchase
      const { data: purchaseResult, error: purchaseError } = await supabase.rpc(
        'process_wallet_purchase',
        {
          p_amount: doctor.consultationFee,
          p_description: `Segunda Opinión con ${doctor.name}`,
          p_metadata: { type: 'double_check', doctor_id: doctor.userId },
        }
      );

      if (purchaseError) throw purchaseError;
      const result = purchaseResult as { success: boolean; error?: string; amount_charged?: number; new_balance?: number } | null;
      if (!result?.success) {
        throw new Error(result?.error || 'Error en el pago');
      }

      // Show debit notification
      toast.success(`Se debitaron $${result.amount_charged} de tu wallet. Nuevo saldo: $${result.new_balance}`);

      // 2. Create consultation record
      const { data: consultation, error: consultationError } = await supabase
        .from('consultations')
        .insert({
          patient_id: user.id,
          doctor_id: doctor.userId,
          status: 'active',
          notes: 'Segunda Opinión médica',
        })
        .select()
        .single();

      if (consultationError) throw consultationError;

      // 3. Grant access to selected files
      for (const fileId of selectedFiles) {
        await grantAccess(fileId, doctor.userId);
      }

      // 4. Create chat session
      const chatResult = await createSession(doctor.userId, 'doctor', true, consultation.id);
      
      if (!chatResult.success) {
        throw new Error(chatResult.error || 'Error al crear sesión de chat');
      }

      // 5. Create entitlement
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      await supabase
        .from('entitlements')
        .insert({
          user_id: user.id,
          type: 'double_check',
          is_active: true,
          expires_at: expiresAt.toISOString(),
        });

      // 6. Credit doctor earnings atomically
      const amountCharged = result.amount_charged || doctor.consultationFee;
      const { data: newPending, error: rpcError } = await supabase.rpc("credit_doctor_earnings", {
        p_doctor_id: doctor.userId,
        p_amount: amountCharged,
      });

      if (!rpcError && newPending !== -1) {
        await supabase
          .from('wallet_transactions')
          .insert({
            user_id: doctor.userId,
            type: 'earning',
            amount: amountCharged,
            description: `Ganancia por Segunda Opinión`,
            status: 'paid',
            metadata: { source: 'double_check', patient_id: user.id, consultation_id: consultation.id },
          });
      }

      // 7. Notify doctor
      await supabase
        .from('notifications')
        .insert({
          user_id: doctor.userId,
          type: 'chat_message',
          title: '🔄 Nueva solicitud de Segunda Opinión',
          message: `${user.name || 'Un paciente'} ha solicitado una segunda opinión`,
          data: { 
            patient_id: user.id, 
            session_id: chatResult.session?.id,
            consultation_id: consultation.id,
            url: '/chat',
            files_shared: selectedFiles.length
          },
        });

      // 8. Refresh wallet
      await refreshWallet();

      toast.success('Double Check iniciado correctamente');
      onClose();
      navigate('/chat', { state: { sessionId: chatResult.session?.id } });

    } catch (error: any) {
      console.error('Double Check error:', error);
      toast.error(error.message || 'Error al iniciar Double Check');
      setStep('confirm');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStripePayment = async () => {
    setIsStripeProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-consultation-checkout', {
        body: { 
          doctorId: doctor.userId, 
          consultationFee: doctor.consultationFee, 
          doctorName: doctor.name,
        },
      });

      if (error) throw error;

      if (data?.url) {
        // Store selected files in sessionStorage so we can grant access after redirect
        if (selectedFiles.length > 0) {
          sessionStorage.setItem('doublecheck_files', JSON.stringify(selectedFiles));
          sessionStorage.setItem('doublecheck_doctor', doctor.userId);
        }
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Stripe checkout error:', error);
      toast.error(error.message || 'Error al procesar el pago con tarjeta');
    } finally {
      setIsStripeProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Double Check</DialogTitle>
              <DialogDescription>
                Segunda opinión con {doctor.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === 'files' && (
          <>
            <div className="py-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Selecciona los estudios a compartir
              </h4>
              
              {patientFiles.length > 0 ? (
                <ScrollArea className="h-[200px] border rounded-lg p-3">
                  <div className="space-y-2">
                    {patientFiles.map((file) => (
                      <div
                        key={file.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedFiles.includes(file.id)
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => toggleFile(file.id)}
                      >
                        <Checkbox checked={selectedFiles.includes(file.id)} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{file.category}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {file.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 bg-muted/50 rounded-lg">
                  <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No tienes expedientes en tu Vault
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      onClose();
                      navigate('/vault');
                    }}
                  >
                    Subir expedientes
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 p-3 bg-info/5 rounded-lg text-sm">
              <Shield className="w-4 h-4 text-info" />
              <span className="text-muted-foreground">
                El acceso a tus expedientes se revocará al finalizar la orientación médica
              </span>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={() => setStep('confirm')}>
                Continuar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className="py-4 space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-3">Resumen de tu Double Check</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Especialista</span>
                    <span className="font-medium">{doctor.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Especialidad</span>
                    <span>{doctor.specialty}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Archivos compartidos</span>
                    <span>{selectedFiles.length} archivos</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-success/5 border border-success/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-success" />
                    <span className="font-medium">Total a pagar</span>
                  </div>
                  <div className="text-right">
                    {role === 'resident' && (
                      <p className="text-xs text-muted-foreground line-through">
                        ${doctor.consultationFee} MXN
                      </p>
                    )}
                    <p className="text-xl font-bold text-success">
                      ${discountedFee} MXN
                    </p>
                    {role === 'resident' && (
                      <Badge variant="success" className="text-xs">
                        50% descuento residente
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Payment Options */}
              <div className="space-y-3">
                {/* Stripe */}
                <Button 
                  onClick={handleStripePayment}
                  disabled={isStripeProcessing || isProcessing}
                  className="w-full h-12 gap-2"
                >
                  {isStripeProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Pagar con tarjeta
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </>
                  )}
                </Button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">o usa tu saldo</span>
                  </div>
                </div>

                {/* Wallet */}
                {canAfford(doctor.consultationFee) ? (
                  <Button 
                    onClick={handleWalletPayment}
                    disabled={isProcessing || isStripeProcessing}
                    variant="outline"
                    className="w-full h-12 gap-2"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Wallet className="w-4 h-4" />
                        Pagar con saldo (${balance.toLocaleString()})
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 p-3 bg-warning/10 rounded-lg border border-warning/30">
                      <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-warning">Saldo insuficiente</p>
                        <p className="text-warning/80 text-xs">
                          Tienes ${balance.toLocaleString()} — necesitas ${(discountedFee - balance).toLocaleString()} más
                        </p>
                      </div>
                    </div>
                    <Button 
                      onClick={() => { onClose(); navigate('/wallet'); }} 
                      variant="outline"
                      className="w-full gap-2"
                    >
                      <Wallet className="w-4 h-4" />
                      Recargar wallet
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Button variant="ghost" onClick={() => setStep('files')} className="w-full">
              ← Atrás
            </Button>
          </>
        )}

        {step === 'processing' && (
          <div className="py-12 text-center">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
            <p className="font-medium">Procesando tu Double Check...</p>
            <p className="text-sm text-muted-foreground mt-1">
              No cierres esta ventana
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
