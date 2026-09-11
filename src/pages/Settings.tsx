import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from 'next-themes';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import { SenyeraIcon } from '@/components/settings/LanguageSwitcher';
import { CurrencySelector } from '@/components/currency/CurrencySelector';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { tzLabel } from '@/lib/proFormat';
import {
  Settings as SettingsIcon, Globe, Bell, Shield, CheckCircle, Mail, CreditCard, Loader2,
  ExternalLink, Moon, Sun, Trash2, AlertTriangle, User, Phone, MapPin, Lock, Clock,
  Gift, Palette, KeyRound, Pencil, Circle, LifeBuoy, Headphones, ChevronRight, BadgeCheck,
  Stethoscope,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Configuración y cuenta — maqueta del cliente (10-sep-2026), diseño PRO.
// Solo diseño: no se ha añadido ningún ajuste que no existiera ya. El carril de
// secciones agrupa lo que antes era una pila de tarjetas, y nada se ha quitado
// (idioma, moneda, apariencia, correo, push, en la app, verificación, portal de
// pagos, 2FA, mis suscripciones, invitaciones y borrado de cuenta).
// Lo que la maqueta enseña y la plataforma NO tiene queda fuera a propósito:
// «Sesiones activas» (Supabase no expone el listado al cliente) y las
// preferencias «Recordatorios de consulta / Mensajes de pacientes / Avisos de
// renovación», que no son columnas: las rápidas de la derecha son los tres
// interruptores REALES de notificación.
// El correo, el teléfono y el país se ENSEÑAN aquí y se editan en el perfil,
// que es donde vive su verificación (OTP por SMS y confirmación por correo).
// ---------------------------------------------------------------------------

type Section = 'account' | 'security' | 'notifications' | 'billing' | 'language' | 'appearance' | 'referrals';

export default function Settings() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { preferences, updatePreferences } = useNotifications();
  const [params, setParams] = useSearchParams();

  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [hasMfa, setHasMfa] = useState(false);
  const [hasPayout, setHasPayout] = useState(false);

  const sectionFromUrl = (params.get('s') || '') as Section;
  const [section, setSection] = useState<Section>(
    ['account', 'security', 'notifications', 'billing', 'language', 'appearance', 'referrals'].includes(sectionFromUrl)
      ? sectionFromUrl
      : 'account'
  );

  const goSection = (s: Section) => {
    setSection(s);
    const next = new URLSearchParams(params);
    next.set('s', s);
    setParams(next, { replace: true });
  };

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
    let alive = true;
    (async () => {
      if (!user?.id) return;
      const [verRes, phoneRes, mfaRes] = await Promise.all([
        supabase
          .from('identity_verifications')
          .select('status')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('profiles').select('phone').eq('id', user.id).maybeSingle(),
        supabase.auth.mfa.listFactors(),
      ]);
      if (!alive) return;
      if (verRes.data) setVerificationStatus(verRes.data.status);
      setPhone(phoneRes.data?.phone || null);
      setHasMfa(((mfaRes.data?.totp || []) as any[]).some(f => f.status === 'verified'));
    })();
    return () => { alive = false; };
  }, [user?.id]);

  // Método de cobro del médico: la fila del resumen solo se enseña si el rol lo
  // tiene (`doctor_bank_accounts` es la tabla real de los pagos al médico).
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id || (role !== 'doctor' && role !== 'resident')) return;
      const { data } = await supabase
        .from('doctor_bank_accounts')
        .select('id')
        .eq('doctor_id', user.id)
        .maybeSingle();
      if (alive) setHasPayout(!!data?.id);
    })();
    return () => { alive = false; };
  }, [user?.id, role]);

  const isVerified = verificationStatus === 'verified' || verificationStatus === 'approved';

  const verificationPill = () => {
    if (isVerified) return <span className="pro-pill pro-pill-ok">{t('verification.verified')}</span>;
    if (verificationStatus === 'pending') return <span className="pro-pill pro-pill-warn">{t('verification.pending')}</span>;
    if (verificationStatus === 'failed') return <span className="pro-pill pro-pill-live">{t('verification.failed')}</span>;
    return <span className="pro-pill pro-pill-muted">{t('settingsPage.notVerifiedBadge')}</span>;
  };

  const handleManageSubscriptions = async () => {
    setIsLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) {
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

  const roleLabel = useMemo(() => {
    const map: Record<string, string> = {
      patient: t('roles.patient'),
      doctor: t('roles.doctor'),
      resident: t('roles.resident'),
      admin: t('roles.admin'),
      visitor: t('roles.visitor'),
    };
    return map[role || 'visitor'] || t('roles.visitor');
  }, [role, language]);

  const sections: { key: Section; label: string; Icon: React.ElementType }[] = [
    { key: 'account', label: t('pro.settings.navAccount'), Icon: User },
    { key: 'security', label: t('pro.settings.navSecurity'), Icon: Shield },
    { key: 'notifications', label: t('pro.settings.navNotifications'), Icon: Bell },
    { key: 'billing', label: t('pro.settings.navBilling'), Icon: CreditCard },
    { key: 'language', label: t('pro.settings.navLanguage'), Icon: Globe },
    { key: 'appearance', label: t('pro.settings.navAppearance'), Icon: Palette },
    { key: 'referrals', label: t('pro.settings.navReferrals'), Icon: Gift },
  ];

  // ------------------------------------------------------------- secciones
  const accountSection = (
    <>
      <section className="pro-card pro-card-pad">
        <div className="pro-card-head">
          <h2 className="pro-card-title"><User /> {t('pro.settings.accountData')}</h2>
          <Link to="/profile" className="pro-link">{t('pro.settings.editInProfile')} <Pencil /></Link>
        </div>

        <div className="pro-field">
          <span className="k">{t('profile.email')}</span>
          <div className="row">
            <span className="box"><Mail /><span className="min-w-0 break-all">{user?.email}</span></span>
            <span className="pro-pill pro-pill-ok">{t('pro.settings.emailVerified')}</span>
            <Link to="/profile" className="pro-btn pro-btn-outline pro-btn-sm" aria-label={t('common.edit')}>
              <Pencil />
            </Link>
          </div>
        </div>

        <div className="pro-field">
          <span className="k">{t('userProfilePage.phone')}</span>
          <div className="row">
            <span className="box">
              <Phone />
              <span className="min-w-0">
                {phone ? phone.replace(/(\d{2})(\d+)(\d{4})/, '$1****$3') : t('userProfilePage.notVerified')}
              </span>
            </span>
            {phone
              ? <span className="pro-pill pro-pill-ok">{t('userProfilePage.verified')}</span>
              : <span className="pro-pill pro-pill-muted">{t('userProfilePage.notVerified')}</span>}
            <Link to="/profile" className="pro-btn pro-btn-outline pro-btn-sm" aria-label={t('common.edit')}>
              <Pencil />
            </Link>
          </div>
        </div>

        <div className="pro-field">
          <span className="k">{t('pro.settings.country')}</span>
          <div className="row">
            <span className="box">
              <MapPin />
              <span>{user?.countryFlag || ''} {user?.countryCode || '—'}</span>
            </span>
          </div>
        </div>

        <div className="pro-field">
          <span className="k">{t('pro.settings.accountType')}</span>
          <div className="row">
            <span className="box is-locked"><Stethoscope />{roleLabel}</span>
            <span className="pro-row-sub flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" />{t('pro.settings.notEditable')}</span>
          </div>
        </div>

        <div className="pro-field">
          <span className="k">{t('profile.memberSince')}</span>
          <div className="row">
            <span className="box">
              <Clock />
              {user?.createdAt ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(user.createdAt)) : '—'}
            </span>
          </div>
        </div>
      </section>

      {/* Zona de riesgo — borrado de cuenta (requisito de App Store y Play). */}
      <section className="pro-card pro-card-pad pro-danger">
        <div className="pro-card-head">
          <h2 className="pro-card-title pro-danger-title"><AlertTriangle /> {t('settingsPage.deleteAccountTitle')}</h2>
        </div>
        <p className="pro-row-sub mb-3">
          {t('settingsPage.deleteAccountDescPart1')} <b>{t('settingsPage.deleteAccountDescStrong')}</b>
          {t('settingsPage.deleteAccountDescPart2')}
        </p>
        <Button
          variant="destructive"
          className="gap-2 w-full sm:w-auto"
          onClick={() => { setDeleteConfirmText(''); setDeleteDialogOpen(true); }}
        >
          <Trash2 className="w-4 h-4" />
          {t('settingsPage.deleteAccountButton')}
        </Button>
      </section>
    </>
  );

  const securitySection = (
    <>
      <section className="pro-card pro-card-pad">
        <div className="pro-card-head">
          <h2 className="pro-card-title"><KeyRound /> {t('pro.settings.accessTitle')}</h2>
        </div>
        <div className="pro-field">
          <span className="k">{t('pro.settings.password')}</span>
          <div className="row">
            <span className="box"><Lock />••••••••••</span>
            <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={() => navigate('/reset-password')}>
              <Pencil /> {t('pro.settings.changePassword')}
            </button>
          </div>
          <p className="hint">{t('pro.settings.passwordHint')}</p>
        </div>
      </section>

      <section className="pro-card pro-card-pad">
        <div className="pro-card-head">
          <h2 className="pro-card-title"><Shield /> {t('verification.title')}</h2>
          {verificationPill()}
        </div>
        <p className="pro-row-sub mb-3">{t('verification.description')}</p>
        <div className="flex items-center gap-3 flex-wrap">
          {user?.avatarUrl
            ? <img src={user.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
            : <span className="pro-initials w-11 h-11 text-[13px]">{(user?.name || '?').charAt(0)}</span>}
          <span className="pro-row-name min-w-0 truncate flex-1">{user?.name}</span>
          <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={() => navigate('/verify-identity')}>
            {isVerified ? t('settingsPage.viewVerification') : t('verification.startVerification')}
          </button>
        </div>
      </section>

      {/* Doble factor — el componente de siempre, sin tocar */}
      <MfaSettings />
    </>
  );

  const notificationsSection = (
    <>
      <section className="pro-card pro-card-pad">
        <div className="pro-card-head">
          <h2 className="pro-card-title"><Mail /> {t('settings.emailTitle')}</h2>
        </div>
        <p className="pro-row-sub mb-2">{t('settings.emailDescription')}</p>

        <div className="pro-setrow">
          <Label htmlFor="email-notifications" className="lbl cursor-pointer">
            <b>{t('settings.enableEmails')}</b>
            <span>{t('settings.masterSwitch')}</span>
          </Label>
          <Switch
            id="email-notifications"
            checked={preferences?.emailNotifications ?? true}
            onCheckedChange={(checked) => updatePreferences({ emailNotifications: checked })}
          />
        </div>

        {preferences?.emailNotifications && (
          <>
            <div className="pro-setrow">
              <Label htmlFor="email-live" className="lbl cursor-pointer">
                <b>🔴 {t('settings.livesEmail')}</b>
                <span>{t('settings.livesEmailDescription')}</span>
              </Label>
              <Switch
                id="email-live"
                checked={preferences?.notifyDoctorLive ?? true}
                onCheckedChange={(checked) => updatePreferences({ notifyDoctorLive: checked })}
              />
            </div>
            <div className="pro-setrow">
              <Label htmlFor="email-content" className="lbl cursor-pointer">
                <b>📄 {t('settings.contentEmail')}</b>
                <span>{t('settings.contentEmailDescription')}</span>
              </Label>
              <Switch
                id="email-content"
                checked={preferences?.notifyNewContent ?? true}
                onCheckedChange={(checked) => updatePreferences({ notifyNewContent: checked })}
              />
            </div>
            <div className="pro-setrow">
              <Label htmlFor="email-chat" className="lbl cursor-pointer">
                <b>💬 {t('settings.chatEmail')}</b>
                <span>{t('settings.chatEmailDescription')}</span>
              </Label>
              <Switch
                id="email-chat"
                checked={preferences?.notifyChatMessages ?? true}
                onCheckedChange={(checked) => updatePreferences({ notifyChatMessages: checked })}
              />
            </div>
          </>
        )}
      </section>

      <section className="pro-card pro-card-pad">
        <div className="pro-card-head">
          <h2 className="pro-card-title"><Bell /> {t('settings.notifications')}</h2>
        </div>
        <p className="pro-row-sub mb-2">{t('settings.pushDescription')}</p>

        <div className="pro-setrow">
          <Label htmlFor="push-notifications" className="lbl cursor-pointer">
            <b>{t('settings.pushNotifications')}</b>
            <span>{t('settings.pushDescription')}</span>
          </Label>
          <Switch
            id="push-notifications"
            checked={preferences?.pushNotifications ?? true}
            onCheckedChange={(checked) => updatePreferences({ pushNotifications: checked })}
          />
        </div>

        <div className="pro-setrow pro-setrow-block">
          <PushNotificationToggle />
        </div>

        <div className="pro-setrow">
          <Label htmlFor="inapp-notifications" className="lbl cursor-pointer">
            <b>{t('settings.inAppNotifications')}</b>
            <span>{t('settings.inAppDescription')}</span>
          </Label>
          <Switch
            id="inapp-notifications"
            checked={preferences?.inAppNotifications ?? true}
            onCheckedChange={(checked) => updatePreferences({ inAppNotifications: checked })}
          />
        </div>
      </section>
    </>
  );

  const billingSection = (
    <>
      <section className="pro-card pro-card-pad">
        <div className="pro-card-head">
          <h2 className="pro-card-title"><CreditCard /> {t('settings.managePayments')}</h2>
        </div>
        <p className="pro-row-sub mb-3">{t('settings.managePaymentsDescription')}</p>
        <button
          type="button"
          onClick={handleManageSubscriptions}
          disabled={isLoadingPortal}
          className="pro-btn pro-btn-teal w-full sm:w-auto"
        >
          {isLoadingPortal ? <Loader2 className="animate-spin" /> : <ExternalLink />}
          {t('settings.openPaymentPortal')}
        </button>
        <p className="pro-row-sub mt-2">{t('settings.paymentPortalNote')}</p>
      </section>

      <section className="pro-card pro-card-pad">
        <div className="pro-card-head">
          <h2 className="pro-card-title"><Globe /> {t('settingsPage.currency')}</h2>
        </div>
        <p className="pro-row-sub mb-3">{t('settingsPage.currencyDescription')}</p>
        <CurrencySelector />
      </section>

      {/* Mis suscripciones — el componente de siempre */}
      <MySubscriptions />
    </>
  );

  const languageSection = (
    <section className="pro-card pro-card-pad">
      <div className="pro-card-head">
        <h2 className="pro-card-title"><Globe /> {t('settings.language')}</h2>
      </div>
      <p className="pro-row-sub mb-3">{t('settings.selectAppLanguage')}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {([
          { code: 'es', flag: '🇪🇸', key: 'settings.spanish' },
          { code: 'en', flag: '🇺🇸', key: 'settings.english' },
          { code: 'pt', flag: '🇵🇹', key: 'settings.portuguese' },
          { code: 'fr', flag: '🇫🇷', key: 'settings.french' },
          { code: 'it', flag: '🇮🇹', key: 'settings.italian' },
          { code: 'de', flag: '🇩🇪', key: 'settings.german' },
          { code: 'ca', flag: '', key: 'settings.catalan' },
          { code: 'zh', flag: '🇨🇳', key: 'settings.chinese' },
        ] as const).map((l) => (
          <button
            key={l.code}
            type="button"
            className={`pro-btn ${language === l.code ? 'pro-btn-teal' : 'pro-btn-outline'} w-full`}
            aria-pressed={language === l.code}
            onClick={() => setLanguage(l.code)}
          >
            {l.code === 'ca' ? <SenyeraIcon /> : <span>{l.flag}</span>} {t(l.key)}
          </button>
        ))}
      </div>

      <div className="pro-field mt-4">
        <span className="k">{t('pro.settings.timezone')}</span>
        <div className="row">
          <span className="box is-locked"><Clock />{tzLabel()}</span>
        </div>
        <p className="hint">{t('pro.settings.timezoneHint')}</p>
      </div>
    </section>
  );

  const appearanceSection = (
    <section className="pro-card pro-card-pad">
      <div className="pro-card-head">
        <h2 className="pro-card-title">
          {theme === 'dark' ? <Moon /> : <Sun />} {t('settingsPage.appearance')}
        </h2>
      </div>
      <p className="pro-row-sub mb-2">{t('settingsPage.appearanceDescription')}</p>
      <div className="pro-setrow">
        <Label htmlFor="dark-mode" className="lbl cursor-pointer">
          <b>{t('settingsPage.darkMode')}</b>
          <span>{t('settingsPage.darkModeDescription')}</span>
        </Label>
        <Switch
          id="dark-mode"
          checked={theme === 'dark'}
          onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
        />
      </div>
    </section>
  );

  const summaryRows = [
    { on: isVerified, label: t('pro.settings.sumVerified') },
    ...(role === 'doctor' || role === 'resident'
      ? [{ on: (user?.doctorProfile?.status || user?.residentProfile?.status) === 'approved', label: t('pro.settings.sumProfileVisible') }]
      : []),
    ...(role === 'doctor' || role === 'resident'
      ? [{ on: hasPayout, label: t('pro.settings.sumPayout') }]
      : []),
    { on: hasMfa, label: t('pro.settings.sumMfa') },
    { on: preferences?.emailNotifications ?? true, label: t('pro.settings.sumEmails') },
  ];

  return (
    <MainLayout>
      <div className="pro-container pro-page">
        <div className="pro-page-head">
          <div className="min-w-0">
            <h1 className="pro-page-title"><SettingsIcon className="w-7 h-7" /> <span className="truncate">{t('pro.settings.title')}</span></h1>
            <p className="pro-page-sub">{t('pro.settings.subtitle')}</p>
          </div>
          <Link to="/profile" className="pro-btn pro-btn-white w-full sm:w-auto">
            <User /> {t('pro.settings.goProfile')}
          </Link>
        </div>

        <div className="pro-work pro-work-set">
          {/* ------------------------------------------- carril de secciones */}
          <nav className="pro-card pro-setnav" aria-label={t('pro.settings.title')}>
            {sections.map(s => (
              <button
                key={s.key}
                type="button"
                className={`pro-lane-item ${section === s.key ? 'is-active' : ''}`}
                aria-pressed={section === s.key}
                onClick={() => goSection(s.key)}
              >
                <s.Icon />
                <span className="label">{s.label}</span>
              </button>
            ))}
          </nav>

          {/* --------------------------------------------------- contenido */}
          <div className="min-w-0 space-y-3 sm:space-y-4">
            {section === 'account' && accountSection}
            {section === 'security' && securitySection}
            {section === 'notifications' && notificationsSection}
            {section === 'billing' && billingSection}
            {section === 'language' && languageSection}
            {section === 'appearance' && appearanceSection}
            {section === 'referrals' && <ReferralProgram />}
          </div>

          {/* ----------------------------------------------------- resumen */}
          <aside className="min-w-0 space-y-3 sm:space-y-4 hidden xl:block">
            <section className="pro-card pro-card-pad">
              <div className="pro-card-head">
                <h2 className="pro-card-title"><BadgeCheck /> {t('pro.settings.summary')}</h2>
              </div>
              {summaryRows.map(r => (
                <div key={r.label} className={`pro-sum ${r.on ? 'is-ok' : 'is-off'}`}>
                  {r.on ? <CheckCircle /> : <Circle />}
                  <span className="lbl">{r.label}</span>
                  <span className={`pro-pill ${r.on ? 'pro-pill-ok' : 'pro-pill-muted'}`}>
                    {r.on ? t('pro.settings.on') : t('pro.settings.off')}
                  </span>
                </div>
              ))}
            </section>

            <section className="pro-card pro-card-pad">
              <div className="pro-card-head">
                <h2 className="pro-card-title"><Bell /> {t('pro.settings.quickPrefs')}</h2>
              </div>
              <div className="pro-setrow">
                <span className="pro-icon-box"><Mail /></span>
                <Label htmlFor="q-email" className="lbl cursor-pointer flex-1">
                  <b>{t('settings.enableEmails')}</b>
                  <span>{t('settings.masterSwitch')}</span>
                </Label>
                <Switch
                  id="q-email"
                  checked={preferences?.emailNotifications ?? true}
                  onCheckedChange={(checked) => updatePreferences({ emailNotifications: checked })}
                />
              </div>
              <div className="pro-setrow">
                <span className="pro-icon-box"><Bell /></span>
                <Label htmlFor="q-push" className="lbl cursor-pointer flex-1">
                  <b>{t('settings.pushNotifications')}</b>
                  <span>{t('settings.pushDescription')}</span>
                </Label>
                <Switch
                  id="q-push"
                  checked={preferences?.pushNotifications ?? true}
                  onCheckedChange={(checked) => updatePreferences({ pushNotifications: checked })}
                />
              </div>
              <div className="pro-setrow">
                <span className="pro-icon-box"><SettingsIcon /></span>
                <Label htmlFor="q-inapp" className="lbl cursor-pointer flex-1">
                  <b>{t('settings.inAppNotifications')}</b>
                  <span>{t('settings.inAppDescription')}</span>
                </Label>
                <Switch
                  id="q-inapp"
                  checked={preferences?.inAppNotifications ?? true}
                  onCheckedChange={(checked) => updatePreferences({ inAppNotifications: checked })}
                />
              </div>
            </section>

            <section className="pro-card pro-card-pad">
              <div className="pro-card-head">
                <h2 className="pro-card-title"><LifeBuoy /> {t('pro.settings.help')}</h2>
              </div>
              <div className="space-y-2">
                <Link to="/help" className="pro-helprow">
                  <LifeBuoy /> <span>{t('pro.settings.helpCenter')}</span> <ChevronRight className="chev" />
                </Link>
                <Link to="/contact" className="pro-helprow">
                  <Headphones /> <span>{t('pro.settings.contactSupport')}</span> <ChevronRight className="chev" />
                </Link>
              </div>
            </section>
          </aside>
        </div>

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
    </MainLayout>
  );
}
