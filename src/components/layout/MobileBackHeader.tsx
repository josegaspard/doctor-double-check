import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
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

  const title = t(titleKey);

  return (
    <div className="app-back-header sticky top-[57px] z-40 flex items-center h-11 px-2 sm:hidden bg-[#0b1d45] border-0">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 px-2 h-9 rounded-md text-white/90 hover:text-white hover:bg-white/10 transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
        <span className="text-sm font-medium">{title}</span>
      </button>
    </div>
  );
}
