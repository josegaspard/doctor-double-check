import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PendingRating {
  consultationId: string;
  doctorId: string;
  doctorName: string;
}

export function usePostConsultationRating() {
  const { user, role } = useAuth();
  const [pendingRating, setPendingRating] = useState<PendingRating | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const recentlyRatedIds = useRef<Set<string>>(new Set());
  const isCheckingRef = useRef(false);
  const dialogShownForId = useRef<string | null>(null);

  // Check for consultations that were closed but not yet rated
  const checkPendingRatings = useCallback(async () => {
    if (!user?.id || role !== 'patient') return;
    // Prevent concurrent checks
    if (isCheckingRef.current) return;
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
        return;
      }

      const { data: existingRatings } = await supabase
        .from('consultation_ratings')
        .select('consultation_id')
        .eq('patient_id', user.id)
        .in('consultation_id', closedConsultations.map(c => c.id));

      const ratedIds = new Set(existingRatings?.map(r => r.consultation_id) || []);
      
      const unrated = closedConsultations.find(c => 
        !ratedIds.has(c.id) && 
        !recentlyRatedIds.current.has(c.id) &&
        dialogShownForId.current !== c.id
      );
      
      if (unrated) {
        const { data: doctorProfile } = await supabase
          .from('profiles_public')
          .select('name')
          .eq('id', unrated.doctor_id)
          .single();

        setPendingRating({
          consultationId: unrated.id,
          doctorId: unrated.doctor_id,
          doctorName: doctorProfile?.name || 'tu médico',
        });

        const endedAt = new Date(unrated.ended_at);
        const hoursAgo = (Date.now() - endedAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursAgo < 24 && dialogShownForId.current !== unrated.id) {
          dialogShownForId.current = unrated.id;
          setTimeout(() => setIsDialogOpen(true), 1500);
        }
      }
    } catch (error) {
      console.error('Error checking pending ratings:', error);
    } finally {
      isCheckingRef.current = false;
    }
  }, [user?.id, role]);

  // Force open the dialog immediately (used when clicking notification)
  const forceOpenDialog = useCallback(() => {
    if (pendingRating) {
      dialogShownForId.current = pendingRating.consultationId;
      setIsDialogOpen(true);
    } else {
      (async () => {
        await checkPendingRatings();
        setIsDialogOpen(true);
      })();
    }
  }, [pendingRating, checkPendingRatings]);

  useEffect(() => {
    checkPendingRatings();

    const handleTrigger = () => {
      forceOpenDialog();
    };
    window.addEventListener('trigger-rating-check', handleTrigger);

    if (!user?.id || role !== 'patient') return;
    
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
            setTimeout(checkPendingRatings, 1500);
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
              // Don't trigger if consultation channel already handled it
              setTimeout(checkPendingRatings, 3000);
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

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    setPendingRating(null);
  }, []);

  const onRated = useCallback(() => {
    // Mark as recently rated to prevent re-showing
    if (pendingRating) {
      recentlyRatedIds.current.add(pendingRating.consultationId);
    }
    setIsDialogOpen(false);
    setPendingRating(null);
  }, [pendingRating]);

  return {
    pendingRating,
    isDialogOpen,
    closeDialog,
    onRated,
    checkPendingRatings,
  };
}
