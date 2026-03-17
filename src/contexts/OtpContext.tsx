import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { OtpFloatingBanner } from '@/components/vault/OtpFloatingBanner';
import { OtpVerificationDialog, OtpDeliveryMethod } from '@/components/vault/OtpVerificationDialog';
import { toast } from 'sonner';

const OTP_DURATION_SECONDS = 120;

interface OtpPatient {
  id: string;
  name: string;
}

interface OtpContextType {
  verifiedPatients: Set<string>;
  isOtpActive: boolean;
  openOtpForPatient: (patientId: string, patientName: string) => void;
  isPatientVerified: (patientId: string) => boolean;
}

const OtpContext = createContext<OtpContextType>({
  verifiedPatients: new Set(),
  isOtpActive: false,
  openOtpForPatient: () => {},
  isPatientVerified: () => false,
});

export const useOtp = () => useContext(OtpContext);

export function OtpProvider({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth();
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpPatient, setOtpPatient] = useState<OtpPatient | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [verifiedPatients, setVerifiedPatients] = useState<Set<string>>(new Set());
  const [deliveryMethod, setDeliveryMethod] = useState<OtpDeliveryMethod>('email');
  const [smsAvailable, setSmsAvailable] = useState(false);
  const [otpRequestedAt, setOtpRequestedAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track the file to open after verification
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (otpRequestedAt === null) {
      setSecondsLeft(null);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - otpRequestedAt) / 1000);
      const remaining = Math.max(0, OTP_DURATION_SECONDS - elapsed);
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        setOtpRequestedAt(null);
        setOtpPatient(null);
        setOtpCode('');
        toast.info('Código OTP expirado. Solicita uno nuevo.');
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [otpRequestedAt]);

  const openOtpForPatient = useCallback((patientId: string, patientName: string) => {
    setOtpPatient({ id: patientId, name: patientName });
    setOtpCode('');
    setOtpDialogOpen(true);
  }, []);

  const isPatientVerified = useCallback((patientId: string) => {
    return verifiedPatients.has(patientId);
  }, [verifiedPatients]);

  const handleRequestOtp = async () => {
    if (!user?.id || !otpPatient) return;
    setIsRequesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp-email', {
        body: { patientId: otpPatient.id, deliveryMethod },
      });
      if (error) throw new Error(error.message || 'Error al solicitar código');
      if (data && !data.success) throw new Error(data.error || 'Error del servidor');
      if (data?.smsAvailable !== undefined) setSmsAvailable(data.smsAvailable);
      if (data?.smsLimitReached) {
        toast.warning('Límite de SMS alcanzado (2/día). Se envió por email.');
      }
      setOtpRequestedAt(Date.now());
      const actualMethod = data?.smsLimitReached ? 'email' : deliveryMethod;
      const methodText = actualMethod === 'email' ? 'email' : actualMethod === 'sms' ? 'SMS' : 'email y SMS';
      toast.success(`Código OTP enviado por ${methodText}. Expira en 2 minutos.`);
    } catch (error: any) {
      console.error('Error requesting OTP:', error);
      toast.error(error.message || 'Error al solicitar código');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!user?.id || !otpPatient) return;
    setIsVerifying(true);
    try {
      const { data, error } = await supabase
        .from('expediente_otp')
        .select('*')
        .eq('patient_id', otpPatient.id)
        .eq('doctor_id', user.id)
        .eq('otp_code', otpCode.trim())
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error('Código inválido o expirado. Solicita uno nuevo.');
        return;
      }

      await supabase
        .from('expediente_otp')
        .update({ used_at: new Date().toISOString() })
        .eq('id', data.id);

      setVerifiedPatients(prev => new Set([...prev, otpPatient.id]));
      setOtpDialogOpen(false);
      setOtpRequestedAt(null);
      setOtpPatient(null);
      setOtpCode('');
      toast.success('Verificación exitosa. Acceso al expediente concedido.');
    } catch (error) {
      console.error('Error verifying OTP:', error);
      toast.error('Error al verificar código');
    } finally {
      setIsVerifying(false);
    }
  };

  const showBanner = otpRequestedAt !== null && !otpDialogOpen && otpPatient !== null && secondsLeft !== null && secondsLeft > 0;

  // Only render OTP UI for doctors
  const isDoctor = role === 'doctor';

  return (
    <OtpContext.Provider value={{ verifiedPatients, isOtpActive: showBanner, openOtpForPatient, isPatientVerified }}>
      {children}
      {isDoctor && (
        <>
          <OtpVerificationDialog
            open={otpDialogOpen}
            onOpenChange={setOtpDialogOpen}
            patientName={otpPatient?.name || ''}
            otpCode={otpCode}
            onOtpChange={setOtpCode}
            onRequestOtp={handleRequestOtp}
            onVerifyOtp={handleVerifyOtp}
            isRequesting={isRequesting}
            isVerifying={isVerifying}
            secondsLeft={secondsLeft}
            deliveryMethod={deliveryMethod}
            onDeliveryMethodChange={setDeliveryMethod}
            smsAvailable={smsAvailable}
          />
          <OtpFloatingBanner
            isVisible={showBanner}
            patientName={otpPatient?.name || ''}
            secondsLeft={secondsLeft || 0}
            onReopen={() => setOtpDialogOpen(true)}
          />
        </>
      )}
    </OtpContext.Provider>
  );
}
