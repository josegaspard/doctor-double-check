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

  // Increment viewer count when joining - with proper error handling
  const joinAsViewer = useCallback(async () => {
    if (!liveId || hasJoinedRef.current) return;

    try {
      // Use direct RPC call with type override since types haven't regenerated yet
      const { error } = await (supabase.rpc as any)('increment_viewer_count', { p_live_id: liveId });
      if (error) {
        console.warn('RPC increment_viewer_count failed:', error.message);
        // Fallback: try direct update
        const { error: updateError } = await supabase
          .from('lives')
          .update({ viewer_count: viewerCount + 1 })
          .eq('id', liveId);
        
        if (updateError) {
          console.error('Fallback update also failed:', updateError.message);
          return; // Don't set as joined if both methods fail
        }
      }
      hasJoinedRef.current = true;
      setIsJoined(true);
    } catch (error) {
      console.error('Unexpected error in joinAsViewer:', error);
    }
  }, [liveId, viewerCount]);

  // Decrement viewer count when leaving - with proper error handling
  const leaveAsViewer = useCallback(async () => {
    if (!liveId || !hasJoinedRef.current) return;

    try {
      const { error } = await (supabase.rpc as any)('decrement_viewer_count', { p_live_id: liveId });
      if (error) {
        console.warn('RPC decrement_viewer_count failed:', error.message);
        // Fallback: try direct update
        const newCount = Math.max(0, viewerCount - 1);
        const { error: updateError } = await supabase
          .from('lives')
          .update({ viewer_count: newCount })
          .eq('id', liveId);
        
        if (updateError) {
          console.error('Fallback update also failed:', updateError.message);
          return;
        }
      }
      hasJoinedRef.current = false;
      setIsJoined(false);
    } catch (error) {
      console.error('Unexpected error in leaveAsViewer:', error);
      hasJoinedRef.current = false;
      setIsJoined(false);
    }
  }, [liveId, viewerCount]);

  // Fetch initial data and subscribe to real-time updates - with error handling
  useEffect(() => {
    if (!liveId) return;

    // Fetch initial counts with error handling
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
    if (autoJoin && liveId && user && !hasJoinedRef.current) {
      joinAsViewer();
    }

    // Cleanup: leave when unmounting
    return () => {
      if (hasJoinedRef.current && liveId) {
        // Fire and forget - don't await in cleanup
        (supabase.rpc as any)('decrement_viewer_count', { p_live_id: liveId })
          .then(() => {})
          .catch(() => {
            // Fallback
            supabase
              .from('lives')
              .update({ viewer_count: 0 }) // Will be overwritten by next viewer count update
              .eq('id', liveId);
          });
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
