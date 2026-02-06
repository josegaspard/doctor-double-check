import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Bell, Check, Trash2, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

function getNotificationIcon(type: string) {
  switch (type) {
    case 'doctor_live': return '🔴';
    case 'doctor_availability': return '📅';
    case 'new_content': return '📄';
    case 'chat_message': return '💬';
    case 'subscription_update': return '⭐';
    default: return '🔔';
  }
}

function navigateByType(notification: Notification, navigate: ReturnType<typeof useNavigate>) {
  const data = notification.data || {};
  switch (notification.type) {
    case 'doctor_live':
      navigate(data.live_id || data.liveId ? `/live/${data.live_id || data.liveId}` : '/lives');
      break;
    case 'new_content':
      navigate(data.content_id || data.contentId ? `/recording/${data.content_id || data.contentId}` : '/recordings');
      break;
    case 'chat_message':
      navigate(data.session_id || data.sessionId ? `/chat?session=${data.session_id || data.sessionId}` : '/chat');
      break;
    case 'doctor_availability':
      navigate(data.doctor_id || data.doctorId ? `/doctor/${data.doctor_id || data.doctorId}` : '/doctors');
      break;
    case 'subscription_update':
      navigate('/settings');
      break;
    default:
      if (data.url) navigate(data.url);
      break;
  }
}

export default function Notifications() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();

  const handleClick = (notification: Notification) => {
    if (!notification.isRead) markAsRead(notification.id);
    navigateByType(notification, navigate);
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-4 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {language === 'es' ? 'Volver' : 'Back'}
        </Button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <Bell className="w-6 h-6" />
              {language === 'es' ? 'Notificaciones' : 'Notifications'}
            </h1>
            {unreadCount > 0 && (
              <p className="text-muted-foreground text-sm mt-1">
                {unreadCount} {language === 'es' ? 'sin leer' : 'unread'}
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <Check className="w-4 h-4 mr-2" />
              {language === 'es' ? 'Marcar todas como leídas' : 'Mark all as read'}
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
              <h3 className="font-semibold text-lg mb-2">
                {language === 'es' ? 'No hay notificaciones' : 'No notifications'}
              </h3>
              <p className="text-muted-foreground">
                {language === 'es' ? 'Las notificaciones aparecerán aquí' : 'Notifications will appear here'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`cursor-pointer hover:shadow-md transition-all ${!notification.isRead ? 'border-primary/30 bg-primary/5' : ''}`}
                onClick={() => handleClick(notification)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{getNotificationIcon(notification.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{notification.title}</p>
                        {!notification.isRead && (
                          <Badge variant="default" className="text-xs px-1.5 py-0">
                            {language === 'es' ? 'Nuevo' : 'New'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(notification.createdAt, {
                          addSuffix: true,
                          locale: language === 'es' ? es : enUS,
                        })}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
