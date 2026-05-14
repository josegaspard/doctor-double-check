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
      bgImage: '/app-roles/visitor.webp',
      fallbackGradient: 'linear-gradient(180deg, #0a1f47 0%, #163a83 60%, #0a1f47 100%)',
      action: 'visitor',
    },
    {
      id: 'patient',
      title: t('roleSelector.imPatient'),
      description: t('roleSelector.patientDescription'),
      icon: User,
      bgImage: '/app-roles/patient.webp',
      fallbackGradient: 'linear-gradient(180deg, #163a83 0%, #00768b 60%, #163a83 100%)',
      action: 'login',
      role: 'patient',
    },
    {
      id: 'doctor',
      title: t('roleSelector.imDoctor'),
      description: t('roleSelector.doctorDescription'),
      icon: Stethoscope,
      bgImage: '/app-roles/doctor.webp',
      fallbackGradient: 'linear-gradient(180deg, #0a1f47 0%, #00768b 60%, #0a1f47 100%)',
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
      {/* Header — mobile: en flujo normal. Desktop (lg+): floating absolute */}
      <header className="relative lg:absolute lg:top-0 lg:left-0 lg:right-0 z-40 px-4 sm:px-8 py-3 sm:py-5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <img src={logoMedicalMastersWhite} alt="Medical Masters" className="h-8 sm:h-10 w-auto drop-shadow-lg" />
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
              <div className="absolute inset-0" style={{ background: option.fallbackGradient }} />
              <div
                className="absolute inset-0 bg-cover bg-center transition-all duration-500 ease-out opacity-40 group-hover:opacity-100 group-hover:scale-105"
                style={{ backgroundImage: `url(${option.bgImage})` }}
              />
              <div className="absolute inset-0 bg-[#0a1f47]/80 group-hover:bg-[#0a1f47]/30 transition-colors duration-500" />

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
  );
}
