import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Scale, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import MainLayout from '@/components/layout/MainLayout';
import DOMPurify from 'dompurify';

interface LegalContent {
  content: string;
  lastUpdated: string | null;
}

export default function CodigoEtica() {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [customContent, setCustomContent] = useState<string | null>(null);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        // El superadministrador puede sobrescribir el contenido desde
        // /admin/site-settings (site_settings → code_of_ethics).
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'code_of_ethics')
          .single();

        if (data?.value) {
          const content = data.value as unknown as LegalContent;
          if (content.content && content.content.trim()) {
            setCustomContent(content.content);
          }
        }
      } catch (error) {
        // Usar contenido por defecto
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, []);

  const defaultContent = `
## Compromiso ético del médico en Medical Masters

Como profesional de la salud registrado en Medical Masters, me comprometo a ejercer mi actividad en la plataforma conforme a los más altos estándares éticos de la profesión médica.

## 1. Respeto y dignidad del paciente

Trataré a cada paciente con respeto, empatía y sin discriminación por motivos de origen, género, religión, condición social, orientación o estado de salud. Respetaré su autonomía y su derecho a la información.

## 2. Confidencialidad y secreto profesional

Guardaré estricta confidencialidad sobre toda la información clínica y personal a la que tenga acceso. No divulgaré, compartiré ni utilizaré datos de los pacientes fuera del contexto asistencial autorizado.

## 3. Veracidad de credenciales

Declaro que la información profesional, cédula, especialidad y experiencia que proporciono es verídica y vigente. Entiendo que la falsedad en mis credenciales es causa de baja inmediata y de las responsabilidades legales que correspondan.

## 4. Competencia y límites de la práctica

Brindaré orientación únicamente dentro de mi área de competencia. Reconozco que las consultas en línea son de carácter orientativo y que recomendaré atención presencial cuando el caso lo requiera.

## 5. Honestidad clínica

No ofreceré diagnósticos, tratamientos ni promesas de resultados sin sustento científico. No promoveré productos, fármacos ni servicios con fines engañosos.

## 6. Relación profesional adecuada

Mantendré en todo momento una relación profesional con pacientes y colegas, libre de acoso, conflictos de interés indebidos o conductas que vulneren la confianza depositada en la plataforma.

## 7. Integridad del contenido

El contenido educativo, transmisiones y materiales que publique serán propios o debidamente acreditados, veraces y con fines formativos o informativos legítimos.

## 8. Colaboración y respeto entre colegas

Trataré a los demás profesionales, residentes y al personal de la plataforma con respeto. Las segundas opiniones y discusiones de caso se realizarán de forma constructiva y profesional.

## 9. Cumplimiento normativo

Cumpliré la legislación sanitaria y de protección de datos aplicable, así como los Términos y Condiciones y la Política de Privacidad de Medical Masters.

## 10. Aceptación

Entiendo que la aceptación de este Código de Ética es requisito indispensable para ingresar y operar como médico en Medical Masters, y que su incumplimiento puede dar lugar a la suspensión o cancelación de mi cuenta.
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
              <Scale className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
              <CardTitle className="text-lg sm:text-xl">
                {t('codeOfEthics.title')}
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('codeOfEthics.subtitle')}
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
