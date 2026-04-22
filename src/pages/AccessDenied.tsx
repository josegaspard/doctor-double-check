import React from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldOff, ArrowLeft, Lock, Download, Eye } from 'lucide-react';

export default function AccessDenied() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const reason = params.get('reason') || 'protected';

  const messages: Record<string, { title: string; description: string }> = {
    role: {
      title: 'Acceso restringido',
      description:
        'Tu rol actual no tiene permiso para descargar o ver este contenido. Si crees que es un error, contacta a soporte.',
    },
    expired: {
      title: 'Tu acceso ha expirado',
      description:
        'El enlace o sesión que intentas usar ya caducó. Vuelve al contenido original y solicita un nuevo acceso.',
    },
    drm: {
      title: 'Descarga bloqueada',
      description:
        'Por motivos de confidencialidad médica y derechos de autor, las descargas directas están deshabilitadas. Puedes ver el contenido dentro de la plataforma cuantas veces quieras.',
    },
    protected: {
      title: 'Contenido protegido',
      description:
        'Este contenido está protegido por las políticas de confidencialidad médica de Medical Masters. Las descargas externas y compartidos directos están deshabilitados para proteger la información de pacientes y profesionales.',
    },
  };

  const m = messages[reason] || messages.protected;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-6 sm:p-10 text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldOff className="w-10 h-10 text-destructive" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{m.title}</h1>
              <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
                {m.description}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto pt-4">
              <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-left">
                <Lock className="w-5 h-5 text-primary mb-1" />
                <p className="text-xs font-medium text-foreground">Confidencial</p>
                <p className="text-[11px] text-muted-foreground">Datos médicos protegidos</p>
              </div>
              <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-left">
                <Download className="w-5 h-5 text-destructive mb-1" />
                <p className="text-xs font-medium text-foreground">Sin descargas</p>
                <p className="text-[11px] text-muted-foreground">Streaming-only por DRM</p>
              </div>
              <div className="p-3 rounded-lg bg-background/50 border border-border/50 text-left">
                <Eye className="w-5 h-5 text-info mb-1" />
                <p className="text-xs font-medium text-foreground">Vista ilimitada</p>
                <p className="text-[11px] text-muted-foreground">Re-visualiza desde la plataforma</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-4">
              <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Volver
              </Button>
              <Button asChild>
                <Link to="/help">Contactar soporte</Link>
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground pt-2">
              Política DRM Medical Masters · cumplimiento HIPAA-equivalente MX
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
