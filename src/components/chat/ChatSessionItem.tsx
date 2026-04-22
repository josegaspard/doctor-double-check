import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Stethoscope, 
  User, 
  CheckCheck, 
  Lock, 
  GraduationCap,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { ChatSession } from '@/contexts/ChatContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatMessagePreview } from '@/lib/utils';

interface SessionDisplayInfo {
  name: string;
  specialty?: string;
  avatar?: string;
  type: string;
}

interface ChatSessionItemProps {
  session: ChatSession;
  isSelected: boolean;
  displayInfo: SessionDisplayInfo;
  officeHours: string | null;
  isAvailable: boolean;
  canOpenDoctorProfile: boolean;
  userRole: string | null;
  onClick: () => void;
  onDoctorProfileClick: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  isSelecting?: boolean;
  isChecked?: boolean;
  onCheckChange?: (checked: boolean) => void;
}

export function ChatSessionItem({
  session,
  isSelected,
  displayInfo,
  isAvailable,
  canOpenDoctorProfile,
  userRole,
  onClick,
  onDoctorProfileClick,
  onDelete,
  isSelecting = false,
  isChecked = false,
  onCheckChange,
}: ChatSessionItemProps) {
  const { t, language } = useLanguage();
  const isClosed = session.status === 'closed';
  const dateLocale = language === 'en' ? enUS : es;
  
  const getParticipantIcon = () => {
    if (displayInfo.type === 'doctor') return <Stethoscope className="w-5 h-5" />;
    if (displayInfo.type === 'resident') return <GraduationCap className="w-5 h-5" />;
    return <User className="w-5 h-5" />;
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div
      onClick={() => {
        if (isSelecting && onCheckChange) {
          onCheckChange(!isChecked);
        } else {
          onClick();
        }
      }}
      className={`
        group relative p-3 rounded-xl cursor-pointer transition-all duration-200
        ${isSelecting && isChecked ? 'bg-primary/10 ring-2 ring-primary/30' : ''}
        ${!isSelecting && isSelected 
          ? 'bg-primary/10 ring-2 ring-primary/20 shadow-sm' 
          : isClosed 
            ? 'bg-muted/30 hover:bg-muted/50' 
            : 'hover:bg-accent/50 hover:shadow-sm'
        }
        ${isClosed ? 'opacity-80' : ''}
      `}
    >
      <div className="flex items-center gap-3">
        {/* Checkbox for selection mode */}
        {isSelecting && (
          <div className="flex items-center flex-shrink-0">
            <Checkbox
              checked={isChecked}
              onCheckedChange={(checked) => onCheckChange?.(!!checked)}
              onClick={(e) => e.stopPropagation()}
              className="h-5 w-5"
            />
          </div>
        )}

        {/* Avatar with availability dot */}
        <div className="relative flex-shrink-0">
          <Avatar className={`w-11 h-11 ${isClosed ? 'opacity-75' : ''} ring-2 ring-background`}>
            <AvatarImage src={displayInfo.avatar} alt={displayInfo.name} />
            <AvatarFallback className={`
              text-sm font-medium
              ${displayInfo.type === 'doctor' 
                ? 'bg-primary/15 text-primary' 
                : displayInfo.type === 'resident'
                  ? 'bg-secondary/20 text-secondary-foreground'
                  : 'bg-muted text-muted-foreground'
              }
            `}>
              {displayInfo.avatar ? getParticipantIcon() : getInitials(displayInfo.name)}
            </AvatarFallback>
          </Avatar>
          {/* Availability dot — only for doctors, from patient view */}
          {!isClosed && displayInfo.type === 'doctor' && userRole === 'patient' && (
            <span className={`
              absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background
              ${isAvailable ? 'bg-success' : 'bg-muted-foreground/40'}
            `} />
          )}
        </div>
        
        {/* Content — clean 2-line layout */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {canOpenDoctorProfile ? (
                <button
                  type="button"
                  onClick={onDoctorProfileClick}
                  className="font-semibold text-sm truncate text-left hover:text-primary transition-colors focus:outline-none"
                  title={t('common.viewProfile')}
                >
                  {displayInfo.name}
                </button>
              ) : (
                <p className="font-semibold text-sm truncate">{displayInfo.name}</p>
              )}
              {session.isDoubleCheck && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 gap-0.5 flex-shrink-0">
                  <CheckCheck className="w-3 h-3" />
                  2nd
                </Badge>
              )}
            </div>
            {/* Time */}
            <span className="text-[11px] text-muted-foreground flex-shrink-0">
              {session.lastMessageAt && format(session.lastMessageAt, 'HH:mm', { locale: dateLocale })}
            </span>
          </div>

          {/* Specialty inline */}
          {displayInfo.specialty && (
            <span className="text-xs text-primary/80 font-medium truncate block">
              {displayInfo.specialty}
            </span>
          )}

          {/* Last message — sanitiza mensajes legacy guardados con formato feo [Imagen:...] */}
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-xs text-muted-foreground truncate flex-1">
              {session.lastMessage ? formatMessagePreview(session.lastMessage, 80) : t('chat.noConversations')}
            </p>
            {/* Right indicators */}
            {!isClosed && session.unreadCount > 0 && (
              <Badge className="h-5 min-w-5 px-1.5 text-[10px] bg-primary hover:bg-primary flex-shrink-0">
                {session.unreadCount}
              </Badge>
            )}
            {isClosed && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive flex-shrink-0"
                onClick={onDelete}
                title="Eliminar chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
            {isClosed && !onDelete && (
              <Lock className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
