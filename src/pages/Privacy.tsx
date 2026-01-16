import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Shield, Lock } from 'lucide-react';

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-heading font-bold text-foreground">Dr Double Check</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Lock className="w-8 h-8 text-primary" />
              <CardTitle className="text-2xl">Política de Privacidad</CardTitle>
            </div>
            <p className="text-muted-foreground text-sm">
              Última actualización: Enero 2026
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <h2>1. Información que Recopilamos</h2>
            <p>Recopilamos información que usted nos proporciona directamente:</p>
            <ul>
              <li><strong>Información de cuenta:</strong> nombre, correo electrónico, contraseña</li>
              <li><strong>Información profesional:</strong> cédula profesional, especialidad, institución (para médicos y residentes)</li>
              <li><strong>Información de verificación:</strong> documentos de identidad para verificar cuentas</li>
              <li><strong>Información de pago:</strong> procesada de forma segura por Stripe</li>
              <li><strong>Archivos médicos:</strong> documentos que usted sube a su bóveda personal</li>
            </ul>

            <h2>2. Cómo Usamos su Información</h2>
            <p>Utilizamos la información recopilada para:</p>
            <ul>
              <li>Proporcionar, mantener y mejorar nuestros servicios</li>
              <li>Verificar la identidad de profesionales médicos</li>
              <li>Procesar transacciones y pagos</li>
              <li>Enviar notificaciones sobre lives, contenido nuevo y actualizaciones</li>
              <li>Responder a consultas y brindar soporte</li>
              <li>Proteger la seguridad de la plataforma y los usuarios</li>
            </ul>

            <h2>3. Protección de Información Médica</h2>
            <p>
              Los archivos médicos almacenados en la bóveda personal están protegidos con:
            </p>
            <ul>
              <li>Encriptación en tránsito y en reposo</li>
              <li>Acceso controlado solo para el propietario y médicos autorizados</li>
              <li>URLs firmadas temporales para acceso seguro</li>
              <li>Auditoría de accesos y permisos</li>
            </ul>

            <h2>4. Compartición de Información</h2>
            <p>
              No vendemos su información personal. Solo compartimos datos en los siguientes casos:
            </p>
            <ul>
              <li>Con su consentimiento explícito</li>
              <li>Con proveedores de servicios que nos ayudan a operar (Stripe para pagos, Resend para emails)</li>
              <li>Cuando sea requerido por ley</li>
              <li>Para proteger los derechos y seguridad de usuarios</li>
            </ul>

            <h2>5. Sus Derechos</h2>
            <p>Usted tiene derecho a:</p>
            <ul>
              <li>Acceder a sus datos personales</li>
              <li>Corregir información inexacta</li>
              <li>Solicitar la eliminación de su cuenta</li>
              <li>Revocar acceso de médicos a sus archivos</li>
              <li>Exportar sus datos en formato portátil</li>
              <li>Oponerse al procesamiento de sus datos</li>
            </ul>

            <h2>6. Retención de Datos</h2>
            <p>
              Conservamos su información mientras su cuenta esté activa o según sea necesario para:
            </p>
            <ul>
              <li>Cumplir con obligaciones legales</li>
              <li>Resolver disputas</li>
              <li>Mantener registros de transacciones</li>
            </ul>

            <h2>7. Seguridad</h2>
            <p>
              Implementamos medidas de seguridad técnicas y organizativas para proteger su información, 
              incluyendo:
            </p>
            <ul>
              <li>Encriptación SSL/TLS</li>
              <li>Autenticación segura</li>
              <li>Políticas de seguridad a nivel de fila (RLS) en la base de datos</li>
              <li>Monitoreo continuo de actividad sospechosa</li>
            </ul>

            <h2>8. Cookies y Tecnologías Similares</h2>
            <p>
              Utilizamos cookies y tecnologías similares para mantener sesiones de usuario, 
              recordar preferencias y mejorar la experiencia en la plataforma.
            </p>

            <h2>9. Menores de Edad</h2>
            <p>
              Nuestros servicios no están dirigidos a menores de 18 años. No recopilamos 
              intencionalmente información de menores.
            </p>

            <h2>10. Cambios a esta Política</h2>
            <p>
              Podemos actualizar esta política periódicamente. Le notificaremos sobre cambios 
              significativos a través de la plataforma o por correo electrónico.
            </p>

            <h2>11. Contacto</h2>
            <p>
              Para ejercer sus derechos o realizar consultas sobre privacidad, contáctenos en: 
              privacidad@drdoublecheck.com
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
