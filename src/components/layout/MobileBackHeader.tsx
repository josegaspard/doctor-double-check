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
  '/',
];

// Map paths to readable page titles
const PAGE_TITLES: Record<string, string> = {
  '/recordings': 'Grabaciones',
  '/content': 'Contenido',
  '/news': 'Noticias',
  '/prescriptions': 'Recetas',
  '/vault': 'Vault',
  '/wallet': 'Wallet',
  '/settings': 'Configuración',
  '/doctor/dashboard': 'Dashboard',
  '/doctor/vault': 'Vault',
  '/doctor/upload': 'Subir Contenido',
  '/doctor/availability': 'Disponibilidad',
  '/doctor/earnings': 'Ganancias',
  '/doctor/recordings': 'Grabaciones',
  '/doctor/content': 'Contenido',
  '/doctor/invoices': 'Facturas',
  '/doctor/bank-account': 'Cuenta Bancaria',
  '/doctor/go-live': 'Ir en Vivo',
  '/doctor/profile': 'Mi Perfil',
  '/medical-history': 'Historial Médico',
  '/double-check': 'Double Check',
  '/clinical-sessions': 'Sesiones Clínicas',
  '/help': 'Ayuda',
  '/contact': 'Contacto',
  '/terms': 'Términos',
  '/privacy': 'Privacidad',
  '/security': 'Seguridad',
  '/report-issue': 'Reportar',
  '/identity-verification': 'Verificación',
  '/verification-pending': 'Verificación Pendiente',
};

export function MobileBackHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const path = location.pathname;

  // Don't show on root routes
  if (ROOT_ROUTES.includes(path)) return null;

  // Determine page title
  let title = PAGE_TITLES[path] || '';
  
  // For dynamic routes like /news/:id, /doctors/:id, etc.
  if (!title) {
    if (path.startsWith('/news/')) title = 'Artículo';
    else if (path.startsWith('/doctors/')) title = 'Doctor';
    else if (path.startsWith('/live/')) title = 'En Vivo';
    else if (path.startsWith('/recording/')) title = 'Grabación';
    else if (path.startsWith('/prescription/')) title = 'Receta';
    else if (path.startsWith('/admin')) title = 'Admin';
    else title = 'Atrás';
  }

  return (
    <div className="sticky top-[57px] z-40 flex items-center h-11 px-2 border-b border-border bg-card/95 backdrop-blur sm:hidden">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 text-muted-foreground px-2"
        onClick={() => navigate(-1)}
      >
        <ChevronLeft className="w-5 h-5" />
        <span className="text-sm">{title}</span>
      </Button>
    </div>
  );
}
