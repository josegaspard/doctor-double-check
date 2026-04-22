import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Lock,
  PlayCircle,
  Wallet,
  CreditCard,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Clock,
} from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { usePurchases } from '@/hooks/usePurchases';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

export type PaywallTxStatus = 'idle' | 'initiated' | 'paid' | 'failed';

interface RecordingPaywallProps {
  recordingId: string;
  title: string;
  doctorName: string;
  specialty: string;
  price: number;
  durationSeconds: number;
  thumbnailUrl?: string;
  onPaid: () => Promise<void> | void;
  onBack?: () => void;
}

/**
 * Paywall real para grabaciones:
 * - Estados visibles del wallet/pago: idle / initiated / paid / failed
 * - Pagar con Wallet (RPC) o Stripe Checkout
 * - Al pagar con Wallet, refresca purchases y monta el player sin reload
 */
export function RecordingPaywall({
  recordingId,
  title,
  doctorName,
  specialty,
  price,
  durationSeconds,
  thumbnailUrl,
  onPaid,
  onBack,
}: RecordingPaywallProps) {
  const navigate = useNavigate();
  const { balance, canAfford } = useWallet();
  const { purchaseWithWallet, purchaseWithStripe, refresh } = usePurchases();
  const [txStatus, setTxStatus] = useState<PaywallTxStatus>('idle');
  const [txError, setTxError] = useState<string | null>(null);

  const affordable = canAfford(price);

  // Auto-hide success state after 2s and unlock player
  useEffect(() => {
    if (txStatus !== 'paid') return;
    const t = setTimeout(async () => {
      await onPaid();
    }, 1200);
    return () => clearTimeout(t);
  }, [txStatus, onPaid]);

  const formatDuration = (seconds: number) => {
    if (seconds <= 0) return '—';
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    return `${h}h ${mins % 60}m`;
  };

  const handleWallet = async () => {
    setTxStatus('initiated');
    setTxError(null);
    try {
      const res = await purchaseWithWallet(recordingId);
      if (res.success) {
        await refresh();
        setTxStatus('paid');
      } else {
        setTxError(res.error || 'No se pudo procesar el pago');
        setTxStatus('failed');
      }
    } catch (e: any) {
      setTxError(e?.message || 'Error inesperado');
      setTxStatus('failed');
    }
  };

  const handleStripe = async () => {
    setTxStatus('initiated');
    setTxError(null);
    try {
      const res = await purchaseWithStripe(recordingId);
      if (res.success && res.url) {
        window.location.href = res.url;
        return;
      }
      setTxError(res.error || 'No se pudo iniciar el checkout');
      setTxStatus('failed');
    } catch (e: any) {
      setTxError(e?.message || 'Error iniciando checkout');
      setTxStatus('failed');
    }
  };

  const handleRetry = () => {
    setTxStatus('idle');
    setTxError(null);
  };

  const StatusBadge = () => {
    if (txStatus === 'idle') {
      return (
        <Badge variant="outline" className="gap-1.5">
          <Wallet className="w-3 h-3" />
          Saldo: ${balance.toLocaleString()} MXN
        </Badge>
      );
    }
    if (txStatus === 'initiated') {
      return (
        <Badge className="gap-1.5 bg-info text-info-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          Procesando pago…
        </Badge>
      );
    }
    if (txStatus === 'paid') {
      return (
        <Badge className="gap-1.5 bg-success text-success-foreground">
          <CheckCircle2 className="w-3 h-3" />
          Pagado · Cargando reproductor…
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="gap-1.5">
        <AlertCircle className="w-3 h-3" />
        Pago rechazado
      </Badge>
    );
  };

  const isProcessing = txStatus === 'initiated' || txStatus === 'paid';

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-2xl">
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-3 h-8 text-xs sm:text-sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Volver
        </Button>
      )}

      <Card className="overflow-hidden">
        <div className="relative aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={title}
              className="w-full h-full object-cover opacity-60"
            />
          ) : (
            <PlayCircle className="w-16 h-16 text-muted-foreground/40" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute top-3 left-3">
            <Badge variant="premium" className="gap-1">
              <Lock className="w-3 h-3" />
              Premium
            </Badge>
          </div>
          <div className="absolute bottom-3 left-3 right-3 text-white">
            <h1 className="font-heading text-lg sm:text-xl font-bold drop-shadow line-clamp-2">
              {title}
            </h1>
            <p className="text-xs sm:text-sm opacity-90">{doctorName} · {specialty}</p>
          </div>
        </div>

        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              {formatDuration(durationSeconds)}
            </div>
            <StatusBadge />
          </div>

          <Separator />

          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground">Precio único · acceso ilimitado</p>
            <p className="text-3xl sm:text-4xl font-bold text-foreground mt-1">
              ${price.toLocaleString()} <span className="text-base font-normal text-muted-foreground">MXN</span>
            </p>
          </div>

          {txStatus === 'failed' && txError && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">No se pudo completar el pago</p>
                <p className="text-xs text-muted-foreground mt-0.5">{txError}</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleRetry} className="h-8 text-xs">
                Reintentar
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Button
              className="w-full h-11 gap-2"
              onClick={handleWallet}
              disabled={!affordable || isProcessing}
              variant={affordable ? 'default' : 'outline'}
            >
              {txStatus === 'initiated' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wallet className="w-4 h-4" />
              )}
              {affordable
                ? `Pagar con Wallet — $${price.toLocaleString()} MXN`
                : `Saldo insuficiente ($${balance.toLocaleString()} disponibles)`}
            </Button>

            {!affordable && (
              <Button
                variant="ghost"
                className="w-full h-9 text-xs"
                onClick={() => navigate('/wallet')}
              >
                Recargar Wallet
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full h-11 gap-2"
              onClick={handleStripe}
              disabled={isProcessing}
            >
              <CreditCard className="w-4 h-4" />
              Pagar con Tarjeta (Stripe)
            </Button>
          </div>

          <p className="text-[11px] text-center text-muted-foreground">
            Pago seguro. Acceso de por vida una vez confirmado.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
