import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, RefreshCw, AlertCircle, Radio, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export type LiveRecordingStatus = 'live' | 'processing_recording' | 'recording_ready' | 'failed' | 'none';

interface LiveProcessingOverlayProps {
  liveId: string;
  status: LiveRecordingStatus;
  recordingId?: string | null;
  viewerCount?: number;
  onStatusChange?: (newStatus: LiveRecordingStatus, recordingId?: string | null) => void;
  autoRedirect?: boolean;
}

const POLL_INTERVAL_MS = 15_000;
const MAX_AUTO_RETRIES = 5;
const REDIRECT_DELAY_MS = 3_000;

export function LiveProcessingOverlay({
  liveId,
  status,
  recordingId,
  viewerCount = 0,
  onStatusChange,
  autoRedirect = true,
}: LiveProcessingOverlayProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [retryCount, setRetryCount] = useState(0);
  const [progressValue, setProgressValue] = useState(10);
  const [redirectCancelled, setRedirectCancelled] = useState(false);

  const refetchStatus = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('lives')
        .select('*')
        .eq('id', liveId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const next = ((data as any).recording_status as LiveRecordingStatus) ?? 'none';
        onStatusChange?.(next, (data as any).recording_id ?? null);
      }
    } catch (e) {
      console.error('[LiveProcessingOverlay] refetch failed:', e);
    }
  }, [liveId, onStatusChange]);

  // Auto-poll while processing
  useEffect(() => {
    if (status !== 'processing_recording') return;
    if (retryCount >= MAX_AUTO_RETRIES) return;
    const id = setInterval(() => {
      setRetryCount((c) => c + 1);
      refetchStatus();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [status, retryCount, refetchStatus]);

  // Indeterminate progress animation
  useEffect(() => {
    if (status !== 'processing_recording') return;
    const id = setInterval(() => {
      setProgressValue((v) => (v >= 90 ? 30 : v + 5));
    }, 800);
    return () => clearInterval(id);
  }, [status]);

  // Auto-redirect to replay when ready
  useEffect(() => {
    if (status !== 'recording_ready' || !recordingId || !autoRedirect || redirectCancelled) return;
    toast({
      title: '🎬 Replay disponible',
      description: 'Te llevamos a la grabación en 3 segundos…',
    });
    const t = setTimeout(() => {
      if (!redirectCancelled) navigate(`/recording/${recordingId}`);
    }, REDIRECT_DELAY_MS);
    return () => clearTimeout(t);
  }, [status, recordingId, autoRedirect, redirectCancelled, navigate, toast]);

  if (status === 'live') {
    return (
      <div
        data-testid="live-status-badge"
        className="absolute top-4 left-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive text-destructive-foreground shadow-lg animate-pulse"
      >
        <Radio className="w-3.5 h-3.5" />
        <span className="text-xs font-bold uppercase tracking-wide">EN VIVO</span>
        <span className="text-xs opacity-80 flex items-center gap-1">
          <Eye className="w-3 h-3" />
          {viewerCount}
        </span>
      </div>
    );
  }

  if (status === 'processing_recording') {
    return (
      <div
        data-testid="live-processing-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      >
        <Card className="max-w-sm w-full mx-4 shadow-2xl">
          <CardContent className="p-6 space-y-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground">
                Procesando grabación…
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Esto puede tardar 1-3 minutos. Estamos preparando tu replay.
              </p>
            </div>
            <Progress value={progressValue} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Reintentos automáticos: {retryCount} / {MAX_AUTO_RETRIES}
            </p>
            {retryCount >= MAX_AUTO_RETRIES && (
              <Button
                onClick={() => {
                  setRetryCount(0);
                  refetchStatus();
                }}
                variant="outline"
                className="w-full gap-2"
                data-testid="manual-retry-btn"
              >
                <RefreshCw className="w-4 h-4" />
                Reintentar manualmente
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'recording_ready' && recordingId) {
    return (
      <div
        data-testid="live-ready-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      >
        <Card className="max-w-sm w-full mx-4 shadow-2xl">
          <CardContent className="p-6 space-y-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground">
                ¡Replay disponible!
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Tu grabación está lista para verse.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => navigate(`/recording/${recordingId}`)}
                className="w-full gap-2"
                data-testid="view-replay-btn"
              >
                Ver replay ahora
              </Button>
              <Button
                variant="ghost"
                onClick={() => setRedirectCancelled(true)}
                className="w-full text-xs"
              >
                Cancelar redirección
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div
        data-testid="live-failed-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      >
        <Card className="max-w-sm w-full mx-4 shadow-2xl">
          <CardContent className="p-6 space-y-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="font-heading text-lg font-bold text-foreground">
              No pudimos procesar la grabación
            </h3>
            <p className="text-sm text-muted-foreground">
              Ocurrió un error al guardar el replay. Intenta de nuevo más tarde.
            </p>
            <Button onClick={() => navigate('/lives')} className="w-full">
              Volver a lives
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
