import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import MainLayout from '@/components/layout/MainLayout';
import { DmcaBadge } from '@/components/layout/DmcaBadge';
import DOMPurify from 'dompurify';

interface LegalContent {
  content: string;
  lastUpdated: string | null;
}

const TITLE: Record<string, string> = {
  es: 'Política de DMCA y Derechos de Autor',
  en: 'DMCA & Copyright Policy',
  pt: 'Política de DMCA e Direitos Autorais',
  fr: 'Politique DMCA et droits d’auteur',
  it: 'Politica DMCA e diritti d’autore',
  de: 'DMCA- und Urheberrechtsrichtlinie',
  ca: 'Política de DMCA i drets d’autor',
};

const SUBTITLE: Record<string, string> = {
  es: 'Cómo notificar y atender infracciones de derechos de autor en Medical Masters.',
  en: 'How to report and handle copyright infringement on Medical Masters.',
  pt: 'Como notificar e tratar violações de direitos autorais no Medical Masters.',
  fr: 'Comment signaler et traiter les atteintes au droit d’auteur sur Medical Masters.',
  it: 'Come segnalare e gestire le violazioni del copyright su Medical Masters.',
  de: 'So melden und bearbeiten wir Urheberrechtsverletzungen auf Medical Masters.',
  ca: 'Com notificar i atendre infraccions de drets d’autor a Medical Masters.',
};

const CONTACT = 'contacto@medical-masters.com';

const CONTENT_ES = `
## 1. Compromiso con los derechos de autor

Medical Masters respeta la propiedad intelectual de terceros y espera que sus usuarios hagan lo mismo. Atendemos las notificaciones de presunta infracción de derechos de autor de conformidad con la **Digital Millennium Copyright Act (DMCA), 17 U.S.C. § 512**, y con la legislación aplicable. Esta plataforma cuenta con protección de contenido a través de DMCA.com.

## 2. Cómo enviar una notificación de retiro (takedown)

Si usted es titular de derechos de autor —o actúa en su representación— y considera que algún contenido alojado en Medical Masters infringe sus derechos, envíe una notificación por escrito a nuestro agente designado que incluya, conforme al § 512(c)(3):

- Una firma física o electrónica del titular del derecho o de la persona autorizada para actuar en su nombre.
- La identificación de la obra protegida que se alega infringida.
- La identificación del material presuntamente infractor, con información suficiente para localizarlo (por ejemplo, la URL exacta dentro de la plataforma).
- Sus datos de contacto: nombre completo, dirección, teléfono y correo electrónico.
- Una declaración de que usted cree de buena fe que el uso del material no está autorizado por el titular, su agente o la ley.
- Una declaración, bajo pena de perjurio, de que la información de la notificación es exacta y de que usted es el titular del derecho o está autorizado para actuar en su nombre.

## 3. Agente designado

Envíe su notificación a: **${CONTACT}** (asunto: "Notificación DMCA"). Procesaremos las solicitudes válidas y, cuando corresponda, retiraremos o inhabilitaremos el acceso al material señalado.

## 4. Contranotificación

Si usted considera que su contenido fue retirado por error o por una identificación equivocada, puede enviar una contranotificación a **${CONTACT}** que incluya su firma, la identificación del material retirado y su ubicación anterior, una declaración bajo pena de perjurio de que cree de buena fe que el retiro fue un error, y su consentimiento a la jurisdicción correspondiente.

## 5. Infractores reincidentes

De acuerdo con nuestra política, podremos suspender o cancelar las cuentas de usuarios que sean infractores reincidentes de derechos de autor.

## 6. Buena fe y abuso

Las notificaciones falsas o presentadas de mala fe pueden generar responsabilidad. Asegúrese de que su reclamo es legítimo antes de enviarlo.
`.trim();

const CONTENT_EN = `
## 1. Commitment to copyright

Medical Masters respects the intellectual property of others and expects its users to do the same. We respond to notices of alleged copyright infringement in accordance with the **Digital Millennium Copyright Act (DMCA), 17 U.S.C. § 512**, and applicable law. This platform is content-protected through DMCA.com.

## 2. How to submit a takedown notice

If you are a copyright owner —or are authorized to act on their behalf— and believe that content hosted on Medical Masters infringes your rights, send a written notice to our designated agent including, per § 512(c)(3):

- A physical or electronic signature of the copyright owner or a person authorized to act on their behalf.
- Identification of the copyrighted work claimed to have been infringed.
- Identification of the allegedly infringing material, with enough information to locate it (for example, the exact URL within the platform).
- Your contact details: full name, address, phone number and email.
- A statement that you have a good-faith belief that the use of the material is not authorized by the owner, its agent, or the law.
- A statement, under penalty of perjury, that the information in the notice is accurate and that you are the copyright owner or authorized to act on their behalf.

## 3. Designated agent

Send your notice to: **${CONTACT}** (subject: "DMCA Notice"). We will process valid requests and, where appropriate, remove or disable access to the identified material.

## 4. Counter-notification

If you believe your content was removed by mistake or misidentification, you may send a counter-notification to **${CONTACT}** including your signature, identification of the removed material and its prior location, a statement under penalty of perjury that you have a good-faith belief the removal was a mistake, and your consent to the applicable jurisdiction.

## 5. Repeat infringers

In accordance with our policy, we may suspend or terminate the accounts of users who are repeat copyright infringers.

## 6. Good faith and abuse

False or bad-faith notices may result in liability. Please make sure your claim is legitimate before submitting it.
`.trim();

function renderMarkdown(md: string): string {
  const html = md
    .replace(/\n/g, '<br/>')
    .replace(/## /g, '<h2 class="text-base font-semibold mt-6 mb-2">')
    .replace(/<br\/><h2/g, '</h2><h2')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/- /g, '• ');
  return DOMPurify.sanitize(html);
}

export default function Dmca() {
  const { language } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [customContent, setCustomContent] = useState<string | null>(null);

  const lang = String(language);
  const title = TITLE[lang] ?? TITLE.en;
  const subtitle = SUBTITLE[lang] ?? SUBTITLE.en;
  const defaultContent = lang === 'es' ? CONTENT_ES : CONTENT_EN;

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'dmca_policy')
          .single();

        if (data?.value) {
          const content = data.value as unknown as LegalContent;
          if (content.content && content.content.trim()) {
            setCustomContent(content.content);
          }
        }
      } catch {
        // Use default content
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, []);

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
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
                <CardTitle className="text-lg sm:text-xl">{title}</CardTitle>
              </div>
              <DmcaBadge className="hidden sm:inline-flex" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
            <div
              dangerouslySetInnerHTML={{
                __html: customContent ? DOMPurify.sanitize(customContent) : renderMarkdown(defaultContent),
              }}
            />
          </CardContent>
        </Card>
      </main>
    </MainLayout>
  );
}
