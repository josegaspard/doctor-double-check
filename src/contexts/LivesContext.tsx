import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
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
  dailyRoomName?: string;
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

// Throttle function to limit API calls
function throttle<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;
  
  return ((...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = delay - (now - lastCall);
    
    if (remaining <= 0) {
      lastCall = now;
      return fn(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn(...args);
      }, remaining);
    }
  }) as T;
}

export function LivesProvider({ children }: { children: ReactNode }) {
  const authContext = useContext(AuthContext);
  const user = authContext?.user;
  const [lives, setLives] = useState<Live[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [likedLives, setLikedLives] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  
  // Track if initial load is done
  const initialLoadDone = useRef(false);
  // Track last fetch time to prevent rapid re-fetches
  const lastFetchTime = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 5000; // Minimum 5 seconds between fetches
  
  // Cache for doctor profiles to reduce redundant queries
  const profileCache = useRef<Map<string, { name: string; avatar_url?: string }>>(new Map());
  const doctorProfileCache = useRef<Map<string, { followers_count: number }>>(new Map());

  const fetchLives = useCallback(async (force = false) => {
    const now = Date.now();
    
    // Skip if fetched recently (unless forced)
    if (!force && now - lastFetchTime.current < MIN_FETCH_INTERVAL) {
      return;
    }
    
    lastFetchTime.current = now;
    
    try {
      const { data: livesData, error } = await supabase
        .from('lives')
        .select('*')
        .order('started_at', { ascending: false });

      if (error) {
        console.error('Error fetching lives:', error);
        return;
      }
      
      if (livesData && livesData.length > 0) {
        // Get unique doctor IDs that aren't in cache
        const doctorIds = [...new Set(livesData.map(l => l.doctor_id))];
        const uncachedIds = doctorIds.filter(id => !profileCache.current.has(id));
        
        // Only fetch profiles not in cache
        if (uncachedIds.length > 0) {
          const [profilesResult, doctorProfilesResult] = await Promise.all([
            supabase
              .from('profiles_public')
              .select('id, name, avatar_url')
              .in('id', uncachedIds),
            supabase
              .from('doctor_profiles_public')
              .select('user_id, followers_count')
              .in('user_id', uncachedIds)
          ]);

          // Update caches
          profilesResult.data?.forEach(p => {
            profileCache.current.set(p.id, { name: p.name || 'Doctor', avatar_url: p.avatar_url || undefined });
          });
          doctorProfilesResult.data?.forEach(d => {
            doctorProfileCache.current.set(d.user_id, { followers_count: d.followers_count || 0 });
          });
        }

        setLives(livesData.map(l => ({
          id: l.id,
          title: l.title,
          description: l.description || undefined,
          doctorId: l.doctor_id,
          doctorName: profileCache.current.get(l.doctor_id)?.name || 'Doctor',
          doctorAvatar: profileCache.current.get(l.doctor_id)?.avatar_url,
          specialty: l.specialty,
          status: l.status as LiveStatus,
          viewerCount: l.viewer_count,
          likesCount: l.likes_count,
          startedAt: new Date(l.started_at),
          endedAt: l.ended_at ? new Date(l.ended_at) : undefined,
          thumbnailUrl: l.thumbnail_url || undefined,
          recordingPrice: l.recording_price ? Number(l.recording_price) : undefined,
          tags: l.tags || [],
          followersCount: doctorProfileCache.current.get(l.doctor_id)?.followers_count || 0,
          dailyRoomName: (l as any).daily_room_name || undefined,
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
        const uncachedIds = doctorIds.filter(id => !profileCache.current.has(id));
        
        if (uncachedIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles_public')
            .select('id, name')
            .in('id', uncachedIds);

          profiles?.forEach(p => {
            if (!profileCache.current.has(p.id)) {
              profileCache.current.set(p.id, { name: p.name || 'Doctor' });
            }
          });
        }

        setRecordings(recordingsData.map(r => ({
          id: r.id,
          liveId: r.live_id || undefined,
          title: r.title,
          description: r.description || undefined,
          doctorId: r.doctor_id,
          doctorName: profileCache.current.get(r.doctor_id)?.name || 'Doctor',
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

  // Throttled fetch for realtime updates - prevents rapid re-fetches
  const throttledFetchLives = useMemo(
    () => throttle(() => fetchLives(false), 3000),
    [fetchLives]
  );

  // Initial data load - only once
  useEffect(() => {
    if (initialLoadDone.current) return;
    
    let isMounted = true;
    
    const loadData = async () => {
      if (!isMounted) return;
      setIsLoading(true);
      await Promise.all([fetchLives(true), fetchRecordings(), fetchLikedLives()]);
      if (isMounted) {
        setIsLoading(false);
        initialLoadDone.current = true;
      }
    };

    loadData();
    
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array - only run on mount

  // Realtime subscription with intelligent batching
  useEffect(() => {
    // Use a single channel with batched updates
    const channel = supabase
      .channel('lives-realtime-optimized')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lives' },
        (payload) => {
          // For INSERT/UPDATE, update state directly when possible
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const record = payload.new as any;
            
            setLives(prev => {
              const existing = prev.find(l => l.id === record.id);
              const updatedLive: Live = {
                id: record.id,
                title: record.title,
                description: record.description || undefined,
                doctorId: record.doctor_id,
                doctorName: existing?.doctorName || profileCache.current.get(record.doctor_id)?.name || 'Doctor',
                doctorAvatar: existing?.doctorAvatar || profileCache.current.get(record.doctor_id)?.avatar_url,
                specialty: record.specialty,
                status: record.status as LiveStatus,
                viewerCount: record.viewer_count,
                likesCount: record.likes_count,
                startedAt: new Date(record.started_at),
                endedAt: record.ended_at ? new Date(record.ended_at) : undefined,
                thumbnailUrl: record.thumbnail_url || undefined,
                recordingPrice: record.recording_price ? Number(record.recording_price) : undefined,
                tags: record.tags || [],
                followersCount: existing?.followersCount || doctorProfileCache.current.get(record.doctor_id)?.followers_count || 0,
                dailyRoomName: record.daily_room_name || undefined,
              };
              
              if (existing) {
                return prev.map(l => l.id === record.id ? updatedLive : l);
              } else {
                // New live - fetch doctor info if not cached
                if (!profileCache.current.has(record.doctor_id)) {
                  throttledFetchLives();
                }
                return [updatedLive, ...prev];
              }
            });
          } else if (payload.eventType === 'DELETE') {
            setLives(prev => prev.filter(l => l.id !== (payload.old as any).id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_likes' },
        () => {
          // Only refresh liked lives for the current user, not full fetch
          fetchLikedLives();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [throttledFetchLives, fetchLikedLives]);

  const getLive = useCallback((id: string): Live | undefined => {
    return lives.find(l => l.id === id);
  }, [lives]);

  const getRecording = useCallback((id: string): Recording | undefined => {
    return recordings.find(r => r.id === id);
  }, [recordings]);

  const getLivesByDoctor = useCallback((doctorId: string): Live[] => {
    return lives.filter(l => l.doctorId === doctorId);
  }, [lives]);

  const getRecordingsByDoctor = useCallback((doctorId: string): Recording[] => {
    return recordings.filter(r => r.doctorId === doctorId);
  }, [recordings]);

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

  const hasLiked = useCallback((liveId: string): boolean => {
    return likedLives.has(liveId);
  }, [likedLives]);

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

      await Promise.all([fetchLives(true), fetchRecordings()]);
      return { success: true, recordingId };
    } catch (error: any) {
      return { success: false, error: error.message || 'Error al terminar live' };
    }
  };

  const refreshLives = useCallback(async () => {
    await fetchLives(true);
  }, [fetchLives]);

  const refreshRecordings = useCallback(async () => {
    await fetchRecordings();
  }, [fetchRecordings]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
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
  }), [lives, recordings, isLoading, getLive, getRecording, getLivesByDoctor, getRecordingsByDoctor, hasLiked, refreshLives, refreshRecordings]);

  return (
    <LivesContext.Provider value={contextValue}>
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
