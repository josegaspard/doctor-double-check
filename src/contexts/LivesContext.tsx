import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
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
  location?: string;
  chatMode?: string;
  chatPrice?: number;
  doctorCedula?: string;
  doctorCofepris?: string;
  doctorCedulaStatus?: 'pending' | 'approved' | 'rejected' | null;
  doctorCedulaRejectionReason?: string | null;
  doctorCofeprisStatus?: 'pending' | 'approved' | 'rejected' | null;
  doctorCofeprisRejectionReason?: string | null;
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
  peakViewers?: number;
  bunnyVideoId?: string;
  /** uploading=TUS aún no termina, processing=Bunny encodando, ready=jugable, failed=error */
  bunnyStatus?: 'uploading' | 'processing' | 'ready' | 'failed';
}

export interface DebugCacheEntry {
  doctorId: string;
  name: string;
  cedulaState: 'value' | 'null' | 'undefined';
  cofeprisState: 'value' | 'null' | 'undefined';
}

interface LivesContextType {
  lives: Live[];
  recordings: Recording[];
  isLoading: boolean;
  credentialsLoadError: boolean;
  credentialsRetrying: boolean;
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
  ensureRecordingsLoaded: () => Promise<void>;
  retryCredentials: () => Promise<void>;
  getDebugCacheSnapshot: () => DebugCacheEntry[];
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
  const [credentialsLoadError, setCredentialsLoadError] = useState(false);
  const [credentialsRetrying, setCredentialsRetrying] = useState(false);
  const recordingsLoadedRef = useRef(false);
  
  // Track last fetch time to prevent rapid re-fetches
  const lastFetchTime = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 3000; // Minimum 3 seconds between fetches
  
  // Cache for doctor profiles to reduce redundant queries
  const profileCache = useRef<Map<string, { name: string; avatar_url?: string }>>(new Map());
  const doctorProfileCache = useRef<Map<string, {
    followers_count: number;
    cedula_profesional?: string | null;
    cofepris_permit?: string | null;
    cedula_status?: 'pending' | 'approved' | 'rejected' | null;
    cedula_rejection_reason?: string | null;
    cofepris_status?: 'pending' | 'approved' | 'rejected' | null;
    cofepris_rejection_reason?: string | null;
  }>>(new Map());

