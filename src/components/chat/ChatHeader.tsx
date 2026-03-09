import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Stethoscope, 
  User, 
  CheckCheck, 
  Lock, 
  Clock,
  XCircle,
  Loader2,
  GraduationCap,
  ArrowLeft,
  Video,
  Ban,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChatSession } from '@/contexts/ChatContext';
import { BlockUserButton } from '@/components/blocks/BlockUserButton';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface SessionDisplayInfo {
  name: string;
  specialty?: string;
  avatar?: string;
  type: string;
}

interface ChatHeaderProps {
  session: ChatSession;
  displayInfo: SessionDisplayInfo;
  officeHours: string | null;
  isAvailable: boolean;
  isClosed: boolean;
  isClosing: boolean;
  userRole: string | null;
  canOpenDoctorProfile: boolean;
  onDoctorProfileClick: (e: React.MouseEvent) => void;
  onCloseSession: () => void;
  onBack?: () => void;
  consultationId?: string | null;
}

export function ChatHeader({
  session,
  displayInfo,
  officeHours,
  isAvailable,
  isClosed,
  isClosing,
  userRole,
  canOpenDoctorProfile,
  onDoctorProfileClick,
  onCloseSession,
  onBack,
  consultationId,
}: ChatHeaderProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  const getOtherUserId = () => {
    if (!user) return null;
    return session.participant1Id === user.id ? session.participant2Id : session.participant1Id;
  };
  const getParticipantIcon = () => {
    if (displayInfo.type === 'doctor') {
      return <Stethoscope className="w-5 h-5 text-primary" />;
    }
    if (displayInfo.type === 'resident') {
      return <GraduationCap className="w-5 h-5 text-secondary-foreground" />;
    }
    return <User className="w-5 h-5 text-muted-foreground" />;
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
    <div className="px-4 py-3 border-b bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        {/* Back button for mobile */}
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        
        {/* Avatar */}
        <div className="relative">
          <Avatar className="w-11 h-11 ring-2 ring-background">
            <AvatarImage src={displayInfo.avatar} alt={displayInfo.name} />
            <AvatarFallback className={`
              ${displayInfo.type === 'doctor' 
                ? 'bg-gradient-to-br from-primary/20 to-primary/10' 
                : displayInfo.type === 'resident'
                  ? 'bg-gradient-to-br from-secondary/30 to-secondary/10'
                  : 'bg-gradient-to-br from-muted to-muted/50'
              }
            `}>
              {displayInfo.avatar ? getParticipantIcon() : getInitials(displayInfo.name)}
            </AvatarFallback>
          </Avatar>
          {!isClosed && displayInfo.type === 'doctor' && userRole === 'patient' && (
            <span className={`
              absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background
              ${isAvailable ? 'bg-success' : 'bg-warning'}
            `} />
          )}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {canOpenDoctorProfile ? (
              <button
                type="button"
                onClick={onDoctorProfileClick}
                className="text-sm font-semibold text-left hover:text-primary transition-colors focus:outline-none truncate"
                title={t('common.viewProfile')}
              >
                {displayInfo.name}
              </button>
            ) : (
              <span className="text-base font-semibold truncate">{displayInfo.name}</span>
            )}
            {session.isDoubleCheck && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 gap-0.5">
                <CheckCheck className="w-3 h-3" />
                2nd
              </Badge>
            )}
            {displayInfo.type === 'resident' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                {t('roles.resident')}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-[11px] sm:text-xs text-muted-foreground min-w-0 overflow-hidden">
            {displayInfo.specialty && (
              canOpenDoctorProfile ? (
                <button
                  type="button"
                  onClick={onDoctorProfileClick}
                  className="text-primary hover:underline focus:outline-none font-medium truncate flex-shrink-0 max-w-[120px] sm:max-w-none"
                  title={t('common.viewProfile')}
                >
                  {displayInfo.specialty}
                </button>
              ) : (
                <span className="text-primary font-medium truncate flex-shrink-0 max-w-[120px] sm:max-w-none">{displayInfo.specialty}</span>
              )
            )}
            {officeHours && userRole === 'patient' && (
              <>
                {displayInfo.specialty && <span className="text-muted-foreground/50 flex-shrink-0">•</span>}
                <span className={`flex items-center gap-1 truncate flex-shrink min-w-0 ${isAvailable ? 'text-success' : 'text-warning'}`}>
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  {isAvailable ? (
                    <span className="flex items-center gap-1">
                      <span className="relative flex h-2 w-2 flex-shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                      </span>
                      {t('chat.available')}
                    </span>
                  ) : (
                    <span className="truncate">{t('chat.offHours')} · {officeHours}</span>
                  )}
                </span>
              </>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          {/* Video call button */}
          {!isClosed && consultationId && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9 text-primary hover:text-primary hover:bg-primary/10 rounded-full"
              onClick={() => navigate(`/video-call?consultation=${consultationId}`)}
              title="Videollamada"
            >
              <Video className="w-4 h-4" />
            </Button>
          )}

          {/* Prescription button - only for doctors */}
          {!isClosed && userRole === 'doctor' && (() => {
            const patientId = session.participant1Id === user?.id ? session.participant2Id : session.participant1Id;
            const patientName = displayInfo.name;
            return (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9 text-primary hover:text-primary hover:bg-primary/10 rounded-full"
                onClick={() => navigate(`/prescriptions/new?patientId=${patientId}&patientName=${encodeURIComponent(patientName)}${consultationId ? `&consultationId=${consultationId}` : ''}&sessionId=${session.id}`)}
                title={t('common.createPrescription')}
              >
                <FileText className="w-4 h-4" />
              </Button>
            );
          })()}

          {/* Block user button */}
          {(() => {
            const otherUserId = getOtherUserId();
            return otherUserId ? (
              <BlockUserButton
                targetUserId={otherUserId}
                targetUserName={displayInfo.name}
                size="icon"
              />
            ) : null;
          })()}

          {isClosed ? (
            <Badge variant="secondary" className="gap-1 bg-muted/80 text-muted-foreground text-[11px] px-2 py-0.5">
              <Lock className="w-3 h-3" />
              <span className="hidden sm:inline">{t('chat.closed')}</span>
            </Badge>
          ) : (
            userRole === 'doctor' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-full" title={t('common.closeConsultation')}>
                    <XCircle className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('chat.closeSessionTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('chat.closeSessionDescription')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={onCloseSession}
                      disabled={isClosing}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isClosing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {t('chat.closing')}
                        </>
                      ) : (
                        t('chat.yesClose')
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )
          )}
        </div>
      </div>
      
      {isClosed && session.createdAt && (
        <p className="text-[11px] text-muted-foreground mt-2 pl-14">
          Orientación del {format(session.createdAt, 'dd MMMM yyyy', { locale: es })}
        </p>
      )}
    </div>
  );
}
