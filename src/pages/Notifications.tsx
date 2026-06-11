import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Bell, Check, Trash2, Loader2, CheckSquare, X } from 'lucide-react';
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

function stripLeadingEmoji(text: string): string {
  return text.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\uFE0F]+\s*/u, '').trim();
}
function getNotificationIcon(type: string) {
  switch (type) {
    case 'doctor_live': return '🔴';
    case 'doctor_availability': return '📅';
    case 'new_content': return '📄';
    case 'chat_message': return '💬';
    case 'subscription_update': return '⭐';
    case 'rating_request': return '⭐';
    case 'system': return '🔔';
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
    case 'rating_request':
      window.dispatchEvent(new CustomEvent('trigger-rating-check'));
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
  const { t, language } = useLanguage();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification, deleteNotifications } = useNotifications();
  const dateLocale = language === 'es' ? es : enUS;

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClick = (notification: Notification) => {
    if (isSelecting) {
      toggleSelect(notification.id);
      return;
    }
    if (!notification.isRead) markAsRead(notification.id);
    navigateByType(notification, navigate);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map(n => n.id)));
    }
  };

  const exitSelectionMode = () => {
    setIsSelecting(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    await deleteNotifications(Array.from(selectedIds));
    exitSelectionMode();
    setIsDeleting(false);
    setShowDeleteConfirm(false);
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-3xl">
        <Button
          variant="back"
          size="sm"
          onClick={() => navigate('/lives')}
          className="mb-4 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('notificationsPage.back')}
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="min-w-0">
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Bell className="w-6 h-6" />
              {t('notificationsPage.title')}
            </h1>
            {unreadCount > 0 && (
              <p className="text-muted-foreground text-sm mt-1">
                {unreadCount} {t('notificationsPage.unread')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {notifications.length > 0 && (
              <Button
                variant={isSelecting ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => isSelecting ? exitSelectionMode() : setIsSelecting(true)}
                className="gap-1.5"
              >
                {isSelecting ? <X className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                {isSelecting ? t('notificationsPage.cancel') : t('notificationsPage.select')}
              </Button>
            )}
            {!isSelecting && unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                <Check className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">{t('notificationsPage.markAllRead')}</span>
                <span className="sm:hidden">{t('notificationsPage.read')}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Select all bar */}
        {isSelecting && notifications.length > 0 && (
          <div className="flex items-center gap-3 mb-3 px-1">
            <Checkbox
              checked={selectedIds.size === notifications.length && notifications.length > 0}
              onCheckedChange={toggleSelectAll}
              className="h-5 w-5"
            />
            <span className="text-sm text-muted-foreground">
              {selectedIds.size === 0
                ? t('notificationsPage.selectAll')
                : `${selectedIds.size} / ${notifications.length}`}
            </span>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
              <h3 className="font-semibold text-lg mb-2">
                {t('notificationsPage.noNotifications')}
              </h3>
              <p className="text-muted-foreground">
                {t('notificationsPage.notificationsAppearHere')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 pb-20">
            {(() => {
              let lastGroup = '';
              return notifications.map((notification) => {
                const date = notification.createdAt;
                let group = '';
                if (isToday(date)) group = language === 'es' ? 'Hoy' : 'Today';
                else if (isYesterday(date)) group = language === 'es' ? 'Ayer' : 'Yesterday';
                else if (isThisWeek(date)) group = language === 'es' ? 'Esta semana' : 'This week';
                else group = language === 'es' ? 'Anteriores' : 'Older';

                const showHeader = group !== lastGroup;
                lastGroup = group;

                return (
                  <React.Fragment key={notification.id}>
                    {showHeader && (
                      <div className="pt-3 pb-1 first:pt-0">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group}</p>
                      </div>
                    )}
                    <Card
                      className={`cursor-pointer transition-all active:scale-[0.98] ${
                        isSelecting && selectedIds.has(notification.id)
                          ? 'ring-2 ring-primary bg-primary/10 border-primary/50'
                          : !notification.isRead
                            ? 'bg-card border-l-4 border-l-primary border-primary/20 shadow-sm hover:shadow-md hover:bg-accent'
                            : 'bg-card/60 hover:bg-card hover:shadow-sm'
                      }`}
                      onClick={() => handleClick(notification)}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start gap-3">
                          {isSelecting && (
                            <div className="pt-0.5 flex-shrink-0">
                              <Checkbox
                                checked={selectedIds.has(notification.id)}
                                onCheckedChange={() => toggleSelect(notification.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-5 w-5"
                              />
                            </div>
                          )}
                          <span className="text-xl mt-0.5 flex-shrink-0">{getNotificationIcon(notification.type)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm flex-1 min-w-0">{stripLeadingEmoji(notification.title)}</p>
                              {!notification.isRead && (
                                <span className="flex-shrink-0 inline-flex items-center h-5 px-2 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap leading-none">
                                  {t('notificationsPage.new')}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(notification.createdAt, {
                                addSuffix: true,
                                locale: dateLocale,
                              })}
                            </p>
                          </div>
                          {!isSelecting && (
                            <div className="flex gap-1 flex-shrink-0">
                              {!notification.isRead && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-10 w-10"
                                  onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 text-destructive"
                                onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </React.Fragment>
                );
              });
            })()}
          </div>
        )}

        {/* Floating bulk delete bar */}
        {isSelecting && selectedIds.size > 0 && (
          <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
            <div className="bg-card/95 backdrop-blur-lg border border-border rounded-xl shadow-2xl p-3">
              <Button
                variant="destructive"
                className="w-full gap-2 h-11 text-sm font-medium"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4" />
                {t('notificationsPage.deleteBtn')} ({selectedIds.size})
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('notificationsPage.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('notificationsPage.deleteConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('notificationsPage.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t('notificationsPage.deleting') : t('notificationsPage.deleteBtn')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
