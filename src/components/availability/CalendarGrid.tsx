import React, { useMemo, useState } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isToday, isSameDay,
  addDays,
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
  language: 'es' | 'en' | 'pt' | 'fr' | 'it' | 'de';
  onDayClick: (date: Date) => void;
  onEventClick: (availability: DoctorAvailability) => void;
  isManaging?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  /**
   * Optional drag-and-drop handler. If provided, events become draggable on
   * sm+ screens and day cells become drop targets. mobile uses tap-to-edit.
   */
  onMoveEvent?: (availabilityId: string, newDate: Date) => void;
  /**
   * Subset of availability IDs the current user is allowed to drag.
   * If undefined, all events are draggable (back-compat).
   */
  draggableIds?: Set<string>;
}

const typeConfig = {
  live: { color: 'bg-destructive', text: 'text-white', icon: Video, label: 'Live' },
  consultation: { color: 'bg-primary', text: 'text-white', icon: MessageSquare, label: 'Orientación' },
  office_hours: { color: 'bg-success', text: 'text-white', icon: Clock, label: 'Disponible' },
};

function EventChip({
  availability, onClick, isManaging, isSelected, onToggleSelect,
  isDraggable, onDragStart, onDragEnd,
}: {
  availability: DoctorAvailability;
  onClick: () => void;
  isManaging?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  isDraggable?: boolean;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
}) {
  const config = typeConfig[availability.type] || typeConfig.office_hours;
  const Icon = config.icon;
  const isCancelled = availability.status === 'cancelled';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isManaging && onToggleSelect) {
      onToggleSelect(availability.id);
    } else {
      onClick();
    }
  };

  const dragHandlers = isDraggable
    ? {
        draggable: true,
        onDragStart: (e: React.DragEvent) => {
          e.stopPropagation();
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', availability.id);
          onDragStart?.(availability.id);
        },
        onDragEnd: (e: React.DragEvent) => {
          e.stopPropagation();
          onDragEnd?.();
        },
      }
    : {};

  return (
    <button
      onClick={handleClick}
      {...dragHandlers}
      className={cn(
        'w-full text-left rounded px-1.5 py-0.5 text-[10px] sm:text-xs font-semibold truncate flex items-center gap-1 transition-all hover:opacity-90 shadow-sm',
        config.color, config.text,
        isCancelled && 'opacity-40 line-through',
        isDraggable && 'cursor-grab active:cursor-grabbing',
        isManaging && 'ring-2 ring-offset-1 ring-offset-transparent',
        isManaging && isSelected && 'ring-white',
        isManaging && !isSelected && 'ring-white/40',
      )}
      title={`${availability.title} — ${format(availability.scheduledAt, 'HH:mm')}`}
    >
      {isManaging && (
        <span className={cn(
          'w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-[8px]',
          isSelected ? 'bg-white text-primary border-white' : 'border-white/60',
        )}>
          {isSelected && '✓'}
        </span>
      )}
      <Icon className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
      <span className="truncate">
        {format(availability.scheduledAt, 'HH:mm')} {availability.title}
      </span>
    </button>
  );
}

/**
 * Contraste:
 * - El componente vive sobre la imagen de fondo azul → usamos colores explícitos
 *   (blanco / blanco translúcido) en lugar de tokens semánticos que pueden quedar
 *   invisibles. Las celdas tienen un panel oscuro translúcido para máxima
 *   legibilidad de los números.
 */
