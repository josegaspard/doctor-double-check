import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, PhoneOff, Stethoscope } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

interface IncomingCallModalProps {
  open: boolean;
  onClose: () => void;
  doctorName: string;
  doctorSpecialty?: string;
  doctorAvatar?: string;
  consultationId: string;
  doctorId?: string;
}

// Generate a ringtone using Web Audio API
function createRingtone(audioCtxRef: React.MutableRefObject<AudioContext | null>) {
  const ctx = new AudioContext();
  audioCtxRef.current = ctx;

  let playing = true;

  const playRing = () => {
    if (!playing || ctx.state === 'closed') return;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.value = 440;
    osc2.type = 'sine';
    osc2.frequency.value = 480;

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.8);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 2);
    osc2.stop(ctx.currentTime + 2);

    // Ring pattern: 2s on, 3s pause
    setTimeout(() => playRing(), 5000);
  };

  playRing();

  return () => {
    playing = false;
    ctx.close().catch(() => {});
  };
}

export function IncomingCallModal({
  open,
  onClose,
  doctorName,
  doctorSpecialty,
  doctorAvatar,
  consultationId,
  doctorId,
}: IncomingCallModalProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [ringCount, setRingCount] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Notify the doctor that the patient rejected / didn't answer so their UI can stop waiting.
  const notifyDoctorRejection = useCallback(
    (reason: 'rejected' | 'no_answer') => {
      if (!doctorId) return;
      supabase
        .channel(`call-status-${doctorId}`)
        .send({
          type: 'broadcast',
          event: 'call_rejected',
          payload: { consultationId, reason },
        })
        .catch((e) => console.warn('call_rejected broadcast failed', e));
    },
    [doctorId, consultationId],
  );

  const handleReject = useCallback(() => {
    notifyDoctorRejection('rejected');
    onClose();
  }, [notifyDoctorRejection, onClose]);

  // Ringtone sound
  useEffect(() => {
    if (!open) return;
    const stop = createRingtone(audioCtxRef);
    return stop;
  }, [open]);

  // Pulse animation counter
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setRingCount(c => c + 1), 2000);
    return () => clearInterval(interval);
  }, [open]);

  // Auto-dismiss after 60 seconds — broadcast 'no_answer' to doctor before closing
  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => {
      notifyDoctorRejection('no_answer');
      onClose();
    }, 60000);
    return () => clearTimeout(timeout);
  }, [open, onClose, notifyDoctorRejection]);

  // Vibrate on mobile
  useEffect(() => {
    if (!open) return;
    if (navigator.vibrate) {
      const interval = setInterval(() => navigator.vibrate([200, 100, 200]), 4000);
      navigator.vibrate([200, 100, 200]);
      return () => { clearInterval(interval); navigator.vibrate(0); };
    }
  }, [open]);

  const handleAccept = () => {
    onClose();
    navigate(`/video-call?consultation=${consultationId}&autojoin=1`);
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleReject()}>
      <DialogContent className="sm:max-w-sm w-[calc(100vw-2rem)] p-0 overflow-hidden border-0 rounded-3xl bg-gradient-to-b from-[hsl(220,40%,13%)] to-[hsl(220,40%,8%)] text-white shadow-2xl shadow-black/50 [&>button]:text-white/70 [&>button:hover]:text-white">
        <div className="flex flex-col items-center py-8 sm:py-10 px-6">
          {/* Pulsing ring effect */}
          <div className="relative mb-6 w-28 h-28 flex items-center justify-center">
            <motion.div
              key={ringCount}
              className="absolute inset-0 rounded-full border-2 border-success/40"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 2, ease: 'easeOut' }}
            />
            <motion.div
              key={`ring2-${ringCount}`}
              className="absolute inset-0 rounded-full border-2 border-success/20"
              initial={{ scale: 1, opacity: 0.4 }}
              animate={{ scale: 2.8, opacity: 0 }}
              transition={{ duration: 2.5, ease: 'easeOut', delay: 0.3 }}
            />
            <Avatar className="w-24 h-24 ring-4 ring-success/40 shadow-xl shadow-emerald-500/20">
              <AvatarImage src={doctorAvatar} alt={doctorName} />
              <AvatarFallback className="bg-success/20 text-success text-2xl font-bold">
                {getInitials(doctorName)}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Info */}
          <p className="text-sm text-white/50 font-medium mb-1.5 tracking-wide uppercase text-[11px]">
            {t('incomingCallModal.incomingVideoCall')}
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">{doctorName}</h2>
          {doctorSpecialty && (
            <div className="flex items-center gap-1.5 text-success/90 text-sm mb-8 sm:mb-10">
              <Stethoscope className="w-4 h-4" />
              <span>{doctorSpecialty}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-10 sm:gap-12">
            <div className="flex flex-col items-center gap-2.5">
              <Button
                size="lg"
                className="rounded-full w-16 h-16 sm:w-18 sm:h-18 bg-destructive hover:bg-destructive shadow-lg shadow-red-500/40 border-0 active:scale-95 transition-transform"
                onClick={handleReject}
              >
                <PhoneOff className="w-7 h-7 text-white" />
              </Button>
              <span className="text-xs text-white/60 font-medium">{t('incomingCallModal.reject')}</span>
            </div>

            <div className="flex flex-col items-center gap-2.5">
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <Button
                  size="lg"
                  className="rounded-full w-16 h-16 sm:w-18 sm:h-18 bg-success hover:bg-success shadow-lg shadow-emerald-500/40 border-0 active:scale-95 transition-transform"
                  onClick={handleAccept}
                >
                  <Phone className="w-7 h-7 text-white" />
                </Button>
              </motion.div>
              <span className="text-xs text-white/60 font-medium">{t('incomingCallModal.accept')}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
