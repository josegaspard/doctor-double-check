import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Eye, 
  User, 
  Stethoscope, 
  GraduationCap,
  Heart,
  Video,
  Lock
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/settings/LanguageSwitcher';
import logoMedicalMastersWhite from '@/assets/logo-medical-masters-white.png';

export default function RoleSelector() {
  const navigate = useNavigate();
  const { loginAsVisitor } = useAuth();
  const { t, translations } = useLanguage();

  const roleOptions = [
    {
      id: 'visitor',
      title: t('roleSelector.exploreLives'),
      description: t('roleSelector.exploreDescription'),
      icon: Eye,
      color: 'bg-muted',
      iconColor: 'text-muted-foreground',
      action: 'visitor',
    },
    {
      id: 'patient',
      title: t('roleSelector.imPatient'),
      description: t('roleSelector.patientDescription'),
      icon: User,
      color: 'bg-primary/10',
      iconColor: 'text-primary',
      action: 'login',
      role: 'patient',
    },
    {
      id: 'doctor',
      title: t('roleSelector.imDoctor'),
      description: t('roleSelector.doctorDescription'),
      icon: Stethoscope,
      color: 'bg-info/10',
      iconColor: 'text-info',
      action: 'login',
      role: 'doctor',
    },
    {
      id: 'resident',
      title: t('roleSelector.imResident'),
      description: t('roleSelector.residentDescription'),
      icon: GraduationCap,
      color: 'bg-warning/10',
      iconColor: 'text-warning',
      action: 'login',
      role: 'resident',
    },
  ];

  const handleRoleSelect = (option: typeof roleOptions[0]) => {
    if (option.action === 'visitor') {
      loginAsVisitor();
      navigate('/lives');
    } else {
      navigate('/login', { state: { preferredRole: option.role } });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-dark">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <img src={logoMedicalMastersWhite} alt="Medical Masters" className="h-10 w-auto" />
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 md:py-16">
        <div className="max-w-2xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-accent rounded-full px-4 py-2 mb-4">
              <Video className="w-4 h-4 text-accent-foreground" />
              <span className="text-sm font-medium text-accent-foreground">{t('roleSelector.tagline')}</span>
            </div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3">
              {t('roleSelector.title')}
            </h2>
            <p className="text-muted-foreground">
              {t('roleSelector.subtitle')}
            </p>
          </div>

          {/* Role Cards */}
          <div className="grid gap-4">
            {roleOptions.map((option) => (
              <Card
                key={option.id}
                className="p-4 cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/30"
                onClick={() => handleRoleSelect(option)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${option.color} flex items-center justify-center flex-shrink-0`}>
                    <option.icon className={`w-6 h-6 ${option.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{option.title}</h3>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Features */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-success/10 flex items-center justify-center mb-2">
                <Video className="w-5 h-5 text-success" />
              </div>
              <p className="text-xs text-muted-foreground">{t('roleSelector.freeLives')}</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Stethoscope className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">{t('roleSelector.verifiedDoctors')}</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-info/10 flex items-center justify-center mb-2">
                <Lock className="w-5 h-5 text-info" />
              </div>
              <p className="text-xs text-muted-foreground">{t('roleSelector.secureVault')}</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-live/10 flex items-center justify-center mb-2">
                <Heart className="w-5 h-5 text-live" />
              </div>
              <p className="text-xs text-muted-foreground">{t('roleSelector.oneOnOneChat')}</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-dark py-4">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-dark-foreground">
            {t('footer.copyright')}
          </p>
        </div>
      </footer>
    </div>
  );
}
