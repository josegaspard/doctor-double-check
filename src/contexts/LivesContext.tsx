import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext } from './AuthContext';

export type LiveStatus = 'live' | 'ended' | 'processing_recording' | 'recording_ready';

export interface Live {
  id: string;
  title: string;
  description?: string;
  doctorId: string;
  doctorName: string;
  doctorAvatar?: string;
  specialty: string;
  status: LiveStatus;
  viewerCount: number;
  likesCount: number;
  startedAt: Date;
  endedAt?: Date;
  thumbnailUrl?: string;
  recordingPrice?: number;
  tags: string[];
  followersCount?: number;
}

export interface Recording {
  id: string;
  liveId?: string;
  title: string;
  description?: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  duration: number;
  price: number;
  thumbnailUrl?: string;
  videoUrl?: string;
  createdAt: Date;
  tags: string[];
}

interface LivesContextType {
  lives: Live[];
  recordings: Recording[];
  isLoading: boolean;
  getLive: (id: string) => Live | undefined;
  getRecording: (id: string) => Recording | undefined;
  getLivesByDoctor: (doctorId: string) => Live[];
  getRecordingsByDoctor: (doctorId: string) => Recording[];
  likeLive: (liveId: string) => Promise<void>;
  unlikeLive: (liveId: string) => Promise<void>;
  hasLiked: (liveId: string) => boolean;
  createLive: (data: Partial<Live>) => Promise<{ success: boolean; liveId?: string; error?: string }>;
  endLive: (liveId: string, saveAsRecording?: boolean) => Promise<{ success: boolean; recordingId?: string; error?: string }>;
  refreshLives: () => Promise<void>;
  refreshRecordings: () => Promise<void>;
}

const LivesContext = createContext<LivesContextType | undefined>(undefined);

