import { useState, useEffect, useCallback } from 'react';
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

  // Check for consultations that were closed but not yet rated
  const checkPendingRatings = useCallback(async () => {
    if (!user?.id || role !== 'patient') return;

    try {
      // Find consultations that ended (closed or with ended_at set) and don't have a rating yet
      const { data: closedConsultations } = await supabase
        .from('consultations')
        .select('id, doctor_id, ended_at')
        .eq('patient_id', user.id)
        .not('ended_at', 'is', null)
        .order('ended_at', { ascending: false })
        .limit(5);

      if (!closedConsultations || closedConsultations.length === 0) return;

      // Check which ones are already rated
      const { data: existingRatings } = await supabase
        .from('consultation_ratings')
        .select('consultation_id')
        .eq('patient_id', user.id)
        .in('consultation_id', closedConsultations.map(c => c.id));

      const ratedIds = new Set(existingRatings?.map(r => r.consultation_id) || []);
      
      // Find the first unrated consultation
      const unrated = closedConsultations.find(c => !ratedIds.has(c.id));
      
      if (unrated) {
        // Fetch doctor name
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

        // Auto-show dialog if consultation ended recently (within 24h)
        const endedAt = new Date(unrated.ended_at);
        const hoursAgo = (Date.now() - endedAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursAgo < 24) {
          setTimeout(() => setIsDialogOpen(true), 1500);
        }
      }
    } catch (error) {
      console.error('Error checking pending ratings:', error);
    }
  }, [user?.id, role]);

  // Force open the dialog immediately (used when clicking notification)
  const forceOpenDialog = useCallback(() => {
    if (pendingRating) {
      setIsDialogOpen(true);
    } else {
      // No pending rating cached yet — fetch and open immediately
      (async () => {
        await checkPendingRatings();
        // After check, force open
        setIsDialogOpen(true);
      })();
    }
  }, [pendingRating, checkPendingRatings]);

  useEffect(() => {
    checkPendingRatings();

    // Listen for manual trigger from notification click — open immediately
    const handleTrigger = () => {
      forceOpenDialog();
    };
    window.addEventListener('trigger-rating-check', handleTrigger);

    // Listen for consultation updates (e.g., doctor closes the session)
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
          if (payload.new?.ended_at && !payload.old?.ended_at && !isDialogOpen) {
            setTimeout(checkPendingRatings, 1000);
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
            if (isParticipant && !isDialogOpen) {
              setTimeout(checkPendingRatings, 1500);
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
  }, [checkPendingRatings, forceOpenDialog, user?.id, role, isDialogOpen]);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    setPendingRating(null);
  }, []);

  const onRated = useCallback(() => {
    setIsDialogOpen(false);
    setPendingRating(null);
    // Check if there are more pending ratings
    setTimeout(checkPendingRatings, 1000);
  }, [checkPendingRatings]);

  return {
    pendingRating,
    isDialogOpen,
    closeDialog,
    onRated,
    checkPendingRatings,
  };
}
