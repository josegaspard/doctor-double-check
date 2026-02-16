import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UseViewerCountOptions {
  liveId: string;
  autoJoin?: boolean;
}

export function useViewerCount({ liveId, autoJoin = true }: UseViewerCountOptions) {
  const { user } = useAuth();
  const [viewerCount, setViewerCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [isJoined, setIsJoined] = useState(false);
  const hasJoinedRef = useRef(false);

  // Increment viewer count when joining
  const joinAsViewer = useCallback(async () => {
    if (!liveId || hasJoinedRef.current) return;

    try {
      const { error } = await supabase.rpc('increment_viewer_count', { p_live_id: liveId });
      if (error) {
        console.error('RPC increment_viewer_count failed:', error.message);
        return;
      }
      hasJoinedRef.current = true;
      setIsJoined(true);
    } catch (error) {
      console.error('Unexpected error in joinAsViewer:', error);
    }
  }, [liveId]);

  // Decrement viewer count when leaving
  const leaveAsViewer = useCallback(async () => {
    if (!liveId || !hasJoinedRef.current) return;

    try {
      const { error } = await supabase.rpc('decrement_viewer_count', { p_live_id: liveId });
      if (error) {
        console.error('RPC decrement_viewer_count failed:', error.message);
      }
      hasJoinedRef.current = false;
      setIsJoined(false);
    } catch (error) {
      console.error('Unexpected error in leaveAsViewer:', error);
      hasJoinedRef.current = false;
      setIsJoined(false);
    }
  }, [liveId]);

  // Fetch initial data and subscribe to real-time updates
  useEffect(() => {
    if (!liveId) return;

    const fetchCounts = async () => {
      try {
        const { data, error } = await supabase
          .from('lives')
          .select('viewer_count, likes_count')
          .eq('id', liveId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching viewer counts:', error.message);
          return;
        }

        if (data) {
          setViewerCount(data.viewer_count);
          setLikesCount(data.likes_count);
        }
      } catch (error) {
        console.error('Unexpected error fetching counts:', error);
      }
    };

    fetchCounts();

    const channel = supabase
      .channel(`live-stats-${liveId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lives',
          filter: `id=eq.${liveId}`,
        },
        (payload) => {
          const newData = payload.new as { viewer_count: number; likes_count: number };
          setViewerCount(newData.viewer_count);
          setLikesCount(newData.likes_count);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveId]);

  // Auto-join when component mounts
  useEffect(() => {
    if (autoJoin && liveId && user && !hasJoinedRef.current) {
      joinAsViewer();
    }

    // Cleanup: decrement properly on unmount
    return () => {
      if (hasJoinedRef.current && liveId) {
        // Fire and forget - use RPC to decrement by 1
        (async () => {
          try {
            await supabase.rpc('decrement_viewer_count', { p_live_id: liveId });
          } catch (err) {
            console.warn('Cleanup decrement failed:', err);
          }
        })();
        hasJoinedRef.current = false;
      }
    };
  }, [autoJoin, liveId, user, joinAsViewer]);

  return {
    viewerCount,
    likesCount,
    isJoined,
    joinAsViewer,
    leaveAsViewer,
  };
}