export function LivesProvider({ children }: { children: ReactNode }) {
  const authContext = useContext(AuthContext);
  const user = authContext?.user;
  const [lives, setLives] = useState<Live[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [likedLives, setLikedLives] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const fetchLives = useCallback(async () => {
    try {
      // Fetch lives without foreign key joins to avoid 400 errors
      const { data: livesData, error } = await supabase
        .from('lives')
        .select('*')
        .order('started_at', { ascending: false });

      if (error) {
        console.error('Error fetching lives:', error);
        return;
      }
      
      if (livesData && livesData.length > 0) {
        // Fetch doctor data from public views
        const doctorIds = [...new Set(livesData.map(l => l.doctor_id))];
        
        const [profilesResult, doctorProfilesResult] = await Promise.all([
          supabase
            .from('profiles_public')
            .select('id, name, avatar_url')
            .in('id', doctorIds),
          supabase
            .from('doctor_profiles_public')
            .select('user_id, followers_count')
            .in('user_id', doctorIds)
        ]);

        const profileMap = new Map(profilesResult.data?.map(p => [p.id, p]) || []);
        const doctorMap = new Map(doctorProfilesResult.data?.map(d => [d.user_id, d]) || []);

        setLives(livesData.map(l => ({
          id: l.id,
          title: l.title,
          description: l.description || undefined,
          doctorId: l.doctor_id,
          doctorName: profileMap.get(l.doctor_id)?.name || 'Doctor',
          doctorAvatar: profileMap.get(l.doctor_id)?.avatar_url || undefined,
          specialty: l.specialty,
          status: l.status as LiveStatus,
          viewerCount: l.viewer_count,
          likesCount: l.likes_count,
          startedAt: new Date(l.started_at),
          endedAt: l.ended_at ? new Date(l.ended_at) : undefined,
          thumbnailUrl: l.thumbnail_url || undefined,
          recordingPrice: l.recording_price ? Number(l.recording_price) : undefined,
          tags: l.tags || [],
          followersCount: doctorMap.get(l.doctor_id)?.followers_count || 0,
        })));
      } else {
        setLives([]);
      }
    } catch (error) {
      console.error('Error fetching lives:', error);
    }
  }, []);

  const fetchRecordings = useCallback(async () => {
    try {
      const { data: recordingsData } = await supabase
        .from('recordings')
        .select('*')
        .order('created_at', { ascending: false });

      if (recordingsData) {
        const doctorIds = [...new Set(recordingsData.map(r => r.doctor_id))];
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('id, name')
          .in('id', doctorIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        setRecordings(recordingsData.map(r => ({
          id: r.id,
          liveId: r.live_id || undefined,
          title: r.title,
          description: r.description || undefined,
          doctorId: r.doctor_id,
          doctorName: profileMap.get(r.doctor_id)?.name || 'Doctor',
          specialty: r.specialty,
          duration: r.duration,
          price: Number(r.price),
          thumbnailUrl: r.thumbnail_url || undefined,
          videoUrl: r.video_url || undefined,
          createdAt: new Date(r.created_at),
          tags: r.tags || [],
        })));
      }
    } catch (error) {
      console.error('Error fetching recordings:', error);
    }
  }, []);

  const fetchLikedLives = useCallback(async () => {
    if (!user?.id || user.role === 'visitor') return;

    try {
      const { data } = await supabase
        .from('live_likes')
        .select('live_id')
        .eq('user_id', user.id);

      if (data) {
        setLikedLives(new Set(data.map(l => l.live_id)));
      }
    } catch (error) {
      console.error('Error fetching liked lives:', error);
    }
  }, [user?.id, user?.role]);

  // Initial data load - only once
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (!isMounted) return;
      setIsLoading(true);
      await Promise.all([fetchLives(), fetchRecordings(), fetchLikedLives()]);
      if (isMounted) {
        setIsLoading(false);
      }
    };

    loadData();
    
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array - only run on mount

  // Realtime subscription - separate effect with stable channel
  useEffect(() => {
    const channel = supabase
      .channel('lives-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lives' },
        () => {
          fetchLives();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_likes' },
        () => {
          fetchLives();
          fetchLikedLives();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLives, fetchLikedLives]);

  const getLive = (id: string): Live | undefined => {
    return lives.find(l => l.id === id);
  };

  const getRecording = (id: string): Recording | undefined => {
    return recordings.find(r => r.id === id);
  };

  const getLivesByDoctor = (doctorId: string): Live[] => {
    return lives.filter(l => l.doctorId === doctorId);
  };

  const getRecordingsByDoctor = (doctorId: string): Recording[] => {
    return recordings.filter(r => r.doctorId === doctorId);
  };

  const likeLive = async (liveId: string) => {
    if (!user?.id || user.role === 'visitor') return;

    try {
      await supabase
        .from('live_likes')
        .insert({ live_id: liveId, user_id: user.id });

      setLikedLives(prev => new Set([...prev, liveId]));
    } catch (error) {
      console.error('Error liking live:', error);
    }
  };

  const unlikeLive = async (liveId: string) => {
    if (!user?.id) return;

    try {
      await supabase
        .from('live_likes')
        .delete()
        .eq('live_id', liveId)
        .eq('user_id', user.id);

      setLikedLives(prev => {
        const newSet = new Set(prev);
        newSet.delete(liveId);
        return newSet;
      });
    } catch (error) {
      console.error('Error unliking live:', error);
    }
  };

  const hasLiked = (liveId: string): boolean => {
    return likedLives.has(liveId);
  };

  const createLive = async (data: Partial<Live>): Promise<{ success: boolean; liveId?: string; error?: string }> => {
    if (!user?.id) return { success: false, error: 'Usuario no autenticado' };

    try {
      const { data: newLive, error } = await supabase
        .from('lives')
        .insert({
          doctor_id: user.id,
          title: data.title || 'Nueva transmisión',
          description: data.description,
          specialty: data.specialty || 'General',
          tags: data.tags || [],
          recording_price: data.recordingPrice,
        })
        .select()
        .single();

      if (error) throw error;

      // Notify subscribers automatically when live starts
      const { data: notifyResult } = await supabase.rpc('notify_subscribers', {
        p_doctor_id: user.id,
        p_notification_type: 'doctor_live',
        p_title: `🔴 ${user.name} está en vivo`,
        p_message: data.title || 'Nueva transmisión en vivo',
        p_data: { live_id: newLive.id, specialty: data.specialty || 'General' },
      });

      console.log(`Notified ${notifyResult} subscribers about new live`);

      await fetchLives();
      return { success: true, liveId: newLive.id };
    } catch (error: any) {
      return { success: false, error: error.message || 'Error al crear live' };
    }
  };

  const endLive = async (liveId: string, saveAsRecording: boolean = false): Promise<{ success: boolean; recordingId?: string; error?: string }> => {
    if (!user?.id) return { success: false, error: 'Usuario no autenticado' };

    try {
      // Get the live data first
      const live = lives.find(l => l.id === liveId);
      if (!live) return { success: false, error: 'Live no encontrado' };

      // Update live status
      const newStatus = saveAsRecording ? 'processing_recording' : 'ended';
      const { error } = await supabase
        .from('lives')
        .update({ status: newStatus, ended_at: new Date().toISOString() })
        .eq('id', liveId)
        .eq('doctor_id', user.id);

      if (error) throw error;

      let recordingId: string | undefined;

      // Create recording if requested
      if (saveAsRecording) {
        const duration = Math.floor((Date.now() - live.startedAt.getTime()) / 60000); // Duration in minutes
        
        const { data: newRecording, error: recordingError } = await supabase
          .from('recordings')
          .insert({
            live_id: liveId,
            doctor_id: user.id,
            title: live.title,
            description: live.description,
            specialty: live.specialty,
            duration: duration,
            price: live.recordingPrice || 0,
            tags: live.tags,
            thumbnail_url: live.thumbnailUrl,
          })
          .select()
          .single();

        if (recordingError) {
          console.error('Error creating recording:', recordingError);
        } else {
          recordingId = newRecording.id;
          
          // Update live status to recording_ready
          await supabase
            .from('lives')
            .update({ status: 'recording_ready' })
            .eq('id', liveId);
        }
      }

      await Promise.all([fetchLives(), fetchRecordings()]);
      return { success: true, recordingId };
    } catch (error: any) {
      return { success: false, error: error.message || 'Error al terminar live' };
    }
  };

  const refreshLives = async () => {
    await fetchLives();
  };

  const refreshRecordings = async () => {
    await fetchRecordings();
  };

  return (
    <LivesContext.Provider
      value={{
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
        refreshLives,
        refreshRecordings,
      }}
    >
      {children}
    </LivesContext.Provider>
  );
}

export function useLives() {
  const context = useContext(LivesContext);
  if (context === undefined) {
    throw new Error('useLives must be used within a LivesProvider');
  }
  return context;
}
