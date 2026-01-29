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
        setLives([]);
      } else if (livesData && livesData.length > 0) {
        // Get unique doctor IDs
        const doctorIds = [...new Set(livesData.map(l => l.doctor_id))];
        
        // Batch fetch profiles from public views (no RLS issues)
        const [profilesResult, doctorProfilesResult] = await Promise.all([
          supabase
            .from('profiles_public')
            .select('id, name, avatar_url')
            .in('id', doctorIds),
          supabase
            .from('doctor_profiles_public')
            .select('user_id, specialty, bio, followers_count')
            .in('user_id', doctorIds)
        ]);

        const profileMap = new Map(profilesResult.data?.map(p => [p.id, p]) || []);
        const doctorProfileMap = new Map(doctorProfilesResult.data?.map(d => [d.user_id, d]) || []);

        setLives(livesData.map(live => ({
          ...live,
          doctor: profileMap.get(live.doctor_id) || undefined,
          doctor_profile: doctorProfileMap.get(live.doctor_id) || undefined,
        } as Live)));
      } else {
        setLives([]);
      }

      // Fetch recordings
      const { data: recordingsData, error: recordingsError } = await supabase
        .from('recordings')
        .select('*')
        .order('created_at', { ascending: false });

      if (recordingsError) {
        console.error('Error fetching recordings:', recordingsError);
        setRecordings([]);
      } else if (recordingsData && recordingsData.length > 0) {
        // Get unique doctor IDs
        const doctorIds = [...new Set(recordingsData.map(r => r.doctor_id))];
        
        // Batch fetch profiles from public view
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('id, name, avatar_url')
          .in('id', doctorIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        setRecordings(recordingsData.map(rec => ({
          ...rec,
          doctor: profileMap.get(rec.doctor_id) || undefined,
        } as Recording)));
      } else {
        setRecordings([]);
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
