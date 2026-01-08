import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Live, Recording, LiveLike } from '@/types/database';

export function useLives() {
  const [lives, setLives] = useState<Live[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch lives and recordings
  const fetchData = useCallback(async () => {
    try {
      // Fetch active lives
      const { data: livesData, error: livesError } = await supabase
        .from('lives')
        .select('*')
        .order('started_at', { ascending: false });

      if (livesError) {
        console.error('Error fetching lives:', livesError);
      } else {
        // Enrich with doctor data
        const enrichedLives = await Promise.all(
          (livesData || []).map(async (live) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', live.doctor_id)
              .single();
            
            const { data: doctorProfile } = await supabase
              .from('doctor_profiles')
              .select('*')
              .eq('user_id', live.doctor_id)
              .single();

            return {
              ...live,
              doctor: profile || undefined,
              doctor_profile: doctorProfile || undefined,
            } as Live;
          })
        );
        setLives(enrichedLives);
      }

      // Fetch recordings
      const { data: recordingsData, error: recordingsError } = await supabase
        .from('recordings')
        .select('*')
        .order('created_at', { ascending: false });

      if (recordingsError) {
        console.error('Error fetching recordings:', recordingsError);
      } else {
        // Enrich with doctor data
        const enrichedRecordings = await Promise.all(
          (recordingsData || []).map(async (rec) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', rec.doctor_id)
              .single();

            return {
              ...rec,
              doctor: profile || undefined,
            } as Recording;
          })
        );
        setRecordings(enrichedRecordings);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Subscribe to realtime updates for lives
    const channel = supabase
      .channel('lives-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lives' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Get a specific live
  const getLive = (id: string): Live | undefined => {
    return lives.find(l => l.id === id);
  };

  // Get a specific recording
  const getRecording = (id: string): Recording | undefined => {
    return recordings.find(r => r.id === id);
  };

  // Get lives by doctor
  const getLivesByDoctor = (doctorId: string): Live[] => {
    return lives.filter(l => l.doctor_id === doctorId);
  };

  // Get recordings by doctor
  const getRecordingsByDoctor = (doctorId: string): Recording[] => {
    return recordings.filter(r => r.doctor_id === doctorId);
  };

  // Like a live
  const likeLive = async (liveId: string, userId: string): Promise<{ success: boolean }> => {
    try {
      const { error } = await supabase
        .from('live_likes')
        .insert({ live_id: liveId, user_id: userId });

      if (error && error.code !== '23505') { // Ignore duplicate key error
        console.error('Error liking live:', error);
        return { success: false };
      }

      await fetchData();
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  };

  // Unlike a live
  const unlikeLive = async (liveId: string, userId: string): Promise<{ success: boolean }> => {
    try {
      const { error } = await supabase
        .from('live_likes')
        .delete()
        .eq('live_id', liveId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error unliking live:', error);
        return { success: false };
      }

      await fetchData();
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  };

  // Check if user liked a live
  const hasLiked = async (liveId: string, userId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('live_likes')
      .select('id')
      .eq('live_id', liveId)
      .eq('user_id', userId)
      .single();

    return !!data;
  };

  // Create a new live (for doctors/residents)
  const createLive = async (data: {
    title: string;
    description?: string;
    specialty: string;
    tags?: string[];
    recording_price?: number;
  }, doctorId: string): Promise<{ success: boolean; live?: Live; error?: string }> => {
    try {
      const { data: newLive, error } = await supabase
        .from('lives')
        .insert({
          doctor_id: doctorId,
          title: data.title,
          description: data.description,
          specialty: data.specialty,
          tags: data.tags || [],
          recording_price: data.recording_price,
          status: 'live',
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      await fetchData();
      return { success: true, live: newLive as Live };
    } catch (error) {
      return { success: false, error: 'Error al crear live' };
    }
  };

  // End a live
  const endLive = async (liveId: string): Promise<{ success: boolean }> => {
    try {
      const { error } = await supabase
        .from('lives')
        .update({ 
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('id', liveId);

      if (error) {
        console.error('Error ending live:', error);
        return { success: false };
      }

      await fetchData();
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  };

  return {
    lives,
    recordings,
    isLoading,
    getLive,
    getRecording,
    getLivesByDoctor,
    getRecordingsByDoctor,
    likeLive,
    unlikeLive,
    hasLiked,
    createLive,
    endLive,
    refresh: fetchData,
  };
}
