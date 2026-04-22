import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Clock, CheckCircle, ArrowRight, Home, Eye } from 'lucide-react';
import { AppBackground } from '@/components/layout/AppBackground';

export default function VerificationPending() {
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();

  const isPending = (role === 'doctor' && user?.doctorProfile?.status === 'pending') ||
                   (role === 'resident' && user?.residentProfile?.status === 'pending');

  const isApproved = (role === 'doctor' && user?.doctorProfile?.status === 'approved') ||
                    (role === 'resident' && user?.residentProfile?.status === 'approved');

  if (isApproved) {
    return (
      <AppBackground className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-success/30 bg-success/5">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <CardTitle className="text-2xl">¡Cuenta Aprobada!</CardTitle>
            <CardDescription>
              Tu cuenta ha sido verificada. Ya puedes acceder a todas las funciones.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" onClick={() => navigate('/doctor/dashboard')}>
              Ir a mi Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </AppBackground>
    );
  }

  return (
    <AppBackground className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-warning/20 flex items-center justify-center">
            <Clock className="w-8 h-8 text-warning" />
          </div>
          <CardTitle className="text-2xl">Verificación Pendiente</CardTitle>
          <CardDescription>
            Tu solicitud de registro como {role === 'doctor' ? 'médico' : 'residente'} está siendo revisada por nuestro equipo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Revisión de credenciales</p>
                <p className="text-xs text-muted-foreground">
                  Verificamos tu cédula profesional y documentación
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-warning mt-0.5" />
              <div>
                <p className="font-medium text-sm">Tiempo estimado: 24-48 horas</p>
                <p className="text-xs text-muted-foreground">
                  Te notificaremos por email cuando tu cuenta sea aprobada
                </p>
              </div>
            </div>
          </div>

          {/* While you wait */}
          <div>
            <p className="text-sm font-medium mb-3">Mientras tanto puedes:</p>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={() => navigate('/lives')}
              >
                <Eye className="w-4 h-4" />
                Explorar lives como visitante
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={() => navigate('/recordings')}
              >
                <Home className="w-4 h-4" />
                Ver grabaciones disponibles
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="ghost" className="flex-1" onClick={() => navigate('/')}>
              Volver al inicio
            </Button>
            <Button variant="outline" className="flex-1" onClick={logout}>
              Cerrar sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </AppBackground>
  );
}
