import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isConsultationCountryAllowed } from '@/lib/consultationRegions';
import { useVault } from '@/contexts/VaultContext';
import { useChat } from '@/contexts/ChatContext';
import { useWallet } from '@/contexts/WalletContext';
import { useLanguage } from '@/contexts/LanguageContext';
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
import { DoctorBadgeIcon } from '@/components/doctor/DoctorBadgeIcon';
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
  const { t } = useLanguage();

  const [step, setStep] = useState<'files' | 'confirm' | 'processing'>('files');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStripeProcessing, setIsStripeProcessing] = useState(false);
  // Stable idempotency key per flow instance → a double-submit reuses the same
  // key and is replayed server-side instead of charging twice.
  const idemKeyRef = useRef<string>(crypto.randomUUID());

  const patientFiles = files.filter(f => f.patientId === user?.id);
  const discountedFee = getEffectivePrice(doctor.consultationFee);

  const toggleFile = (fileId: string) => {
    setSelectedFiles((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
  };

  const handleWalletPayment = async () => {
    if (!user) return;

    // Consultas solo para México por ahora (cliente 2026-06-29).
    if (!isConsultationCountryAllowed(user.countryCode)) {
      toast.error(t('bookAppointment.toastMexicoOnly'));
      return;
    }

    setStep('processing');
    setIsProcessing(true);

    try {
      // 0. Verify doctor is approved
      const { data: doctorProfile, error: doctorError } = await supabase
        .from('doctor_profiles_public')
        .select('status')
        .eq('user_id', doctor.userId)
        .maybeSingle();

      if (doctorError || doctorProfile?.status !== 'approved') {
        throw new Error(t('doubleCheckFlow.errors.doctorNotAvailable'));
      }

      // SECURITY (2026-05-11): atomic patient debit + doctor credit in one RPC.
      // Previously two separate calls left a window where a malicious patient
      // could call credit_doctor_earnings directly to inflate earnings w/o paying.
      const { data: purchaseResult, error: purchaseError } = await supabase.rpc(
        'process_double_check_purchase' as any,
        {
          p_doctor_id: doctor.userId,
          p_amount: doctor.consultationFee,
          p_description: t('doubleCheckFlow.purchase.description').replace('{doctorName}', doctor.name),
          p_idempotency_key: idemKeyRef.current,
        }
      );

      if (purchaseError) throw purchaseError;
      const result = purchaseResult as { success: boolean; error?: string; amount_charged?: number; new_balance?: number } | null;
      if (!result?.success) {
        throw new Error(result?.error || t('doubleCheckFlow.errors.paymentError'));
      }

      toast.success(
        t('doubleCheckFlow.walletDebited')
          .replace('{amount}', String(result.amount_charged))
          .replace('{balance}', String(result.new_balance))
      );

      // 2. Create consultation record
      const { data: consultation, error: consultationError } = await supabase
        .from('consultations')
        .insert({
          patient_id: user.id,
          doctor_id: doctor.userId,
          status: 'active',
          notes: t('doubleCheckFlow.consultationNotes'),
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
        throw new Error(chatResult.error || t('doubleCheckFlow.errors.chatSessionError'));
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

      // Doctor earnings + earning transaction were already credited atomically
      // inside process_double_check_purchase above.

      // 7. Notify doctor
      await supabase
        .from('notifications')
        .insert({
          user_id: doctor.userId,
          type: 'chat_message',
          title: t('doubleCheckFlow.notification.title'),
          message: user.name
            ? t('doubleCheckFlow.notification.messageWithName').replace('{patientName}', user.name)
            : t('doubleCheckFlow.notification.messageDefault'),
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

      toast.success(t('doubleCheckFlow.consultationStarted'));
      onClose();
      navigate('/chat', { state: { sessionId: chatResult.session?.id } });

    } catch (error: any) {
      console.error('Segunda Opinión error:', error);
      toast.error(error.message || t('doubleCheckFlow.errors.consultationError'));
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
          // Segunda opinión: el webhook debe crear una consulta double-check,
          // compartir los estudios seleccionados con el médico y dar el entitlement
          // 'double_check'. Antes esto se perdía (sessionStorage nunca se leía) y la
          // 2ª opinión pagada con tarjeta se degradaba a un chat normal.
          isDoubleCheck: true,
          fileIds: selectedFiles,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Stripe checkout error:', error);
      toast.error(error.message || t('doubleCheckFlow.errors.stripeError'));
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
              <DialogTitle>{t('doubleCheckFlow.title')}</DialogTitle>
              <DialogDescription>
                {t('doubleCheckFlow.description').replace('{doctorName}', doctor.name)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === 'files' && (
          <>
            <div className="py-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {t('doubleCheckFlow.files.selectStudies')}
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
                    {t('doubleCheckFlow.files.noFiles')}
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      onClose();
                      navigate('/vault');
                    }}
                  >
                    {t('doubleCheckFlow.files.uploadFiles')}
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 p-3 bg-info/5 rounded-lg text-sm">
              <Shield className="w-4 h-4 text-info" />
              <span className="text-muted-foreground">
                {t('doubleCheckFlow.files.accessRevokedNotice')}
              </span>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                {t('doubleCheckFlow.actions.cancel')}
              </Button>
              <Button onClick={() => setStep('confirm')}>
                {t('doubleCheckFlow.actions.continue')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className="py-4 space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-3">{t('doubleCheckFlow.confirm.summaryTitle')}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('doubleCheckFlow.confirm.specialist')}</span>
                    <span className="font-medium inline-flex items-center gap-1 min-w-0">
                      {doctor.name}
                      <DoctorBadgeIcon userId={doctor.userId} size="sm" className="flex-shrink-0" />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('doubleCheckFlow.confirm.specialty')}</span>
                    <span>{doctor.specialty}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('doubleCheckFlow.confirm.sharedFiles')}</span>
                    <span>{t('doubleCheckFlow.confirm.filesCount').replace('{count}', String(selectedFiles.length))}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-success/5 border border-success/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-success" />
                    <span className="font-medium">{t('doubleCheckFlow.confirm.totalToPay')}</span>
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
                        {t('doubleCheckFlow.confirm.residentDiscount')}
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
                      {t('doubleCheckFlow.confirm.payWithCard')}
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
                    <span className="bg-background px-2 text-muted-foreground">{t('doubleCheckFlow.confirm.orUseBalance')}</span>
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
                        {t('doubleCheckFlow.confirm.payWithBalance').replace('{balance}', balance.toLocaleString())}
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 p-3 bg-warning/10 rounded-lg border border-warning/30">
                      <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-warning">{t('doubleCheckFlow.confirm.insufficientBalance')}</p>
                        <p className="text-warning/80 text-xs">
                          {t('doubleCheckFlow.confirm.insufficientBalanceDetail')
                            .replace('{balance}', balance.toLocaleString())
                            .replace('{missing}', (discountedFee - balance).toLocaleString())}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => { onClose(); navigate('/wallet'); }}
                      variant="outline"
                      className="w-full gap-2"
                    >
                      <Wallet className="w-4 h-4" />
                      {t('doubleCheckFlow.confirm.topUpWallet')}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Button variant="ghost" onClick={() => setStep('files')} className="w-full">
              {t('doubleCheckFlow.actions.back')}
            </Button>
          </>
        )}

        {step === 'processing' && (
          <div className="py-12 text-center">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
            <p className="font-medium">{t('doubleCheckFlow.processing.title')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('doubleCheckFlow.processing.doNotClose')}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
