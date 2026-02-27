import React, { useRef, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotificationsRealtime } from '@/hooks/useNotificationsRealtime';
import { useNotifications } from '@/hooks/useNotifications';
import { useSocialLinks } from '@/hooks/useSiteSettings';
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
  PlayCircle,
  MessageSquare,
  Folder,
  User,
  Wallet,
  Settings,
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
} from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { LanguageSwitcher } from '@/components/settings/LanguageSwitcher';
import logoMedicalMasters from '@/assets/logo-medical-masters.png';
import logoMedicalMastersWhite from '@/assets/logo-medical-masters-white.png';

interface NavItem {
  labelKey: string;
  shortLabelKey?: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
}

const navItems: NavItem[] = [
  { labelKey: 'nav.lives', href: '/lives', icon: Video, roles: ['visitor', 'patient', 'doctor', 'resident', 'admin'] },
  { labelKey: 'nav.recordings', href: '/recordings', icon: PlayCircle, roles: ['patient', 'doctor', 'resident', 'admin'] },
  { labelKey: 'nav.content', shortLabelKey: 'nav.contentShort', href: '/content', icon: Folder, roles: ['patient', 'doctor', 'resident', 'admin'] },
  { labelKey: 'nav.news', href: '/news', icon: Calendar, roles: ['visitor', 'patient', 'doctor', 'resident', 'admin'] },
  { labelKey: 'nav.chat', href: '/chat', icon: MessageSquare, roles: ['patient', 'doctor'] },
  { labelKey: 'nav.prescriptions', href: '/prescriptions', icon: FileText, roles: ['patient', 'doctor'] },
  { labelKey: 'nav.vault', href: '/vault', icon: Folder, roles: ['patient'] },
  { labelKey: 'nav.doctorVault', shortLabelKey: 'nav.doctorVaultShort', href: '/doctor/vault', icon: Folder, roles: ['doctor'] },
  { labelKey: 'nav.availability', href: '/doctor/availability', icon: Calendar, roles: ['doctor'] },
  { labelKey: 'nav.upload', href: '/doctor/upload', icon: Upload, roles: ['doctor'] },
  { labelKey: 'nav.dashboard', href: '/doctor/dashboard', icon: LayoutDashboard, roles: ['doctor'] },
  { labelKey: 'nav.admin', href: '/admin', icon: Settings, roles: ['admin'] },
];

