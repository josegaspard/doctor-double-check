import React, { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface PasswordStrengthProps {
  password: string;
}

// Las etiquetas son claves de traducción (passwordStrength.*): antes iban en español
// fijo y salían así con la interfaz en otro idioma (3-oct-2026).
interface PasswordRequirement {
  labelKey: string;
  met: boolean;
}

export function getPasswordStrength(password: string): {
  score: number;
  labelKey: string;
  color: string;
  requirements: PasswordRequirement[];
} {
  const requirements: PasswordRequirement[] = [
    { labelKey: 'passwordStrength.minLength', met: password.length >= 12 },
    { labelKey: 'passwordStrength.lowercase', met: /[a-z]/.test(password) },
    { labelKey: 'passwordStrength.uppercase', met: /[A-Z]/.test(password) },
    { labelKey: 'passwordStrength.number', met: /[0-9]/.test(password) },
    { labelKey: 'passwordStrength.special', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ];

  const metCount = requirements.filter(r => r.met).length;
  const score = (metCount / requirements.length) * 100;

  let labelKey = 'passwordStrength.veryWeak';
  let color = 'bg-destructive';

  if (score >= 100) {
    labelKey = 'passwordStrength.veryStrong';
    color = 'bg-success';
  } else if (score >= 80) {
    labelKey = 'passwordStrength.strong';
    color = 'bg-success';
  } else if (score >= 60) {
    labelKey = 'passwordStrength.good';
    color = 'bg-warning';
  } else if (score >= 40) {
    labelKey = 'passwordStrength.weak';
    color = 'bg-warning';
  }

  return { score, labelKey, color, requirements };
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const { t } = useLanguage();
  const { score, labelKey, color, requirements } = useMemo(
    () => getPasswordStrength(password),
    [password]
  );

  if (!password) return null;

  return (
    <div className="space-y-3">
      {/* Strength bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground">{t('passwordStrength.title')}</span>
          <span className={cn(
            "font-medium",
            score >= 80 ? "text-success" : score >= 60 ? "text-warning" : "text-destructive"
          )}>
            {t(labelKey)}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full transition-all duration-300 rounded-full", color)}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Requirements checklist */}
      <div className="grid gap-1.5">
        {requirements.map((req, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center gap-2 text-xs transition-colors",
              req.met ? "text-success" : "text-muted-foreground"
            )}
          >
            {req.met ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <X className="w-3.5 h-3.5" />
            )}
            <span>{t(req.labelKey)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
