import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePurchases } from '@/hooks/usePurchases';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Lock, 
  Wallet, 
  Clock, 
  PlayCircle,
  AlertCircle,
  CheckCircle,
  Loader2,
  CreditCard,
  ExternalLink,
} from 'lucide-react';
import { Recording } from '@/types';

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  recording: Recording | null;
  onPurchase?: () => void;
  isPurchasing?: boolean;
  canAfford: boolean;
  balance: number;
}

export default function PaywallModal({
  open,
  onClose,
  recording,
  onPurchase,
  isPurchasing: externalIsPurchasing,
  canAfford,
  balance,
}: PaywallModalProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { purchaseWithWallet, isPurchasing: walletIsPurchasing } = usePurchases();
  const [isStripeProcessing, setIsStripeProcessing] = useState(false);

  const isPurchasing = externalIsPurchasing || walletIsPurchasing;

  if (!recording) return null;

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} minutos`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const handleStripeCheckout = async () => {
    setIsStripeProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-recording-checkout', {
        body: { recordingId: recording.id },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        onClose();
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo iniciar el proceso de pago',
        variant: 'destructive',
      });
    } finally {
      setIsStripeProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-full bg-premium/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-premium" />
            </div>
            <Badge variant="premium">Contenido Premium</Badge>
          </div>
          <DialogTitle className="text-xl">{recording.title}</DialogTitle>
          <DialogDescription>
            Elige cómo deseas adquirir esta grabación
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recording Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-premium/20 to-primary/20 flex items-center justify-center">
                <PlayCircle className="w-8 h-8 text-premium/60" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{recording.doctorName}</p>
                <p className="text-sm text-muted-foreground">{recording.specialty}</p>
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatDuration(recording.duration)}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Price Display */}
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground">Precio</p>
            <p className="text-3xl font-bold text-premium">${recording.price} MXN</p>
          </div>

          {/* Benefits */}
          <div className="space-y-2">
            <ul className="space-y-1">
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Acceso ilimitado a la grabación
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Reproducción en cualquier dispositivo
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Sin fecha de expiración
              </li>
            </ul>
          </div>

          <Separator />

          {/* Payment Options */}
          <div className="space-y-3">
            {/* Option 1: Pay with Stripe */}
            <Button 
              onClick={handleStripeCheckout} 
              disabled={isStripeProcessing}
              className="w-full h-12 gap-2"
              variant="default"
            >
              {isStripeProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Pagar con Tarjeta
                  <ExternalLink className="w-3 h-3 ml-1" />
                </>
              )}
            </Button>

            {/* Option 2: Pay with Wallet */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">o usa tu wallet</span>
              </div>
            </div>

            {canAfford ? (
              <Button 
                onClick={async () => {
                  if (recording) {
                    const result = await purchaseWithWallet(recording.id);
                    if (result.success) {
                      onClose();
                      navigate(`/recording/${recording.id}`);
                    }
                  }
                }} 
                disabled={isPurchasing} 
                className="w-full"
                variant="outline"
              >
                {isPurchasing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4 mr-2" />
                    Pagar con Wallet (Saldo: ${balance.toLocaleString()})
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">Saldo insuficiente</p>
                    <p className="text-yellow-700 dark:text-yellow-300 text-xs">
                      Tienes ${balance.toLocaleString()} - Necesitas ${(recording.price - balance).toLocaleString()} más
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={() => { onClose(); navigate('/wallet'); }} 
                  className="w-full"
                  variant="outline"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Recargar Wallet
                </Button>
              </div>
            )}
          </div>
        </div>

        <Button variant="ghost" onClick={onClose} className="w-full">
          Cancelar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
