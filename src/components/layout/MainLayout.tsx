import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotificationsRealtime } from '@/hooks/useNotificationsRealtime';
import { useHasAdCampaigns } from '@/hooks/useHasAdCampaigns';
import { useNotifications } from '@/hooks/useNotifications';
import { useSiteToggles } from '@/hooks/useSiteToggles';
import { useChat } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  Video,
  MessageSquare,
  Folder,
  FolderOpen,
  User,
  Users,
  Wallet,
  DollarSign,
  Settings,
  GraduationCap,
  LogOut,
  LogIn,
  Stethoscope,
  LayoutDashboard,
  Upload,
  Calendar,
  CalendarDays,
  Clock,
  FileText,
  Bell,
  Radio,
  MoreHorizontal,
  X,
  Megaphone,
  MapPin,
  Package,
  ChevronDown,
  BookOpen,
  PlayCircle,
} from 'lucide-react';
import { MobileBackHeader } from '@/components/layout/MobileBackHeader';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { LanguageSwitcher } from '@/components/settings/LanguageSwitcher';
import { TutorialVideoDialog } from '@/components/profile/TutorialVideoDialog';
import { UnifiedFooter } from '@/components/layout/UnifiedFooter';
import { AppBackground } from '@/components/layout/AppBackground';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { ActiveLiveBanner } from '@/components/live/ActiveLiveBanner';
import { DiscoverGate } from '@/components/DiscoverGate';
import logoMedicalMasters from '@/assets/logo-medical-masters.png';
import logoMedicalMastersWhite from '@/assets/logo-medical-masters-white.png';

interface NavItem {
  labelKey: string;
  shortLabelKey?: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
  toggleKey?: string;
  hidden?: boolean;
}

// ============================================================================
// MÉDICO — diseño PRO aprobado por el cliente el 7-sep-2026.
// Barra en píldora: Inicio · Agenda · Mis pacientes · Consultas · Lives y
// contenidos · Comunidad · Más ▾ (todo lo demás cuelga de "Más").
// ============================================================================
const doctorPrimaryNav: NavItem[] = [
  { labelKey: 'pro.nav.home', href: '/doctor/dashboard', icon: LayoutDashboard, roles: ['doctor'] },
  { labelKey: 'pro.nav.agenda', href: '/doctor/agenda', icon: CalendarDays, roles: ['doctor'] },
  { labelKey: 'pro.nav.patients', shortLabelKey: 'pro.nav.patientsShort', href: '/doctor/patients', icon: Users, roles: ['doctor'] },
  { labelKey: 'pro.nav.consultations', href: '/my-appointments', icon: Stethoscope, roles: ['doctor'] },
  // La pestaña Lives abre la PORTADA de lives (`?vista=directo`); la parrilla es
  // la vista inicial de /lives. Lo pidió el cliente el 7-sep-2026.
  { labelKey: 'pro.nav.livesContent', shortLabelKey: 'nav.lives', href: '/lives?vista=directo', icon: Video, roles: ['doctor'] },
  { labelKey: 'pro.nav.community', href: '/foro', icon: MessageSquare, roles: ['doctor'] },
];

const doctorMoreNav: NavItem[] = [
  { labelKey: 'nav.education', href: '/education', icon: GraduationCap, roles: ['doctor'] },
  { labelKey: 'nav.chat', href: '/chat', icon: MessageSquare, roles: ['doctor'] },
  { labelKey: 'nav.soyMedico', href: '/doctors', icon: Stethoscope, roles: ['doctor'] },
  { labelKey: 'pro.nav.patientFiles', href: '/doctor/vault', icon: Folder, roles: ['doctor'] },
  ...(FEATURE_FLAGS.marketplaceFeeModel
    ? [{ labelKey: 'nav.marketplace', href: '/marketplace', icon: Package, roles: ['doctor'] } as NavItem]
    : []),
  { labelKey: 'pro.nav.myContent', href: '/doctor/content', icon: FolderOpen, roles: ['doctor'] },
  { labelKey: 'pro.nav.myRecordings', href: '/doctor/recordings', icon: PlayCircle, roles: ['doctor'] },
  { labelKey: 'nav.upload', href: '/doctor/upload', icon: Upload, roles: ['doctor'] },
  { labelKey: 'pro.nav.books', href: '/doctor/books', icon: BookOpen, roles: ['doctor'] },
  { labelKey: 'nav.availability', href: '/doctor/availability', icon: Clock, roles: ['doctor'] },
  { labelKey: 'nav.medicalRecord', href: '/medical-record', icon: FileText, roles: ['doctor'] },
  { labelKey: 'nav.prescriptions', href: '/prescriptions', icon: FileText, roles: ['doctor'], toggleKey: 'enable_prescriptions' },
  { labelKey: 'nav.news', href: '/news', icon: Calendar, roles: ['doctor'], toggleKey: 'show_news_section' },
  { labelKey: 'nav.meetings', href: '/meetings', icon: Users, roles: ['doctor'] },
  { labelKey: 'nav.hospitalLocator', href: '/hospital-locator', icon: MapPin, roles: ['doctor'] },
  { labelKey: 'nav.earnings', href: '/doctor/earnings', icon: DollarSign, roles: ['doctor'] },
];

