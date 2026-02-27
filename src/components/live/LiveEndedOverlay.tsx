import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Radio,
  Heart,
  Eye,
  Clock,
  UserCircle,
} from 'lucide-react';

interface LiveEndedOverlayProps {
  doctorId: string;
  doctorName: string;
  doctorAvatar?: string;
  specialty: string;
  likesCount: number;
  peakViewers: number;
  duration: string;
}

export function LiveEndedOverlay({
  doctorId,
  doctorName,
  doctorAvatar,
  specialty,
  likesCount,
  peakViewers,
  duration,
}: LiveEndedOverlayProps) {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown <= 0) {
      navigate('/lives');
      return;
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, navigate]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <Card className="max-w-sm w-full mx-4 shadow-2xl border-0 bg-card">
        <CardContent className="p-6 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <Radio className="w-7 h-7 text-destructive" />
          </div>

          <div>
            <h3 className="font-heading text-lg font-bold text-foreground">
              Transmisión finalizada
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              El doctor ha terminado la transmisión en vivo.
            </p>
            <p className="text-sm text-primary font-medium mt-1">
              Si te interesa, en breve podrás comprar la grabación de este live.
            </p>
          </div>

          {/* Doctor info */}
          <div className="flex items-center gap-3 justify-center">
            <Avatar className="h-10 w-10">
              <AvatarImage src={doctorAvatar} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {doctorName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="text-left">
              <p className="font-semibold text-foreground text-sm">{doctorName}</p>
              <p className="text-xs text-muted-foreground">{specialty}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 py-2">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-foreground font-bold">
                <Heart className="w-3.5 h-3.5 text-destructive" />
                {likesCount}
              </div>
              <p className="text-[10px] text-muted-foreground">Likes</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-foreground font-bold">
                <Eye className="w-3.5 h-3.5 text-info" />
                {peakViewers}
              </div>
              <p className="text-[10px] text-muted-foreground">Pico</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-foreground font-bold">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                {duration}
              </div>
              <p className="text-[10px] text-muted-foreground">Duración</p>
            </div>
          </div>

          {/* Countdown */}
          <p className="text-sm text-muted-foreground">
            En <span className="font-bold text-foreground">{countdown}</span> segundo{countdown !== 1 ? 's' : ''} te vamos a redirigir al inicio
          </p>

          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate(`/doctor/${doctorId}`)} className="w-full gap-2">
              <UserCircle className="w-4 h-4" />
              Ver Perfil del Doctor
            </Button>
            <Button variant="outline" onClick={() => navigate('/lives')} className="w-full">
              Ir al inicio ahora
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
