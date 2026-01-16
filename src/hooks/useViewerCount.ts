import { useState, useEffect, useCallback } from 'react';
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

  // Increment viewer count when joining
  const joinAsViewer = useCallback(async () => {
    if (!liveId || isJoined) return;

    try {
      // Increment viewer count
      await supabase.rpc('increment_viewer_count', { p_live_id: liveId });
      setIsJoined(true);
    } catch (error) {
      console.warn('Error joining as viewer:', error);
      // Fallback: try direct update
      await supabase
        .from('lives')
        .update({ viewer_count: viewerCount + 1 })
        .eq('id', liveId);
      setIsJoined(true);
    }
  }, [liveId, isJoined, viewerCount]);

  // Decrement viewer count when leaving
  const leaveAsViewer = useCallback(async () => {
    if (!liveId || !isJoined) return;

    try {
      await supabase.rpc('decrement_viewer_count', { p_live_id: liveId });
      setIsJoined(false);
    } catch (error) {
      console.warn('Error leaving as viewer:', error);
      // Fallback: try direct update
      const newCount = Math.max(0, viewerCount - 1);
      await supabase
        .from('lives')
        .update({ viewer_count: newCount })
        .eq('id', liveId);
      setIsJoined(false);
    }
  }, [liveId, isJoined, viewerCount]);

  // Fetch initial data and subscribe to real-time updates
  useEffect(() => {
    if (!liveId) return;

    // Fetch initial counts
    const fetchCounts = async () => {
      const { data } = await supabase
        .from('lives')
        .select('viewer_count, likes_count')
        .eq('id', liveId)
        .single();

      if (data) {
        setViewerCount(data.viewer_count);
        setLikesCount(data.likes_count);
      }
    };

    fetchCounts();

    // Subscribe to real-time updates
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
    if (autoJoin && liveId && user) {
      joinAsViewer();
    }

    // Cleanup: leave when unmounting
    return () => {
      if (isJoined && liveId) {
        // Fire and forget - don't await in cleanup
        supabase.rpc('decrement_viewer_count', { p_live_id: liveId }).catch(() => {
          // Fallback
          supabase
            .from('lives')
            .update({ viewer_count: Math.max(0, viewerCount - 1) })
            .eq('id', liveId);
        });
      }
    };
  }, [autoJoin, liveId, user]);

  return {
    viewerCount,
    likesCount,
    isJoined,
    joinAsViewer,
    leaveAsViewer,
  };
}