// ============================================================================
// RESTO DE ROLES — orden del menú definido por el cliente (2026-06-29).
// ============================================================================
const navItems: NavItem[] = [
  { labelKey: 'nav.lives', href: '/lives', icon: Video, roles: ['visitor', 'patient', 'resident', 'admin'] },
  { labelKey: 'nav.education', shortLabelKey: 'nav.educationShort', href: '/education', icon: GraduationCap, roles: ['patient', 'resident', 'admin'] },
  { labelKey: 'nav.chat', href: '/chat', icon: MessageSquare, roles: ['patient', 'resident'] },
  { labelKey: 'nav.soyMedico', href: '/doctors', icon: Stethoscope, roles: ['patient', 'resident', 'admin'] },
  ...(FEATURE_FLAGS.marketplaceFeeModel
    ? [{ labelKey: 'nav.marketplace', href: '/marketplace', icon: Package, roles: ['resident'] } as NavItem]
    : []),
  { labelKey: 'nav.news', href: '/news', icon: Calendar, roles: ['visitor', 'patient', 'resident', 'admin'], toggleKey: 'show_news_section' },
  { labelKey: 'nav.prescriptions', href: '/prescriptions', icon: FileText, roles: ['patient'], toggleKey: 'enable_prescriptions' },
  { labelKey: 'nav.medicalRecord', href: '/medical-record', icon: FileText, roles: ['patient', 'resident'] },
  { labelKey: 'nav.myAppointments', href: '/my-appointments', icon: Calendar, roles: ['patient', 'resident'] },
  { labelKey: 'nav.myVault', href: '/vault', icon: Folder, roles: ['patient', 'resident'] },
  // Foro: solo como enlace explícito junto a la lupa (cliente 15-jul-2026).
  { labelKey: 'nav.foro', href: '/foro', icon: MessageSquare, roles: ['resident'], hidden: true },
  { labelKey: 'nav.meetings', href: '/meetings', icon: Calendar, roles: ['resident'], hidden: true },
  { labelKey: 'nav.hospitalLocator', href: '/hospital-locator', icon: MapPin, roles: ['patient', 'resident'], hidden: true },
  { labelKey: 'nav.admin', href: '/admin', icon: Settings, roles: ['admin'] },
];

const pathOf = (href: string) => href.split('?')[0];

// Bottom tab items per role — only 4 fixed tabs, 5th is "More"
function getBottomTabs(role: string | undefined, t: (key: string) => string) {
  const lives = { label: t('nav.lives'), href: '/lives', icon: Radio };

  if (role === 'doctor') {
    return [
      { label: t('pro.nav.home'), href: '/doctor/dashboard', icon: LayoutDashboard },
      { label: t('pro.nav.agenda'), href: '/doctor/agenda', icon: CalendarDays },
      { label: t('pro.nav.patientsShort'), href: '/doctor/patients', icon: Users },
      { label: t('nav.lives'), href: '/lives?vista=directo', icon: Radio },
    ];
  }

  if (role === 'patient') {
    return [
      lives,
      { label: t('nav.doctors'), href: '/doctors', icon: Stethoscope },
      { label: t('nav.chat'), href: '/chat', icon: MessageSquare },
    ];
  }

  if (role === 'admin') {
    return [
      lives,
      { label: t('nav.doctors'), href: '/doctors', icon: Stethoscope },
      { label: t('nav.admin'), href: '/admin', icon: Settings },
    ];
  }

  if (role === 'visitor' || !role) {
    return [
      lives,
      { label: t('nav.news'), href: '/news', icon: Calendar },
    ];
  }

  // resident
  return [
    lives,
    { label: t('nav.educationShort'), href: '/education', icon: GraduationCap },
    { label: t('nav.soyMedicoShort'), href: '/doctors', icon: Stethoscope },
    { label: t('nav.chat'), href: '/chat', icon: MessageSquare },
  ];
}

