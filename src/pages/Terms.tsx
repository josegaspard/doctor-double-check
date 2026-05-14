import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import MainLayout from '@/components/layout/MainLayout';
import DOMPurify from 'dompurify';

interface LegalContent {
  content: string;
  lastUpdated: string | null;
}

export default function Terms() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [customContent, setCustomContent] = useState<string | null>(null);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'terms_of_service')
          .single();

        if (data?.value) {
          const content = data.value as unknown as LegalContent;
          if (content.content && content.content.trim()) {
            setCustomContent(content.content);
          }
        }
      } catch (error) {
        // Use default content
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, []);

  const defaultContent = `
## 1. Aceptación de los Términos

Al acceder y utilizar Medical Masters, usted acepta estar sujeto a estos términos y condiciones de uso. Si no está de acuerdo con alguna parte de estos términos, no podrá acceder al servicio.

## 2. Descripción del Servicio

Medical Masters es una plataforma que conecta pacientes con profesionales médicos para consultas, transmisiones en vivo educativas y acceso a contenido médico grabado. La plataforma no proporciona diagnósticos médicos definitivos ni reemplaza la atención médica presencial.

## 3. Registro y Cuentas

Para utilizar ciertas funciones de la plataforma, debe crear una cuenta proporcionando información precisa y completa. Usted es responsable de mantener la confidencialidad de su cuenta y contraseña.

## 4. Verificación de Profesionales

Los médicos y residentes que se registran en la plataforma deben proporcionar documentación válida de sus credenciales profesionales. La verificación está sujeta a la aprobación de nuestro equipo de administración.

## 5. Uso del Servicio

Usted acepta no:

- Utilizar el servicio para fines ilegales o no autorizados
- Compartir contenido ofensivo, difamatorio o fraudulento
- Intentar acceder a cuentas de otros usuarios
- Redistribuir contenido de pago sin autorización
- Proporcionar información médica falsa o engañosa

## 6. Pagos y Reembolsos

Los pagos se procesan a través de Stripe de forma segura. Los fondos agregados a la billetera son no reembolsables excepto en casos excepcionales determinados por nuestro equipo de soporte.

## 7. Propiedad Intelectual

Todo el contenido de la plataforma, incluyendo grabaciones, materiales educativos y diseño, está protegido por derechos de autor. El contenido de los profesionales pertenece a sus respectivos creadores.

## 8. Limitación de Responsabilidad

Medical Masters no es responsable de las opiniones médicas expresadas por los profesionales en la plataforma. Las consultas en línea son de carácter orientativo y no sustituyen la atención médica presencial.

## 9. Privacidad

El tratamiento de sus datos personales se rige por nuestra Política de Privacidad. Al usar la plataforma, usted consiente la recopilación y uso de información según lo descrito.

## 10. Modificaciones

Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios entrarán en vigor inmediatamente después de su publicación en la plataforma.

## 11. Contacto

Para cualquier consulta sobre estos términos, puede contactarnos a través de la plataforma o enviando un correo electrónico a soporte@medicalmasters.com
  `.trim();

  if (isLoading) {
    return (
      <MainLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <main className="container mx-auto px-3 sm:px-4 pt-8 sm:pt-14 pb-8 sm:pb-12 max-w-3xl">
        <Card>
          <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
              <CardTitle className="text-lg sm:text-xl">
                {language === 'es' ? 'Términos y Condiciones' : 'Terms & Conditions'}
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {language === 'es' ? 'Última actualización: Enero 2026' : 'Last updated: January 2026'}
            </p>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
            {customContent ? (
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(customContent) }} />
            ) : (
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(defaultContent.replace(/\n/g, '<br/>').replace(/## /g, '<h2 class="text-base font-semibold mt-6 mb-2">').replace(/<br\/><h2/g, '</h2><h2').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/- /g, '• ')) }} />
            )}
          </CardContent>
        </Card>
      </main>
    </MainLayout>
  );
}