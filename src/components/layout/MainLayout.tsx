import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useWallet } from '@/contexts/WalletContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotificationsRealtime } from '@/hooks/useNotificationsRealtime';
import { useHasAdCampaigns } from '@/hooks/useHasAdCampaigns';
import { useNotifications } from '@/hooks/useNotifications';
import { useSocialLinks } from '@/hooks/useSiteSettings';
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
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Menu,
  Video,
  MessageSquare,
  Folder,
  User,
  Wallet,
  DollarSign,
  Settings,
  GraduationCap,
  LogOut,
  LogIn,
  Stethoscope,
  LayoutDashboard,
  Upload,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
  Calendar,
  FileText,
  Search,
  Bell,
  Radio,
  MoreHorizontal,
  X,
  Star,
  Mail,
  HelpCircle,
  Shield,
  Megaphone,
  MapPin,
  Package,
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

const navItems: NavItem[] = [
  // ===== Orden del menú definido por el cliente (2026-06-29) =====
  //   1. Lives  2. MM Education  3. Chat  4. Mis Pacientes  5. Directorio Médico
  //   6. Marketplace  7. Historial Clínico  8. Foro  9. Panel
  // Lo que no entra en la barra superior se colapsa en el botón "Más".
  // News y Recetas quedan en el "Más" (no forman parte del orden core del cliente).
  { labelKey: 'nav.lives', href: '/lives', icon: Video, roles: ['visitor', 'patient', 'doctor', 'resident', 'admin'] },
  { labelKey: 'nav.education', shortLabelKey: 'nav.educationShort', href: '/education', icon: GraduationCap, roles: ['patient', 'doctor', 'resident', 'admin'] },
  { labelKey: 'nav.chat', href: '/chat', icon: MessageSquare, roles: ['patient', 'doctor', 'resident'] },
  { labelKey: 'nav.doctorVault', shortLabelKey: 'nav.doctorVaultShort', href: '/doctor/vault', icon: Folder, roles: ['doctor'] },
  { labelKey: 'nav.soyMedico', href: '/doctors', icon: Stethoscope, roles: ['patient', 'doctor', 'resident', 'admin'] },
  // Marketplace de venta de PRODUCTOS al paciente RETIRADO (cliente 2026-06-30): /medical-supplies
  // ya no aparece en el menú de ningún rol.
  // Marketplace REVENTA dr↔dr con fee (cliente 2026-07-01): posición 6 del orden del cliente.
  // Visible SOLO para doctores y residentes; se agrega abajo condicionado al feature flag.
  ...(FEATURE_FLAGS.marketplaceFeeModel
    ? [{ labelKey: 'nav.marketplace', href: '/marketplace', icon: Package, roles: ['doctor', 'resident'] } as NavItem]
    : []),
  // Congresos: NO va en el menú header — vive SOLO en el footer (columna Plataforma).
  { labelKey: 'nav.news', href: '/news', icon: Calendar, roles: ['visitor', 'patient', 'doctor', 'resident', 'admin'], toggleKey: 'show_news_section' },
  { labelKey: 'nav.prescriptions', href: '/prescriptions', icon: FileText, roles: ['patient', 'doctor'], toggleKey: 'enable_prescriptions' },
  { labelKey: 'nav.medicalRecord', href: '/medical-record', icon: FileText, roles: ['patient', 'doctor', 'resident'] },
  // Antes enterradas (solo accesibles por URL o un botón perdido): ahora en el menú
  // del paciente para que pueda volver a sus citas y a su bóveda de estudios.
  { labelKey: 'nav.myAppointments', href: '/my-appointments', icon: Calendar, roles: ['patient', 'resident'] },
  { labelKey: 'nav.myVault', href: '/vault', icon: Folder, roles: ['patient', 'resident'] },
  // Foro RETIRADO del menú por completo (cliente 2026-07-02); la ruta /foro sigue
  // viva por URL directa, pero no aparece en barra ni en "Más".
  // Foro: hidden en navItems (NO debe salir en "Más" ni en el nav principal) —
  // se muestra SOLO como ícono+texto a la izquierda de la lupa (Link explícito
  // en el header). Cliente 15-jul-2026.
  { labelKey: 'nav.foro', href: '/foro', icon: MessageSquare, roles: ['doctor', 'resident'], hidden: true },
  { labelKey: 'nav.dashboard', href: '/doctor/dashboard', icon: LayoutDashboard, roles: ['doctor'] },
  // ===== Hidden — accesibles por URL pero fuera del menú =====
  { labelKey: 'nav.availability', href: '/doctor/availability', icon: Calendar, roles: ['doctor'], hidden: true },
  { labelKey: 'nav.meetings', href: '/meetings', icon: Calendar, roles: ['doctor', 'resident'], hidden: true },
  { labelKey: 'nav.hospitalLocator', href: '/hospital-locator', icon: MapPin, roles: ['patient', 'doctor', 'resident'], hidden: true },
  { labelKey: 'nav.admin', href: '/admin', icon: Settings, roles: ['admin'] },
];

