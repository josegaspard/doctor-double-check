import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Eye, User, Stethoscope, GraduationCap } from 'lucide-react';
import { LanguageSwitcher } from '@/components/settings/LanguageSwitcher';
import logoMedicalMastersWhite from '@/assets/logo-medical-masters-white.png';

type RoleOption = {
  id: 'visitor' | 'patient' | 'doctor' | 'resident';
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  bgImage: string;
  fallbackGradient: string;
  action: 'visitor' | 'login';
  role?: 'patient' | 'doctor' | 'resident';
};

export default function RoleSelector() {
  const navigate = useNavigate();
  const { loginAsVisitor, user, role, isAuthenticated, isLoading } = useAuth();
  const { t } = useLanguage();

  const roleOptions: RoleOption[] = [
    {
      id: 'visitor',
      title: t('roleSelector.exploreLives'),
      description: t('roleSelector.exploreDescription'),
      icon: Eye,
      bgImage: '/app-roles/visitor.jpg',
      fallbackGradient: 'linear-gradient(180deg, #0a1f47 0%, #163a83 60%, #0a1f47 100%)',
      action: 'visitor',
    },
    {
      id: 'patient',
      title: t('roleSelector.imPatient'),
      description: t('roleSelector.patientDescription'),
      icon: User,
      bgImage: '/app-roles/patient.jpg',
      fallbackGradient: 'linear-gradient(180deg, #163a83 0%, #00768b 60%, #163a83 100%)',
      action: 'login',
      role: 'patient',
    },
    {
      id: 'doctor',
      title: t('roleSelector.imDoctor'),
      description: t('roleSelector.doctorDescription'),
      icon: Stethoscope,
      bgImage: '/app-roles/doctor.jpg',
      fallbackGradient: 'linear-gradient(180deg, #0a1f47 0%, #00768b 60%, #0a1f47 100%)',
      action: 'login',
      role: 'doctor',
    },
    {
      id: 'resident',
      title: t('roleSelector.imResident'),
      description: t('roleSelector.residentDescription'),
      icon: GraduationCap,
      bgImage: '/app-roles/resident.jpg',
      fallbackGradient: 'linear-gradient(180deg, #163a83 0%, #0a1f47 60%, #163a83 100%)',
      action: 'login',
      role: 'resident',
    },
  ];

  const handleRoleSelect = (option: RoleOption) => {
    if (option.action === 'visitor') {
      loginAsVisitor();
      navigate('/lives');
      return;
    }
    if (isAuthenticated && user) {
      if (option.role === 'doctor') {
        navigate(role === 'doctor' ? '/doctor/dashboard' : '/lives');
        return;
      }
      navigate('/lives');
      return;
    }
    navigate('/login', { state: { preferredRole: option.role } });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a1f47' }}>
        <div className="flex items-center gap-3 text-white/90">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <span>Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: '#0a1f47' }}>
      {/* Header — flota arriba */}
      <header className="absolute top-0 left-0 right-0 z-40 px-4 sm:px-8 py-4 sm:py-5">
        <div className="flex items-center justify-between">
          <img src={logoMedicalMastersWhite} alt="Medical Masters" className="h-8 sm:h-10 w-auto drop-shadow-lg" />
          <LanguageSwitcher className="bg-white/10 hover:bg-white/20 text-white border-white/20" />
        </div>
      </header>

      {/* Título centrado encima de las columnas */}
      <div className="absolute top-20 sm:top-24 left-0 right-0 z-30 px-4 text-center pointer-events-none">
        <p className="text-sm sm:text-base text-white/85 mb-1 sm:mb-2 drop-shadow">
          {t('roleSelector.title')}
        </p>
        <h1 className="font-heading text-xl sm:text-2xl md:text-3xl font-bold text-white drop-shadow-lg max-w-2xl mx-auto leading-tight">
          {t('roleSelector.subtitle')}
        </h1>
      </div>

      {/* 4 columnas full-bleed, sin gaps */}
      <main className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 min-h-screen">
        {roleOptions.map((option, idx) => {
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleRoleSelect(option)}
              className={`group relative overflow-hidden text-left min-h-[280px] sm:min-h-[360px] lg:min-h-screen focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white/40 ${
                idx < roleOptions.length - 1 ? 'lg:border-r border-white/10' : ''
              }`}
              aria-label={option.title}
            >
              {/* Fallback gradient (siempre presente, sirve si la imagen falla) */}
              <div className="absolute inset-0" style={{ background: option.fallbackGradient }} />

              {/* Imagen de fondo: visible en default, MÁS visible en hover */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-all duration-500 ease-out opacity-40 group-hover:opacity-100 group-hover:scale-105"
                style={{ backgroundImage: `url(${option.bgImage})` }}
              />

              {/* Overlay oscuro: denso en default, se transparenta en hover */}
              <div className="absolute inset-0 bg-[#0a1f47]/80 group-hover:bg-[#0a1f47]/30 transition-colors duration-500" />

              {/* Contenido: icono + título + descripción, anclado al lower-half */}
              <div className="relative z-10 h-full min-h-[280px] sm:min-h-[360px] lg:min-h-screen flex flex-col items-center justify-center sm:justify-end px-6 pb-8 sm:pb-12 lg:pb-20 text-center">
                <div className="mb-4 sm:mb-5 transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1">
                  <Icon className="w-10 h-10 sm:w-12 sm:h-12 text-white drop-shadow-lg" strokeWidth={1.5} />
                </div>
                <h3 className="font-heading text-base sm:text-lg md:text-xl font-bold text-white mb-2 sm:mb-3 leading-tight drop-shadow-md">
                  {option.title}
                </h3>
                <p className="text-xs sm:text-sm text-white/85 leading-relaxed max-w-[16rem] drop-shadow">
                  {option.description}
                </p>

                {/* Indicador hover */}
                <div className="mt-4 sm:mt-5 h-0.5 w-0 group-hover:w-12 bg-white transition-all duration-500 rounded-full" />
              </div>
            </button>
          );
        })}
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-4 py-3 text-center bg-[#0a1f47]/70 backdrop-blur-sm">
        <p className="text-[11px] sm:text-xs text-white/70">{t('footer.copyright')}</p>
      </footer>
    </div>
  );
}
