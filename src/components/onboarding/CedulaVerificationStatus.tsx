import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Shield, 
  Loader2,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type CedulaStatus = 'empty' | 'invalid' | 'valid_pending' | 'verified' | 'checking';

interface CedulaVerificationStatusProps {
  status: CedulaStatus;
  cedula: string;
  className?: string;
}

const statusConfig = {
  empty: {
    icon: Info,
    label: 'Ingresa tu cédula',
    description: 'Debe contener 7-8 dígitos numéricos',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    borderColor: 'border-muted',
  },
  invalid: {
    icon: AlertCircle,
    label: 'Formato inválido',
    description: 'La cédula debe tener 7-8 dígitos',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/30',
  },
  valid_pending: {
    icon: Clock,
    label: 'Pendiente de verificación',
    description: 'Será verificada por un administrador',
    color: 'text-warning dark:text-warning',
    bgColor: 'bg-warning dark:bg-warning/30',
    borderColor: 'border-warning dark:border-warning',
  },
  verified: {
    icon: CheckCircle2,
    label: 'Cédula verificada',
    description: 'Verificada en el Registro Nacional',
    color: 'text-success dark:text-success',
    bgColor: 'bg-success dark:bg-success/30',
    borderColor: 'border-success dark:border-success',
  },
  checking: {
    icon: Loader2,
    label: 'Verificando formato...',
    description: 'Validando número de cédula',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/30',
  },
};

export const CedulaVerificationStatus: React.FC<CedulaVerificationStatusProps> = ({
  status,
  cedula,
  className,
}) => {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, y: -5, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 5, scale: 0.98 }}
        transition={{ 
          type: "spring", 
          stiffness: 500, 
          damping: 30 
        }}
        className={cn(
          "rounded-lg border p-3 transition-colors",
          config.bgColor,
          config.borderColor,
          className
        )}
      >
        <div className="flex items-start gap-3">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ 
              type: "spring", 
              stiffness: 400, 
              damping: 20,
              delay: 0.1 
            }}
            className={cn(
              "mt-0.5 flex-shrink-0",
              config.color
            )}
          >
            <Icon className={cn(
              "w-5 h-5",
              status === 'checking' && "animate-spin"
            )} />
          </motion.div>
          <div className="flex-1 min-w-0">
            <motion.p 
              className={cn("font-medium text-sm", config.color)}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 }}
            >
              {config.label}
            </motion.p>
            <motion.p 
              className="text-xs text-muted-foreground mt-0.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              {config.description}
            </motion.p>
            
            {/* Show cedula number when valid */}
            {(status === 'valid_pending' || status === 'verified') && cedula && (
              <motion.div 
                className="mt-2 flex items-center gap-2"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/80 border border-border/50">
                  <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-mono font-medium text-foreground">
                    {cedula}
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Additional info for pending verification */}
        {status === 'valid_pending' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ delay: 0.2 }}
            className="mt-3 pt-3 border-t border-warning dark:border-warning/50"
          >
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-warning dark:text-warning mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tu cédula será verificada manualmente por nuestro equipo contra el 
                <span className="font-medium text-foreground"> Registro Nacional de Profesionistas</span>. 
                Este proceso puede tomar 1-3 días hábiles.
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

// Hook to determine cedula status
export function useCedulaStatus(cedula: string): CedulaStatus {
  const trimmed = cedula.trim();
  
  if (!trimmed) return 'empty';
  
  // Check if only contains digits
  if (!/^\d*$/.test(trimmed)) return 'invalid';
  
  // Check length (7-8 digits for Mexican cédula)
  if (trimmed.length < 7) return 'invalid';
  if (trimmed.length > 8) return 'invalid';
  
  // Valid format - pending admin verification
  return 'valid_pending';
}
