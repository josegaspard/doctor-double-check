import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Globe, Bell, Shield, CheckCircle, Mail, CreditCard, Loader2, ExternalLink, Moon, Sun, Trash2, AlertTriangle } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotifications } from '@/hooks/useNotifications';
import { PushNotificationToggle } from '@/components/notifications/PushNotificationToggle';
import { MySubscriptions } from '@/components/subscriptions/MySubscriptions';
import { ReferralProgram } from '@/components/referrals/ReferralProgram';
import { MfaSettings } from '@/components/settings/MfaSettings';
import { CurrencySelector } from '@/components/currency/CurrencySelector';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { preferences, updatePreferences } = useNotifications();
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'ELIMINAR') {
      toast.error(t('settingsPage.toastTypeConfirmWord'));
      return;
    }
    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account', {
        body: { confirmation: 'ELIMINAR' },
      });
      if (error) throw error;
      await supabase.auth.signOut();
      toast.success(t('settingsPage.toastAccountDeleted'));
      window.location.replace('/');
    } catch (err: any) {
      console.error('delete account failed', err);
      toast.error(err?.message || t('settingsPage.toastDeleteFailed'));
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    const fetchVerification = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('identity_verifications')
        .select('status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setVerificationStatus(data.status);
    };
    fetchVerification();
  }, [user?.id]);

  const getVerificationBadge = () => {
    switch (verificationStatus) {
      case 'verified':
        return <Badge variant="success" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />{t('verification.verified')}</Badge>;
      case 'pending':
        return <Badge variant="warning" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />{t('verification.pending')}</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="text-xs">{t('verification.failed')}</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{t('settingsPage.notVerifiedBadge')}</Badge>;
    }
  };

  const handleManageSubscriptions = async () => {
    setIsLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) {
        // Parse the error body if available
        const errorBody = typeof error === 'object' && error.message ? error.message : String(error);
        if (errorBody.includes('No Stripe customer found')) {
          toast.info(t('paywall.noPaymentHistory'));
          return;
        }
        throw error;
      }
      if (data?.url) {
        window.open(data.url, '_blank');
      } else if (data?.error) {
        if (data.error.includes('No Stripe customer found')) {
          toast.info(t('paywall.noPaymentHistory'));
        } else {
          toast.error(data.error);
        }
      } else {
        toast.error(t('settingsPage.toastPortalFailed'));
      }
    } catch (error: any) {
      console.error('Error opening portal:', error);
      const msg = error?.message || error?.context?.body?.error || t('settingsPage.toastPortalErrorGeneric');
      if (msg.includes('No Stripe customer found')) {
        toast.info(t('paywall.noPaymentHistory'));
      } else {
        toast.error(msg);
      }
    } finally {
      setIsLoadingPortal(false);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="back" size="icon" onClick={() => navigate(-1)} className="hidden sm:flex">
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
                {t('settings.selectAppLanguage')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {([
                  { code: 'es', flag: '🇪🇸', key: 'settings.spanish' },
                  { code: 'en', flag: '🇺🇸', key: 'settings.english' },
                  { code: 'pt', flag: '🇵🇹', key: 'settings.portuguese' },
                  { code: 'fr', flag: '🇫🇷', key: 'settings.french' },
                  { code: 'it', flag: '🇮🇹', key: 'settings.italian' },
                  { code: 'de', flag: '🇩🇪', key: 'settings.german' },
                ] as const).map((l) => (
                  <Button
                    key={l.code}
                    variant={language === l.code ? 'default' : 'outline'}
                    onClick={() => setLanguage(l.code)}
                    className="w-full"
                  >
                    {l.flag} {t(l.key)}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Currency (Multi-currency PDF 1 Fase 2) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {t('settingsPage.currency')}
              </CardTitle>
              <CardDescription>
                {t('settingsPage.currencyDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CurrencySelector />
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                {t('settingsPage.appearance')}
              </CardTitle>
              <CardDescription>
                {t('settingsPage.appearanceDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="dark-mode" className="flex flex-col gap-1 flex-1 min-w-0">
                  <span>{t('settingsPage.darkMode')}</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {t('settingsPage.darkModeDescription')}
                  </span>
                </Label>
                <Switch
                  id="dark-mode"
                  checked={theme === 'dark'}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Email Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                {t('settings.emailTitle')}
              </CardTitle>
              <CardDescription>
                {t('settings.emailDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="email-notifications" className="flex flex-col gap-1 flex-1 min-w-0">
                  <span>{t('settings.enableEmails')}</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {t('settings.masterSwitch')}
                  </span>
                </Label>
                <Switch
                  id="email-notifications"
                  checked={preferences?.emailNotifications ?? true}
                  onCheckedChange={(checked) => updatePreferences({ emailNotifications: checked })}
                />
              </div>

              {preferences?.emailNotifications && (
                <>
                  <Separator />
                  <h4 className="font-medium text-sm text-muted-foreground">{t('settings.emailTypes')}</h4>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="email-live" className="flex items-center gap-2">
                      <span className="text-destructive">🔴</span>
                      <span className="flex flex-col">
                        <span>{t('settings.livesEmail')}</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          {t('settings.livesEmailDescription')}
                        </span>
                      </span>
                    </Label>
                    <Switch
                      id="email-live"
                      checked={preferences?.notifyDoctorLive ?? true}
                      onCheckedChange={(checked) => updatePreferences({ notifyDoctorLive: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="email-content" className="flex items-center gap-2">
                      <span>📄</span>
                      <span className="flex flex-col">
                        <span>{t('settings.contentEmail')}</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          {t('settings.contentEmailDescription')}
                        </span>
                      </span>
                    </Label>
                    <Switch
                      id="email-content"
                      checked={preferences?.notifyNewContent ?? true}
                      onCheckedChange={(checked) => updatePreferences({ notifyNewContent: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="email-chat" className="flex items-center gap-2">
                      <span>💬</span>
                      <span className="flex flex-col">
                        <span>{t('settings.chatEmail')}</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          {t('settings.chatEmailDescription')}
                        </span>
                      </span>
                    </Label>
                    <Switch
                      id="email-chat"
                      checked={preferences?.notifyChatMessages ?? true}
                      onCheckedChange={(checked) => updatePreferences({ notifyChatMessages: checked })}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Push & In-App Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {t('settings.notifications')}
              </CardTitle>
              <CardDescription>
                {t('settings.pushDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="push-notifications" className="flex flex-col gap-1 flex-1 min-w-0">
                  <span>{t('settings.pushNotifications')}</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {t('settings.pushDescription')}
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

              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="inapp-notifications" className="flex flex-col gap-1 flex-1 min-w-0">
                  <span>{t('settings.inAppNotifications')}</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {t('settings.inAppDescription')}
                  </span>
                </Label>
                <Switch
                  id="inapp-notifications"
                  checked={preferences?.inAppNotifications ?? true}
                  onCheckedChange={(checked) => updatePreferences({ inAppNotifications: checked })}
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
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={t('settingsPage.avatarAlt')}
                      className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-lg sm:text-xl">{user?.name?.charAt(0) || '?'}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{user?.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {getVerificationBadge()}
                    </div>
                  </div>
                </div>
                <Button variant="outline" className="w-full sm:w-auto flex-shrink-0" onClick={() => navigate('/verify-identity')}>
                  {verificationStatus === 'verified'
                    ? t('settingsPage.viewVerification')
                    : t('verification.startVerification')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Payments & Billing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {t('settings.managePayments')}
              </CardTitle>
              <CardDescription>
                {t('settings.managePaymentsDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleManageSubscriptions}
                disabled={isLoadingPortal}
                variant="outline"
                className="w-full gap-2"
              >
                {isLoadingPortal ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {t('settings.openPaymentPortal')}
              </Button>
              <p className="text-[11px] text-muted-foreground mt-2 text-center">
                {t('settings.paymentPortalNote')}
              </p>
            </CardContent>
          </Card>

          {/* MFA / 2FA */}
          <MfaSettings />

          {/* My Subscriptions */}
          <MySubscriptions />

          {/* Referral Program */}
          <ReferralProgram />

          {/* Danger Zone — Account Deletion (Apple App Store + Google Play requirement).
              Diseño: card sólido con borde izquierdo destructive grueso + header con icono
              circular sobre fondo destructive sólido. Mejor contraste sobre fondo teal app. */}
          <Card className="border-destructive/30 bg-card shadow-md overflow-hidden">
            <div className="flex">
              <div aria-hidden className="w-1.5 bg-destructive flex-shrink-0" />
              <div className="flex-1">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg sm:text-xl text-destructive mb-1">
                        {t('settingsPage.deleteAccountTitle')}
                      </CardTitle>
                      <CardDescription className="text-sm text-muted-foreground">
                        {t('settingsPage.deleteAccountDescPart1')}{' '}
                        <strong className="text-foreground">{t('settingsPage.deleteAccountDescStrong')}</strong>
                        {t('settingsPage.deleteAccountDescPart2')}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <Button
                    variant="destructive"
                    className="gap-2 w-full sm:w-auto"
                    onClick={() => { setDeleteConfirmText(''); setDeleteDialogOpen(true); }}
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('settingsPage.deleteAccountButton')}
                  </Button>
                </CardContent>
              </div>
            </div>
          </Card>

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  {t('settingsPage.deleteDialogTitle')}
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <span className="block">
                    {t('settingsPage.deleteDialogIntroPart1')}{' '}
                    <strong>{t('settingsPage.deleteDialogIntroStrong')}</strong>
                    {t('settingsPage.deleteDialogIntroPart2')}
                  </span>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    <li>{t('settingsPage.deleteDialogBullet1')}</li>
                    <li>{t('settingsPage.deleteDialogBullet2')}</li>
                    <li>{t('settingsPage.deleteDialogBullet3')}</li>
                    <li>{t('settingsPage.deleteDialogBullet4')}</li>
                  </ul>
                  <span className="block pt-2">
                    {t('settingsPage.deleteDialogConfirmPrefix')}{' '}
                    <code className="px-1 py-0.5 bg-muted rounded font-mono">ELIMINAR</code>{' '}
                    {t('settingsPage.deleteDialogConfirmSuffix')}
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                placeholder={t('settingsPage.deleteDialogPlaceholder')}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                autoComplete="off"
                disabled={isDeleting}
              />
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>{t('settingsPage.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'ELIMINAR' || isDeleting}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : t('settingsPage.deletePermanently')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </MainLayout>
  );
}