// Bottom tab items per role
function getBottomTabs(role: string | undefined, t: (key: string) => string) {
  const common = [
    { label: 'Lives', href: '/lives', icon: Radio },
  ];

  if (role === 'doctor') {
    return [
      ...common,
      { label: 'Chat', href: '/chat', icon: MessageSquare },
      { label: t('nav.doctors') || 'Doctores', href: '/doctors', icon: Stethoscope },
      { label: t('nav.notifications') || 'Avisos', href: '/notifications', icon: Bell },
      { label: 'Panel', href: '/doctor/dashboard', icon: LayoutDashboard },
    ];
  }

  if (role === 'patient') {
    return [
      ...common,
      { label: 'Chat', href: '/chat', icon: MessageSquare },
      { label: 'Doctores', href: '/doctors', icon: Stethoscope },
      { label: t('nav.notifications') || 'Avisos', href: '/notifications', icon: Bell },
      { label: 'Perfil', href: '/profile', icon: User },
    ];
  }

  // visitor / resident / admin
  return [
    ...common,
    { label: 'Doctores', href: '/doctors', icon: Stethoscope },
    { label: t('nav.notifications') || 'Avisos', href: '/notifications', icon: Bell },
    { label: role === 'admin' ? 'Admin' : 'Perfil', href: role === 'admin' ? '/admin' : '/profile', icon: role === 'admin' ? Settings : User },
  ];
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
      initial={{ scale: 1.25, color: 'hsl(var(--success))' }}
      animate={{ scale: 1, color: 'hsl(var(--foreground))' }}
      transition={{ duration: 0.5 }}
      className="font-semibold"
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
  const { t } = useLanguage();
  const { socialLinks } = useSocialLinks();
  const { unreadCount: notifUnread } = useNotifications();
  
  // Enable realtime notifications
  useNotificationsRealtime();

  // Get unread chat count
  const chatUnread = (() => {
    try {
      const { getSessionsByUser } = useChat();
      const sessions = getSessionsByUser();
      return sessions.reduce((sum, s) => {
        if (s.status !== 'active') return sum;
        return sum + (s.unreadCount || 0);
      }, 0);
    } catch {
      return 0;
    }
  })();

  const filteredNavItems = navItems.filter(item => 
    role && item.roles.includes(role)
  );

  const handleLogout = () => {
    logout();
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

  const bottomTabs = getBottomTabs(role, t);

  // Hide bottom nav on certain pages (video call, live player full experience)
  const hideBottomNav = location.pathname.startsWith('/video-call');

  return (
    <div ref={ref} className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4">
          <div className="flex h-14 items-center justify-between">
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
                      <p className="text-sm text-muted-foreground mb-3">Inicia sesión para acceder a todas las funciones</p>
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
                        {(role === 'patient' || role === 'resident') && (
                          <Link to="/wallet" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${location.pathname === '/wallet' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                            <Wallet className="w-5 h-5" />
                            {t('nav.wallet')} (<AnimatedBalance balance={balance} />)
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

              {/* Logo on mobile - small */}
              <Link to="/lives" className="flex sm:hidden items-center">
                <img src={logoMedicalMasters} alt="Medical Masters" className="h-7 w-auto" />
              </Link>

              {/* Logo - hidden on md, visible on lg+ */}
              <Link to="/lives" className="hidden lg:flex items-center">
                <img src={logoMedicalMasters} alt="Medical Masters" className="h-8 xl:h-10 w-auto" />
              </Link>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center flex-1 justify-center lg:justify-start overflow-x-auto scrollbar-hide mx-2">
              <div className="flex items-center gap-0.5 lg:gap-1">
                {filteredNavItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  const isPanelItem = item.href === '/doctor/dashboard';
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`relative flex items-center gap-0.5 lg:gap-1 px-1.5 lg:px-2 xl:px-2.5 py-1.5 rounded-md text-[11px] lg:text-xs xl:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                        isActive
                          ? 'text-primary'
                          : isPanelItem
                            ? 'bg-primary/10 text-primary hover:bg-primary/15'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="nav-pill"
                          className={isPanelItem ? 'absolute inset-0 bg-primary/20 rounded-md' : 'absolute inset-0 bg-primary/10 rounded-md'}
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                      <item.icon className="w-3 h-3 lg:w-3.5 lg:h-3.5 flex-shrink-0 relative z-10" />
                      <span className="relative z-10">{t(item.shortLabelKey || item.labelKey)}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* Right Side */}
            <div className="flex items-center gap-1.5">
              {/* Search - hidden on mobile (accessible via Doctores tab) */}
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-foreground hidden sm:flex"
                onClick={() => navigate('/doctors')}
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">{t('common.search')}</span>
              </Button>
              
              <LanguageSwitcher />
              
              {/* Notifications - hidden on mobile (in bottom nav) */}
              {isAuthenticated && <span className="hidden sm:block"><NotificationBell /></span>}
              
              {/* Wallet */}
              {(role === 'patient' || role === 'resident') && (
                <Link to="/wallet" className="hidden sm:block">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Wallet className="w-4 h-4" />
                    <AnimatedBalance balance={balance} />
                  </Button>
                </Link>
              )}

              {/* User Menu */}
              {isAuthenticated && user && role !== 'visitor' ? (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1 sm:gap-2 px-2 sm:px-3">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {role === 'doctor' ? (
                          <Stethoscope className="w-4 h-4 text-primary" />
                        ) : (
                          <User className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <span className="text-xs sm:text-sm max-w-[60px] sm:max-w-none truncate hidden sm:inline">{user.name.split(' ')[0]}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                        <div className="pt-1">{getRoleBadge()}</div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/profile')}>
                      <User className="w-4 h-4 mr-2" />
                      {t('nav.profile')}
                    </DropdownMenuItem>
                    {(role === 'patient' || role === 'resident') && (
                      <DropdownMenuItem onClick={() => navigate('/wallet')}>
                        <Wallet className="w-4 h-4 mr-2" />
                        {t('nav.wallet')}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => navigate('/settings')}>
                      <Settings className="w-4 h-4 mr-2" />
                      {t('nav.settings')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                      <LogOut className="w-4 h-4 mr-2" />
                      {t('nav.logout')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button onClick={() => navigate('/login')} size="sm" className="gap-2">
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('nav.login')}</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - add bottom padding on mobile for tab bar */}
      <main className="flex-1 pb-[72px] sm:pb-0">
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
              const Icon = tab.icon;
              
              // Badge count
              let badgeCount = 0;
              if (tab.href === '/chat') badgeCount = chatUnread;
              if (tab.href === '/notifications') badgeCount = notifUnread;

              return (
                <Link
                  key={tab.href}
                  to={tab.href}
                  className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors active:scale-95 ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <div className="relative">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
                    {badgeCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium leading-tight ${isActive ? 'text-primary' : ''}`}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="bottom-nav-indicator"
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* Footer - hidden on mobile (bottom nav takes its place) */}
      <footer className="bg-dark text-dark-foreground py-8 mt-auto hidden sm:block">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <img src={logoMedicalMastersWhite} alt="Medical Masters" className="h-8 w-auto" />
                <span className="text-sm text-light">{t('footer.platform')}</span>
              </div>
              
              <div className="flex items-center gap-4">
                {socialLinks.facebook && (
                  <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-light/70 hover:text-light transition-colors">
                    <Facebook className="w-5 h-5" />
                  </a>
                )}
                {socialLinks.instagram && (
                  <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-light/70 hover:text-light transition-colors">
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
                {socialLinks.twitter && (
                  <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-light/70 hover:text-light transition-colors">
                    <Twitter className="w-5 h-5" />
                  </a>
                )}
                {socialLinks.linkedin && (
                  <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-light/70 hover:text-light transition-colors">
                    <Linkedin className="w-5 h-5" />
                  </a>
                )}
                {socialLinks.youtube && (
                  <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="text-light/70 hover:text-light transition-colors">
                    <Youtube className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>
            
            <div className="border-t border-light/20" />
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <nav className="flex items-center gap-6">
                <Link to="/terms" className="text-sm text-light/70 hover:text-light transition-colors">
                  {t('footer.termsOfService')}
                </Link>
                <Link to="/privacy" className="text-sm text-light/70 hover:text-light transition-colors">
                  {t('footer.privacyPolicy')}
                </Link>
                <Link to="/contact" className="text-sm text-light/70 hover:text-light transition-colors">
                  {t('footer.contact')}
                </Link>
              </nav>
              
              <p className="text-sm text-light/70">
                {t('footer.copyright')}
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
});

MainLayout.displayName = 'MainLayout';
export default MainLayout;
