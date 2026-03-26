import React, { useMemo } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay, isToday,
  addDays, startOfDay,
} from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { DoctorAvailability } from '@/hooks/useDoctorAvailability';
import { cn } from '@/lib/utils';
import { Video, MessageSquare, Clock } from 'lucide-react';

type ViewMode = 'month' | 'week' | 'day';

interface CalendarGridProps {
  currentDate: Date;
  viewMode: ViewMode;
  availabilities: DoctorAvailability[];
  language: 'es' | 'en';
  onDayClick: (date: Date) => void;
  onEventClick: (availability: DoctorAvailability) => void;
}

const typeConfig = {
  live: { color: 'bg-red-500', text: 'text-white', icon: Video, label: 'Live' },
  consultation: { color: 'bg-blue-500', text: 'text-white', icon: MessageSquare, label: 'Orientación' },
  office_hours: { color: 'bg-emerald-500', text: 'text-white', icon: Clock, label: 'Disponible' },
};

function EventChip({ availability, onClick }: { availability: DoctorAvailability; onClick: () => void }) {
  const config = typeConfig[availability.type] || typeConfig.office_hours;
  const Icon = config.icon;
  const isCancelled = availability.status === 'cancelled';

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        'w-full text-left rounded px-1.5 py-0.5 text-[10px] sm:text-xs font-medium truncate flex items-center gap-1 transition-opacity hover:opacity-80',
        config.color, config.text,
        isCancelled && 'opacity-40 line-through',
      )}
      title={`${availability.title} — ${format(availability.scheduledAt, 'HH:mm')}`}
    >
      <Icon className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
      <span className="truncate">
        {format(availability.scheduledAt, 'HH:mm')} {availability.title}
      </span>
    </button>
  );
}

function MonthView({ currentDate, availabilities, language, onDayClick, onEventClick }: Omit<CalendarGridProps, 'viewMode'>) {
  const locale = language === 'es' ? es : enUS;
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const eventsByDay = useMemo(() => {
    const map = new Map<string, DoctorAvailability[]>();
    availabilities.forEach(a => {
      const key = format(a.scheduledAt, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    // Sort each day's events by time
    map.forEach(events => events.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()));
    return map;
  }, [availabilities]);

  const weekDays = Array.from({ length: 7 }, (_, i) =>
    format(addDays(calStart, i), 'EEE', { locale })
  );

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-7 bg-muted/50">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2 border-b border-border">
            {day}
          </div>
        ))}
      </div>
      {/* Days grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay.get(key) || [];
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);

          return (
            <div
              key={key}
              onClick={() => onDayClick(day)}
              className={cn(
                'min-h-[80px] sm:min-h-[100px] border-b border-r border-border p-1 cursor-pointer transition-colors hover:bg-accent/30',
                !inMonth && 'bg-muted/30',
                idx % 7 === 0 && 'border-l-0',
              )}
            >
              <div className={cn(
                'text-xs sm:text-sm font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                today && 'bg-primary text-primary-foreground',
                !inMonth && 'text-muted-foreground/50',
              )}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(event => (
                  <EventChip key={event.id} availability={event} onClick={() => onEventClick(event)} />
                ))}
                {dayEvents.length > 3 && (
                  <p className="text-[10px] text-muted-foreground pl-1.5">+{dayEvents.length - 3} más</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ currentDate, availabilities, language, onDayClick, onEventClick }: Omit<CalendarGridProps, 'viewMode'>) {
  const locale = language === 'es' ? es : enUS;
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  const hours = Array.from({ length: 16 }, (_, i) => i + 6); // 6:00-21:00

  const eventsByDay = useMemo(() => {
    const map = new Map<string, DoctorAvailability[]>();
    availabilities.forEach(a => {
      const key = format(a.scheduledAt, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return map;
  }, [availabilities]);

  return (
    <div className="border border-border rounded-lg overflow-auto">
      <div className="min-w-[600px]">
        {/* Header */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] bg-muted/50 sticky top-0 z-10">
          <div className="border-b border-r border-border" />
          {days.map(day => (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={cn(
                'text-center py-2 border-b border-r border-border cursor-pointer hover:bg-accent/30',
                isToday(day) && 'bg-primary/10',
              )}
            >
              <div className="text-[10px] text-muted-foreground uppercase">{format(day, 'EEE', { locale })}</div>
              <div className={cn(
                'text-sm font-semibold w-7 h-7 mx-auto flex items-center justify-center rounded-full',
                isToday(day) && 'bg-primary text-primary-foreground',
              )}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>
        {/* Time grid */}
        {hours.map(hour => (
          <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)]">
            <div className="text-[10px] text-muted-foreground text-right pr-2 pt-1 border-r border-border h-12 border-b">
              {`${hour.toString().padStart(2, '0')}:00`}
            </div>
            {days.map(day => {
              const key = format(day, 'yyyy-MM-dd');
              const dayEvents = (eventsByDay.get(key) || []).filter(
                e => e.scheduledAt.getHours() === hour
              );
              return (
                <div
                  key={`${key}-${hour}`}
                  onClick={() => onDayClick(day)}
                  className="h-12 border-b border-r border-border p-0.5 cursor-pointer hover:bg-accent/20"
                >
                  {dayEvents.map(event => (
                    <EventChip key={event.id} availability={event} onClick={() => onEventClick(event)} />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayView({ currentDate, availabilities, language, onDayClick, onEventClick }: Omit<CalendarGridProps, 'viewMode'>) {
  const hours = Array.from({ length: 18 }, (_, i) => i + 5); // 5:00-22:00
  const dayKey = format(currentDate, 'yyyy-MM-dd');
  const dayEvents = availabilities.filter(a => format(a.scheduledAt, 'yyyy-MM-dd') === dayKey);

  return (
    <div className="border border-border rounded-lg overflow-auto">
      <div className="bg-muted/50 px-4 py-3 border-b border-border text-center">
        <div className={cn(
          'text-lg font-semibold',
          isToday(currentDate) && 'text-primary',
        )}>
          {format(currentDate, language === 'es' ? "EEEE d 'de' MMMM" : 'EEEE, MMMM d', {
            locale: language === 'es' ? es : enUS,
          })}
        </div>
      </div>
      {hours.map(hour => {
        const hourEvents = dayEvents.filter(e => e.scheduledAt.getHours() === hour);
        return (
          <div key={hour} className="grid grid-cols-[60px_1fr] border-b border-border">
            <div className="text-xs text-muted-foreground text-right pr-3 pt-1.5 border-r border-border h-16">
              {`${hour.toString().padStart(2, '0')}:00`}
            </div>
            <div
              className="h-16 p-1 cursor-pointer hover:bg-accent/20 space-y-0.5"
              onClick={() => onDayClick(currentDate)}
            >
              {hourEvents.map(event => (
                <EventChip key={event.id} availability={event} onClick={() => onEventClick(event)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CalendarGrid(props: CalendarGridProps) {
  switch (props.viewMode) {
    case 'week':
      return <WeekView {...props} />;
    case 'day':
      return <DayView {...props} />;
    default:
      return <MonthView {...props} />;
  }
}
