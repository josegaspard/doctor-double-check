import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Eye, User, Stethoscope, GraduationCap, Video, ArrowRight } from 'lucide-react';
import { LanguageSwitcher } from '@/components/settings/LanguageSwitcher';
import logoMedicalMastersWhite from '@/assets/logo-medical-masters-white.png';

type RoleOption = {
  id: 'visitor' | 'patient' | 'doctor' | 'resident';
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  bgImage: string;
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
      action: 'visitor',
    },
    {
      id: 'patient',
      title: t('roleSelector.imPatient'),
      description: t('roleSelector.patientDescription'),
      icon: User,
      bgImage: '/app-roles/patient.jpg',
      action: 'login',
      role: 'patient',
    },
    {
      id: 'doctor',
      title: t('roleSelector.imDoctor'),
      description: t('roleSelector.doctorDescription'),
      icon: Stethoscope,
      bgImage: '/app-roles/doctor.jpg',
      action: 'login',
      role: 'doctor',
    },
    {
      id: 'resident',
      title: t('roleSelector.imResident'),
      description: t('roleSelector.residentDescription'),
      icon: GraduationCap,
      bgImage: '/app-roles/resident.jpg',
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-primary to-secondary">
        <div className="flex items-center gap-3 text-white/90">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <span>Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-secondary via-primary to-secondary">
      {/* Header */}
      <header className="relative z-10 px-4 sm:px-6 py-4 sm:py-5">
        <div className="container mx-auto flex items-center justify-between">
          <img src={logoMedicalMastersWhite} alt="Medical Masters" className="h-8 sm:h-10 w-auto" />
          <LanguageSwitcher className="bg-white/10 hover:bg-white/20 text-white border-white/20" />
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-4 sm:px-6 py-6 sm:py-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 mb-4 backdrop-blur-sm">
          <Video className="w-3.5 h-3.5 text-white" />
          <span className="text-xs sm:text-sm font-medium text-white">{t('roleSelector.tagline')}</span>
        </div>
        <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">
          {t('roleSelector.title')}
        </h1>
        <p className="text-sm sm:text-base text-white/80 max-w-xl mx-auto">
          {t('roleSelector.subtitle')}
        </p>
      </section>

      {/* 4-column role grid */}
      <main className="relative z-10 flex-1 px-4 sm:px-6 pb-8 sm:pb-12">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 max-w-7xl mx-auto">
            {roleOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleRoleSelect(option)}
                  className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-secondary shadow-xl ring-1 ring-white/10 transition-all duration-300 hover:ring-white/30 hover:shadow-2xl hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-white/60 text-left h-[260px] sm:h-[340px] md:h-[400px] lg:h-[480px]"
                  aria-label={option.title}
                >
                  {/* Background image */}
                  <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-700 group-hover:scale-110"
                    style={{ backgroundImage: `url(${option.bgImage})` }}
                  />
                  {/* Fallback color (visible if image missing) */}
                  <div className="absolute inset-0 bg-gradient-to-br from-secondary via-primary/60 to-secondary -z-10" />
                  {/* Dark gradient overlay for legibility */}
                  <div className="absolute inset-0 bg-gradient-to-t from-secondary/95 via-secondary/55 to-secondary/15 group-hover:from-secondary/85 group-hover:via-secondary/40 transition-colors duration-300" />

                  {/* Top: icon chip */}
                  <div className="relative z-10 p-5 sm:p-6 flex flex-col h-full">
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-lg">
                        <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                      </div>
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                        <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                    </div>

                    {/* Bottom: title + desc */}
                    <div className="mt-auto pt-6">
                      <h3 className="font-heading text-lg sm:text-xl md:text-2xl font-bold text-white mb-1.5 sm:mb-2 leading-tight drop-shadow-md">
                        {option.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-white/85 leading-relaxed line-clamp-3">
                        {option.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-4 py-4 text-center">
        <p className="text-xs text-white/70">{t('footer.copyright')}</p>
      </footer>
    </div>
  );
}
