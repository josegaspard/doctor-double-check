import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { KeyRound, Loader2, ShieldCheck, Timer } from 'lucide-react';

interface OtpVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
  otpCode: string;
  onOtpChange: (code: string) => void;
  onRequestOtp: () => void;
  onVerifyOtp: () => void;
  isRequesting: boolean;
  isVerifying: boolean;
  secondsLeft: number | null;
}

export function OtpVerificationDialog({
  open,
  onOpenChange,
  patientName,
  otpCode,
  onOtpChange,
  onRequestOtp,
  onVerifyOtp,
  isRequesting,
  isVerifying,
  secondsLeft,
}: OtpVerificationDialogProps) {
  const hasActiveTimer = secondsLeft !== null && secondsLeft > 0;
  const minutes = hasActiveTimer ? Math.floor(secondsLeft! / 60) : 0;
  const secs = hasActiveTimer ? secondsLeft! % 60 : 0;
  const timeStr = `${minutes}:${secs.toString().padStart(2, '0')}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <KeyRound className="w-5 h-5 text-primary" />
            Verificación de Acceso
          </DialogTitle>
          <DialogDescription className="text-sm">
            Para acceder al expediente de <strong>{patientName}</strong>, ingresa el código OTP que el paciente te proporcionará.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {hasActiveTimer && (
            <div className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg ${
              secondsLeft! <= 30 ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning-foreground'
            }`}>
              <Timer className="w-4 h-4" />
              <span className="text-sm font-medium">Tiempo restante:</span>
              <span className="font-mono font-bold text-lg">{timeStr}</span>
            </div>
          )}

          <div className="space-y-2">
            <Input
              placeholder="Código de 6 dígitos"
              value={otpCode}
              onChange={(e) => onOtpChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-2xl tracking-[0.5em] font-mono h-14"
              maxLength={6}
              inputMode="numeric"
            />
            <p className="text-xs text-muted-foreground text-center">
              El paciente recibirá el código por notificación y correo electrónico.
            </p>
          </div>

          <Button
            variant="outline"
            className="w-full gap-2 h-11"
            onClick={onRequestOtp}
            disabled={isRequesting || hasActiveTimer}
          >
            {isRequesting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <KeyRound className="w-4 h-4" />
            )}
            {hasActiveTimer ? 'Código ya enviado' : 'Solicitar código al paciente'}
          </Button>
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 h-11">
            Minimizar
          </Button>
          <Button
            onClick={onVerifyOtp}
            disabled={otpCode.length !== 6 || isVerifying}
            className="flex-1 gap-2 h-11"
          >
            {isVerifying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            Verificar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
