import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Eye, User, Stethoscope, GraduationCap } from 'lucide-react';
import { LanguageSwitcher } from '@/components/settings/LanguageSwitcher';
import { BrandLaunchAnimation } from '@/components/BrandLaunchAnimation';
import { hasAppBooted } from '@/lib/appBootFlag';
import logoMedicalMastersWhite from '@/assets/logo-medical-masters-white.png';

type RoleOption = {
  id: 'visitor' | 'patient' | 'doctor' | 'resident';
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>;
  bgImage: string;
  fallbackGradient: string;
  action: 'visitor' | 'login';
  role?: 'patient' | 'doctor' | 'resident';
};

export default function RoleSelector() {
  const navigate = useNavigate();
  const { loginAsVisitor, user, role, isAuthenticated, isLoading } = useAuth();
  const { t } = useLanguage();

  // Momento de marca al "entrar a la app" desde el CTA del landing (navegación
  // SPA, sin recarga): mismo look que el splash de arranque en frío, para que
  // se sienta a abrir una app y no a cargar una página. Vive como hermano ESTABLE
  // en el árbol (no dentro de las ramas isLoading/ready de abajo) para que NO se
  // remonte — y por lo tanto no reinicie su propio cronómetro — si isLoading
  // cambia de valor mientras todavía se está mostrando.
  // Si se entra AQUÍ directo (recarga dura / deep-link a /app), el splash de
  // arranque de App.tsx ya está cubriendo la pantalla — no dupliques el overlay.
  const [showLaunch, setShowLaunch] = useState(() => hasAppBooted());

  // Lives en vivo para mostrarlos difuminados de fondo (cliente 2026-06-15)
  const [liveThumbs, setLiveThumbs] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('lives')
        .select('thumbnail_url')
        .eq('status', 'live')
        .eq('is_broadcasting', true)
        .not('thumbnail_url', 'is', null)
        .limit(6);
      setLiveThumbs(((data || []) as any[]).map((l) => l.thumbnail_url).filter(Boolean));
    })();
  }, []);

  const roleOptions: RoleOption[] = [
    // "Descubre MedicalMasters" PRIMERO (cliente 16-jul-2026): acceso libre SIN
    // cuenta por 10 min; al agotarse, DiscoverGate bloquea y pide registro.
    // Imagen restaurada: collage de lives.
    {
      id: 'visitor',
      title: t('roleSelector.discoverTitle'),
      description: t('roleSelector.discoverDescription'),
      icon: Eye,
      bgImage: '/app-roles/visitor.webp',
      fallbackGradient: 'linear-gradient(180deg, #227787 0%, #163a83 60%, #0a1f47 100%)',
      action: 'visitor',
    },
    {
      id: 'patient',
      title: t('roleSelector.imPatient'),
      description: t('roleSelector.patientDescription'),
      icon: User,
      // Imagen de fondo restaurada (cliente 2026-06-16): collage de telemedicina/bienestar del paciente.
      bgImage: '/app-roles/patient.webp',
      fallbackGradient: 'linear-gradient(180deg, #163a83 0%, #227787 60%, #163a83 100%)',
      action: 'login',
      role: 'patient',
    },
    {
      id: 'doctor',
      title: t('roleSelector.imDoctor'),
      description: t('roleSelector.doctorDescription'),
      icon: Stethoscope,
      bgImage: '/app-roles/doctor.webp',
      fallbackGradient: 'linear-gradient(180deg, #0a1f47 0%, #227787 60%, #0a1f47 100%)',
      action: 'login',
      role: 'doctor',
    },
    {
      id: 'resident',
      title: t('roleSelector.imResident'),
      description: t('roleSelector.residentDescription'),
      icon: GraduationCap,
      bgImage: '/app-roles/resident.webp',
      fallbackGradient: 'linear-gradient(180deg, #163a83 0%, #0a1f47 60%, #163a83 100%)',
      action: 'login',
      role: 'resident',
    },
  ];

  // Un usuario REAL logueado = autenticado y con rol distinto de 'visitor'.
  // (Un visitante también está "autenticado", por eso NO basta isAuthenticated.)
  const isRealUser = isAuthenticated && !!user && !!role && role !== 'visitor';

  const handleRoleSelect = (option: RoleOption) => {
    if (option.action === 'visitor') {
      // No degradar cuentas reales: si ya hay usuario real, va a su destino normal.
      if (isRealUser) {
        navigate(role === 'admin' ? '/admin' : role === 'doctor' ? '/doctor/dashboard' : '/lives');
        return;
      }
      // Descubre MedicalMasters (cliente 16-jul): el clic SIEMPRE deja entrar a
      // lives sin login. Arranca 10 min frescos; al agotarse, DiscoverGate
      // regresa al login. Volver a dar clic da otros 10 min (nunca bloquea el
      // acceso a lives desde aquí).
      loginAsVisitor();
      navigate('/lives');
      return;
    }
    // Tarjetas de rol (paciente/médico/residente): SOLO un usuario REAL va a su
    // panel. Un visitante o alguien sin sesión SIEMPRE va a login/registro con el
    // rol elegido (antes un visitante caía en /lives → parecía "Descubre").
    if (isRealUser) {
      if (role === 'admin') { navigate('/admin'); return; }
      if (option.role === 'doctor') { navigate(role === 'doctor' ? '/doctor/dashboard' : '/lives'); return; }
      navigate('/lives');
      return;
    }
    navigate('/login', { state: { preferredRole: option.role } });
  };

  if (isLoading) {
    return (
      <>
        {showLaunch && (
          <BrandLaunchAnimation onFinish={() => setShowLaunch(false)} subtitle={t('landing.nav.launching')} />
        )}
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a1f47' }}>
          <div className="flex items-center gap-3 text-white/90">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <span>{t('common.loading')}</span>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {showLaunch && (
        <BrandLaunchAnimation onFinish={() => setShowLaunch(false)} subtitle={t('landing.nav.launching')} />
      )}
    <div className="min-h-screen flex flex-col relative" style={{ background: '#0a1f47' }}>
      {/* Lives transmitiendo atrás en borroso (cliente 2026-06-15): si hay lives en vivo,
          se muestran sus miniaturas difuminadas de fondo detrás de las tarjetas. */}
      {liveThumbs.length > 0 && (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden>
          <div className="grid grid-cols-2 sm:grid-cols-3 h-full w-full">
            {liveThumbs.slice(0, 6).map((src, i) => (
              <img key={i} src={src} alt="" className="w-full h-full object-cover blur-2xl scale-125" />
            ))}
          </div>
          <div className="absolute inset-0 bg-[#0a1f47]/75" />
        </div>
      )}
      {/* Header — mobile: en flujo normal. Desktop (lg+): floating absolute */}
      <header className="relative lg:absolute lg:top-0 lg:left-0 lg:right-0 z-40 px-4 sm:px-8 py-3 sm:py-5 flex-shrink-0">
        <div className="relative flex items-center justify-between min-h-14">
          {/* Logo GRANDE y centrado en móvil/tablet, mismo tamaño que el landing (cliente 10-jul); desktop a la izquierda */}
          <button type="button" onClick={() => navigate('/')} aria-label="Inicio" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 lg:static lg:translate-x-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-sm">
            <img src={logoMedicalMastersWhite} alt="Medical Masters" className="h-14 w-auto drop-shadow-lg" />
          </button>
          <LanguageSwitcher className="bg-white/10 hover:bg-white/20 text-white border-white/20" />
        </div>
      </header>

      {/* Título — mobile/tablet: en flujo normal (no overlap con cards stacked).
          Desktop (lg+): absolute floating sobre las 4 columnas full-height */}
      <div className="relative lg:absolute lg:top-24 lg:left-0 lg:right-0 z-30 px-4 pt-2 pb-5 sm:pb-7 lg:py-0 text-center flex-shrink-0 pointer-events-none">
        <p className="text-xs sm:text-sm md:text-base text-white/85 mb-1.5 lg:mb-2 drop-shadow">
          {t('roleSelector.title')}
        </p>
        <h1 className="font-heading text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white drop-shadow-lg max-w-2xl mx-auto leading-tight px-2">
          {t('roleSelector.subtitle')}
        </h1>
      </div>

      {/* Mobile: 1 col stack. Tablet (sm): 2x2. Desktop (lg): 4 col full-height */}
      <main className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 lg:min-h-screen">
        {roleOptions.map((option, idx) => {
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleRoleSelect(option)}
              className={`group relative overflow-hidden text-left min-h-[140px] sm:min-h-[280px] lg:min-h-screen focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/40 ${
                idx < roleOptions.length - 1 ? 'lg:border-r border-white/10' : ''
              } border-b border-white/10 sm:border-b-0 ${idx < 2 ? 'sm:border-b sm:border-white/10 lg:border-b-0' : ''}`}
              aria-label={option.title}
            >
              {/* Imágenes de fondo RESTAURADAS (cliente 2026-06-16) solo para roles médicos
                  (doctor/residente, collages 100% clínicos). Patient/visitor quedan en degradado
                  hasta tener imágenes médicas sin comida/lifestyle. Al hacer hover se revela la foto. */}
              {option.bgImage ? (
                <>
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-50 transition-all duration-500 group-hover:opacity-100 group-hover:scale-105"
                    style={{ backgroundImage: `url(${option.bgImage})` }}
                  />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,31,71,0.30) 0%, rgba(10,31,71,0.68) 100%)' }} />
                </>
              ) : (
                <div className="absolute inset-0" style={{ background: option.fallbackGradient, opacity: liveThumbs.length ? 0.55 : 1 }} />
              )}
              <div className="absolute inset-0 bg-[#0a1f47]/25 group-hover:bg-[#0a1f47]/0 transition-colors duration-500" />

              <div className="relative z-10 h-full min-h-[140px] sm:min-h-[280px] lg:min-h-screen flex flex-col items-center justify-center px-5 py-5 sm:py-8 text-center">
                <div className="mb-2 sm:mb-4 transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1">
                  <Icon className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-white drop-shadow-lg" strokeWidth={1.5} />
                </div>
                <h3 className="font-heading text-sm sm:text-base md:text-lg lg:text-xl font-bold text-white mb-1 sm:mb-2 leading-tight drop-shadow-md">
                  {option.title}
                </h3>
                <p className="text-[11px] sm:text-xs md:text-sm text-white/85 leading-snug max-w-[18rem] drop-shadow line-clamp-3">
                  {option.description}
                </p>
                <div className="mt-2 sm:mt-4 h-0.5 w-0 group-hover:w-12 bg-white transition-all duration-500 rounded-full" />
              </div>
            </button>
          );
        })}
      </main>

      <footer className="relative z-10 px-4 py-2 sm:py-3 text-center bg-[#0a1f47]/70 backdrop-blur-sm flex-shrink-0">
        <p className="text-[10px] sm:text-xs text-white/70">{t('footer.copyright')}</p>
      </footer>
    </div>
    </>
  );
}
