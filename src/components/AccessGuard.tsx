import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Lock, LogIn, UserPlus } from 'lucide-react';

interface AccessGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  requiresEntitlement?: 'chat' | 'recordings';
  fallbackMessage?: string;
  fallbackType?: 'login' | 'upgrade' | 'forbidden';
}

export default function AccessGuard({
  children,
  allowedRoles,
  requiresEntitlement,
  fallbackMessage,
  fallbackType = 'login',
}: AccessGuardProps) {
  const { user, role, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Check role access
  const hasRoleAccess = role && allowedRoles.includes(role);

  // Check entitlement if required
  let hasEntitlement = true;
  if (requiresEntitlement && user) {
    if (requiresEntitlement === 'chat') {
      hasEntitlement = (user as any)?.entitlements?.chat === true;
    } else if (requiresEntitlement === 'recordings') {
      // Recordings require either being a paying role or having purchased
      hasEntitlement = role === 'doctor' || role === 'admin';
    }
  }

  if (!hasRoleAccess || !hasEntitlement) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              {fallbackType === 'login' ? (
                <Lock className="w-8 h-8 text-muted-foreground" />
              ) : fallbackType === 'upgrade' ? (
                <Shield className="w-8 h-8 text-premium" />
              ) : (
                <Lock className="w-8 h-8 text-destructive" />
              )}
            </div>
            
            <h2 className="font-heading text-xl font-bold text-foreground mb-2">
              {fallbackType === 'login' && 'Inicia sesión para continuar'}
              {fallbackType === 'upgrade' && 'Contenido Premium'}
              {fallbackType === 'forbidden' && 'Acceso Restringido'}
            </h2>
            
            <p className="text-muted-foreground mb-6">
              {fallbackMessage || (
                fallbackType === 'login'
                  ? 'Necesitas una cuenta para acceder a esta sección.'
                  : fallbackType === 'upgrade'
                  ? 'Adquiere este contenido para acceder.'
                  : 'No tienes permisos para ver esta sección.'
              )}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {fallbackType === 'login' && (
                <>
                  <Button onClick={() => navigate('/login')} className="gap-2">
                    <LogIn className="w-4 h-4" />
                    Iniciar Sesión
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/login')}
                    className="gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    Registrarse
                  </Button>
                </>
              )}
              {fallbackType === 'upgrade' && (
                <Button onClick={() => navigate('/wallet')} className="gap-2">
                  <Shield className="w-4 h-4" />
                  Ver Opciones
                </Button>
              )}
              <Button variant="ghost" onClick={() => navigate('/lives')}>
                Ir a Lives
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
