import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PendingRating {
  consultationId: string;
  doctorId: string;
  doctorName: string;
}

// Consultas cuyo aviso ya se cerró en esta sesión («Ahora no», la X o Escape). No se
// vuelven a abrir solas hasta la próxima sesión; solo si el paciente pulsa la notificación.
const DISMISSED_KEY = 'mm_rating_dismissed';

function readDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<string>) {
  try {
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {
    /* sin almacenamiento: queda en memoria */
  }
}

export function usePostConsultationRating() {
  const { user, role } = useAuth();
  const [pendingRating, setPendingRating] = useState<PendingRating | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const recentlyRatedIds = useRef<Set<string>>(new Set());
  const isCheckingRef = useRef(false);
  const dialogShownForId = useRef<string | null>(null);
  const dismissedIds = useRef<Set<string>>(readDismissed());
  // Consultas sin calificar vistas en la última comprobación: al cerrar o calificar una,
  // las demás también se dan por vistas, para no encadenar un aviso tras otro.
  const lastUnratedIds = useRef<string[]>([]);
  const pendingRef = useRef<PendingRating | null>(null);
  pendingRef.current = pendingRating;

  // Check for consultations that were closed but not yet rated
  // force = el paciente pulsó la notificación: se abre aunque la hubiera cerrado antes.
  const checkPendingRatings = useCallback(async (force = false): Promise<boolean> => {
    if (!user?.id || role !== 'patient') return false;
    // Prevent concurrent checks
    if (isCheckingRef.current) return false;
    isCheckingRef.current = true;

    try {
      const { data: closedConsultations } = await supabase
        .from('consultations')
        .select('id, doctor_id, ended_at')
        .eq('patient_id', user.id)
        .not('ended_at', 'is', null)
        .order('ended_at', { ascending: false })
        .limit(5);

      if (!closedConsultations || closedConsultations.length === 0) {
        isCheckingRef.current = false;
        return false;
      }

      const { data: existingRatings } = await supabase
        .from('consultation_ratings')
        .select('consultation_id')
        .eq('patient_id', user.id)
        .in('consultation_id', closedConsultations.map(c => c.id));

      const ratedIds = new Set(existingRatings?.map(r => r.consultation_id) || []);
      
      const unratedAll = closedConsultations.filter(c =>
        !ratedIds.has(c.id) &&
        !recentlyRatedIds.current.has(c.id)
      );
      lastUnratedIds.current = unratedAll.map(c => c.id);
      const unrated = force
        ? unratedAll[0]
        : unratedAll.find(c =>
            !dismissedIds.current.has(c.id) &&
            dialogShownForId.current !== c.id
          );

      if (unrated) {
        const { data: doctorProfile } = await supabase
          .from('profiles_public')
          .select('name')
          .eq('id', unrated.doctor_id)
          .maybeSingle();

        setPendingRating({
          consultationId: unrated.id,
          doctorId: unrated.doctor_id,
          doctorName: doctorProfile?.name || 'tu médico',
        });

        const endedAt = new Date(unrated.ended_at);
        const hoursAgo = (Date.now() - endedAt.getTime()) / (1000 * 60 * 60);
        
        if (!force && hoursAgo < 24 && dialogShownForId.current !== unrated.id) {
          dialogShownForId.current = unrated.id;
          setTimeout(() => setIsDialogOpen(true), 1500);
        }
      }
      return !!unrated;
    } catch (error) {
      console.error('Error checking pending ratings:', error);
      return false;
    } finally {
      isCheckingRef.current = false;
    }
  }, [user?.id, role]);

  // Force open the dialog immediately (used when clicking notification)
  // Lee pendingRating de una ref: así no cambia al cerrar el diálogo y el efecto de abajo
  // no vuelve a comprobar (y a abrir) en cuanto el paciente lo cierra.
  const forceOpenDialog = useCallback(() => {
    const current = pendingRef.current;
    if (current) {
      dialogShownForId.current = current.consultationId;
      setIsDialogOpen(true);
    } else {
      (async () => {
        if (await checkPendingRatings(true)) setIsDialogOpen(true);
      })();
    }
  }, [checkPendingRatings]);

  useEffect(() => {
    checkPendingRatings();

    const handleTrigger = () => {
      forceOpenDialog();
    };
    window.addEventListener('trigger-rating-check', handleTrigger);

    if (!user?.id || role !== 'patient') {
      return () => {
        window.removeEventListener('trigger-rating-check', handleTrigger);
      };
    }
    
    const channel = supabase
      .channel(`consultation-rating-check-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'consultations',
          filter: `patient_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new?.ended_at && !payload.old?.ended_at && !isCheckingRef.current) {
            setTimeout(() => checkPendingRatings(), 1500);
          }
        }
      )
      .subscribe();

    const chatChannel = supabase
      .channel(`chat-session-closed-rating-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_sessions',
        },
        (payload) => {
          if (payload.new?.status === 'closed' && payload.old?.status === 'active') {
            const isParticipant = payload.new.participant1_id === user.id || payload.new.participant2_id === user.id;
            if (isParticipant && !isCheckingRef.current) {
              setTimeout(() => checkPendingRatings(), 3000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('trigger-rating-check', handleTrigger);
      supabase.removeChannel(channel);
      supabase.removeChannel(chatChannel);
    };
  }, [checkPendingRatings, forceOpenDialog, user?.id, role]);

  // Al cerrar o calificar, la consulta y las demás pendientes ya vistas no se reabren solas
  // en esta sesión. Una consulta que termine después sí avisa.
  const markSeen = useCallback((consultationId?: string) => {
    if (consultationId) dismissedIds.current.add(consultationId);
    lastUnratedIds.current.forEach(id => dismissedIds.current.add(id));
    writeDismissed(dismissedIds.current);
  }, []);

  const closeDialog = useCallback(() => {
    markSeen(pendingRef.current?.consultationId);
    setIsDialogOpen(false);
    setPendingRating(null);
  }, [markSeen]);

  const onRated = useCallback(() => {
    // Mark as recently rated to prevent re-showing
    const current = pendingRef.current;
    if (current) {
      recentlyRatedIds.current.add(current.consultationId);
    }
    markSeen();
    setIsDialogOpen(false);
    setPendingRating(null);
  }, [markSeen]);

  return {
    pendingRating,
    isDialogOpen,
    closeDialog,
    onRated,
    checkPendingRatings,
  };
}
