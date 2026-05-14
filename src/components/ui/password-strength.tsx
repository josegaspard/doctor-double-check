import React, { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthProps {
  password: string;
}

interface PasswordRequirement {
  label: string;
  met: boolean;
}

export function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
  requirements: PasswordRequirement[];
} {
  const requirements: PasswordRequirement[] = [
    { label: 'Al menos 12 caracteres', met: password.length >= 12 },
    { label: 'Una letra minúscula', met: /[a-z]/.test(password) },
    { label: 'Una letra mayúscula', met: /[A-Z]/.test(password) },
    { label: 'Un número', met: /[0-9]/.test(password) },
    { label: 'Un carácter especial (!@#$%)', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ];

  const metCount = requirements.filter(r => r.met).length;
  const score = (metCount / requirements.length) * 100;

  let label = 'Muy débil';
  let color = 'bg-destructive';

  if (score >= 100) {
    label = 'Muy fuerte';
    color = 'bg-success';
  } else if (score >= 80) {
    label = 'Fuerte';
    color = 'bg-success';
  } else if (score >= 60) {
    label = 'Buena';
    color = 'bg-warning';
  } else if (score >= 40) {
    label = 'Débil';
    color = 'bg-warning';
  }

  return { score, label, color, requirements };
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const { score, label, color, requirements } = useMemo(
    () => getPasswordStrength(password),
    [password]
  );

  if (!password) return null;

  return (
    <div className="space-y-3">
      {/* Strength bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground">Fortaleza:</span>
          <span className={cn(
            "font-medium",
            score >= 80 ? "text-success" : score >= 60 ? "text-warning" : "text-destructive"
          )}>
            {label}
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
            <span>{req.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