function MonthView({ currentDate, availabilities, language, onDayClick, onEventClick, isManaging, selectedIds, onToggleSelect, onMoveEvent, draggableIds }: Omit<CalendarGridProps, 'viewMode'>) {
  const locale = language === 'es' ? es : enUS;
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, DoctorAvailability[]>();
    availabilities.forEach(a => {
      const key = format(a.scheduledAt, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    map.forEach(events => events.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()));
    return map;
  }, [availabilities]);

  const weekDays = Array.from({ length: 7 }, (_, i) =>
    format(addDays(calStart, i), 'EEE', { locale })
  );

  return (
    <div className="mm-calendar-panel">
      {/* Header */}
      <div className="grid grid-cols-7 mm-calendar-header">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-bold uppercase tracking-wide py-2 mm-calendar-cell-border">
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
          const isDropTarget = dropTargetKey === key && draggingId !== null;
          const draggingEvent = draggingId ? availabilities.find(a => a.id === draggingId) : null;
          const isSameDayAsSource = draggingEvent ? isSameDay(draggingEvent.scheduledAt, day) : false;

          const dropHandlers = onMoveEvent
            ? {
                onDragOver: (e: React.DragEvent) => {
                  if (!draggingId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = isSameDayAsSource ? 'none' : 'move';
                  if (dropTargetKey !== key && !isSameDayAsSource) setDropTargetKey(key);
                },
                onDragLeave: (e: React.DragEvent) => {
                  const related = e.relatedTarget as Node | null;
                  if (related && (e.currentTarget as Node).contains(related)) return;
                  if (dropTargetKey === key) setDropTargetKey(null);
                },
                onDrop: (e: React.DragEvent) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/plain') || draggingId;
                  setDropTargetKey(null);
                  setDraggingId(null);
                  if (!id) return;
                  const evt = availabilities.find(a => a.id === id);
                  if (!evt) return;
                  if (isSameDay(evt.scheduledAt, day)) return;
                  onMoveEvent(id, day);
                },
              }
            : {};

          return (
            <div
              key={key}
              onClick={() => onDayClick(day)}
              {...dropHandlers}
              className={cn(
                'min-h-[80px] sm:min-h-[100px] mm-calendar-cell p-1 cursor-pointer transition-colors',
                !inMonth && 'mm-calendar-cell-out',
                idx % 7 === 0 && 'mm-calendar-cell-first',
                isDropTarget && !isSameDayAsSource && 'ring-2 ring-inset ring-white/80 bg-white/10',
                isSameDayAsSource && draggingId && 'opacity-60',
              )}
            >
              <div className={cn(
                'text-xs sm:text-sm font-bold mb-1 w-7 h-7 flex items-center justify-center rounded-full',
                today && 'mm-calendar-today',
                !today && inMonth && 'text-white',
                !today && !inMonth && 'text-white/45',
              )}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(event => {
                  const draggable = onMoveEvent !== undefined && (draggableIds ? draggableIds.has(event.id) : true) && event.status !== 'cancelled';
                  return (
                    <EventChip
                      key={event.id}
                      availability={event}
                      onClick={() => onEventClick(event)}
                      isManaging={isManaging}
                      isSelected={selectedIds?.has(event.id)}
                      onToggleSelect={onToggleSelect}
                      isDraggable={draggable && !isManaging}
                      onDragStart={(id) => setDraggingId(id)}
                      onDragEnd={() => { setDraggingId(null); setDropTargetKey(null); }}
                    />
                  );
                })}
                {dayEvents.length > 3 && (
                  <p className="text-[10px] text-white/75 pl-1.5 font-medium">+{dayEvents.length - 3}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ currentDate, availabilities, language, onDayClick, onEventClick, isManaging, selectedIds, onToggleSelect }: Omit<CalendarGridProps, 'viewMode'>) {
  const locale = language === 'es' ? es : enUS;
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  const hours = Array.from({ length: 16 }, (_, i) => i + 6);

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
    <div className="mm-calendar-panel overflow-auto">
      <div className="min-w-[600px]">
        {/* Header */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] mm-calendar-header sticky top-0 z-10">
          <div className="mm-calendar-cell-border" />
          {days.map(day => (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className="text-center py-2 mm-calendar-cell-border cursor-pointer hover:bg-white/5"
            >
              <div className="text-[10px] text-white/75 uppercase font-semibold">{format(day, 'EEE', { locale })}</div>
              <div className={cn(
                'text-sm font-bold w-7 h-7 mx-auto flex items-center justify-center rounded-full text-white',
                isToday(day) && 'mm-calendar-today',
              )}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>
        {/* Time grid */}
        {hours.map(hour => (
          <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)]">
            <div className="text-[10px] text-white/80 text-right pr-2 pt-1 mm-calendar-cell-border h-12 font-medium">
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
                  className="h-12 mm-calendar-cell p-0.5 cursor-pointer"
                >
                  {dayEvents.map(event => (
                    <EventChip key={event.id} availability={event} onClick={() => onEventClick(event)} isManaging={isManaging} isSelected={selectedIds?.has(event.id)} onToggleSelect={onToggleSelect} />
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

function DayView({ currentDate, availabilities, language, onDayClick, onEventClick, isManaging, selectedIds, onToggleSelect }: Omit<CalendarGridProps, 'viewMode'>) {
  const hours = Array.from({ length: 18 }, (_, i) => i + 5);
  const dayKey = format(currentDate, 'yyyy-MM-dd');
  const dayEvents = availabilities.filter(a => format(a.scheduledAt, 'yyyy-MM-dd') === dayKey);

  return (
    <div className="mm-calendar-panel overflow-auto">
      <div className="mm-calendar-header px-4 py-3 text-center">
        <div className={cn(
          'text-lg font-bold',
          isToday(currentDate) ? 'text-white' : 'text-white',
        )}>
          {format(currentDate, language === 'es' ? "EEEE d 'de' MMMM" : 'EEEE, MMMM d', {
            locale: language === 'es' ? es : enUS,
          })}
        </div>
      </div>
      {hours.map(hour => {
        const hourEvents = dayEvents.filter(e => e.scheduledAt.getHours() === hour);
        return (
          <div key={hour} className="grid grid-cols-[60px_1fr]">
            <div className="text-xs text-white/80 text-right pr-3 pt-1.5 mm-calendar-cell-border h-16 font-medium">
              {`${hour.toString().padStart(2, '0')}:00`}
            </div>
            <div
              className="h-16 mm-calendar-cell p-1 cursor-pointer space-y-0.5"
              onClick={() => onDayClick(currentDate)}
            >
              {hourEvents.map(event => (
                <EventChip key={event.id} availability={event} onClick={() => onEventClick(event)} isManaging={isManaging} isSelected={selectedIds?.has(event.id)} onToggleSelect={onToggleSelect} />
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