  // Cache versioning: invalidates stale caches that lack credential fields
  const PROFILE_CACHE_VERSION = 'v2-credentials';
  const cacheVersionChecked = useRef(false);
  if (!cacheVersionChecked.current) {
    cacheVersionChecked.current = true;
    try {
      const stored = typeof window !== 'undefined' ? sessionStorage.getItem('lives_profile_cache_version') : null;
      if (stored !== PROFILE_CACHE_VERSION) {
        doctorProfileCache.current.clear();
        profileCache.current.clear();
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('lives_profile_cache_version', PROFILE_CACHE_VERSION);
        }
      }
    } catch (e) {
      // sessionStorage unavailable — clear anyway to be safe
      doctorProfileCache.current.clear();
    }
  }

  const fetchLives = useCallback(async (force = false) => {
    const now = Date.now();
    
    // Skip if fetched recently (unless forced)
    if (!force && now - lastFetchTime.current < MIN_FETCH_INTERVAL) {
      return;
    }
    
    lastFetchTime.current = now;
    
    try {
      // Gate de visibilidad pública: solo lives status='live' Y donde el doctor
      // realmente está transmitiendo (Daily room joined → is_broadcasting=true).
      // Esto evita "ghost lives" que aparecen sin nadie del otro lado.
      // El propio doctor sigue viendo su live en su panel via fetch directo.
      const { data: livesData, error } = await supabase
        .from('lives')
        .select('*')
        .eq('status', 'live')
        .eq('is_broadcasting', true)
        .order('started_at', { ascending: false });

      if (error) {
        console.error('Error fetching lives:', error);
        return;
      }
      
      if (livesData && livesData.length > 0) {
        // Get unique doctor IDs that aren't in cache OR are cached but missing credential fields
        const doctorIds = [...new Set(livesData.map(l => l.doctor_id))];
        const needsFetch = (id: string) => {
          const cached = doctorProfileCache.current.get(id);
          // Refetch if missing entirely or if credential field is undefined (not null — null = fetched but empty)
          return !cached || cached.cedula_profesional === undefined;
        };
        const uncachedIds = doctorIds.filter(needsFetch);
        const uncachedProfileIds = doctorIds.filter(id => !profileCache.current.has(id));
        
        // Only fetch profiles not in cache
        if (uncachedIds.length > 0 || uncachedProfileIds.length > 0) {
          const [profilesResult, doctorProfilesResult] = await Promise.all([
            uncachedProfileIds.length > 0
              ? supabase
                  .from('profiles_public')
                  .select('id, name, avatar_url')
                  .in('id', uncachedProfileIds)
              : Promise.resolve({ data: [] as any[] }),
            uncachedIds.length > 0
              ? supabase
                  .from('doctor_profiles_public')
                  .select('user_id, followers_count, specialty, cedula_profesional, cofepris_permit, cedula_status, cedula_rejection_reason, cofepris_status, cofepris_rejection_reason')
                  .in('user_id', uncachedIds)
              : Promise.resolve({ data: [] as any[] }),
          ]);

          // Detect credential fetch error: only mark error when there's a real client error
          // (with a message). Empty result arrays are valid responses, NOT errors.
          if (uncachedIds.length > 0) {
            const credErr = (doctorProfilesResult as any).error;
            if (credErr && credErr.message) {
              console.error('Error fetching doctor credentials:', credErr);
              setCredentialsLoadError(true);
            } else {
              setCredentialsLoadError(false);
            }
          }

          // Update caches
          profilesResult.data?.forEach((p: any) => {
            profileCache.current.set(p.id, { name: p.name || 'Doctor', avatar_url: p.avatar_url || undefined });
          });
          doctorProfilesResult.data?.forEach((d: any) => {
            doctorProfileCache.current.set(d.user_id, {
              followers_count: d.followers_count || 0,
              cedula_profesional: d.cedula_profesional ?? null,
              cofepris_permit: d.cofepris_permit ?? null,
              cedula_status: d.cedula_status || null,
              cedula_rejection_reason: d.cedula_rejection_reason || null,
              cofepris_status: d.cofepris_status || null,
              cofepris_rejection_reason: d.cofepris_rejection_reason || null,
            });
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
          doctorCedula: doctorProfileCache.current.get(l.doctor_id)?.cedula_profesional || undefined,
          doctorCofepris: doctorProfileCache.current.get(l.doctor_id)?.cofepris_permit || undefined,
          doctorCedulaStatus: doctorProfileCache.current.get(l.doctor_id)?.cedula_status ?? null,
          doctorCedulaRejectionReason: doctorProfileCache.current.get(l.doctor_id)?.cedula_rejection_reason ?? null,
          doctorCofeprisStatus: doctorProfileCache.current.get(l.doctor_id)?.cofepris_status ?? null,
          doctorCofeprisRejectionReason: doctorProfileCache.current.get(l.doctor_id)?.cofepris_rejection_reason ?? null,
          dailyRoomName: l.daily_room_name || undefined,
          location: (l as any).location || undefined,
          chatMode: (l as any).chat_mode || 'free',
          chatPrice: (l as any).chat_price ? Number((l as any).chat_price) : 0,
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
      // Columnas explícitas: anon no tiene grant sobre bunny_video_id/video_url
      // (migración 20260517_recordings_anon_columns.sql). El RecordingPlayer
      // pide esos campos por separado vía /recording/:id que sí requiere auth.
      // bunny_status se omite aquí (no tipado en types.ts; el grid no lo renderiza).
      // Se lee de la VISTA pública, no de la tabla: `recordings` no tiene GRANT
      // de SELECT para `anon` (revocado a propósito en el endurecimiento del
      // 11-jul), así que consultarla sin sesión devolvía 401 a todo visitante.
      // recordings_public expone justo estas columnas y deja fuera storage_path,
      // bunny_video_id y demás. (Auditoría 2026-08-05)
      const { data: recordingsData } = await supabase
        .from('recordings_public')
        .select('id, live_id, doctor_id, title, description, specialty, duration, price, thumbnail_url, peak_viewers, created_at, tags')
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

          // NOTA: Bunny thumbnail está protegido con Token Auth (mismo pull zone
          // como manifest). En grid usamos solo thumbnail_url custom o placeholder
          // — la versión firmada de thumbnail llega vía bunny-signed-url cuando
          // se abre el recording, no en grid (evita N requests por scroll).

          // Auto-generate Cloudflare thumbnail (legacy) si todavía no hay
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
            // videoUrl/bunnyVideoId/bunnyStatus se obtienen en RecordingPlayer
            // vía fetch autenticado (anon no tiene grant sobre esas columnas).
            videoUrl: undefined,
            createdAt: new Date(r.created_at),
            tags: r.tags || [],
            peakViewers: r.peak_viewers ?? undefined,
            bunnyVideoId: undefined,
            bunnyStatus: undefined,
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

  // Initial data load - runs on mount and re-runs if provider remounts (HMR)
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (!isMounted) return;
      setIsLoading(true);
      await Promise.all([fetchLives(true), fetchLikedLives()]);
      if (isMounted) {
        setIsLoading(false);
      }
    };

    loadData();
    
    // Safety timeout: if isLoading is still true after 10s, force it off
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        setIsLoading(prev => {
          if (prev) {
            console.warn('LivesProvider: safety timeout triggered, forcing isLoading=false');
            return false;
          }
          return prev;
        });
      }
    }, 10000);
    
    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          .update({ status: 'ended', is_broadcasting: false, ended_at: new Date().toISOString() })
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
            const record = payload.new as { id: string; title: string; description?: string; doctor_id: string; specialty: string; status: string; viewer_count: number; likes_count: number; started_at: string; ended_at?: string; thumbnail_url?: string; recording_price?: number; tags?: string[]; daily_room_name?: string; location?: string; chat_mode?: string; chat_price?: number };
            
            // If the live has ended, remove it from state entirely
            if (record.status === 'ended' || record.status === 'processing_recording' || record.status === 'recording_ready') {
              setLives(prev => prev.filter(l => l.id !== record.id));
              return;
            }
            
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
                location: record.location || undefined,
                chatMode: record.chat_mode || 'free',
                chatPrice: record.chat_price ? Number(record.chat_price) : 0,
              };
              
              if (existing) {
                return prev.map(l => l.id === record.id ? updatedLive : l);
              } else {
                // New live - fetch profile inline if not cached
                if (!profileCache.current.has(record.doctor_id)) {
                  (async () => {
                    try {
                      const [profileRes, doctorRes] = await Promise.all([
                        supabase.from('profiles_public').select('id, name, avatar_url').eq('id', record.doctor_id).maybeSingle(),
                        supabase.from('doctor_profiles_public').select('user_id, followers_count').eq('user_id', record.doctor_id).maybeSingle(),
                      ]);
                      if (profileRes.data) {
                        profileCache.current.set(record.doctor_id, { name: profileRes.data.name || 'Doctor', avatar_url: profileRes.data.avatar_url || undefined });
                      }
                      if (doctorRes.data) {
                        doctorProfileCache.current.set(record.doctor_id, { followers_count: doctorRes.data.followers_count || 0 });
                      }
                      // Update the live in state with correct name
                      setLives(prev => prev.map(l => l.id === record.id ? {
                        ...l,
                        doctorName: profileCache.current.get(record.doctor_id)?.name || 'Doctor',
                        doctorAvatar: profileCache.current.get(record.doctor_id)?.avatar_url,
                        followersCount: doctorProfileCache.current.get(record.doctor_id)?.followers_count || 0,
                      } : l));
                    } catch (e) {
                      console.error('Error fetching profile for new live:', e);
                    }
                  })();
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
          // Only refresh if recordings were already loaded
          if (recordingsLoadedRef.current) {
            fetchRecordings();
          }
        }
      )
      .subscribe();

    // Polling fallback: catch any missed realtime events (30s since realtime covers most cases)
    const pollInterval = setInterval(() => {
      fetchLives(false);
    }, 30000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [throttledFetchLives, fetchLikedLives, fetchRecordings, fetchLives]);

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
      // Optimistic update
      setLikedLives(prev => new Set([...prev, liveId]));
      setLives(prev => prev.map(l => l.id === liveId ? { ...l, likesCount: l.likesCount + 1 } : l));

      const { error } = await supabase
        .from('live_likes')
        .insert({ live_id: liveId, user_id: user.id });
      if (error) throw error;
    } catch (error: any) {
      // Rollback on error
      setLikedLives(prev => { const s = new Set(prev); s.delete(liveId); return s; });
      setLives(prev => prev.map(l => l.id === liveId ? { ...l, likesCount: Math.max(0, l.likesCount - 1) } : l));
      console.error('Error liking live:', error);
      toast.error('No se pudo dar like');
    }
  };

  const unlikeLive = async (liveId: string) => {
    if (!user?.id) return;

    try {
      // Optimistic update
      setLikedLives(prev => { const s = new Set(prev); s.delete(liveId); return s; });
      setLives(prev => prev.map(l => l.id === liveId ? { ...l, likesCount: Math.max(0, l.likesCount - 1) } : l));

      const { error } = await supabase
        .from('live_likes')
        .delete()
        .eq('live_id', liveId)
        .eq('user_id', user.id);
      if (error) throw error;
    } catch (error: any) {
      // Rollback on error
      setLikedLives(prev => new Set([...prev, liveId]));
      setLives(prev => prev.map(l => l.id === liveId ? { ...l, likesCount: l.likesCount + 1 } : l));
      console.error('Error unliking live:', error);
      toast.error('No se pudo quitar like');
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
          location: data.location || null,
          chat_mode: data.chatMode || 'free',
          chat_price: data.chatPrice || 0,
        } as any)
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
      // Postgres RLS violation (code 42501 o mensaje "row-level security"):
      // significa que la BD rechazó el INSERT porque el usuario no es un
      // doctor aprobado. Traducimos a un mensaje accionable para el usuario.
      const rawMsg: string = error?.message || '';
      const isRls =
        error?.code === '42501' ||
        /row-level security/i.test(rawMsg) ||
        /violates row-level/i.test(rawMsg);
      if (isRls) {
        return {
          success: false,
          error: tContext('contextErrors.notVerifiedToCreateLive'),
        };
      }
      return { success: false, error: rawMsg || tContext('contextErrors.createLiveError') };
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
        .update({ status: 'ended', is_broadcasting: false, ended_at: new Date().toISOString() })
        .eq('id', liveId)
        .eq('doctor_id', user.id);

      if (error) throw error;

      recordingsLoadedRef.current = true;
      await Promise.all([fetchLives(true), fetchRecordings()]);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || tContext('contextErrors.endLiveGenericError') };
    }
  };

  const refreshLives = useCallback(async () => {
    await fetchLives(true);
  }, [fetchLives]);

  const retryCredentials = useCallback(async () => {
    setCredentialsRetrying(true);
    try {
      // Clear credential cache only — keep profile name/avatar cache for snappy UI
      doctorProfileCache.current.clear();
      setCredentialsLoadError(false);
      await fetchLives(true);
    } finally {
      setCredentialsRetrying(false);
    }
  }, [fetchLives]);

  const getDebugCacheSnapshot = useCallback((): DebugCacheEntry[] => {
    const entries: DebugCacheEntry[] = [];
    const seen = new Set<string>();
    lives.forEach(l => {
      if (seen.has(l.doctorId)) return;
      seen.add(l.doctorId);
      const cached = doctorProfileCache.current.get(l.doctorId);
      const stateOf = (v: string | null | undefined): 'value' | 'null' | 'undefined' => {
        if (v === undefined) return 'undefined';
        if (v === null) return 'null';
        return 'value';
      };
      entries.push({
        doctorId: l.doctorId,
        name: l.doctorName,
        cedulaState: cached ? stateOf(cached.cedula_profesional) : 'undefined',
        cofeprisState: cached ? stateOf(cached.cofepris_permit) : 'undefined',
      });
    });
    return entries;
  }, [lives]);

  const refreshRecordings = useCallback(async () => {
    recordingsLoadedRef.current = false;
    await fetchRecordings();
    recordingsLoadedRef.current = true;
  }, [fetchRecordings]);

  // Lazy-load recordings: only fetch on first access
  const ensureRecordingsLoaded = useCallback(async () => {
    if (recordingsLoadedRef.current) return;
    recordingsLoadedRef.current = true;
    await fetchRecordings();
  }, [fetchRecordings]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    lives,
    recordings,
    isLoading,
    credentialsLoadError,
    credentialsRetrying,
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
    ensureRecordingsLoaded,
    retryCredentials,
    getDebugCacheSnapshot,
  }), [lives, recordings, isLoading, credentialsLoadError, credentialsRetrying, getLive, getRecording, getLivesByDoctor, getRecordingsByDoctor, hasLiked, refreshLives, refreshRecordings, ensureRecordingsLoaded, retryCredentials, getDebugCacheSnapshot]);

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
  isLoading: false,
  credentialsLoadError: false,
  credentialsRetrying: false,
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
  ensureRecordingsLoaded: async () => {},
  retryCredentials: async () => {},
  getDebugCacheSnapshot: () => [],
};

export function useLives() {
  const context = useContext(LivesContext);
  if (context === undefined) {
    console.warn('useLives called outside LivesProvider – returning defaults');
    return LIVES_DEFAULTS;
  }
  return context;
}
