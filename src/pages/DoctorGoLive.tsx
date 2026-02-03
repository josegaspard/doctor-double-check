import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useViewerCount } from '@/hooks/useViewerCount';
import { useCloudflareStream, checkH264Support, useLocalRecording } from '@/hooks/cloudflare';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { CloudflareStreamPlayer } from '@/components/live/CloudflareStreamPlayer';
import { LiveChat } from '@/components/live/LiveChat';
import { AnimatedViewerCount } from '@/components/live/AnimatedViewerCount';
import { EndingLiveModal } from '@/components/live/EndingLiveModal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Video, 
  Radio, 
  Loader2, 
  X, 
  Plus,
  Users,
  Heart,
  Clock,
  MessageSquare,
  StopCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const SPECIALTIES = [
  'Cardiología',
  'Dermatología',
  'Endocrinología',
  'Gastroenterología',
  'Ginecología',
  'Medicina General',
  'Medicina Interna',
  'Neurología',
  'Oftalmología',
  'Oncología',
  'Ortopedia',
  'Pediatría',
  'Psiquiatría',
  'Urología',
  'Otra',
];

interface LiveData {
  id: string;
  title: string;
  description: string;
  specialty: string;
  viewerCount: number;
  likesCount: number;
  startedAt: Date;
}

interface StreamData {
  uid: string;
  webRTCUrl: string;
  playbackUrl: string;
}

