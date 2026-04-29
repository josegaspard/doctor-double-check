import React from 'react';
import { Bell, Check, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDistanceToNow } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { formatMessagePreview } from '@/lib/utils';

// Strip leading emojis from text to avoid duplicate icons
function stripLeadingEmoji(text: string): string {
  return text.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\uFE0F]+\s*/u, '').trim();
}

/**
 * Sanitiza el cuerpo de la notificación para evitar mostrar marcadores feos
 * tipo "[Imagen: scan.jpg]" cuando llega una notificación de chat con archivo.
 * Para tipo `chat_message` aplicamos `formatMessagePreview` (📷 Foto / 📎 Archivo / 📋 Receta médica).
 */
function getCleanNotificationBody(notification: Notification): string {
  const raw = notification.message || '';
  if (notification.type === 'chat_message') {
    return formatMessagePreview(raw, 120);
  }
  return raw;
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  language,
}: {
  notification: Notification;
  onMarkAsRead: () => void;
  onDelete: () => void;
  language: 'es' | 'en';
}) {
  const navigate = useNavigate();

  const getNotificationIcon = () => {
    switch (notification.type) {
      case 'doctor_live':
        return '🔴';
      case 'doctor_availability':
        return '📅';
      case 'new_content':
        return '📄';
      case 'chat_message':
        return '💬';
      case 'subscription_update':
        return '⭐';
      case 'rating_request':
        return '⭐';
      default:
        return '🔔';
    }
  };

  const handleClick = () => {
    if (!notification.isRead) {
      onMarkAsRead();
    }

    // Navigate based on notification type and data
    const data = notification.data || {};
    
    switch (notification.type) {
      case 'doctor_live':
        if (data.live_id || data.liveId) {
          navigate(`/live/${data.live_id || data.liveId}`);
        } else {
          navigate('/lives');
        }
        break;
      case 'new_content':
        if (data.content_id || data.contentId) {
          navigate(`/recording/${data.content_id || data.contentId}`);
        } else {
          navigate('/recordings');
        }
        break;
      case 'chat_message':
        if (data.session_id || data.sessionId) {
          navigate(`/chat?session=${data.session_id || data.sessionId}`);
        } else {
          navigate('/chat');
        }
        break;
      case 'doctor_availability':
        if (data.doctor_id || data.doctorId) {
          navigate(`/doctor/${data.doctor_id || data.doctorId}`);
        } else {
          navigate('/doctors');
        }
        break;
      case 'rating_request':
        // Immediately open the rating modal
        window.dispatchEvent(new CustomEvent('trigger-rating-check'));
        break;
      case 'subscription_update':
        navigate('/settings');
        break;
      case 'system':
        // System notifications - check for URL in data
        if (data.url) {
          navigate(data.url);
        }
        break;
      default:
        // For any other type, try to use URL from data or stay on current page
        if (data.url) {
          navigate(data.url);
        }
        break;
    }
  };

  return (
    <div
      className={`p-3 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors ${
        !notification.isRead ? 'bg-primary/5' : ''
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl">{getNotificationIcon()}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{stripLeadingEmoji(notification.title)}</p>
            {!notification.isRead && (
              <Badge variant="default" className="text-xs px-1.5 py-0">
                {language === 'es' ? 'Nuevo' : 'New'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {getCleanNotificationBody(notification)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(notification.createdAt, {
              addSuffix: true,
              locale: language === 'es' ? es : enUS,
            })}
          </p>
        </div>
        <div className="flex gap-1">
          {!notification.isRead && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead();
              }}
            >
              <Check className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, isLoading } =
    useNotifications();
  const { language, t } = useLanguage();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="app-header-control relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 p-0 flex items-center justify-center text-[10px]"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-96 p-0 mx-2 sm:mx-0" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="font-semibold text-sm sm:text-base">{t('notifications.title')}</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs sm:text-sm h-8">
              {t('notifications.markAllAsRead')}
            </Button>
          )}
        </div>
        <ScrollArea className="h-[60vh] sm:h-[400px]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {t('notifications.noNotifications')}
            </div>
          ) : (
            notifications.slice(0, 10).map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={() => markAsRead(notification.id)}
                onDelete={() => deleteNotification(notification.id)}
                language={language}
              />
            ))
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <div className="p-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-primary text-sm"
              onClick={() => navigate('/notifications')}
            >
              {language === 'es' ? 'Ver todas las notificaciones' : 'View all notifications'}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
