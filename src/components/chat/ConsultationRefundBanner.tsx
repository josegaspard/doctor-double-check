import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@/contexts/WalletContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConfirmAction } from '@/components/common/ConfirmActionDialog';
import { money2, fill } from '@/lib/proFormat';

interface Props {
  consultationId: string | null;
  patientId: string;
  doctorId: string;
  currentUserId?: string;
  userRole: string;
  sessionCreatedAt?: Date | string;
  messages: { senderId: string }[];
}

const NO_SHOW_HOURS = 72;

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
  const { t, language } = useLanguage();
  // Reembolsar ya no va al primer clic: se enseña el importe antes de pedirlo.
  const { confirm, dialog } = useConfirmAction();
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
    const ok = await confirm({
      title: t('mm2.confirm.consultationRefund.title'),
      description: t('mm2.confirm.consultationRefund.description'),
      tone: 'payment',
      details: [{ label: t('mm2.confirm.consultationRefund.destinationLabel'), value: t('mm2.confirm.payCommon.methodWallet') }],
      confirmLabel: t('mm2.confirm.consultationRefund.confirmLabel'),
    });
    if (!ok) return;
    setIsRequesting(true);
    try {
      const { data, error } = await supabase.rpc('request_consultation_refund', {
        p_consultation_id: consultationId,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; refunded_amount?: number };
      if (!result.success) {
        toast.error(result.error || t('mm2.confirm.consultationRefund.genericError'));
        return;
      }
      setRefunded(true);
      await refreshWallet();
      toast.success(fill(t('mm2.confirm.consultationRefund.issuedToast'), { amount: money2(result.refunded_amount || 0, language) }));
    } catch (err: any) {
      toast.error(err?.message || t('mm2.confirm.consultationRefund.genericError'));
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="mx-3 my-2 rounded-lg border border-warning/30 bg-warning/10 p-3 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        <p className="font-medium text-foreground">
          {t('mm2.confirm.consultationRefund.bannerTitle')}
        </p>
        <p className="text-muted-foreground text-xs mt-0.5">
          {t('mm2.confirm.consultationRefund.bannerBody')}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleRefund}
        disabled={isRequesting}
        className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary gap-1.5"
      >
        {isRequesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
        {t('mm2.confirm.consultationRefund.buttonLabel')}
      </Button>
      {dialog}
    </div>
  );
}