export default function DoctorGoLive() {
  const navigate = useNavigate();
  const { user, role, isLoading: isAuthLoading } = useAuth();
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [recordingPrice, setRecordingPrice] = useState<number>(0);
  const [enableRecording, setEnableRecording] = useState(true);
  
  // Live state
  const [isCreating, setIsCreating] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [showChat, setShowChat] = useState(true);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showEndingModal, setShowEndingModal] = useState(false);
  
  // Cloudflare Stream hook
  const { 
    createStream, 
    startBroadcast, 
    endStream, 
    toggleMute, 
    toggleVideo, 
    getLocalStream,
    isLoading: isStreamLoading,
    negotiatedCodec,
  } = useCloudflareStream();
  
  // Local recording as fallback
  const localRecording = useLocalRecording();
  
  const [endingStage, setEndingStage] = useState<'ending' | 'saving' | 'uploading' | 'done'>('ending');
  
  // Codec support check
  const [codecCheck, setCodecCheck] = useState<{
    checked: boolean;
    h264Supported: boolean;
    availableCodecs: string[];
  }>({ checked: false, h264Supported: false, availableCodecs: [] });
  const [showRtmpsInfo, setShowRtmpsInfo] = useState(false);
  
  // Check H.264 support on mount
  useEffect(() => {
    checkH264Support().then(result => {
      setCodecCheck({
        checked: true,
        h264Supported: result.h264Supported,
        availableCodecs: result.availableCodecs,
      });
      console.log('[GoLive] Codec check result:', result);
    });
  }, []);

  // Real-time viewer count (owner doesn't auto-join as viewer)
  const { viewerCount, likesCount } = useViewerCount({
    liveId: liveData?.id || '',
    autoJoin: false,
  });

  // Timer for elapsed time
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLive && liveData?.startedAt) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - new Date(liveData.startedAt).getTime()) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isLive, liveData?.startedAt]);

  // Format elapsed time
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Add tag
  const addTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < 5) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  // Remove tag
  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // Start live - Using Cloudflare Stream
  const handleStartLive = async () => {
    if (!user?.id || !title.trim() || !specialty) {
      toast.error('Por favor completa el título y la especialidad');
      return;
    }

    setIsCreating(true);

    try {
      // 1. Create live record in database
      const { data: live, error: liveError } = await supabase
        .from('lives')
        .insert({
          doctor_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          specialty,
          tags: tags.length > 0 ? tags : null,
          recording_price: enableRecording ? recordingPrice : null,
          status: 'live',
        })
        .select()
        .single();

      if (liveError) throw liveError;

      // 2. Create Cloudflare Stream live input
      const stream = await createStream(live.id, title.trim(), enableRecording);
      
      if (!stream) {
        // Rollback: delete live record
        await supabase.from('lives').delete().eq('id', live.id);
        throw new Error('Error creating stream');
      }

      // 3. Start WebRTC broadcast from browser
      const broadcastStarted = await startBroadcast(stream.webRTCUrl);
      
      if (!broadcastStarted) {
        await supabase.from('lives').delete().eq('id', live.id);
        throw new Error('Error starting broadcast');
      }

      // 4. Start local recording as fallback (if recording is enabled)
      if (enableRecording) {
        // Give a moment for getLocalStream to be populated
        setTimeout(() => {
          const localStream = getLocalStream();
          if (localStream) {
            const started = localRecording.startRecording(localStream);
            if (started) {
              console.log('[GoLive] Local backup recording started');
            } else {
              console.warn('[GoLive] Failed to start local backup recording');
            }
          }
        }, 1000);
      }

      // 5. Set live state
      setLiveData({
        id: live.id,
        title: live.title,
        description: live.description || '',
        specialty: live.specialty,
        viewerCount: 0,
        likesCount: 0,
        startedAt: new Date(live.started_at),
      });
      setStreamData({
        uid: stream.uid,
        webRTCUrl: stream.webRTCUrl,
        playbackUrl: stream.playbackUrl,
      });
      setIsLive(true);

      // 6. Notify subscribers (in-app + push + email)
      try {
        // In-app notifications
        await supabase.rpc('notify_subscribers', {
          p_doctor_id: user.id,
          p_notification_type: 'doctor_live',
          p_title: '¡En vivo ahora!',
          p_message: `${user.name || 'Un doctor que sigues'} está transmitiendo: ${title}`,
          p_data: { liveId: live.id },
        });

        // Push notifications
        await supabase.functions.invoke('send-push-notification', {
          body: {
            doctorId: user.id,
            liveId: live.id,
            title: '¡En vivo ahora!',
            message: `${user.name || 'Un doctor que sigues'} está transmitiendo: ${title}`,
          },
        });

        // Email notifications
        await supabase.functions.invoke('send-live-notification-email', {
          body: {
            doctorId: user.id,
            liveId: live.id,
            title: title.trim(),
            description: description.trim() || null,
          },
        });
      } catch (notifyError) {
        console.warn('Failed to notify subscribers:', notifyError);
      }

      toast.success('¡Transmisión iniciada!');
    } catch (error: any) {
      console.error('Error starting live:', error);
      toast.error(error.message || 'Error al iniciar la transmisión');
    } finally {
      setIsCreating(false);
    }
  };

  // End live - Using Cloudflare Stream with local fallback
  const handleEndLive = async () => {
    if (!liveData?.id || !user?.id) return;
    if (isEnding) return;

    setIsEnding(true);
    setShowEndDialog(false);
    setShowEndingModal(true);
    setEndingStage('ending');

    try {
      // Stage 1: Stop local recording first (if active)
      if (localRecording.isRecording) {
        console.log('[GoLive] Stopping local backup recording...');
        await localRecording.stopRecording();
      }

      // Stage 2: End Cloudflare stream
      setEndingStage('saving');
      const result = await endStream(liveData.id, streamData?.uid, enableRecording);

      const cloudflareRecordingId = result.success ? result.recordingId : undefined;
      let recordingCreated = !!cloudflareRecordingId;
      console.log('[GoLive] Cloudflare end result:', { success: result.success, recordingId: result.recordingId });

      // Stage 3: Always upload local backup (if we have it) so the video is available "sí o sí"
      // IMPORTANT: we must NOT rely on `localRecording.hasRecording` here.
      // React state updates are async; right after `await stopRecording()` it can still be false.
      // Instead, check the underlying buffered data via `getRecordingBlob()`.
      const localBlob = enableRecording ? localRecording.getRecordingBlob() : null;

      // - If Cloudflare created a recording row, we UPDATE it with the storage-backed video.
      // - If not, we create a new recording row.
      if (enableRecording && localBlob && localBlob.size > 0) {
        console.log('[GoLive] Uploading local backup recording to guarantee availability...');
        setEndingStage('uploading');
        
        const uploadResult = await localRecording.uploadRecording({
          liveId: liveData.id,
          doctorId: user.id,
          title: liveData.title,
          description: liveData.description,
          specialty: liveData.specialty,
          tags: tags,
          price: recordingPrice,
          recordingId: cloudflareRecordingId,
        });

        if (uploadResult.success) {
          recordingCreated = true;
          console.log('[GoLive] ✅ Local recording uploaded successfully');
        } else {
          console.error('[GoLive] ❌ Local recording upload failed');
        }
      } else if (enableRecording) {
        console.warn('[GoLive] No local backup blob available, skipping upload');
      }

      // Fallback: manually update the live status if edge function fails
      if (!result.success) {
        await supabase
          .from('lives')
          .update({
            status: 'ended',
            ended_at: new Date().toISOString(),
          })
          .eq('id', liveData.id);
      }

      // Cleanup local recording
      localRecording.cleanup();

      // Stage 4: Done
      setEndingStage('done');
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Navigate based on recording preference
      if (enableRecording && recordingCreated) {
        toast.success('¡Transmisión finalizada! La grabación está disponible.');
        navigate('/doctor/recordings');
      } else if (enableRecording) {
        toast.warning('La transmisión finalizó pero no se pudo guardar la grabación.');
        navigate('/doctor/dashboard');
      } else {
        toast.success('Transmisión finalizada');
        navigate('/doctor/dashboard');
      }
    } catch (error: any) {
      console.error('Error ending live:', error);
      toast.error('Error al finalizar la transmisión');
      
      // Cleanup
      localRecording.cleanup();
      
      // Ensure we clean up the state even on error
      try {
        await supabase
          .from('lives')
          .update({
            status: 'ended',
            ended_at: new Date().toISOString(),
          })
          .eq('id', liveData.id);
      } catch {}
      
      navigate('/doctor/dashboard');
    } finally {
      setIsEnding(false);
      setShowEndingModal(false);
    }
  };

  // Wait for auth to resolve to avoid flickers/false negatives that can “break” the view
  if (isAuthLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Cargando...</span>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Block non-doctors
  if (role !== 'doctor') {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-lg mx-auto text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Video className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-2">
              Iniciar Transmisión
            </h2>
            <p className="text-muted-foreground mb-6">
              Solo los médicos verificados pueden iniciar transmisiones en vivo.
            </p>
            <Button onClick={() => navigate('/login')}>
              Iniciar Sesión como Médico
            </Button>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Live streaming view
  if (isLive && streamData && liveData) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-4">
          {/* Header with controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                </span>
                <Badge variant="destructive">EN VIVO</Badge>
              </div>
              <div>
                <h1 className="font-heading text-lg font-bold">{liveData.title}</h1>
                <p className="text-xs text-muted-foreground">{liveData.specialty}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Stats */}
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatTime(elapsedTime)}
                </span>
                <AnimatedViewerCount 
                  count={viewerCount || liveData.viewerCount} 
                  variant="inline" 
                />
                <span className="flex items-center gap-1">
                  <Heart className="w-4 h-4" />
                  {likesCount || liveData.likesCount}
                </span>
              </div>

              {/* Actions */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowChat(!showChat)}
                className="gap-1"
              >
                <MessageSquare className="w-4 h-4" />
                {showChat ? 'Ocultar' : 'Chat'}
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowEndDialog(true)}
                className="gap-1"
              >
                <StopCircle className="w-4 h-4" />
                Finalizar
              </Button>
            </div>
          </div>

          {/* Video + Chat */}
          <div className="grid lg:grid-cols-4 gap-4">
            <div className={showChat ? 'lg:col-span-3' : 'lg:col-span-4'}>
              <CloudflareStreamPlayer
                localStream={getLocalStream()}
                isOwner={true}
                onToggleMute={toggleMute}
                onToggleVideo={toggleVideo}
                onLeave={() => setShowEndDialog(true)}
                viewerCount={viewerCount || liveData.viewerCount}
              />
            </div>

            {showChat && (
              <div className="lg:col-span-1">
                <LiveChat liveId={liveData.id} isOwner={true} />
              </div>
            )}
          </div>
        </div>

        {/* End confirmation dialog */}
        <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                ¿Finalizar transmisión?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {enableRecording 
                  ? 'La grabación se procesará y estará disponible para la venta.'
                  : 'Esta acción finalizará la transmisión para todos los espectadores.'
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isEnding}>Continuar transmitiendo</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleEndLive}
                disabled={isEnding}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isEnding ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Finalizando...
                  </>
                ) : (
                  'Sí, finalizar'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Ending modal */}
        <EndingLiveModal 
          isOpen={showEndingModal} 
          stage={endingStage} 
          enableRecording={enableRecording}
          uploadProgress={localRecording.uploadProgress}
        />
      </MainLayout>
    );
  }

  // Setup form view
  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <Radio className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold">Iniciar Transmisión</h1>
            <p className="text-muted-foreground">Configura tu live antes de comenzar</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Detalles del Live</CardTitle>
            <CardDescription>
              Esta información se mostrará a los espectadores
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                placeholder="Ej: Consulta abierta sobre hipertensión"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">{title.length}/100 caracteres</p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                placeholder="Describe de qué tratará tu transmisión..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">{description.length}/500 caracteres</p>
            </div>

            {/* Specialty */}
            <div className="space-y-2">
              <Label htmlFor="specialty">Especialidad *</Label>
              {/*
                NOTE: Usamos <select> nativo aquí porque Radix Select estaba generando
                warnings de refs y en algunos navegadores/estados terminaba “rompiendo” la vista.
              */}
              <select
                id="specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="" disabled>
                  Selecciona una especialidad
                </option>
                {SPECIALTIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                La especialidad ayuda a los pacientes a encontrar tu transmisión
              </p>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Etiquetas</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Añade una etiqueta"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  maxLength={30}
                />
                <Button type="button" variant="outline" size="icon" onClick={addTag} disabled={tags.length >= 5}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      #{tag}
                      <button onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">{tags.length}/5 etiquetas</p>
            </div>

            {/* Recording settings */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Grabar transmisión</Label>
                  <p className="text-xs text-muted-foreground">
                    Guarda la grabación para venderla después
                  </p>
                </div>
                <Switch
                  checked={enableRecording}
                  onCheckedChange={setEnableRecording}
                />
              </div>

              {enableRecording && (
                <div className="space-y-2">
                  <Label htmlFor="price">Precio de la grabación (MXN)</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    step={10}
                    placeholder="0 = gratuita"
                    value={recordingPrice}
                    onChange={(e) => setRecordingPrice(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Deja en 0 para ofrecer la grabación gratis
                  </p>
                </div>
              )}
            </div>

            {/* Codec compatibility warning */}
            {codecCheck.checked && enableRecording && !codecCheck.h264Supported && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Tu navegador no soporta grabaciones</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    Tu navegador solo soporta: {codecCheck.availableCodecs.join(', ') || 'VP8'}. 
                    Cloudflare requiere <strong>H.264</strong> para generar grabaciones.
                  </p>
                  <p className="font-medium">Opciones:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li>Usa <strong>Google Chrome</strong> (mejor soporte H.264)</li>
                    <li>Usa <strong>OBS con RTMPS</strong> para transmitir</li>
                  </ul>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setShowRtmpsInfo(!showRtmpsInfo)}
                  >
                    {showRtmpsInfo ? 'Ocultar info RTMPS' : 'Ver cómo usar OBS'}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {codecCheck.checked && enableRecording && codecCheck.h264Supported && (
              <Alert className="border-primary/50 bg-primary/5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <AlertTitle>Navegador compatible</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  Tu navegador soporta H.264. Las grabaciones funcionarán correctamente.
                </AlertDescription>
              </Alert>
            )}

            {/* RTMPS info for OBS */}
            {showRtmpsInfo && (
              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Transmitir con OBS
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p>Puedes usar OBS Studio (gratuito) para transmitir con mejor calidad:</p>
                  <ol className="list-decimal list-inside space-y-2">
                    <li>Descarga <a href="https://obsproject.com" target="_blank" rel="noopener" className="text-primary underline">OBS Studio</a></li>
                    <li>Ve a <strong>Configuración → Stream</strong></li>
                    <li>Selecciona <strong>Servicio: Personalizado</strong></li>
                    <li>La URL y clave se generarán al iniciar</li>
                  </ol>
                  <p className="text-xs text-muted-foreground">
                    Nota: Primero inicia la transmisión aquí, luego usa los datos RTMPS que aparecerán.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Submit */}
            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleStartLive}
              disabled={isCreating || !title.trim() || !specialty}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Preparando transmisión...
                </>
              ) : (
                <>
                  <Video className="w-5 h-5" />
                  Iniciar Transmisión en Vivo
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Al iniciar, se notificará automáticamente a tus suscriptores
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
