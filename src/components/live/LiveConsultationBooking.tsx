import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import {
  Stethoscope,
  Wallet,
  CreditCard,
  MessageSquare,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { PriceDisplay } from '@/components/currency/PriceDisplay';

interface LiveConsultationBookingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  doctorName: string;
  doctorAvatar?: string;
  specialty: string;
  consultationFee: number;
  liveId: string;
  maxPaidChats?: number | null;
  paidChatsCount?: number;
}

export function LiveConsultationBooking({
  open,
  onOpenChange,
  doctorId,
  doctorName,
  doctorAvatar,
  specialty,
  consultationFee,
  liveId,
  maxPaidChats,
  paidChatsCount = 0,
}: LiveConsultationBookingProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { balance, refreshWallet } = useWallet();
  const { t } = useLanguage();
  const [message, setMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'stripe'>('wallet');
  const [isProcessing, setIsProcessing] = useState(false);

  const canAfford = balance >= consultationFee;
  const limitReached = maxPaidChats != null && paidChatsCount >= maxPaidChats;

  const handlePurchase = async () => {
    if (!user || !message.trim()) return;
    if (limitReached) {
      toast.error('El doctor ha alcanzado el límite de orientaciones para este live');
      return;
    }

    setIsProcessing(true);
    try {
      if (paymentMethod === 'wallet') {
        if (!canAfford) {
          toast.error('Saldo insuficiente');
          setIsProcessing(false);
          return;
        }

        // Use existing RPC
        const { data, error } = await supabase.rpc('process_consultation_purchase', {
          p_doctor_id: doctorId,
          p_amount: consultationFee,
          p_patient_name: user.name || 'Paciente',
        });

        if (error) throw error;
        const result = data as any;
        if (!result.success) {
          toast.error(result.error || 'Error al procesar el pago');
          setIsProcessing(false);
          return;
        }

        // Send the message as first chat message
        if (result.session_id && message.trim()) {
          await supabase.from('chat_messages').insert({
            session_id: result.session_id,
            sender_id: user.id,
            content: `📋 Mensaje desde el live: ${message.trim()}`,
          });
        }

        // Record the live consultation request
        await supabase.from('live_consultation_requests').insert({
          live_id: liveId,
          patient_id: user.id,
          doctor_id: doctorId,
          message: message.trim(),
          payment_method: 'wallet',
          amount: consultationFee,
          chat_session_id: result.session_id,
          consultation_id: result.consultation_id,
          status: 'completed',
        });

        // Increment paid_chats_count on the live
        await supabase.rpc('increment_viewer_count', { p_live_id: liveId }).then(() => {
          // Use direct update instead
        });
        await supabase
          .from('lives')
          .update({ paid_chats_count: paidChatsCount + 1 })
          .eq('id', liveId);

        // Send enhanced notification
        await supabase.from('notifications').insert({
          user_id: doctorId,
          type: 'chat_message' as any,
          title: '🎯 Nueva orientación desde tu Live',
          message: `${user.name || 'Paciente'} ha reservado una orientación desde tu transmisión en vivo`,
          data: {
            patient_id: user.id,
            url: '/chat',
            session_id: result.session_id,
            source: 'live',
            live_id: liveId,
          },
        });

        await refreshWallet();
        toast.success('¡Orientación reservada! Te redirigimos al chat');
        onOpenChange(false);
        navigate(`/chat?session=${result.session_id}`);
      } else {
        // Stripe flow
        const { data, error } = await supabase.functions.invoke('create-consultation-checkout', {
          body: {
            doctorId,
            amount: consultationFee,
            liveId,
            message: message.trim(),
          },
        });
        if (error) throw error;
        if (data?.url) {
          window.location.href = data.url;
        } else {
          throw new Error('No checkout URL returned');
        }
      }
    } catch (err: any) {
      console.error('Booking error:', err);
      toast.error('Error al procesar la reserva');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-primary" />
            {t('ads.bookConsultation')}
          </DialogTitle>
          <DialogDescription>
            {t('ads.bookConsultationDesc')}
          </DialogDescription>
        </DialogHeader>

        {limitReached ? (
          <div className="flex flex-col items-center py-6 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">{t('ads.limitReached')}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('ads.limitReachedDesc')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Doctor info */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Avatar className="w-10 h-10">
                {doctorAvatar && <AvatarImage src={doctorAvatar} />}
                <AvatarFallback className="bg-primary/10">
                  <Stethoscope className="w-5 h-5 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{doctorName}</p>
                <p className="text-xs text-muted-foreground">{specialty}</p>
              </div>
              <Badge variant="secondary" className="text-sm font-bold">
                <PriceDisplay amount={consultationFee} size="sm" />
              </Badge>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="booking-message">
                {t('ads.messageForDoctor')} <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="booking-message"
                placeholder={t('ads.describeBriefly')}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">{message.length}/500</p>
            </div>

            <Separator />

            {/* Payment method */}
            <div className="space-y-3">
              <Label>{t('ads.paymentMethod')}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('wallet')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-colors ${
                    paymentMethod === 'wallet'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <Wallet className="w-5 h-5 text-primary" />
                  <span className="text-xs font-medium">{t('ads.balance')}</span>
                  <span className={`text-xs ${canAfford ? 'text-success' : 'text-destructive'}`}>
                    ${balance.toLocaleString()}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('stripe')}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-colors ${
                    paymentMethod === 'stripe'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-primary" />
                  <span className="text-xs font-medium">{t('ads.card')}</span>
                  <span className="text-xs text-muted-foreground">Stripe</span>
                </button>
              </div>

              {paymentMethod === 'wallet' && !canAfford && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    {t('ads.insufficientRecharge')}{' '}
                    <button
                      className="underline font-medium"
                      onClick={() => { onOpenChange(false); navigate('/wallet'); }}
                    >
                      {t('ads.rechargeHere')}
                    </button>
                  </span>
                </div>
              )}
            </div>

            {/* Submit */}
            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handlePurchase}
              disabled={isProcessing || !message.trim() || (paymentMethod === 'wallet' && !canAfford)}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('ads.processing')}
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  {t('ads.payAndBook')} <PriceDisplay amount={consultationFee} size="sm" />
                </>
              )}
            </Button>

            <p className="text-[10px] text-center text-muted-foreground">
              {t('ads.paymentDisclaimer')}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
