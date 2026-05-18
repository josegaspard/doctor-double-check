import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { RecordingVideoPlayer } from '@/components/recordings/RecordingVideoPlayer';
import { RecordingPaywall } from '@/components/recordings/RecordingPaywall';
import { AdPreroll } from '@/components/ads/AdPreroll';
// RecordingChatReplay solo se monta si el recording tiene liveId asociado. Lazy
// para que el chunk principal de RecordingPlayer no lo arrastre.
const RecordingChatReplay = React.lazy(() =>
  import('@/components/recordings/RecordingChatReplay').then(m => ({ default: m.RecordingChatReplay }))
);
import {
  PlayCircle,
  ArrowLeft,
  Clock,
  Stethoscope,
  Award,
  Lock,
  Loader2,
} from 'lucide-react';

interface Recording {
  id: string;
  title: string;
  description?: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  duration: number;
  price: number;
  thumbnailUrl?: string;
  videoUrl?: string;
  liveId?: string;
  createdAt: Date;
  tags: string[];
  bunnyStatus?: 'uploading' | 'processing' | 'ready' | 'failed' | string | null;
}

export default function RecordingPlayer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role, supabaseUser } = useAuth();
  
  const [recording, setRecording] = useState<Recording | null>(null);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [prerollDone, setPrerollDone] = useState(false);
  const [prefetchedSignedUrl, setPrefetchedSignedUrl] = useState<string | null>(null);
  const [prefetchedTtl, setPrefetchedTtl] = useState<number>(600);
  const [prefetchedThumbUrl, setPrefetchedThumbUrl] = useState<string | null>(null);

  const handlePrerollComplete = useCallback(() => {
    setPrerollDone(true);
  }, []);

  const refreshPurchase = useCallback(async () => {
    if (!id || !supabaseUser?.id) return;
    const { data } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', supabaseUser.id)
      .eq('recording_id', id)
      .maybeSingle();
    setHasPurchased(!!data);
  }, [id, supabaseUser?.id]);

  // Realtime: detect Stripe webhook -> purchase row insert and unlock player without reload
  useEffect(() => {
    if (!supabaseUser?.id || !id || hasPurchased) return;
    const channel = supabase
      .channel(`purchases-${supabaseUser.id}-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'purchases', filter: `user_id=eq.${supabaseUser.id}` },
        (payload: any) => {
          if (payload.new?.recording_id === id) setHasPurchased(true);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabaseUser?.id, id, hasPurchased]);

  // Realtime: subscribir a cambios de bunny_status del recording actual.
  // Cuando Bunny webhook actualiza processing → ready, el player switchea
  // automáticamente de /original a HLS sin reload.
  useEffect(() => {
    if (!id || !recording || recording.bunnyStatus === 'ready') return;
    const channel = supabase
      .channel(`recording-status-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'recordings', filter: `id=eq.${id}` },
        (payload: any) => {
          const newStatus = payload.new?.bunny_status;
          if (newStatus && newStatus !== recording.bunnyStatus) {
            console.log('[RecordingPlayer] bunny_status →', newStatus);
            setRecording(prev => prev ? { ...prev, bunnyStatus: newStatus } : null);
            // Invalidar prefetched signed URL — el player vuelve a pedir uno
            // nuevo apuntando a HLS en vez de /original.
            if (newStatus === 'ready') {
              setPrefetchedSignedUrl(null);
              setPrefetchedThumbUrl(null);
              const videoUrl = recording.videoUrl;
              if (videoUrl?.startsWith('bunny:')) {
                const cacheKey = `signedurl-v3:bunny:${videoUrl.slice(6)}`;
                try { sessionStorage.removeItem(cacheKey); } catch { /* ignore */ }
              }
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, recording]);

  // Auto-confirm wallet/Stripe redirect (?recording_paid=success or legacy ?purchased=true)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('recording_paid') === 'success' || params.get('purchased') === 'true') {
      refreshPurchase();
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [refreshPurchase]);

  // Fetch recording + check purchase in parallel
  useEffect(() => {
    const load = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }

      const recordingPromise = supabase
        .from('recordings')
        .select('*')
        .eq('id', id)
        .single();

      const purchasePromise = supabaseUser?.id && role !== 'admin' && role !== 'doctor'
        ? supabase
            .from('purchases')
            .select('id')
            .eq('user_id', supabaseUser.id)
            .eq('recording_id', id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      // Esperar primero solo recording para conocer doctor_id, después lanzar
      // profile y purchase en paralelo. Antes profile era SECUENCIAL después del
      // batch — añadía 200-300ms de latencia que retrasaba el render del video.
      const recResult = await recordingPromise;

      if (recResult.error || !recResult.data) {
        setIsLoading(false);
        return;
      }

      const profilePromise = supabase
        .from('profiles_public')
        .select('name')
        .eq('id', recResult.data.doctor_id)
        .single();

      // PREFETCH del signed URL en paralelo con profile/purchase. Esto elimina
      // el ~700ms de espera entre que el video player se monta y dispara su
      // propia fetch. Cuando el componente renderiza, ya pasamos el URL listo.
      const videoUrl = recResult.data.video_url as string | undefined;
      let signedUrlPromise: Promise<{ url: string; ttlSec: number } | null> = Promise.resolve(null);
      if (videoUrl) {
        const bunnyMatch = /^bunny:(.+)$/.exec(videoUrl);
        const b2Match = /^b2:(.+)$/.exec(videoUrl);
        const storageMatch = /^storage:(.+)$/.exec(videoUrl);
        // Cache check sessionStorage primero
        const cacheKey = bunnyMatch
          ? `signedurl-v3:bunny:${bunnyMatch[1]}`
          : b2Match
            ? `signedurl-v3:b2:${b2Match[1]}`
            : `signedurl-v3:${storageMatch?.[1] || videoUrl}`;
        try {
          const raw = sessionStorage.getItem(cacheKey);
          if (raw) {
            const cached = JSON.parse(raw) as { url: string; generatedAt: number; ttlSec: number };
            const ageMs = Date.now() - cached.generatedAt;
            if (ageMs < (cached.ttlSec - 300) * 1000) {
              signedUrlPromise = Promise.resolve({ url: cached.url, ttlSec: cached.ttlSec });
            } else {
              sessionStorage.removeItem(cacheKey);
            }
          }
        } catch { /* ignore */ }
        if (bunnyMatch && (await signedUrlPromise) === null) {
          // Bunny: prefetch HLS (anti-piracy via fragmented .ts segments).
          // Si bunny_status=processing usaremos /original en el player.
          const isProcessing = recResult.data.bunny_status && recResult.data.bunny_status !== 'ready';
          signedUrlPromise = supabase.functions
            .invoke('bunny-signed-url', { body: { videoId: bunnyMatch[1], ttlSec: 180 } })
            .then(({ data }) => {
              if (!data?.hlsUrl) return null;
              const url = isProcessing ? data.originalUrl : data.hlsUrl;
              return { url, thumb: data.thumbnailUrl, ttlSec: typeof data.expiresSec === 'number' ? data.expiresSec : 180 };
            })
            .catch(() => null);
        } else if (b2Match && (await signedUrlPromise) === null) {
          signedUrlPromise = supabase.functions
            .invoke('b2-presigned-url', { body: { operation: 'get', path: b2Match[1] } })
            .then(({ data }) => data?.url ? { url: data.url as string, ttlSec: typeof data.expiresSec === 'number' ? data.expiresSec : 3600 } : null)
            .catch(() => null);
        } else if (storageMatch && (await signedUrlPromise) === null) {
          signedUrlPromise = supabase.storage
            .from('recordings')
            .createSignedUrl(storageMatch[1], 3600)
            .then(({ data }) => data?.signedUrl ? { url: data.signedUrl, ttlSec: 3600 } : null)
            .catch(() => null);
        }
      }

      const [purchResult, { data: profile }, signedUrlResult] = await Promise.all([
        purchasePromise,
        profilePromise,
        signedUrlPromise,
      ]);

      if (signedUrlResult) {
        setPrefetchedSignedUrl((signedUrlResult as any).url);
        setPrefetchedTtl((signedUrlResult as any).ttlSec);
        if ((signedUrlResult as any).thumb) setPrefetchedThumbUrl((signedUrlResult as any).thumb);
        // Cache para revisitas en la sesión
        const cacheKey = videoUrl
          ? (videoUrl.startsWith('bunny:')
              ? `signedurl-v3:bunny:${videoUrl.slice(6)}`
              : videoUrl.startsWith('b2:')
                ? `signedurl-v3:b2:${videoUrl.slice(3)}`
                : `signedurl-v3:${videoUrl.replace(/^storage:/, '')}`)
          : null;
        if (cacheKey) {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify({
              url: (signedUrlResult as any).url,
              poster: (signedUrlResult as any).thumb,
              generatedAt: Date.now(),
              ttlSec: (signedUrlResult as any).ttlSec,
            }));
          } catch { /* quota, ignore */ }
        }
      }

      setRecording({
        id: recResult.data.id,
        title: recResult.data.title,
        description: recResult.data.description || undefined,
        doctorId: recResult.data.doctor_id,
        doctorName: profile?.name || 'Doctor',
        specialty: recResult.data.specialty,
        duration: recResult.data.duration,
        price: Number(recResult.data.price),
        thumbnailUrl: recResult.data.thumbnail_url || undefined,
        videoUrl: recResult.data.video_url || undefined,
        liveId: recResult.data.live_id || undefined,
        createdAt: new Date(recResult.data.created_at),
        tags: recResult.data.tags || [],
        bunnyStatus: (recResult.data as any).bunny_status,
      });

      if (role === 'admin' || role === 'doctor') {
        setHasPurchased(true);
      } else {
        setHasPurchased(!!purchResult.data);
      }

      setIsLoading(false);
    };

    load();
  }, [id, supabaseUser?.id, role]);

  const hasAccess = (): boolean => {
    if (!user) return false;
    if (role === 'admin' || role === 'doctor') return true;
    if (recording && recording.price === 0) return true;
    return hasPurchased;
  };

  // Skip preroll para: admin, doctor (no ven ads), owner del recording, recordings
  // gratis (price=0). Esto evita 4 queries DB secuenciales antes del play.
  const skipPreroll = (
    role === 'admin' ||
    role === 'doctor' ||
    !!(recording && recording.price === 0) ||
    !!(recording && supabaseUser && recording.doctorId === supabaseUser.id)
  );

  const handleDurationUpdate = (newDuration: number) => {
    if (!recording || newDuration <= 0) return;
    if (recording.duration === newDuration) return;
    setRecording(prev => prev ? { ...prev, duration: newDuration } : null);

    // Backfill duration in DB when the owner watches their own recording and
    // the stored value is 0/missing. Older rows (pre-duration capture or
    // failed save-recording metadata) get healed silently as the doctor
    // navigates through their library.
    const isOwner = supabaseUser?.id && recording.doctorId === supabaseUser.id;
    const needsBackfill = !recording.duration || recording.duration <= 0;
    if (isOwner && needsBackfill) {
      supabase
        .from('recordings')
        .update({ duration: newDuration })
        .eq('id', recording.id)
        .eq('doctor_id', supabaseUser.id)
        .then(({ error }) => {
          if (error) console.warn('[RecordingPlayer] Failed to backfill duration:', error.message);
        });
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12 text-center">
          <Loader2 className="w-16 h-16 mx-auto animate-spin text-primary mb-4" />
          <h2 className="text-xl font-semibold mb-2">Cargando...</h2>
        </div>
      </MainLayout>
    );
  }

  if (!recording) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12 text-center">
          <PlayCircle className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Grabación no encontrada</h2>
          <p className="text-muted-foreground mb-4">Es posible que la grabación no exista o no tengas acceso.</p>
          <Button onClick={() => navigate('/recordings')}>Volver a Grabaciones</Button>
        </div>
      </MainLayout>
    );
  }

  if (!hasAccess()) {
    return (
      <MainLayout>
        <RecordingPaywall
          recordingId={recording.id}
          title={recording.title}
          doctorName={recording.doctorName}
          specialty={recording.specialty}
          price={recording.price}
          durationSeconds={recording.duration}
          thumbnailUrl={recording.thumbnailUrl}
          onPaid={refreshPurchase}
          onBack={() => navigate('/recordings')}
        />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 max-w-6xl">
        <Button variant="ghost" size="sm" onClick={() => navigate('/recordings')} className="hidden sm:inline-flex mb-3 sm:mb-4 h-8 text-xs sm:text-sm">
          <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          Volver a Grabaciones
        </Button>

        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 space-y-3 sm:space-y-4">
            <div className="relative no-context-menu aspect-video rounded-xl overflow-hidden bg-black">
              {/* Skip preroll ad entirely si: usuario es doctor (su propio contenido o
                  los doctores no ven ads), admin, o el recording es del propio doctor.
                  Antes AdPreroll hacía 4 queries secuenciales a ad_config/ad_placements/
                  ad_creatives/ad_campaigns_public antes de decidir si mostrar el video,
                  retrasando 400-800ms el inicio del reproductor. */}
              {!prerollDone && recording.videoUrl && skipPreroll === false && (
                <AdPreroll onComplete={handlePrerollComplete} placementName="recording_preroll" />
              )}
              {recording.videoUrl ? (
                <div className={(!prerollDone && skipPreroll === false) ? 'opacity-0 pointer-events-none absolute inset-0' : 'w-full h-full'}>
                  <RecordingVideoPlayer
                    videoUrl={recording.videoUrl}
                    recordingId={recording.id}
                    bunnyStatus={recording.bunnyStatus}
                    onDurationUpdate={handleDurationUpdate}
                    onTimeUpdate={setVideoCurrentTime}
                    autoPlay={prerollDone || skipPreroll}
                    prefetchedSignedUrl={prefetchedSignedUrl}
                    prefetchedTtl={prefetchedTtl}
                    prefetchedThumbUrl={prefetchedThumbUrl}
                  />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <div className="text-center p-6">
                    <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Video no disponible</h3>
                    <p className="text-sm text-muted-foreground">
                      La grabación aún no está disponible.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h1 className="font-heading text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-2 sm:mb-3">
                {recording.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <Badge variant="outline" className="gap-1 text-xs">
                  <Clock className="w-3 h-3" />
                  {recording.duration > 0 ? `${Math.floor(recording.duration / 60)} min` : 'Procesando...'}
                </Badge>
                {recording.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
              
              <Separator className="my-3 sm:my-4" />
              
              <p className="text-muted-foreground text-sm">{recording.description}</p>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {recording.liveId && (
              <React.Suspense fallback={null}>
                <RecordingChatReplay liveId={recording.liveId} />
              </React.Suspense>
            )}
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Stethoscope className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">{recording.doctorName}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{recording.specialty}</p>
                    <Badge variant="secondary" className="mt-2 gap-1 text-xs">
                      <Award className="w-3 h-3" />
                      Verificado
                    </Badge>
                  </div>
                </div>
                
                <Separator className="my-3 sm:my-4" />
                
                <Button className="w-full h-9 text-sm" onClick={() => navigate(`/doctor/${recording.doctorId}`)}>
                  Ver Perfil
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary to-secondary border-0 shadow-md text-white overflow-hidden relative">
              <div aria-hidden className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-light/25 blur-xl" />
              <CardContent className="p-3 sm:p-4 relative">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0 ring-1 ring-white/30 shadow-sm">
                    <Award className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-xs sm:text-sm">Acceso Ilimitado</h4>
                    <p className="text-xs text-white/85 mt-1 leading-relaxed">
                      Puedes ver esta grabación las veces que quieras.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Este contenido está protegido. No se permite la descarga.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
