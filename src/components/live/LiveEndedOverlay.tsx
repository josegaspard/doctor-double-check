import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

  return (
    <div className="aspect-video bg-gradient-to-br from-muted/80 to-muted/60 rounded-xl flex items-center justify-center animate-fade-in">
      <Card className="max-w-sm w-full mx-4 shadow-xl border-0 bg-card/95 backdrop-blur-sm">
        <CardContent className="p-6 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
            <Radio className="w-6 h-6 text-muted-foreground" />
          </div>

          <div>
            <h3 className="font-heading text-lg font-bold text-foreground">
              Transmisión finalizada
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              El doctor ha terminado la transmisión en vivo
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

          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate(`/doctor/${doctorId}`)} className="w-full gap-2">
              <UserCircle className="w-4 h-4" />
              Ver Perfil del Doctor
            </Button>
            <Button variant="outline" onClick={() => navigate('/lives')} className="w-full">
              Volver a Lives
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
