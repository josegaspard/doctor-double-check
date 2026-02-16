import React from 'react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Calendar, Clock, Video, MessageSquare, ChevronRight, Bell } from 'lucide-react';
import { useDoctorAvailability, DoctorAvailability } from '@/hooks/useDoctorAvailability';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

function AvailabilityItem({
  availability,
  language,
  isPremium,
}: {
  availability: DoctorAvailability;
  language: 'es' | 'en';
  isPremium?: boolean;
}) {
  const isLive = availability.type === 'live';
  const isConsultation = availability.type === 'consultation';
  
  const Icon = isLive ? Video : isConsultation ? MessageSquare : Clock;
  
  const timeUntil = formatDistanceToNow(availability.scheduledAt, {
    addSuffix: true,
    locale: language === 'es' ? es : enUS,
  });

  return (
    <Link to={`/doctor/${availability.doctorId}`}>
      <Card className={cn(
        'min-w-[280px] max-w-[280px] hover:shadow-md transition-all cursor-pointer border-l-4',
        isLive ? 'border-l-red-500 hover:border-l-red-600' :
        isConsultation ? 'border-l-blue-500 hover:border-l-blue-600' :
        'border-l-muted-foreground'
      )}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              'p-2 rounded-lg flex-shrink-0',
              isLive ? 'bg-red-500/10 text-red-500' :
              isConsultation ? 'bg-blue-500/10 text-blue-500' :
              'bg-muted text-muted-foreground'
            )}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm line-clamp-2">{availability.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {availability.doctorName}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={availability.status === 'confirmed' ? 'verified' : 'secondary'} className="text-xs">
                  {isLive ? 'Live' : isConsultation ? 'Consulta' : 'Horario'}
                </Badge>
                {isPremium && isLive && (
                  <Badge className="text-[10px] bg-yellow-500/10 text-yellow-600 border-yellow-300 gap-0.5">
                    ⭐ Acceso anticipado
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {format(availability.scheduledAt, "d MMM, HH:mm", {
                  locale: language === 'es' ? es : enUS,
                })}
                <span className="text-primary font-medium ml-1">
                  ({timeUntil})
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function UpcomingAvailabilities() {
  const { language, t } = useLanguage();
  const { availabilities, isLoading } = useDoctorAvailability();
  const { subscriptions } = useSubscriptions();

  // Filter availabilities from doctors the user follows
  const premiumDoctorIds = new Set(subscriptions.filter(s => s.tier === 'premium').map(s => s.creatorId));
  const subscribedDoctorIds = new Set(subscriptions.map(s => s.creatorId));
  
  const followedAvailabilities = availabilities
    .filter(a => subscribedDoctorIds.has(a.doctorId))
    .slice(0, 10);

  // If user has no subscriptions, show some general upcoming availabilities
  const displayAvailabilities = followedAvailabilities.length > 0 
    ? followedAvailabilities 
    : availabilities.slice(0, 6);

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Próximas actividades
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3].map(i => (
              <div key={i} className="min-w-[280px] h-32 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (displayAvailabilities.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {followedAvailabilities.length > 0 
              ? 'Próximos de doctores que sigues' 
              : 'Próximas actividades'
            }
          </CardTitle>
          {followedAvailabilities.length === 0 && subscriptions.length === 0 && (
            <Badge variant="secondary" className="gap-1">
              <Bell className="h-3 w-3" />
              Sigue doctores para recibir alertas
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4 pb-2">
            {displayAvailabilities.map(availability => (
              <AvailabilityItem
                key={availability.id}
                availability={availability}
                language={language}
                isPremium={premiumDoctorIds.has(availability.doctorId)}
              />
            ))}
            
            {/* View all card */}
            <Link to="/doctor/availability">
              <Card className="min-w-[160px] max-w-[160px] h-full flex items-center justify-center bg-primary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/40 transition-all cursor-pointer group">
                <CardContent className="p-4 text-center flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <ChevronRight className="h-5 w-5 text-primary group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <p className="text-sm font-medium text-primary">Ver todos</p>
                </CardContent>
              </Card>
            </Link>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}