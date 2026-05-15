import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Calendar, Clock, Video, MessageSquare, ChevronRight, Bell, User } from 'lucide-react';
import { useDoctorAvailability, DoctorAvailability } from '@/hooks/useDoctorAvailability';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

function AvailabilityCard({
  availability,
  language,
  isPremium,
  onClick,
}: {
  availability: DoctorAvailability;
  language: 'es' | 'en';
  isPremium?: boolean;
  onClick: () => void;
}) {
  const isLive = availability.type === 'live';
  const isConsultation = availability.type === 'consultation';

  const Icon = isLive ? Video : isConsultation ? MessageSquare : Clock;

  const timeUntil = formatDistanceToNow(availability.scheduledAt, {
    addSuffix: true,
    locale: language === 'es' ? es : enUS,
  });

  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className={cn(
        'min-w-[240px] max-w-[240px] sm:min-w-[280px] sm:max-w-[280px] hover:shadow-md transition-all cursor-pointer border-l-4',
        isLive ? 'border-l-red-500 hover:border-l-red-600' :
        isConsultation ? 'border-l-blue-500 hover:border-l-blue-600' :
        'border-l-muted-foreground'
      )}>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <div className={cn(
              'p-1.5 sm:p-2 rounded-lg flex-shrink-0',
              isLive ? 'bg-destructive/10 text-destructive' :
              isConsultation ? 'bg-primary/10 text-primary' :
              'bg-muted text-muted-foreground'
            )}>
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm line-clamp-2 whitespace-normal break-words leading-snug">
                {availability.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {availability.doctorName}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <Badge variant={availability.status === 'confirmed' ? 'verified' : 'secondary'} className="text-[10px] px-1.5 py-0 h-5">
                  {isLive ? 'Live' : isConsultation ? 'Consulta' : 'Horario'}
                </Badge>
                {isPremium && isLive && (
                  <Badge className="text-[10px] bg-warning/10 text-warning border-warning px-1.5 py-0 h-5">
                    ⭐
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground whitespace-normal">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                <span>
                  {format(availability.scheduledAt, "d MMM, HH:mm", {
                    locale: language === 'es' ? es : enUS,
                  })}
                </span>
                <span className="text-primary font-medium ml-0.5">({timeUntil})</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function AvailabilityDetailDialog({
  availability,
  language,
  isPremium,
  open,
  onOpenChange,
}: {
  availability: DoctorAvailability | null;
  language: 'es' | 'en';
  isPremium?: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!availability) return null;

  const isLive = availability.type === 'live';
  const isConsultation = availability.type === 'consultation';
  const Icon = isLive ? Video : isConsultation ? MessageSquare : Clock;

  const timeUntil = formatDistanceToNow(availability.scheduledAt, {
    addSuffix: true,
    locale: language === 'es' ? es : enUS,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className={cn(
              'p-2.5 rounded-lg flex-shrink-0',
              isLive ? 'bg-destructive/10 text-destructive' :
              isConsultation ? 'bg-primary/10 text-primary' :
              'bg-muted text-muted-foreground'
            )}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base leading-snug break-words">
                {availability.title}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {availability.doctorName}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={availability.status === 'confirmed' ? 'verified' : 'secondary'}>
              {isLive ? 'Live' : isConsultation ? 'Consulta' : 'Horario'}
            </Badge>
            {isPremium && isLive && (
              <Badge className="bg-warning/10 text-warning border-warning gap-1">
                ⭐ Acceso anticipado
              </Badge>
            )}
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="font-medium">
                {format(availability.scheduledAt, "EEEE d 'de' MMMM, HH:mm", {
                  locale: language === 'es' ? es : enUS,
                })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span>{availability.durationMinutes} min · {timeUntil}</span>
            </div>
          </div>

          {availability.description && (
            <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
              {availability.description}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cerrar
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link to={`/doctor/${availability.doctorId}`}>
              <User className="h-4 w-4 mr-1.5" />
              Ver perfil del doctor
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UpcomingAvailabilities() {
  const { language, t } = useLanguage();
  const { availabilities, isLoading } = useDoctorAvailability();
  const { subscriptions } = useSubscriptions();
  const [selected, setSelected] = useState<DoctorAvailability | null>(null);
  const [open, setOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);

  const premiumDoctorIds = new Set(subscriptions.filter(s => s.tier === 'premium').map(s => s.creatorId));
  const subscribedDoctorIds = new Set(subscriptions.map(s => s.creatorId));

  const followedAvailabilities = availabilities
    .filter(a => subscribedDoctorIds.has(a.doctorId))
    .slice(0, 10);

  const displayAvailabilities = followedAvailabilities.length > 0
    ? followedAvailabilities
    : availabilities.slice(0, 6);

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-3 px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Próximas actividades
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3].map(i => (
              <div key={i} className="min-w-[240px] sm:min-w-[280px] h-28 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (displayAvailabilities.length === 0) {
    return null;
  }

  const openDetails = (a: DoctorAvailability) => {
    setSelected(a);
    setOpen(true);
  };

  return (
    <>
      <Card className="mb-6 overflow-hidden">
        <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2 min-w-0">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
              <span className="truncate">
                {followedAvailabilities.length > 0
                  ? 'Próximos de doctores que sigues'
                  : 'Próximas actividades'}
              </span>
            </CardTitle>
            {followedAvailabilities.length === 0 && subscriptions.length === 0 && (
              <Badge variant="secondary" className="gap-1 hidden sm:inline-flex">
                <Bell className="h-3 w-3" />
                Sigue doctores para recibir alertas
              </Badge>
            )}
          </div>
          {followedAvailabilities.length === 0 && subscriptions.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 sm:hidden">
              <Bell className="h-3 w-3" />
              Sigue doctores para recibir alertas
            </p>
          )}
        </CardHeader>
        <CardContent className="pb-4 px-4 sm:px-6">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-3 sm:gap-4 pb-2">
              {displayAvailabilities.map(availability => (
                <AvailabilityCard
                  key={availability.id}
                  availability={availability}
                  language={language}
                  isPremium={premiumDoctorIds.has(availability.doctorId)}
                  onClick={() => openDetails(availability)}
                />
              ))}

              {displayAvailabilities.length > 3 && (
                <button type="button" onClick={() => setAllOpen(true)} className="text-left">
                  <Card className="min-w-[120px] max-w-[120px] sm:min-w-[160px] sm:max-w-[160px] h-full flex items-center justify-center bg-primary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/40 transition-all cursor-pointer group">
                    <CardContent className="p-3 sm:p-4 text-center flex flex-col items-center justify-center gap-2">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-primary group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-primary">Ver todas</p>
                      <p className="text-[10px] text-muted-foreground">({displayAvailabilities.length})</p>
                    </CardContent>
                  </Card>
                </button>
              )}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      <AvailabilityDetailDialog
        availability={selected}
        language={language}
        isPremium={selected ? premiumDoctorIds.has(selected.doctorId) : false}
        open={open}
        onOpenChange={setOpen}
      />

      <Dialog open={allOpen} onOpenChange={setAllOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {followedAvailabilities.length > 0
                ? 'Próximos de doctores que sigues'
                : 'Próximas actividades'}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              {displayAvailabilities.length} {displayAvailabilities.length === 1 ? 'actividad' : 'actividades'}
            </p>
          </DialogHeader>

          <div className="overflow-y-auto -mx-6 px-6 space-y-2">
            {displayAvailabilities.map(a => {
              const isLive = a.type === 'live';
              const isConsultation = a.type === 'consultation';
              const ItemIcon = isLive ? Video : isConsultation ? MessageSquare : Clock;
              const timeUntil = formatDistanceToNow(a.scheduledAt, {
                addSuffix: true,
                locale: language === 'es' ? es : enUS,
              });
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setAllOpen(false);
                    setTimeout(() => openDetails(a), 80);
                  }}
                  className={cn(
                    'w-full text-left rounded-lg border bg-card p-3 hover:shadow-md transition-all border-l-4',
                    isLive ? 'border-l-red-500' :
                    isConsultation ? 'border-l-blue-500' :
                    'border-l-muted-foreground'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'p-1.5 rounded-lg flex-shrink-0',
                      isLive ? 'bg-destructive/10 text-destructive' :
                      isConsultation ? 'bg-primary/10 text-primary' :
                      'bg-muted text-muted-foreground'
                    )}>
                      <ItemIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm line-clamp-2 break-words leading-snug">
                        {a.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {a.doctorName}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground flex-wrap">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <span>
                          {format(a.scheduledAt, "d MMM, HH:mm", {
                            locale: language === 'es' ? es : enUS,
                          })}
                        </span>
                        <span className="text-primary font-medium">({timeUntil})</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                </button>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAllOpen(false)} className="w-full sm:w-auto">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
