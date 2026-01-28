import React from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Globe, Bell, Shield, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotifications } from '@/hooks/useNotifications';
import { PushNotificationToggle } from '@/components/notifications/PushNotificationToggle';

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { preferences, updatePreferences } = useNotifications();

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{t('nav.settings')}</h1>
            <p className="text-muted-foreground">{t('settings.preferences')}</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Language Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {t('settings.language')}
              </CardTitle>
              <CardDescription>
                Selecciona el idioma de la aplicación
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button
                  variant={language === 'es' ? 'default' : 'outline'}
                  onClick={() => setLanguage('es')}
                  className="flex-1"
                >
                  🇪🇸 {t('settings.spanish')}
                </Button>
                <Button
                  variant={language === 'en' ? 'default' : 'outline'}
                  onClick={() => setLanguage('en')}
                  className="flex-1"
                >
                  🇺🇸 {t('settings.english')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {t('settings.notifications')}
              </CardTitle>
              <CardDescription>
                Configura cómo quieres recibir notificaciones
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="email-notifications" className="flex flex-col gap-1">
                  <span>{t('settings.emailNotifications')}</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    Recibe notificaciones por correo electrónico
                  </span>
                </Label>
                <Switch
                  id="email-notifications"
                  checked={preferences?.emailNotifications ?? true}
                  onCheckedChange={(checked) => updatePreferences({ emailNotifications: checked })}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <Label htmlFor="push-notifications" className="flex flex-col gap-1">
                  <span>{t('settings.pushNotifications')}</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    Recibe notificaciones push en tu dispositivo
                  </span>
                </Label>
                <Switch
                  id="push-notifications"
                  checked={preferences?.pushNotifications ?? true}
                  onCheckedChange={(checked) => updatePreferences({ pushNotifications: checked })}
                />
              </div>

              <Separator />

              {/* Push Notification Toggle - Browser-level */}
              <PushNotificationToggle />

              <Separator />

              <div className="flex items-center justify-between">
                <Label htmlFor="inapp-notifications" className="flex flex-col gap-1">
                  <span>{t('settings.inAppNotifications')}</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    Muestra notificaciones dentro de la app
                  </span>
                </Label>
                <Switch
                  id="inapp-notifications"
                  checked={preferences?.inAppNotifications ?? true}
                  onCheckedChange={(checked) => updatePreferences({ inAppNotifications: checked })}
                />
              </div>

              <Separator />

              <h4 className="font-medium pt-2">Tipos de notificación</h4>

              <div className="flex items-center justify-between">
                <Label htmlFor="notify-live" className="flex items-center gap-2">
                  <span className="text-red-500">🔴</span>
                  Cuando un doctor inicie un Live
                </Label>
                <Switch
                  id="notify-live"
                  checked={preferences?.notifyDoctorLive ?? true}
                  onCheckedChange={(checked) => updatePreferences({ notifyDoctorLive: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="notify-content" className="flex items-center gap-2">
                  <span>📄</span>
                  Nuevo contenido de doctores que sigues
                </Label>
                <Switch
                  id="notify-content"
                  checked={preferences?.notifyNewContent ?? true}
                  onCheckedChange={(checked) => updatePreferences({ notifyNewContent: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="notify-chat" className="flex items-center gap-2">
                  <span>💬</span>
                  Mensajes de chat
                </Label>
                <Switch
                  id="notify-chat"
                  checked={preferences?.notifyChatMessages ?? true}
                  onCheckedChange={(checked) => updatePreferences({ notifyChatMessages: checked })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Identity Verification */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('verification.title')}
              </CardTitle>
              <CardDescription>
                {t('verification.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt="Avatar"
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-xl">{user?.name?.charAt(0) || '?'}</span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{user?.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {t('verification.pending')}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button variant="outline">
                  {t('verification.startVerification')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                La verificación de identidad está disponible próximamente. Te notificaremos cuando esté lista.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
