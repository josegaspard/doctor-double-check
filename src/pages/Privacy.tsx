import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Lock, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import MainLayout from '@/components/layout/MainLayout';
import DOMPurify from 'dompurify';

interface LegalContent {
  content: string;
  lastUpdated: string | null;
}

export default function Privacy() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [customContent, setCustomContent] = useState<string | null>(null);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'privacy_policy')
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
## 1. Información que Recopilamos

Recopilamos información que usted nos proporciona directamente:

- **Información de cuenta:** nombre, correo electrónico, contraseña
- **Información profesional:** cédula profesional, especialidad, institución (para médicos y residentes)
- **Información de verificación:** documentos de identidad para verificar cuentas
- **Información de pago:** procesada de forma segura por Stripe
- **Archivos médicos:** documentos que usted sube a su bóveda personal

## 2. Cómo Usamos su Información

Utilizamos la información recopilada para:

- Proporcionar, mantener y mejorar nuestros servicios
- Verificar la identidad de profesionales médicos
- Procesar transacciones y pagos
- Enviar notificaciones sobre lives, contenido nuevo y actualizaciones
- Responder a consultas y brindar soporte
- Proteger la seguridad de la plataforma y los usuarios

## 3. Protección de Información Médica

Los archivos médicos almacenados en la bóveda personal están protegidos con:

- Encriptación en tránsito y en reposo
- Acceso controlado solo para el propietario y médicos autorizados
- URLs firmadas temporales para acceso seguro
- Auditoría de accesos y permisos

## 4. Compartición de Información

No vendemos su información personal. Solo compartimos datos en los siguientes casos:

- Con su consentimiento explícito
- Con proveedores de servicios que nos ayudan a operar (Stripe para pagos, Resend para emails)
- Cuando sea requerido por ley
- Para proteger los derechos y seguridad de usuarios

## 5. Sus Derechos

Usted tiene derecho a:

- Acceder a sus datos personales
- Corregir información inexacta
- Solicitar la eliminación de su cuenta
- Revocar acceso de médicos a sus archivos
- Exportar sus datos en formato portátil
- Oponerse al procesamiento de sus datos

## 6. Retención de Datos

Conservamos su información mientras su cuenta esté activa o según sea necesario para:

- Cumplir con obligaciones legales
- Resolver disputas
- Mantener registros de transacciones

## 7. Seguridad

Implementamos medidas de seguridad técnicas y organizativas para proteger su información, incluyendo:

- Encriptación SSL/TLS
- Autenticación segura
- Políticas de seguridad a nivel de fila (RLS) en la base de datos
- Monitoreo continuo de actividad sospechosa

## 8. Cookies y Tecnologías Similares

Utilizamos cookies y tecnologías similares para mantener sesiones de usuario, recordar preferencias y mejorar la experiencia en la plataforma.

## 9. Menores de Edad

Nuestros servicios no están dirigidos a menores de 18 años. No recopilamos intencionalmente información de menores.

## 10. Cambios a esta Política

Podemos actualizar esta política periódicamente. Le notificaremos sobre cambios significativos a través de la plataforma o por correo electrónico.

## 11. Contacto

Para ejercer sus derechos o realizar consultas sobre privacidad, contáctenos en: privacidad@medicalmasters.com
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
              <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
              <CardTitle className="text-lg sm:text-xl">
                {t('autoI18n.privacy1')}
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('autoI18n.privacy2')}
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