import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Stethoscope, 
  User, 
  CheckCheck, 
  Lock, 
  Clock,
  GraduationCap,
  Circle
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChatSession } from '@/contexts/ChatContext';
import { useLanguage } from '@/contexts/LanguageContext';

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
}

export function ChatSessionItem({
  session,
  isSelected,
  displayInfo,
  officeHours,
  isAvailable,
  canOpenDoctorProfile,
  userRole,
  onClick,
  onDoctorProfileClick,
}: ChatSessionItemProps) {
  const { t } = useLanguage();
  const isClosed = session.status === 'closed';
  
  const getParticipantIcon = () => {
    if (displayInfo.type === 'doctor') {
      return <Stethoscope className="w-4 h-4" />;
    }
    if (displayInfo.type === 'resident') {
      return <GraduationCap className="w-4 h-4" />;
    }
    return <User className="w-4 h-4" />;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      onClick={onClick}
      className={`
        group relative p-3 rounded-xl cursor-pointer transition-all duration-200
        ${isSelected 
          ? 'bg-primary/10 ring-2 ring-primary/20 shadow-sm' 
          : isClosed 
            ? 'bg-muted/30 hover:bg-muted/50' 
            : 'hover:bg-accent/50 hover:shadow-sm'
        }
        ${isClosed ? 'opacity-80' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Avatar with online indicator */}
        <div className="relative flex-shrink-0">
          <Avatar className={`w-12 h-12 ${isClosed ? 'opacity-75' : ''} ring-2 ring-background`}>
            <AvatarImage src={displayInfo.avatar} alt={displayInfo.name} />
            <AvatarFallback className={`
              ${displayInfo.type === 'doctor' 
                ? 'bg-gradient-to-br from-primary/20 to-primary/10 text-primary' 
                : displayInfo.type === 'resident'
                  ? 'bg-gradient-to-br from-secondary/30 to-secondary/10 text-secondary-foreground'
                  : 'bg-gradient-to-br from-muted to-muted/50 text-muted-foreground'
              }
              font-medium
            `}>
              {displayInfo.avatar ? getParticipantIcon() : getInitials(displayInfo.name)}
            </AvatarFallback>
          </Avatar>
          {/* Online/Available indicator for doctors */}
          {!isClosed && displayInfo.type === 'doctor' && userRole === 'patient' && (
            <span className={`
              absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background
              ${isAvailable ? 'bg-success' : 'bg-warning'}
            `} />
          )}
        </div>
        
        <div className="flex-1 min-w-0 space-y-0.5">
          {/* Name row */}
          <div className="flex items-center gap-2">
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
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 gap-0.5">
              <CheckCheck className="w-3 h-3" />
              2nd
            </Badge>
          )}
        </div>
        
        {/* Specialty and role badge */}
          {displayInfo.specialty && (
            <div className="flex items-center gap-1.5">
              {canOpenDoctorProfile ? (
                <button
                  type="button"
                  onClick={onDoctorProfileClick}
                  className="text-xs text-primary font-medium truncate text-left hover:underline focus:outline-none"
                  title={t('common.viewProfile')}
                >
                  {displayInfo.specialty}
                </button>
              ) : (
                <span className="text-xs text-primary font-medium truncate">{displayInfo.specialty}</span>
              )}
              {displayInfo.type === 'resident' && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                  Residente
                </Badge>
              )}
            </div>
          )}
          
          {/* Last message preview */}
          <p className="text-xs text-muted-foreground truncate pr-6">
            {session.lastMessage || 'Sin mensajes aún...'}
          </p>
          
          {/* Office hours or closed date */}
          {isClosed && session.lastMessageAt ? (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Lock className="w-3 h-3" />
              <span>Cerrada el {format(session.lastMessageAt, 'dd MMM yyyy', { locale: es })}</span>
            </div>
          ) : officeHours && userRole === 'patient' ? (
            <div className={`flex items-center gap-1 text-[11px] ${isAvailable ? 'text-success' : 'text-warning'}`}>
              <Clock className="w-3 h-3" />
              <span>{officeHours}</span>
              {!isAvailable && <span className="text-muted-foreground">• Fuera de horario</span>}
            </div>
          ) : null}
        </div>
        
        {/* Right side indicators */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {session.lastMessageAt && (
            <span className="text-[10px] text-muted-foreground">
              {format(session.lastMessageAt, 'HH:mm', { locale: es })}
            </span>
          )}
          {!isClosed && session.unreadCount > 0 && (
            <Badge className="h-5 min-w-5 px-1.5 text-xs bg-primary hover:bg-primary">
              {session.unreadCount}
            </Badge>
          )}
          {isClosed && (
            <Lock className="w-3.5 h-3.5 text-muted-foreground/50" />
          )}
        </div>
      </div>
    </div>
  );
}
