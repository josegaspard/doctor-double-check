import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, PhoneOff, Stethoscope } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface IncomingCallModalProps {
  open: boolean;
  onClose: () => void;
  doctorName: string;
  doctorSpecialty?: string;
  doctorAvatar?: string;
  consultationId: string;
}

export function IncomingCallModal({
  open,
  onClose,
  doctorName,
  doctorSpecialty,
  doctorAvatar,
  consultationId,
}: IncomingCallModalProps) {
  const navigate = useNavigate();
  const [ringCount, setRingCount] = useState(0);

  // Pulse animation counter
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setRingCount(c => c + 1), 2000);
    return () => clearInterval(interval);
  }, [open]);

  // Auto-dismiss after 60 seconds
  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(onClose, 60000);
    return () => clearTimeout(timeout);
  }, [open, onClose]);

  const handleAccept = () => {
    onClose();
    navigate(`/video-call?consultation=${consultationId}&autojoin=1`);
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden border-0 bg-gradient-to-b from-slate-900 to-slate-800 text-white shadow-2xl [&>button]:text-white">
        <div className="flex flex-col items-center py-10 px-6">
          {/* Pulsing ring effect */}
          <div className="relative mb-6">
            <motion.div
              key={ringCount}
              className="absolute inset-0 rounded-full border-2 border-primary/40"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 2.5, opacity: 0 }}
              transition={{ duration: 2, ease: 'easeOut' }}
            />
            <motion.div
              key={`ring2-${ringCount}`}
              className="absolute inset-0 rounded-full border-2 border-primary/30"
              initial={{ scale: 1, opacity: 0.4 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{ duration: 2.5, ease: 'easeOut', delay: 0.3 }}
            />
            <Avatar className="w-24 h-24 ring-4 ring-primary/50 shadow-xl shadow-primary/20">
              <AvatarImage src={doctorAvatar} alt={doctorName} />
              <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">
                {getInitials(doctorName)}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Info */}
          <p className="text-sm text-slate-400 mb-1">Videollamada entrante</p>
          <h2 className="text-xl font-bold mb-1">{doctorName}</h2>
          {doctorSpecialty && (
            <div className="flex items-center gap-1.5 text-primary/80 text-sm mb-8">
              <Stethoscope className="w-4 h-4" />
              {doctorSpecialty}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <Button
                size="lg"
                variant="destructive"
                className="rounded-full w-16 h-16 shadow-lg shadow-destructive/30"
                onClick={onClose}
              >
                <PhoneOff className="w-7 h-7" />
              </Button>
              <span className="text-xs text-slate-400">Rechazar</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <Button
                  size="lg"
                  className="rounded-full w-16 h-16 bg-success hover:bg-success/90 shadow-lg shadow-success/30"
                  onClick={handleAccept}
                >
                  <Phone className="w-7 h-7" />
                </Button>
              </motion.div>
              <span className="text-xs text-slate-400">Aceptar</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
