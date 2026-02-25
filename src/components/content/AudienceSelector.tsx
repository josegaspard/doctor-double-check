import React from 'react';
import { Users, UserCheck, GraduationCap, Crown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useLanguage } from '@/contexts/LanguageContext';

export type ContentAudience = 'all' | 'patients' | 'professionals' | 'subscribers';

interface AudienceSelectorProps {
  value: ContentAudience;
  onChange: (value: ContentAudience) => void;
  disabled?: boolean;
}

export function AudienceSelector({ value, onChange, disabled }: AudienceSelectorProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-3">
      <Label>{t('content.audienceType')}</Label>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as ContentAudience)}
        disabled={disabled}
        className="grid gap-3"
      >
        <Label
          htmlFor="audience-all"
          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
            value === 'all' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <RadioGroupItem value="all" id="audience-all" />
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">{t('content.all')}</p>
            <p className="text-xs text-muted-foreground">
              Visible para todos los usuarios
            </p>
          </div>
        </Label>

        <Label
          htmlFor="audience-patients"
          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
            value === 'patients' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <RadioGroupItem value="patients" id="audience-patients" />
          <UserCheck className="h-5 w-5 text-blue-500" />
          <div>
            <p className="font-medium">{t('content.patients')}</p>
            <p className="text-xs text-muted-foreground">
              {t('content.patientsDescription')}
            </p>
          </div>
        </Label>

        <Label
          htmlFor="audience-professionals"
          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
            value === 'professionals' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <RadioGroupItem value="professionals" id="audience-professionals" />
          <GraduationCap className="h-5 w-5 text-amber-500" />
          <div>
            <p className="font-medium">{t('content.professionals')}</p>
            <p className="text-xs text-muted-foreground">
              {t('content.professionalsDescription')}
            </p>
          </div>
        </Label>

        <Label
          htmlFor="audience-subscribers"
          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
            value === 'subscribers' ? 'border-warning bg-warning/5' : 'border-border hover:border-muted-foreground'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <RadioGroupItem value="subscribers" id="audience-subscribers" />
          <Crown className="h-5 w-5 text-warning" />
          <div>
            <p className="font-medium">Suscriptores de pago</p>
            <p className="text-xs text-muted-foreground">
              Solo visible para pacientes con suscripción Básica o Premium activa
            </p>
          </div>
        </Label>
      </RadioGroup>
    </div>
  );
}
