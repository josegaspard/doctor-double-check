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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { KeyRound, Loader2, ShieldCheck, Timer, Mail, Smartphone } from 'lucide-react';

export type OtpDeliveryMethod = 'email' | 'sms' | 'both';

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
  deliveryMethod: OtpDeliveryMethod;
  onDeliveryMethodChange: (method: OtpDeliveryMethod) => void;
  smsAvailable: boolean;
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
  deliveryMethod,
  onDeliveryMethodChange,
  smsAvailable,
}: OtpVerificationDialogProps) {
  const hasActiveTimer = secondsLeft !== null && secondsLeft > 0;
  const minutes = hasActiveTimer ? Math.floor(secondsLeft! / 60) : 0;
  const secs = hasActiveTimer ? secondsLeft! % 60 : 0;
  const timeStr = `${minutes}:${secs.toString().padStart(2, '0')}`;

  const deliveryText = deliveryMethod === 'email'
    ? 'notificación in-app y correo electrónico'
    : deliveryMethod === 'sms'
      ? 'notificación in-app y SMS'
      : 'notificación in-app, correo y SMS';

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
          {/* Delivery method selector */}
          {!hasActiveTimer && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Método de entrega del código:</Label>
              <RadioGroup
                value={deliveryMethod}
                onValueChange={(v) => onDeliveryMethodChange(v as OtpDeliveryMethod)}
                className="grid gap-2"
              >
                <Label
                  htmlFor="method-email"
                  className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5"
                >
                  <RadioGroupItem value="email" id="method-email" />
                  <Mail className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Email + Notificación</p>
                    <p className="text-[11px] text-muted-foreground">Siempre disponible</p>
                  </div>
                </Label>
                <Label
                  htmlFor="method-sms"
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                    smsAvailable
                      ? 'cursor-pointer hover:bg-muted/50 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5'
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <RadioGroupItem value="sms" id="method-sms" disabled={!smsAvailable} />
                  <Smartphone className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">SMS + Notificación</p>
                    <p className="text-[11px] text-muted-foreground">
                      {smsAvailable ? 'Envío por mensaje de texto' : 'Requiere configurar proveedor SMS'}
                    </p>
                  </div>
                </Label>
                {smsAvailable && (
                  <Label
                    htmlFor="method-both"
                    className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5"
                  >
                    <RadioGroupItem value="both" id="method-both" />
                    <div className="flex gap-1 flex-shrink-0">
                      <Mail className="w-4 h-4 text-primary" />
                      <Smartphone className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Email + SMS + Notificación</p>
                      <p className="text-[11px] text-muted-foreground">Máxima cobertura</p>
                    </div>
                  </Label>
                )}
              </RadioGroup>
            </div>
          )}

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
              El paciente recibirá el código por {deliveryText}.
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
