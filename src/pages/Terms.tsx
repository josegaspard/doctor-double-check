import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Shield, FileText } from 'lucide-react';

export default function Terms() {
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
              <FileText className="w-8 h-8 text-primary" />
              <CardTitle className="text-2xl">Términos y Condiciones</CardTitle>
            </div>
            <p className="text-muted-foreground text-sm">
              Última actualización: Enero 2026
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <h2>1. Aceptación de los Términos</h2>
            <p>
              Al acceder y utilizar Dr Double Check, usted acepta estar sujeto a estos términos y condiciones de uso. 
              Si no está de acuerdo con alguna parte de estos términos, no podrá acceder al servicio.
            </p>

            <h2>2. Descripción del Servicio</h2>
            <p>
              Dr Double Check es una plataforma que conecta pacientes con profesionales médicos para consultas, 
              transmisiones en vivo educativas y acceso a contenido médico grabado. La plataforma no proporciona 
              diagnósticos médicos definitivos ni reemplaza la atención médica presencial.
            </p>

            <h2>3. Registro y Cuentas</h2>
            <p>
              Para utilizar ciertas funciones de la plataforma, debe crear una cuenta proporcionando información 
              precisa y completa. Usted es responsable de mantener la confidencialidad de su cuenta y contraseña.
            </p>

            <h2>4. Verificación de Profesionales</h2>
            <p>
              Los médicos y residentes que se registran en la plataforma deben proporcionar documentación válida 
              de sus credenciales profesionales. La verificación está sujeta a la aprobación de nuestro equipo 
              de administración.
            </p>

            <h2>5. Uso del Servicio</h2>
            <p>Usted acepta no:</p>
            <ul>
              <li>Utilizar el servicio para fines ilegales o no autorizados</li>
              <li>Compartir contenido ofensivo, difamatorio o fraudulento</li>
              <li>Intentar acceder a cuentas de otros usuarios</li>
              <li>Redistribuir contenido de pago sin autorización</li>
              <li>Proporcionar información médica falsa o engañosa</li>
            </ul>

            <h2>6. Pagos y Reembolsos</h2>
            <p>
              Los pagos se procesan a través de Stripe de forma segura. Los fondos agregados a la billetera 
              son no reembolsables excepto en casos excepcionales determinados por nuestro equipo de soporte.
            </p>

            <h2>7. Propiedad Intelectual</h2>
            <p>
              Todo el contenido de la plataforma, incluyendo grabaciones, materiales educativos y diseño, 
              está protegido por derechos de autor. El contenido de los profesionales pertenece a sus respectivos creadores.
            </p>

            <h2>8. Limitación de Responsabilidad</h2>
            <p>
              Dr Double Check no es responsable de las opiniones médicas expresadas por los profesionales 
              en la plataforma. Las consultas en línea son de carácter orientativo y no sustituyen 
              la atención médica presencial.
            </p>

            <h2>9. Privacidad</h2>
            <p>
              El tratamiento de sus datos personales se rige por nuestra Política de Privacidad. 
              Al usar la plataforma, usted consiente la recopilación y uso de información según lo descrito.
            </p>

            <h2>10. Modificaciones</h2>
            <p>
              Nos reservamos el derecho de modificar estos términos en cualquier momento. 
              Los cambios entrarán en vigor inmediatamente después de su publicación en la plataforma.
            </p>

            <h2>11. Contacto</h2>
            <p>
              Para cualquier consulta sobre estos términos, puede contactarnos a través de la plataforma 
              o enviando un correo electrónico a soporte@drdoublecheck.com
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