function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();
}

// "Dra. Demo" en la píldora de cuenta: si el nombre ya trae el tratamiento
// (Dr./Dra.) se conserva junto al primer nombre; si no, solo el primer nombre.
function displayNameOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (/^dra?\.?$/i.test(parts[0]) && parts.length > 1) return `${parts[0]} ${parts[1]}`;
  return parts[0];
}

const MainLayout = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(function MainLayout({ children }, ref) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout, role } = useAuth();
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const { t } = useLanguage();
  const { toggles } = useSiteToggles();
  const { unreadCount: notifUnread } = useNotifications();
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [pendingEarnings, setPendingEarnings] = useState<number>(0);
  const { hasCampaigns } = useHasAdCampaigns();

  // Fetch pending_earnings for doctors
  useEffect(() => {
    if (role === 'doctor' && user?.id) {
      import('@/integrations/supabase/client').then(({ supabase }) => {
        supabase
          .from('doctor_profiles')
          .select('pending_earnings')
          .eq('user_id', user.id)
          .single()
          .then(({ data }) => {
            if (data?.pending_earnings != null) {
              setPendingEarnings(Number(data.pending_earnings));
            }
          });
      });
    }
  }, [role, user?.id]);

  // Enable realtime notifications
  useNotificationsRealtime();

  // Get unread chat count - useChat is always available since ChatProvider wraps MainLayout
  const { getSessionsByUser } = useChat();
  const chatUnread = useMemo(() => {
    const sessions = getSessionsByUser();
    return sessions.reduce((sum, s) => {
      if (s.status !== 'active') return sum;
      return sum + (s.unreadCount || 0);
    }, 0);
  }, [getSessionsByUser]);

  // Funciones activables/desactivables desde el admin.
  const disabledHrefs = useMemo(() => {
    const s = new Set<string>();
    if (!toggles.enable_patient_chat) s.add('/chat');
    if (!toggles.enable_prescriptions) s.add('/prescriptions');
    if (!toggles.enable_video_calls) s.add('/video-call');
    if (!toggles.enable_lives) s.add('/lives');
    if (!toggles.enable_recordings) { s.add('/recordings'); s.add('/doctor/recordings'); }
    if (!toggles.enable_vault) { s.add('/vault'); s.add('/doctor/vault'); }
    if (!toggles.enable_marketplace) s.add('/medical-supplies');
    return s;
  }, [toggles]);

  const keepItem = (item: NavItem, effectiveRole: string) => {
    if (item.hidden) return false;
    if (disabledHrefs.has(pathOf(item.href))) return false;
    if (!item.roles.includes(effectiveRole)) return false;
    if (item.toggleKey && !(toggles as any)[item.toggleKey]) return false;
    return true;
  };

  const filteredNavItems = useMemo(() => {
    const effectiveRole = role || 'visitor';
    const items = navItems.filter(item => keepItem(item, effectiveRole));
    // Cliente 2026-07-09: en PACIENTE, Historial Clínico va ANTES que Recetas.
    if (effectiveRole === 'patient') {
      const mrIdx = items.findIndex(i => i.href === '/medical-record');
      const rxIdx = items.findIndex(i => i.href === '/prescriptions');
      if (mrIdx > -1 && rxIdx > -1 && mrIdx > rxIdx) {
        const [mr] = items.splice(mrIdx, 1);
        items.splice(rxIdx, 0, mr);
      }
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, toggles, disabledHrefs]);

  // Píldora superior: primarios + "Más".
  const { primaryNav, moreNav } = useMemo(() => {
    if (role === 'doctor') {
      return {
        primaryNav: doctorPrimaryNav.filter(i => keepItem(i, 'doctor')),
        moreNav: doctorMoreNav.filter(i => keepItem(i, 'doctor')),
      };
    }
    // Paciente: todos directos (cliente 2026-07-09); resto: 5 + Más.
    if (role === 'patient') return { primaryNav: filteredNavItems, moreNav: [] as NavItem[] };
    return { primaryNav: filteredNavItems.slice(0, 5), moreNav: filteredNavItems.slice(5) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, filteredNavItems, disabledHrefs, toggles]);

  const bottomTabs = useMemo(
    () => getBottomTabs(role, t).filter(tab => !disabledHrefs.has(pathOf(tab.href))),
    [role, t, disabledHrefs]
  );

  const moreNavItems = useMemo(() => {
    const bottomTabPaths = bottomTabs.map(tab => pathOf(tab.href));
    const all = role === 'doctor' ? [...primaryNav, ...moreNav] : filteredNavItems;
    return all.filter(item => !bottomTabPaths.includes(pathOf(item.href)));
  }, [filteredNavItems, bottomTabs, primaryNav, moreNav, role]);

  const isActiveHref = (href: string) => {
    const p = pathOf(href);
    if (p === '/lives') return location.pathname === '/lives' || location.pathname.startsWith('/live/');
    if (p === '/') return location.pathname === '/';
    return location.pathname === p || location.pathname.startsWith(p + '/');
  };

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const getRoleBadge = () => {
    switch (role) {
      case 'doctor':
        return <Badge variant="verified">{t('roles.doctor')}</Badge>;
      case 'patient':
        return <Badge variant="info">{t('roles.patient')}</Badge>;
      case 'resident':
        return <Badge variant="warning">{t('roles.resident')}</Badge>;
      case 'admin':
        return <Badge variant="destructive">{t('roles.admin')}</Badge>;
      default:
        return <Badge variant="secondary">{t('roles.visitor')}</Badge>;
    }
  };

  // Destino del LOGO: el médico va a su panel (Inicio); el resto a /lives; visitante al landing.
  const homeHref = !isAuthenticated || !role || role === 'visitor'
    ? '/'
    : role === 'doctor' ? '/doctor/dashboard' : '/lives';

  const hideBottomNav = location.pathname.startsWith('/video-call');

  // Background mode controlado desde Admin → Site Settings → Toggles
  const useImageBackground = (toggles as any).app_background !== 'white';

  const renderMoreDropdown = (align: 'center' | 'end') => (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('nav.more')}
          className={moreNav.some(i => isActiveHref(i.href)) ? 'is-active' : ''}
        >
          <span>{t('nav.more')}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-64 max-h-[70vh] overflow-y-auto">
        {moreNav.map((item) => {
          const isActive = isActiveHref(item.href);
          return (
            <DropdownMenuItem
              key={item.href}
              onClick={() => navigate(item.href)}
              className={`py-2.5 text-sm cursor-pointer ${isActive ? 'bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground' : ''}`}
            >
              <item.icon className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="truncate">{t(item.labelKey)}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <AppBackground
      ref={ref}
      className="min-h-screen flex flex-col overflow-x-clip"
    >
      <DiscoverGate />
      {/* Barra superior — sticky bajo la safe-area (isla dinámica / status bar). */}
      <header
        className={`sticky z-50 pro-topbar ${useImageBackground ? '' : 'pro-topbar-light border-b border-border bg-card/95 backdrop-blur'}`}
        style={{ top: 'env(safe-area-inset-top)' }}
      >
        <div className="pro-container">
          <div className="flex h-16 sm:h-[68px] items-center gap-2 sm:gap-3">
            {/* Logo */}
            <Link to={homeHref} className="flex items-center shrink-0" aria-label="Medical Masters">
              <img
                src={useImageBackground ? logoMedicalMastersWhite : logoMedicalMasters}
                alt="Medical Masters"
                className="h-9 sm:h-10 xl:h-11 w-auto"
                decoding="async"
              />
            </Link>

            {/* Navegación en píldora (tablet y escritorio) */}
            <nav className="hidden sm:flex flex-1 min-w-0 justify-center" aria-label={t('mainLayout.sectionNavigation')}>
              <div className="pro-navpill">
                {primaryNav.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={isActiveHref(item.href) ? 'is-active' : ''}
                    aria-current={isActiveHref(item.href) ? 'page' : undefined}
                  >
                    <span className="hidden xl:inline">{t(item.labelKey)}</span>
                    <span className="xl:hidden">{t(item.shortLabelKey || item.labelKey)}</span>
                  </Link>
                ))}
                {moreNav.length > 0 && renderMoreDropdown('center')}
              </div>
            </nav>

            {/* Controles de la derecha */}
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
              {(role === 'resident' || role === 'admin') && (
                <Link
                  to="/foro"
                  aria-label={t('forum.title')}
                  className={`flex items-center gap-1.5 h-9 px-2 sm:px-2.5 rounded-md text-sm font-medium ${
                    location.pathname === '/foro' ? 'text-primary' : 'text-foreground/80'
                  }`}
                >
                  <MessageSquare className="w-5 h-5" />
                  <span className="hidden lg:inline">{t('forum.title')}</span>
                </Link>
              )}
              {/* Chat SIEMPRE a un clic (estaba en la barra del médico antes del rediseño):
                  icono con el contador de mensajes sin leer, sin ocupar sitio en la píldora. */}
              {(role === 'doctor' || role === 'patient' || role === 'resident') && !disabledHrefs.has('/chat') && (
                <Link
                  to="/chat"
                  aria-label={t('nav.chat')}
                  className={`app-header-control relative px-2.5 ${location.pathname === '/chat' ? 'app-header-nav-active' : ''}`}
                >
                  <MessageSquare className="w-4 h-4" />
                  {chatUnread > 0 && (
                    <span className="notification-count-badge absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                      {chatUnread > 99 ? '99+' : chatUnread}
                    </span>
                  )}
                </Link>
              )}
              <GlobalSearch />
              <LanguageSwitcher />
              {isAuthenticated && <span className="hidden sm:block"><NotificationBell /></span>}
              {(role === 'patient' || role === 'resident' || role === 'doctor') && (
                <Link to="/wallet" aria-label={t('nav.wallet')} className="hidden sm:inline-flex app-header-control px-2.5">
                  <Wallet className="w-4 h-4" />
                </Link>
              )}

              {isAuthenticated && user && role !== 'visitor' ? (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="app-header-control pro-account" aria-label={user.name}>
                      <span className="pro-avatar">
                        {user.avatarUrl
                          ? <img src={user.avatarUrl} alt="" />
                          : initialsOf(user.name) || (role === 'doctor' ? <Stethoscope className="w-4 h-4" /> : <User className="w-4 h-4" />)}
                      </span>
                      <span className="hidden sm:inline max-w-[120px] truncate">{displayNameOf(user.name)}</span>
                      <ChevronDown className="w-3.5 h-3.5 hidden sm:inline" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                        <div className="pt-1">{getRoleBadge()}</div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/profile')} className="py-3 text-sm">
                      <User className="w-4 h-4 mr-2" />
                      {t('nav.profile')}
                    </DropdownMenuItem>
                    {(role === 'patient' || role === 'resident' || role === 'doctor') && (
                      <DropdownMenuItem onClick={() => navigate('/wallet')} className="py-3 text-sm">
                        <Wallet className="w-4 h-4 mr-2" />
                        {t('nav.wallet')}
                      </DropdownMenuItem>
                    )}
                    {role === 'doctor' && (
                      <DropdownMenuItem onClick={() => navigate('/doctor/earnings')} className="py-3 text-sm">
                        <DollarSign className="w-4 h-4 mr-2" />
                        {t('nav.earnings')}
                      </DropdownMenuItem>
                    )}
                    {(role === 'patient' || role === 'resident') && hasCampaigns && (
                      <DropdownMenuItem onClick={() => navigate('/advertiser/dashboard')} className="py-3 text-sm">
                        <Megaphone className="w-4 h-4 mr-2" />
                        {t('nav.advertising')}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => navigate('/notifications')} className="py-3 text-sm">
                      <Bell className="w-4 h-4 mr-2" />
                      {t('nav.notifications')}
                      {notifUnread > 0 && (
                        <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
                          {notifUnread > 99 ? '99+' : notifUnread}
                        </span>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/settings')} className="py-3 text-sm">
                      <Settings className="w-4 h-4 mr-2" />
                      {t('nav.settings')}
                    </DropdownMenuItem>
                    {(role === 'patient' || role === 'resident' || role === 'doctor') && (
                      <DropdownMenuItem onClick={() => setTutorialOpen(true)} className="py-3 text-sm">
                        <GraduationCap className="w-4 h-4 mr-2" />
                        {t('nav.tutorial')}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive py-3 text-sm">
                      <LogOut className="w-4 h-4 mr-2" />
                      {t('nav.logout')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button onClick={() => navigate('/login')} size="sm" className="app-header-cta h-9 gap-1.5 px-3 text-sm font-semibold">
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('nav.login')}</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {isAuthenticated && user && (
        <TutorialVideoDialog role={role} open={tutorialOpen} onOpenChange={setTutorialOpen} />
      )}

      {/* Mobile Back Header */}
      <MobileBackHeader />

      {/* Main Content - add bottom padding on mobile for tab bar */}
      <main className="flex-1 pb-[72px] sm:pb-0 overflow-x-clip min-h-[calc(100vh-56px-72px)] sm:min-h-0 relative z-10">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      {!hideBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border sm:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex items-center justify-around h-16 px-1">
            {bottomTabs.map((tab) => {
              const isActive = isActiveHref(tab.href);
              const TabIcon = tab.icon;

              let badgeCount = 0;
              if (pathOf(tab.href) === '/chat') badgeCount = chatUnread;
              if (pathOf(tab.href) === '/notifications') badgeCount = notifUnread;

              return (
                <Link
                  key={tab.href}
                  to={tab.href}
                  className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 h-full transition-colors active:scale-95 ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <div className={`relative inline-flex items-center justify-center h-9 w-12 rounded-md transition-colors ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-transparent'}`}>
                    <TabIcon className={`w-5 h-5 ${isActive ? 'text-primary-foreground' : ''}`} />
                    {badgeCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium leading-tight max-w-full truncate whitespace-nowrap px-0.5 ${isActive ? 'text-primary' : ''}`}>
                    {tab.label}
                  </span>
                </Link>
              );
            })}

            {/* "More" button */}
            <button
              onClick={() => setMoreSheetOpen(true)}
              className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors active:scale-95 ${
                moreSheetOpen ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <span className={`relative inline-flex items-center justify-center h-9 w-12 rounded-md transition-colors ${moreSheetOpen ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-transparent'}`}>
                <MoreHorizontal className="w-5 h-5" />
                {/* Si el Chat no está en la barra (médico), sus mensajes sin leer se avisan aquí */}
                {chatUnread > 0 && !bottomTabs.some(tab => pathOf(tab.href) === '/chat') && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                    {chatUnread > 99 ? '99+' : chatUnread}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium leading-tight">{t('nav.more')}</span>
            </button>
          </div>
        </nav>
      )}

      {/* More Sheet (full-screen drawer from bottom) */}
      <Sheet open={moreSheetOpen} onOpenChange={setMoreSheetOpen}>
        <SheetContent side="bottom" hideClose className="h-[85vh] rounded-t-2xl p-0 overflow-hidden">
          <div className="flex flex-col h-full overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <img src={logoMedicalMasters} alt="Medical Masters" className="h-7 w-auto" />
              <button
                onClick={() => setMoreSheetOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
                aria-label={t('pro.common.close')}
              >
                <X className="w-5 h-5 text-foreground" />
              </button>
            </div>

            {isAuthenticated && user && role !== 'visitor' && (
              <div className="mx-5 mb-4 p-4 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {user.avatarUrl
                      ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                      : role === 'doctor'
                        ? <Stethoscope className="w-5 h-5 text-primary" />
                        : <User className="w-5 h-5 text-primary" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  {getRoleBadge()}
                </div>
              </div>
            )}

            {(!isAuthenticated || role === 'visitor') && (
              <div className="mx-5 mb-4 p-4 bg-primary/5 rounded-xl border border-primary/20">
                <p className="text-sm text-muted-foreground mb-3">{t('mainLayout.loginPrompt')}</p>
                <Button size="sm" onClick={() => { setMoreSheetOpen(false); navigate('/login'); }} className="w-full gap-2">
                  <LogIn className="w-4 h-4" />
                  {t('nav.login')}
                </Button>
              </div>
            )}

            <div className="px-5 flex-1">
              {moreNavItems.length > 0 && (
                <div className="space-y-1 mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">{t('mainLayout.sectionNavigation')}</p>
                  {moreNavItems.map((item) => {
                    const isActive = isActiveHref(item.href);
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={() => setMoreSheetOpen(false)}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                          isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="text-sm font-medium">{t(item.labelKey)}</span>
                        {pathOf(item.href) === '/chat' && chatUnread > 0 && (
                          <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
                            {chatUnread > 99 ? '99+' : chatUnread}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}

              {isAuthenticated && role !== 'visitor' && (
                <>
                  <div className="border-t border-border my-3" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">{t('mainLayout.sectionAccount')}</p>
                    <Link
                      to="/profile"
                      onClick={() => setMoreSheetOpen(false)}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                        location.pathname === '/profile' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <User className="w-5 h-5" />
                      <span className="text-sm font-medium">{t('nav.profile')}</span>
                    </Link>
                    {role === 'doctor' && (
                      <Link
                        to="/doctor/earnings"
                        onClick={() => setMoreSheetOpen(false)}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors border ${
                          location.pathname === '/doctor/earnings' ? 'bg-success/15 border-success/30 text-success' : 'bg-success/10 border-success/20 text-foreground hover:bg-success/15'
                        }`}
                      >
                        <DollarSign className="w-5 h-5 text-success" />
                        <span className="text-sm font-medium">{t('nav.earnings')}</span>
                        <span className="ml-auto text-xs font-semibold text-muted-foreground">${pendingEarnings.toLocaleString()}</span>
                      </Link>
                    )}
                    {(role === 'patient' || role === 'resident' || role === 'doctor') && (
                      <Link
                        to="/wallet"
                        onClick={() => setMoreSheetOpen(false)}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors border ${
                          location.pathname === '/wallet' ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-primary/10 border-primary/20 text-foreground hover:bg-primary/15'
                        }`}
                      >
                        <Wallet className="w-5 h-5 text-primary" />
                        <span className="text-sm font-medium">{t('nav.wallet')}</span>
                      </Link>
                    )}
                    {FEATURE_FLAGS.marketplaceFeeModel && role === 'resident' && (
                      <Link
                        to="/marketplace"
                        onClick={() => setMoreSheetOpen(false)}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                          location.pathname === '/marketplace' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <Package className="w-5 h-5" />
                        <span className="text-sm font-medium">Marketplace</span>
                      </Link>
                    )}
                    {(role === 'patient' || role === 'resident') && hasCampaigns && (
                      <Link
                        to="/advertiser/dashboard"
                        onClick={() => setMoreSheetOpen(false)}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                          location.pathname === '/advertiser/dashboard' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <Megaphone className="w-5 h-5" />
                        <span className="text-sm font-medium">{t('nav.advertising')}</span>
                      </Link>
                    )}
                    <Link
                      to="/notifications"
                      onClick={() => setMoreSheetOpen(false)}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                        location.pathname === '/notifications' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <Bell className="w-5 h-5" />
                      <span className="text-sm font-medium">{t('nav.notifications')}</span>
                      {notifUnread > 0 && (
                        <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
                          {notifUnread > 99 ? '99+' : notifUnread}
                        </span>
                      )}
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setMoreSheetOpen(false)}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                        location.pathname === '/settings' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <Settings className="w-5 h-5" />
                      <span className="text-sm font-medium">{t('nav.settings')}</span>
                    </Link>
                  </div>
                  <div className="border-t border-border my-3" />
                  <button
                    onClick={() => { setMoreSheetOpen(false); handleLogout(); }}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-destructive hover:bg-destructive/10 w-full transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="text-sm font-medium">{t('nav.logout')}</span>
                  </button>
                </>
              )}
            </div>

            <div className="h-6" />
          </div>
        </SheetContent>
      </Sheet>

      {/* Active live banner */}
      <ActiveLiveBanner />

      {/* Unified Footer */}
      <UnifiedFooter variant="app" />
    </AppBackground>
  );
});

MainLayout.displayName = 'MainLayout';
export default MainLayout;
