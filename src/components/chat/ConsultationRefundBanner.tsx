import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@/contexts/WalletContext';

interface Props {
  consultationId: string | null;
  patientId: string;
  doctorId: string;
  currentUserId?: string;
  userRole: string;
  sessionCreatedAt?: Date | string;
  messages: { senderId: string }[];
}

const NO_SHOW_HOURS = 24;

/**
 * Shows a refund banner to the patient when the doctor has not replied to
 * the consultation chat within 24h. Calls request_consultation_refund RPC.
 */
export function ConsultationRefundBanner({
  consultationId,
  patientId,
  doctorId,
  currentUserId,
  userRole,
  sessionCreatedAt,
  messages,
}: Props) {
  const { refreshWallet } = useWallet();
  const [isRequesting, setIsRequesting] = useState(false);
  const [refunded, setRefunded] = useState(false);

  const eligible = useMemo(() => {
    if (refunded) return false;
    if (userRole !== 'patient') return false;
    if (!consultationId) return false;
    if (currentUserId !== patientId) return false;
    if (!sessionCreatedAt) return false;
    const startedAt = new Date(sessionCreatedAt).getTime();
    const hoursElapsed = (Date.now() - startedAt) / (1000 * 60 * 60);
    if (hoursElapsed < NO_SHOW_HOURS) return false;
    const doctorHasReplied = messages.some(m => m.senderId === doctorId);
    return !doctorHasReplied;
  }, [refunded, userRole, consultationId, currentUserId, patientId, doctorId, sessionCreatedAt, messages]);

  if (!eligible) return null;

  const handleRefund = async () => {
    if (!consultationId) return;
    setIsRequesting(true);
    try {
      const { data, error } = await supabase.rpc('request_consultation_refund', {
        p_consultation_id: consultationId,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; refunded_amount?: number };
      if (!result.success) {
        toast.error(result.error || 'No se pudo procesar el reembolso');
        return;
      }
      setRefunded(true);
      await refreshWallet();
      toast.success(`Reembolso emitido: $${result.refunded_amount?.toFixed(2)} en tu saldo`);
    } catch (err: any) {
      toast.error(err?.message || 'Error al solicitar reembolso');
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="mx-3 my-2 rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        <p className="font-medium text-amber-900 dark:text-amber-200">
          El doctor no ha respondido en más de 24 horas
        </p>
        <p className="text-amber-800/80 dark:text-amber-200/70 text-xs mt-0.5">
          Puedes solicitar un reembolso completo a tu saldo.
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleRefund}
        disabled={isRequesting}
        className="border-amber-400 text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900/50 gap-1.5"
      >
        {isRequesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
        Reembolsar
      </Button>
    </div>
  );
}
