import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { tContext } from '@/lib/i18n-context';
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
          dailyRoomName: l.daily_room_name || undefined,
        })));
      } else {
        setLives([]);
      }
    } catch (error) {
      console.error('Error fetching lives:', error);
    }
  }, []);

  const CLOUDFLARE_CUSTOMER_SUBDOMAIN = 'customer-3afz9zesalmyroc9.cloudflarestream.com';

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

        // For recordings without thumbnails, try to get thumbnail from linked live
        const liveIdsForThumbnails = recordingsData
          .filter(r => !r.thumbnail_url && r.live_id)
          .map(r => r.live_id!);
        
        const liveStreamUids = new Map<string, string>();
        const liveThumbnails = new Map<string, string>();
        if (liveIdsForThumbnails.length > 0) {
          const { data: livesData } = await supabase
            .from('lives')
            .select('id, daily_room_name, thumbnail_url')
            .in('id', liveIdsForThumbnails);
          
          livesData?.forEach(l => {
            if (l.daily_room_name) {
              liveStreamUids.set(l.id, l.daily_room_name);
            }
            if (l.thumbnail_url) {
              liveThumbnails.set(l.id, l.thumbnail_url);
            }
          });
        }

        setRecordings(recordingsData.map(r => {
          let thumbnailUrl = r.thumbnail_url || undefined;
          
          // Try live's own uploaded thumbnail first
          if (!thumbnailUrl && r.live_id && liveThumbnails.has(r.live_id)) {
            thumbnailUrl = liveThumbnails.get(r.live_id)!;
          }
          
          // Auto-generate Cloudflare thumbnail if still none
          if (!thumbnailUrl && r.live_id && liveStreamUids.has(r.live_id)) {
            const streamUid = liveStreamUids.get(r.live_id)!;
            thumbnailUrl = `https://${CLOUDFLARE_CUSTOMER_SUBDOMAIN}/${streamUid}/thumbnails/thumbnail.jpg`;
          }

          return {
            id: r.id,
            liveId: r.live_id || undefined,
            title: r.title,
            description: r.description || undefined,
            doctorId: r.doctor_id,
            doctorName: profileCache.current.get(r.doctor_id)?.name || 'Doctor',
            specialty: r.specialty,
            duration: r.duration,
            price: Number(r.price),
            thumbnailUrl,
            videoUrl: r.video_url || undefined,
            createdAt: new Date(r.created_at),
            tags: r.tags || [],
          };
        }));
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run on mount

  // Auto-cleanup stuck lives for the current user (doctor only)
  useEffect(() => {
    const cleanupStuckLives = async () => {
      if (!user?.id || user.role !== 'doctor') return;
      
      try {
        // Find lives that are stuck in 'live' status but have no daily room or are older than 6 hours
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
        
        const { data: stuckLives, error } = await supabase
          .from('lives')
          .select('id')
          .eq('doctor_id', user.id)
          .eq('status', 'live')
          .lt('started_at', sixHoursAgo);
        
        if (error || !stuckLives?.length) return;
        
        // Clean up stuck lives
        await supabase
          .from('lives')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .in('id', stuckLives.map(l => l.id));
        
        console.log(`Cleaned up ${stuckLives.length} stuck lives`);
        fetchLives(true);
      } catch (error) {
        console.error('Error cleaning up stuck lives:', error);
      }
    };
    
    cleanupStuckLives();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

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
            const record = payload.new as { id: string; title: string; description?: string; doctor_id: string; specialty: string; status: string; viewer_count: number; likes_count: number; started_at: string; ended_at?: string; thumbnail_url?: string; recording_price?: number; tags?: string[]; daily_room_name?: string };
            
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
            const oldRecord = payload.old as { id: string };
            setLives(prev => prev.filter(l => l.id !== oldRecord.id));
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recordings' },
        () => {
          // Refresh recordings when there are changes
          fetchRecordings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [throttledFetchLives, fetchLikedLives, fetchRecordings]);

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
    if (!user?.id) return { success: false, error: tContext('contextErrors.notAuthenticated') };

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
      return { success: false, error: error.message || tContext('contextErrors.createLiveError') };
    }
  };

  const endLive = async (liveId: string, saveAsRecording: boolean = false): Promise<{ success: boolean; recordingId?: string; error?: string }> => {
    if (!user?.id) return { success: false, error: tContext('contextErrors.notAuthenticated') };

    try {
      const live = lives.find(l => l.id === liveId);
      if (!live) return { success: false, error: tContext('contextErrors.liveNotFound') };

      // End Daily room if it exists
      if (live.dailyRoomName) {
        await supabase.functions.invoke('end-daily-room', {
          body: { roomName: live.dailyRoomName },
        }).catch(err => console.warn('end-daily-room error (non-fatal):', err));
      }

      // Update live status in DB
      const { error } = await supabase
        .from('lives')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', liveId)
        .eq('doctor_id', user.id);

      if (error) throw error;

      await Promise.all([fetchLives(true), fetchRecordings()]);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || tContext('contextErrors.endLiveGenericError') };
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

// Default value for resilience during HMR / module re-evaluation
const LIVES_DEFAULTS: LivesContextType = {
  lives: [],
  recordings: [],
  isLoading: true,
  getLive: () => undefined,
  getRecording: () => undefined,
  getLivesByDoctor: () => [],
  getRecordingsByDoctor: () => [],
  likeLive: async () => {},
  unlikeLive: async () => {},
  hasLiked: () => false,
  createLive: async () => ({ success: false, error: 'Context not ready' }),
  endLive: async () => ({ success: false, error: 'Context not ready' }),
  refreshLives: async () => {},
  refreshRecordings: async () => {},
};

export function useLives() {
  const context = useContext(LivesContext);
  if (context === undefined) {
    console.warn('useLives called outside LivesProvider – returning defaults');
    return LIVES_DEFAULTS;
  }
  return context;
}