// Bottom tab items per role — only 4 fixed tabs, 5th is "More"
function getBottomTabs(role: string | undefined, t: (key: string) => string) {
  // Cliente 2026-06-17: "Contenido Premium" (/recordings) RETIRADO de la barra inferior;
  // ahora se accede desde "Contenido premium" dentro de /education. Lives queda primero.
  const lives = { label: t('nav.lives'), href: '/lives', icon: Radio };

  if (role === 'doctor') {
    return [
      lives,
      { label: t('nav.educationShort'), href: '/education', icon: GraduationCap },
      // Etiqueta CORTA ("Directorio"): "Directorio Médico" completo se partía en
      // dos líneas / se cortaba feo dentro del tab de ~70px de la barra inferior.
      { label: t('nav.soyMedicoShort'), href: '/doctors', icon: Stethoscope },
      { label: t('nav.chat'), href: '/chat', icon: MessageSquare },
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

  // visitor (not logged in) — Contenido Premium y Directorio Médico ocultos
  // por petición del cliente 2026-05-18; el visitor solo ve Lives + News.
  if (role === 'visitor' || !role) {
    return [
      lives,
      { label: t('nav.news'), href: '/news', icon: Calendar },
    ];
  }

  // resident — "Reuniones" se movió dentro de MM Education (cliente 2026-06-16);
  // en su lugar el directorio médico en la barra inferior.
  return [
    lives,
    { label: t('nav.educationShort'), href: '/education', icon: GraduationCap },
    { label: t('nav.soyMedicoShort'), href: '/doctors', icon: Stethoscope },
    { label: t('nav.chat'), href: '/chat', icon: MessageSquare },
  ];
}

// "Más" dropdown — usa Radix DropdownMenu (renderiza vía Portal fuera del
// <header>), evitando la regla global ".app-bg-image > header button > svg
// { color: white }" que pintaba items y iconos blancos sobre fondo blanco.
type MorePopoverItem = {
  labelKey: string;
  shortLabelKey?: string;
  href: string;
  icon: React.ElementType;
};
function MoreNavPopover({
  items,
  t,
  navigate,
  pathname,
  triggerClass,
}: {
  items: MorePopoverItem[];
  t: (key: string) => string;
  navigate: (path: string) => void;
  pathname: string;
  triggerClass: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('nav.more')}
          className={triggerClass}
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
          <span>{t('nav.more')}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {items.map((item) => {
          const isActive = pathname === item.href;
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
}

// Animated wallet balance component
function AnimatedBalance({ balance }: { balance: number }) {
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(balance);

  useEffect(() => {
    if (prevRef.current !== balance) {
      setFlash(true);
      prevRef.current = balance;
      const t = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(t);
    }
  }, [balance]);

  return (
    <motion.span
      key={balance}
      initial={{ scale: 1.1 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.4 }}
      className="font-semibold leading-none"
    >
      ${balance.toLocaleString()}
    </motion.span>
  );
}

const MainLayout = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(function MainLayout({ children }, ref) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout, role } = useAuth();
  const { balance } = useWallet();
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const { t } = useLanguage();
  const { socialLinks } = useSocialLinks();
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

  // Funciones activables/desactivables desde el admin (estilo "publicidad").
  // Si el toggle está apagado: ocultamos su entrada de nav (la ruta además
  // muestra "temporalmente no disponible").
  const disabledHrefs = useMemo(() => {
    const s = new Set<string>();
    if (!toggles.enable_patient_chat) s.add('/chat');
    if (!toggles.enable_prescriptions) s.add('/prescriptions');
    if (!toggles.enable_video_calls) s.add('/video-call');
    // Kill-switches de secciones: ocultar su entrada de nav cuando se apaga.
    if (!toggles.enable_lives) s.add('/lives');
    if (!toggles.enable_recordings) s.add('/recordings');
    if (!toggles.enable_vault) { s.add('/vault'); s.add('/doctor/vault'); }
    if (!toggles.enable_marketplace) s.add('/medical-supplies');
    return s;
  }, [toggles]);

  const filteredNavItems = useMemo(() => {
    const effectiveRole = role || 'visitor';
    const items = navItems.filter(item => {
      if (item.hidden) return false;
      if (disabledHrefs.has(item.href)) return false;
      if (!item.roles.includes(effectiveRole)) return false;
      if (item.toggleKey && !(toggles as any)[item.toggleKey]) return false;
      return true;
    });
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
  }, [role, toggles, disabledHrefs]);

  const bottomTabs = useMemo(
    () => getBottomTabs(role, t).filter(tab => !disabledHrefs.has(tab.href)),
    [role, t, disabledHrefs]
  );
  
  const moreNavItems = useMemo(() => {
    const bottomTabHrefs = bottomTabs.map(tab => tab.href);
    return filteredNavItems.filter(item => !bottomTabHrefs.includes(item.href));
  }, [filteredNavItems, bottomTabs]);

  // Cliente 2026-06-29 (revierte 2026-06-22): TODOS los roles, incluidos los
  // doctores, usan el botón "Más"/"+" cuando no caben todos los items en la barra
  // (primeros N visibles + el resto dentro de "Más"). Así el menú no se satura.
  // Cliente 2026-07-09: EXCEPTO el PACIENTE — sin botón "Más" en el header;
  // todos sus items van directos en la barra (Historial Clínico antes que Recetas).
  const showAllNav = role === 'patient';

  const handleLogout = () => {
    // Llevar al landing inmediatamente al cerrar sesión (cliente 2026-06-19):
    // así no se alcanza a ver el "Acceso denegado" de las páginas protegidas.
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

  // bottomTabs already computed above

  // Destino del LOGO (cliente 2026-07-02): con sesión activa el "home" es /lives;
  // sin sesión (visitor) el logo lleva al landing público /.
  const homeHref = isAuthenticated && role && role !== 'visitor' ? '/lives' : '/';

  // Hide bottom nav on certain pages (video call, live player full experience)
  const hideBottomNav = location.pathname.startsWith('/video-call');

  // Background mode controlado desde Admin → Site Settings → Toggles
  const useImageBackground = (toggles as any).app_background !== 'white';

  return (
    <AppBackground
      ref={ref}
      className="min-h-screen flex flex-col overflow-x-clip"
    >
      {/* Modo "Descubre MedicalMasters": contador de 10 min para visitantes y
          bloqueo con registro al agotarse. No renderiza nada para usuarios reales. */}
      <DiscoverGate />
      {/* Header — usa color del footer cuando el fondo es imagen */}
      <header
        className={`sticky top-0 z-50 backdrop-blur ${
          useImageBackground
            ? 'app-header-bar border-b-0'
            : 'border-b border-border bg-card/95 supports-[backdrop-filter]:bg-card/60'
        }`}
      >
        <div className="container mx-auto px-4">
            <div className="relative flex h-20 sm:h-16 items-center justify-between">
            {/* Logo & Mobile Menu */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Hamburger menu - hidden on mobile (replaced by bottom nav), visible on tablet */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="hidden sm:flex md:hidden flex-shrink-0">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 overflow-y-auto">
                  <div className="flex items-center gap-2 mb-6">
                    <img src={logoMedicalMasters} alt="Medical Masters" className="h-12 w-auto" />
                  </div>
                  
                  {isAuthenticated && user && role !== 'visitor' && (
                    <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {role === 'doctor' ? (
                            <Stethoscope className="w-5 h-5 text-primary" />
                          ) : (
                            <User className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </div>
                      <div className="mt-2">{getRoleBadge()}</div>
                    </div>
                  )}

                  {role === 'visitor' && (
                    <div className="mb-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
                      <p className="text-sm text-muted-foreground mb-3">{t('mainLayout.loginPrompt')}</p>
                      <div className="flex flex-col gap-2">
                        <Button size="sm" onClick={() => navigate('/login')} className="w-full gap-2">
                          <LogIn className="w-4 h-4" />
                          {t('nav.login')}
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  <nav className="flex flex-col gap-1 pb-8">
                    {filteredNavItems.map((item) => {
                      const isActive = location.pathname === item.href;
                      const isPanelItem = item.href === '/doctor/dashboard';
                      return (
                        <Link
                          key={item.href}
                          to={item.href}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                            isActive
                              ? isPanelItem ? 'bg-primary/20 text-primary' : 'bg-accent text-accent-foreground'
                              : isPanelItem ? 'bg-primary/10 text-primary hover:bg-primary/15' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          <item.icon className="w-5 h-5" />
                          {t(item.labelKey)}
                        </Link>
                      );
                    })}
                    
                    {isAuthenticated && role !== 'visitor' && (
                      <>
                        <div className="my-2 border-t border-border" />
                        <Link to="/profile" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${location.pathname === '/profile' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                          <User className="w-5 h-5" />
                          {t('nav.profile')}
                        </Link>
                        {(role === 'patient' || role === 'resident' || role === 'doctor') && (
                          <Link to="/wallet" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${location.pathname === '/wallet' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                            <Wallet className="w-5 h-5" />
                            {t('nav.wallet')}
                          </Link>
                        )}
                        {(role === 'patient' || role === 'resident') && hasCampaigns && (
                          <Link to="/advertiser/dashboard" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${location.pathname === '/advertiser/dashboard' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                            <Megaphone className="w-5 h-5" />
                            {t('nav.advertising')}
                          </Link>
                        )}
                        <Link to="/settings" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${location.pathname === '/settings' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                          <Settings className="w-5 h-5" />
                          {t('nav.settings')}
                        </Link>
                        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-destructive hover:bg-destructive/10 w-full text-left">
                          <LogOut className="w-5 h-5" />
                          {t('nav.logout')}
                        </button>
                      </>
                    )}
                  </nav>
                </SheetContent>
              </Sheet>

              {/* Logo móvil: GRANDE y centrado, MISMO tamaño que el landing (h-14, cliente 10-jul) */}
              <Link to={homeHref} className="flex sm:hidden items-center absolute left-1/2 -translate-x-1/2">
                <img src={logoMedicalMastersWhite} alt="Medical Masters" className="h-14 w-auto" loading="lazy" decoding="async" />
              </Link>

              {/* Logo on tablet - compact */}
              <Link to={homeHref} className="hidden sm:flex md:hidden items-center">
                <img src={logoMedicalMastersWhite} alt="Medical Masters" className="h-10 w-auto" loading="lazy" decoding="async" />
              </Link>

              {/* Logo - desktop+ */}
              <Link to={homeHref} className="hidden md:flex items-center">
                <img src={logoMedicalMastersWhite} alt="Medical Masters" className="h-10 xl:h-11 w-auto" loading="lazy" decoding="async" />
              </Link>
            </div>

            {/* Tablet Nav (md only): 3 primarios + Más con items 3+.
                Doctor (showAllNav): TODOS los items, con scroll horizontal, sin Más. */}
            <nav className="hidden md:flex lg:hidden items-center flex-1 justify-center mx-1 min-w-0">
              <div className={`flex items-center gap-2 min-w-0 ${showAllNav ? 'w-full overflow-x-auto [&::-webkit-scrollbar]:hidden' : ''}`}>
                {(showAllNav ? filteredNavItems : filteredNavItems.slice(0, 3)).map((item) => {
                  const isActive = location.pathname === item.href;
                  const isPanelItem = item.href === '/doctor/dashboard';
                  return (
                    <Link
                      key={`md-${item.href}`}
                      to={item.href}
                      className={`relative flex items-center gap-1.5 px-2 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                        isActive ? 'app-header-nav-active'
                        : isPanelItem ? 'app-header-control px-2'
                        : 'app-header-nav-link'
                      }`}
                    >
                      <item.icon className="w-3.5 h-3.5 flex-shrink-0 relative z-10" />
                      <span className="relative z-10">{t(item.shortLabelKey || item.labelKey)}</span>
                    </Link>
                  );
                })}
                {!showAllNav && filteredNavItems.length > 3 && (
                  <MoreNavPopover
                    items={filteredNavItems.slice(3)}
                    t={t}
                    navigate={navigate}
                    pathname={location.pathname}
                    triggerClass="app-header-nav-link flex items-center gap-1.5 px-2 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap flex-shrink-0"
                  />
                )}
              </div>
            </nav>

            {/* Desktop Nav (lg+): muestra 5 primarios + Más con items 5+
                Threshold bajo (length > 5) para garantizar que el botón Más
                aparezca para cualquier rol que tenga al menos 6 items en su
                navegación filtrada. */}
            <nav className="hidden lg:flex items-center flex-1 justify-start mx-1 lg:mx-2 min-w-0">
              <div className={`flex items-center gap-2 min-w-0 ${showAllNav ? 'w-full overflow-x-auto [&::-webkit-scrollbar]:hidden' : ''}`}>
                {(showAllNav ? filteredNavItems : filteredNavItems.slice(0, 5)).map((item) => {
                  const isActive = location.pathname === item.href;
                  const isPanelItem = item.href === '/doctor/dashboard';
                  return (
                    <Link
                      key={`lg-${item.href}`}
                      to={item.href}
                      className={`relative flex items-center gap-1.5 px-2 lg:px-2.5 rounded-md text-[11px] xl:text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                        isActive ? 'app-header-nav-active'
                        : isPanelItem ? 'app-header-control px-2 lg:px-2.5'
                        : 'app-header-nav-link'
                      }`}
                    >
                      <item.icon className="w-3.5 h-3.5 flex-shrink-0 relative z-10" />
                      <span className="relative z-10">{t(item.shortLabelKey || item.labelKey)}</span>
                    </Link>
                  );
                })}
                {!showAllNav && filteredNavItems.length > 5 && (
                  <MoreNavPopover
                    items={filteredNavItems.slice(5)}
                    t={t}
                    navigate={navigate}
                    pathname={location.pathname}
                    triggerClass="app-header-nav-link flex items-center gap-1.5 px-2 lg:px-2.5 rounded-md text-[11px] xl:text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0"
                  />
                )}
              </div>
            </nav>

            {/* Right Side */}
              <div className="flex items-center gap-1.5">
              {/* Global Search — en móvil vive a la IZQUIERDA del header (absoluto sobre la fila)
                  para que el logo centrado no choque con los controles de la derecha.
                  FORO (cliente 15-jul-2026): ítem inmediatamente a la IZQUIERDA de la lupa,
                  solo para el gremio (doctores/residentes/admin). */}
              <span className="absolute left-0 top-1/2 -translate-y-1/2 sm:static sm:translate-y-0 flex items-center">
                {(role === 'doctor' || role === 'resident' || role === 'admin') && (
                  <Link
                    to="/foro"
                    aria-label={t('forum.title')}
                    title={t('forum.title')}
                    className={`flex items-center gap-1.5 h-9 px-2 sm:px-2.5 rounded-md text-sm font-medium transition-colors ${
                      location.pathname === '/foro'
                        ? 'text-primary'
                        : 'text-foreground/80 hover:text-foreground hover:bg-accent/60'
                    }`}
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span className="hidden sm:inline">{t('forum.title')}</span>
                  </Link>
                )}
                <GlobalSearch />
              </span>
              
              <LanguageSwitcher />
              
              {/* Notifications - hidden on mobile (in bottom nav) */}
              {isAuthenticated && <span className="hidden sm:block"><NotificationBell /></span>}
              
              {/* Wallet — superficie clara: usa clase semántica, sin variant outline.
                  Doctor también ve la wallet (puede cargar saldo y comprar contenido de colegas). */}
              {(role === 'patient' || role === 'resident' || role === 'doctor') && (
                <Link to="/wallet" aria-label={t('nav.wallet')} className="hidden sm:flex items-center app-header-surface-button">
                    {/* Solo el icono de wallet — sin mostrar el monto en el header (cliente 2026-06-16). */}
                    <span className="app-header-control px-2.5">
                    <Wallet className="w-4 h-4" />
                  </span>
                </Link>
              )}

              {/* User Menu */}
              {isAuthenticated && user && role !== 'visitor' ? (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="app-header-control gap-1.5 px-2 sm:px-2.5"
                    >
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {role === 'doctor' ? (
                          <Stethoscope className="w-3.5 h-3.5" />
                        ) : (
                          <User className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <span className="text-xs sm:text-sm font-semibold max-w-[60px] sm:max-w-none truncate hidden sm:inline">{user.name.split(' ')[0]}</span>
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
                    {(role === 'patient' || role === 'resident') && hasCampaigns && (
                      <DropdownMenuItem onClick={() => navigate('/advertiser/dashboard')} className="py-3 text-sm">
                        <Megaphone className="w-4 h-4 mr-2" />
                        {t('nav.advertising')}
                      </DropdownMenuItem>
                    )}
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

      {/* Tutorial "cómo usar la plataforma" por rol — abierto desde el menú del usuario (debajo de Configuración) */}
      {isAuthenticated && user && (
        <TutorialVideoDialog role={role} open={tutorialOpen} onOpenChange={setTutorialOpen} />
      )}

      {/* Mobile Back Header */}
      <MobileBackHeader />

      {/* Main Content - add bottom padding on mobile for tab bar */}
      <main className="flex-1 pb-[72px] sm:pb-0 overflow-x-clip min-h-[calc(100vh-56px-72px)] sm:min-h-0 relative z-10">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      {!hideBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border sm:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex items-center justify-around h-16 px-1">
            {bottomTabs.map((tab) => {
              const isActive = location.pathname === tab.href || (tab.href !== '/lives' && location.pathname.startsWith(tab.href));
              const TabIcon = tab.icon;
              
              // Badge count
              let badgeCount = 0;
              if (tab.href === '/chat') badgeCount = chatUnread;
              if (tab.href === '/notifications') badgeCount = notifUnread;

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
                  {/* Una sola línea SIEMPRE: sin truncate/nowrap las etiquetas largas
                      se partían en dos líneas y desalineaban toda la barra. */}
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
              <span className={`inline-flex items-center justify-center h-9 w-12 rounded-md transition-colors ${moreSheetOpen ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-transparent'}`}>
                <MoreHorizontal className="w-5 h-5" />
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
            {/* Header with close */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <img src={logoMedicalMasters} alt="Medical Masters" className="h-7 w-auto" />
              <button
                onClick={() => setMoreSheetOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
              >
                <X className="w-5 h-5 text-foreground" />
              </button>
            </div>

            {/* User info card */}
            {isAuthenticated && user && role !== 'visitor' && (
              <div className="mx-5 mb-4 p-4 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {role === 'doctor' ? (
                      <Stethoscope className="w-5 h-5 text-primary" />
                    ) : (
                      <User className="w-5 h-5 text-primary" />
                    )}
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

            {/* Navigation items */}
            <div className="px-5 flex-1">
              {moreNavItems.length > 0 && (
                <div className="space-y-1 mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">{t('mainLayout.sectionNavigation')}</p>
                  {moreNavItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={() => setMoreSheetOpen(false)}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="text-sm font-medium">{t(item.labelKey)}</span>
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
                    {/* "Mis Pedidos" (marketplace Material Médico) ELIMINADO — cliente 2026-06-16. */}
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
                        {/* Saldo oculto en el wallet (cliente 2026-06-16): solo nombre + icono. */}
                      </Link>
                    )}
                    {FEATURE_FLAGS.marketplaceFeeModel && (role === 'resident' || role === 'doctor') && (
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
                    {/* "Portal de proveedores" vive en el FOOTER (cliente 2026-07-02), no aquí. */}
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

            {/* Bottom spacer */}
            <div className="h-6" />
          </div>
        </SheetContent>
      </Sheet>

      {/* Active live banner */}
      <ActiveLiveBanner />

      {/* Unified Footer - hidden on mobile (bottom nav takes its place) */}
      <UnifiedFooter variant="app" />
    </AppBackground>
  );
});

MainLayout.displayName = 'MainLayout';
export default MainLayout;
