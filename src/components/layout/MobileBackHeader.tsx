import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

// Root routes where back header should NOT appear
const ROOT_ROUTES = [
  '/lives',
  '/chat',
  '/doctors',
  '/notifications',
  '/profile',
  '/admin',
  '/login',
  '/register',
  '/onboarding',
  '/role-selector',
  '/doctor/dashboard',
  '/',
];

// Map paths to i18n keys under backHeader.*
const PAGE_TITLE_KEYS: Record<string, string> = {
  '/recordings': 'backHeader.premiumContent',
  '/content': 'backHeader.content',
  '/news': 'backHeader.news',
  '/prescriptions': 'backHeader.prescriptions',
  '/vault': 'backHeader.vault',
  '/medical-record': 'backHeader.medicalRecord',
  '/wallet': 'backHeader.wallet',
  '/meetings': 'backHeader.clinicalSessions',
  '/settings': 'backHeader.settings',
  '/hospital-locator': 'backHeader.hospitalLocator',
  '/medical-supplies': 'backHeader.medicalSupplies',
  '/vendor/dashboard': 'backHeader.vendorDashboard',
  '/doctor/dashboard': 'backHeader.dashboard',
  '/doctor/vault': 'backHeader.doctorVault',
  '/doctor/upload': 'backHeader.upload',
  '/doctor/availability': 'backHeader.availability',
  '/doctor/earnings': 'backHeader.earnings',
  '/doctor/recordings': 'backHeader.doctorRecordings',
  '/doctor/content': 'backHeader.doctorContent',
  '/doctor/invoices': 'backHeader.invoices',
  '/doctor/email-history': 'backHeader.earnings',
  '/doctor/bank-account': 'backHeader.bankAccount',
  '/doctor/go-live': 'backHeader.goLive',
  '/doctor/profile': 'backHeader.doctorProfile',
  '/medical-history': 'backHeader.medicalHistory',
  '/double-check': 'backHeader.doubleCheck',
  '/clinical-sessions': 'backHeader.clinicalSessions',
  '/help': 'backHeader.help',
  '/contact': 'backHeader.contact',
  '/terms': 'backHeader.terms',
  '/privacy': 'backHeader.privacy',
  '/security': 'backHeader.security',
  '/report-issue': 'backHeader.reportIssue',
  '/verify-identity': 'backHeader.verification',
  '/verification-pending': 'backHeader.verificationPending',
};

export function MobileBackHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const path = location.pathname;

  // Don't show on root routes
  if (ROOT_ROUTES.includes(path)) return null;

  // Determine page title via i18n
  let titleKey = PAGE_TITLE_KEYS[path];
  
  // For dynamic routes like /news/:id, /doctors/:id, etc.
  if (!titleKey) {
    if (path.startsWith('/news/')) titleKey = 'backHeader.article';
    else if (path.startsWith('/doctors/') || path.startsWith('/doctor/')) titleKey = 'backHeader.doctor';
    else if (path.startsWith('/live/')) titleKey = 'backHeader.live';
    else if (path.startsWith('/recording/')) titleKey = 'backHeader.recording';
    else if (path.startsWith('/prescription')) titleKey = 'backHeader.prescription';
    else if (path.startsWith('/admin')) titleKey = 'backHeader.admin';
    else titleKey = 'backHeader.back';
  }

  // React Router guarda su índice interno en history.state.idx. Si es 0, esta es la
  // PRIMERA página de la sesión SPA (p. ej. recién te logueaste y aterrizaste aquí):
  // no hay ningún "atrás" real dentro de la app, así que el botón NO debe decir
  // "Volver" — debe ser un botón de INICIO (va al home). Solo cuando hay historial
  // propio (idx>0) mostramos la flecha de retroceso con el título de la página.
  const idx = typeof (window.history.state as any)?.idx === 'number'
    ? (window.history.state as any).idx
    : 0;
  const hasBack = idx > 0;

  const label = hasBack ? title : t('backHeader.home');

  return (
    <div className="app-back-header sticky top-20 z-40 flex items-center h-10 px-1 sm:hidden bg-[#227787] shadow-sm border-t border-white/10">
      <button
        type="button"
        onClick={() => {
          // Retroceder SOLO dentro de la app: window.history.length cuenta también
          // las páginas previas al sitio (Google, tab nueva), así que navigate(-1)
          // podía sacar al usuario de la web (y parecía que se cerraba la sesión).
          const curIdx = typeof (window.history.state as any)?.idx === 'number'
            ? (window.history.state as any).idx
            : 0;
          if (curIdx > 0) navigate(-1);
          else navigate('/lives');
        }}
        aria-label={hasBack ? (t('common.back') || 'Volver') : t('backHeader.home')}
        className="inline-flex items-center gap-1 px-2 h-9 rounded-md text-white/90 hover:text-white active:bg-white/10 transition-colors"
      >
        {hasBack ? <ChevronLeft className="w-5 h-5" /> : <Home className="w-[18px] h-[18px]" />}
        <span className="text-sm font-medium">{label}</span>
      </button>
    </div>
  );
}
