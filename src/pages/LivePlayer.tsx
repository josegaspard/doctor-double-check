import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLives } from '@/contexts/LivesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCloudflareStream } from '@/hooks/cloudflare';
import { useViewerCount } from '@/hooks/useViewerCount';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import MainLayout from '@/components/layout/MainLayout';
import { CloudflareStreamPlayer } from '@/components/live/CloudflareStreamPlayer';
import { LiveChat } from '@/components/live/LiveChat';
import { AnimatedViewerCount } from '@/components/live/AnimatedViewerCount';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Video,
  Users,
  Clock,
  ArrowLeft,
  MessageSquare,
  Share2,
  Heart,
  Stethoscope,
  Star,
  Award,
  StopCircle,
  Save,
  Radio,
  Loader2,
} from 'lucide-react';

export default function LivePlayer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getLive, likeLive, unlikeLive, hasLiked, endLive, isLoading, refreshLives } = useLives();
  const { user, role } = useAuth();
  const { getSubscription } = useSubscriptions();
  const { getPlaybackUrl, isLoading: isStreamLoading } = useCloudflareStream();
  
  const [isLiking, setIsLiking] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [saveAsRecording, setSaveAsRecording] = useState(true);
  const [isEnding, setIsEnding] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [isInEarlyAccessWindow, setIsInEarlyAccessWindow] = useState(false);
  
  // Cloudflare Stream state
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [isJoiningStream, setIsJoiningStream] = useState(false);
  
  const live = getLive(id || '');
  const isOwner = user?.id === live?.doctorId;
  const isLiveActive = live?.status === 'live';
  const mySubToDoctor = live?.doctorId ? getSubscription(live.doctorId) : undefined;
  const earlyMinutes = mySubToDoctor?.tier === 'premium' ? (mySubToDoctor.earlyAccessMinutes ?? 0) : 0;

  // Real-time viewer count hook
  const { viewerCount, likesCount: realtimeLikesCount } = useViewerCount({
    liveId: id || '',
    autoJoin: isLiveActive && !isOwner,
  });
  
  const isLiked = live ? hasLiked(live.id) : false;

  // Get playback URL when component mounts and live is active
  useEffect(() => {
    const getStreamUrl = async () => {
      if (!live || !isLiveActive) return;
      if (playbackUrl) return; // Already have URL
      
      // Use the stream UID from the database (stored in daily_room_name column)
      const streamUid = live.dailyRoomName;
      if (!streamUid) {
        console.error('No stream UID found for live:', live.id);
        return;
      }
      
      setIsJoiningStream(true);
      try {
        const url = await getPlaybackUrl(streamUid, 'live');
        if (url) {
          setPlaybackUrl(url);
        }
      } catch (error) {
        console.error('Error getting stream URL:', error);
      } finally {
        setIsJoiningStream(false);
      }
    };

    getStreamUrl();
  }, [live, isLiveActive, getPlaybackUrl, playbackUrl]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <Skeleton className="h-8 w-32 mb-4" />
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="aspect-video w-full rounded-xl" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-48 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!live) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-12 text-center">
          <Video className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Transmisión no encontrada</h2>
          <Button onClick={() => navigate('/lives')}>Volver a Lives</Button>
        </div>
      </MainLayout>
    );
  }

  const formatDuration = (startedAt: Date) => {
    const diff = Date.now() - startedAt.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} minutos`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const handleLike = async () => {
    if (role === 'visitor' || !user || isLiking) return;
    
    setIsLiking(true);
    try {
      if (isLiked) {
        await unlikeLive(live.id);
      } else {
        await likeLive(live.id);
      }
    } finally {
      setIsLiking(false);
    }
  };

  const handleEndLive = async () => {
    if (!live) return;
    
    setIsEnding(true);
    try {
      const result = await endLive(live.id, saveAsRecording);
      
      if (result.success) {
        toast.success(
          saveAsRecording 
            ? 'Live terminado y grabación guardada' 
            : 'Live terminado exitosamente'
        );
        setShowEndDialog(false);
        navigate('/lives');
      } else {
        toast.error(result.error || 'Error al terminar el live');
      }
    } finally {
      setIsEnding(false);
    }
  };

  // Watermark for authenticated users
  const Watermark = () => {
    if (!user || role === 'visitor') return null;
    
    return (
      <>
        <div className="watermark top-4 left-4">
          {user.email} • {new Date().toISOString().slice(0, 10)}
        </div>
        <div className="watermark bottom-4 right-4">
          ID: {user.id}
        </div>
      </>
    );
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 max-w-6xl">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/lives')}
          className="mb-3 sm:mb-4 h-8 text-xs sm:text-sm"
        >
          <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          Volver a Lives
        </Button>

        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Video Player */}
          <div className="lg:col-span-2 space-y-4">
            {/* Player Container */}
            {playbackUrl ? (
              <CloudflareStreamPlayer
                playbackUrl={playbackUrl}
                isOwner={isOwner}
                onLeave={() => navigate('/lives')}
                viewerCount={viewerCount || live.viewerCount}
              />
            ) : (
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden no-context-menu">
                {isJoiningStream ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-info/30">
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 mx-auto mb-4 text-white animate-spin" />
                      <p className="text-white/80 text-sm">Conectando a la transmisión...</p>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-info/30">
                    <div className="text-center">
                      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
                        <Radio className="w-10 h-10 text-white animate-pulse" />
                      </div>
                      <p className="text-white/80 text-sm">Transmisión en vivo</p>
                      <p className="text-white/60 text-xs mt-1">Esperando conexión de video...</p>
                    </div>
                  </div>
                )}
                
                {/* Watermarks */}
                <Watermark />
                
                {/* Live indicator */}
                <div className="absolute top-4 left-4 z-10">
                  <Badge variant="live" className="gap-1">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    EN VIVO
                  </Badge>
                </div>
                
                {/* Viewers - Real-time Animated */}
                <div className="absolute top-4 right-4 z-10">
                  <AnimatedViewerCount count={viewerCount || live.viewerCount} />
                </div>
                
                {/* Duration */}
                <div className="absolute bottom-4 left-4 z-10">
                  <Badge variant="secondary" className="gap-1 bg-black/60 text-white border-0">
                    <Clock className="w-3 h-3" />
                    {formatDuration(live.startedAt)}
                  </Badge>
                </div>
              </div>
            )}

            {/* Video Info */}
            <div>
              <h1 className="font-heading text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-2 sm:mb-3">
                {live.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {live.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
              
              <Separator className="my-3 sm:my-4" />
              
              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={isLiked ? "default" : "outline"}
                  size="sm"
                  onClick={handleLike}
                  disabled={role === 'visitor' || isLiking}
                  className="gap-1 sm:gap-2 h-8 text-xs sm:text-sm"
                >
                  <Heart className={`w-3 h-3 sm:w-4 sm:h-4 ${isLiked ? 'fill-current' : ''}`} />
                  <span className="hidden xs:inline">{realtimeLikesCount || live.likesCount}</span> Me gusta
                </Button>
                <Button variant="outline" size="sm" className="gap-1 sm:gap-2 h-8 text-xs sm:text-sm">
                  <Share2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Compartir</span>
                </Button>
                {role !== 'visitor' && (
                  <Button 
                    variant={showChat ? "default" : "outline"} 
                    size="sm" 
                    className="gap-1 sm:gap-2 h-8 text-xs sm:text-sm lg:hidden"
                    onClick={() => setShowChat(!showChat)}
                  >
                    <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                    Chat
                  </Button>
                )}
              </div>
              
              <Separator className="my-3 sm:my-4" />
              
              {/* Description */}
              <p className="text-muted-foreground text-sm">{live.description}</p>
            </div>
          </div>

          {/* Sidebar - Doctor Info & Chat */}
          <div className="space-y-3 sm:space-y-4">
            {/* Live Chat - Always visible on desktop, toggleable on mobile */}
            {showChat && role !== 'visitor' && (
              <div className="h-[280px] sm:h-[350px]">
                <LiveChat liveId={live.id} isOwner={isOwner} />
              </div>
            )}
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Stethoscope className="w-7 h-7 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{live.doctorName}</h3>
                    <p className="text-sm text-muted-foreground">{live.specialty}</p>
                    <Badge variant="verified" className="mt-2 gap-1">
                      <Award className="w-3 h-3" />
                      Verificado
                    </Badge>
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{realtimeLikesCount || live.likesCount}</p>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Heart className="w-3 h-3 fill-destructive text-destructive" />
                      Likes
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{live.followersCount || 0}</p>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Star className="w-3 h-3 fill-premium text-premium" />
                      Seguidores
                    </p>
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <Button className="w-full" onClick={() => navigate(`/doctor/${live.doctorId}`)}>
                  Ver Perfil
                </Button>
                
                {(role === 'patient') && (
                  <Button 
                    variant="outline" 
                    className="w-full mt-2"
                    onClick={() => navigate('/chat')}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Iniciar Chat Privado
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Recording Notice */}
            <Card className="bg-premium/5 border-premium/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-premium/10 flex items-center justify-center flex-shrink-0">
                    <Video className="w-5 h-5 text-premium" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm">Grabación Premium</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cuando termine este live, la grabación estará disponible para usuarios premium.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Doctor Controls - End Live */}
            {isOwner && isLiveActive && (
              <Card className="bg-destructive/5 border-destructive/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                      <StopCircle className="w-5 h-5 text-destructive" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground text-sm">Panel del Doctor</h4>
                      <p className="text-xs text-muted-foreground mt-1 mb-3">
                        Controles de tu transmisión en vivo.
                      </p>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="w-full"
                        onClick={() => setShowEndDialog(true)}
                      >
                        <StopCircle className="w-4 h-4 mr-2" />
                        Terminar Live
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Visitor Notice */}
            {role === 'visitor' && (
              <Card className="bg-info/5 border-info/20">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    Regístrate para participar en el chat y más
                  </p>
                  <Button size="sm" onClick={() => navigate('/login')}>
                    Crear Cuenta
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* End Live Dialog */}
      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terminar transmisión</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas terminar esta transmisión en vivo?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex items-start space-x-3 p-4 rounded-lg bg-muted/50">
              <Checkbox 
                id="saveRecording" 
                checked={saveAsRecording}
                onCheckedChange={(checked) => setSaveAsRecording(checked === true)}
              />
              <div className="flex-1">
                <label 
                  htmlFor="saveRecording" 
                  className="text-sm font-medium cursor-pointer flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Guardar como grabación
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  La grabación estará disponible para que tus suscriptores la vean después.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowEndDialog(false)}
              disabled={isEnding}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleEndLive}
              disabled={isEnding}
            >
              {isEnding ? 'Terminando...' : 'Terminar Live'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
