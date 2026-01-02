import React from 'react';
import { useNavigate } from 'react-router-dom';
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
import { 
  Lock, 
  Wallet, 
  Clock, 
  PlayCircle,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { Recording } from '@/types';

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  recording: Recording | null;
  onPurchase: () => void;
  isPurchasing: boolean;
  canAfford: boolean;
  balance: number;
}

export default function PaywallModal({
  open,
  onClose,
  recording,
  onPurchase,
  isPurchasing,
  canAfford,
  balance,
}: PaywallModalProps) {
  const navigate = useNavigate();

  if (!recording) return null;

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} minutos`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
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
            Esta grabación requiere una compra para acceder
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

          {/* Price & Balance */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Precio:</span>
              <span className="text-xl font-bold text-premium">${recording.price}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Tu saldo:</span>
              <span className={`font-semibold ${canAfford ? 'text-success' : 'text-destructive'}`}>
                ${balance.toLocaleString()}
              </span>
            </div>
            {canAfford && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Saldo después:</span>
                <span className="text-muted-foreground">${(balance - recording.price).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Insufficient Balance Warning */}
          {!canAfford && (
            <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Saldo insuficiente</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Necesitas ${(recording.price - balance).toLocaleString()} más para comprar esta grabación.
                </p>
              </div>
            </div>
          )}

          {/* Benefits */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Incluye:</p>
            <ul className="space-y-1">
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-success" />
                Acceso ilimitado a la grabación
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-success" />
                Reproducción en cualquier dispositivo
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-success" />
                Sin fecha de expiración
              </li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {canAfford ? (
            <Button onClick={onPurchase} disabled={isPurchasing} className="w-full">
              {isPurchasing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4 mr-2" />
                  Comprar por ${recording.price}
                </>
              )}
            </Button>
          ) : (
            <Button 
              onClick={() => {
                onClose();
                navigate('/wallet');
              }} 
              className="w-full"
            >
              <Wallet className="w-4 h-4 mr-2" />
              Recargar Wallet
            </Button>
          )}
          <Button variant="outline" onClick={onClose} className="w-full">
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
