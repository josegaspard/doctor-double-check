import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, Eye, Server, CheckCircle, Key, FileCheck, Loader2 } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import DOMPurify from 'dompurify';
import { useLanguage } from '@/contexts/LanguageContext';

const securityFeatures = [
  {
    icon: Lock,
    title: 'Encriptación de Extremo a Extremo',
    description: 'Todos los datos se encriptan usando AES-256, el estándar de encriptación más seguro utilizado por instituciones financieras y gobiernos.',
  },
  {
    icon: Shield,
    title: 'Cumplimiento HIPAA',
    description: 'Cumplimos con todas las regulaciones de la Ley de Portabilidad y Responsabilidad del Seguro Médico (HIPAA) para proteger tu información de salud.',
  },
  {
    icon: Eye,
    title: 'Privacidad por Diseño',
    description: 'La privacidad está integrada en cada aspecto de nuestra plataforma, desde el desarrollo hasta la implementación.',
  },
  {
    icon: Server,
    title: 'Infraestructura Segura',
    description: 'Nuestros servidores están alojados en centros de datos certificados SOC 2 Tipo II con redundancia geográfica.',
  },
  {
    icon: Key,
    title: 'Autenticación Multifactor',
    description: 'Protección adicional con verificación en dos pasos para todas las cuentas de usuario y acceso administrativo.',
  },
  {
    icon: FileCheck,
    title: 'Auditorías Regulares',
    description: 'Realizamos auditorías de seguridad trimestrales y pruebas de penetración por terceros independientes.',
  },
];

const certifications = [
  { name: 'HIPAA', description: 'Health Insurance Portability and Accountability Act' },
  { name: 'SOC 2', description: 'Service Organization Control Type II' },
  { name: 'ISO 27001', description: 'Information Security Management' },
  { name: 'GDPR', description: 'General Data Protection Regulation' },
];

export default function Security() {
  const { t } = useLanguage();
  // El superadministrador puede sobrescribir esta página desde
  // /admin/site-settings (pestaña Páginas). Si no, se muestra el contenido
  // por defecto de abajo.
  const [customContent, setCustomContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.from('site_settings').select('value').eq('id', 'security_policy').maybeSingle()
      .then(({ data }) => {
        const c = (data?.value as { content?: string } | null)?.content;
        if (c && c.trim()) setCustomContent(c);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (customContent) {
    return (
      <MainLayout>
        <main className="container mx-auto px-3 sm:px-4 pt-8 sm:pt-14 pb-8 sm:pb-12 max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">{t('fix20.pages.securityTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(customContent) }} />
            </CardContent>
          </Card>
        </main>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Hero */}
      <header className="relative pt-20 sm:pt-28 pb-12 sm:pb-20 bg-gradient-to-br from-secondary via-primary to-secondary overflow-hidden">
        <div aria-hidden className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-light/20 blur-3xl" />
        <div aria-hidden className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-12 relative">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-4 sm:mb-6">
              <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-light" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-light">{t('fix20.pages.securityTitle')}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              {t('fix20.pages.securityHeroTitle')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-light to-white">{t('fix20.pages.securityHeroTitleHighlight')}</span>
            </h1>
            <p className="text-sm sm:text-lg text-light/90 max-w-xl mx-auto px-4">
              {t('fix20.pages.securityHeroSubtitle')}
            </p>
          </div>
        </div>
      </header>

      {/* Security Features */}
      <section className="py-12 sm:py-20 bg-background">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {securityFeatures.map((feature, index) => (
              <div key={index} className="bg-card p-5 sm:p-7 rounded-2xl border border-border shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4 sm:mb-5 shadow-md">
                  <feature.icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-12 sm:py-20 bg-card">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-3xl font-bold text-center text-foreground mb-8 sm:mb-12">
            {t('fix20.pages.securityCertificationsTitle')}
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 max-w-4xl mx-auto">
            {certifications.map((cert, index) => (
              <div key={index} className="bg-primary/5 border border-primary/15 p-4 sm:p-6 rounded-2xl text-center hover:bg-primary/10 transition-colors">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-3 shadow-md">
                  <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <h3 className="font-bold text-foreground text-sm sm:text-lg">{cert.name}</h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{cert.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commitment */}
      <section className="py-12 sm:py-20 bg-gradient-to-br from-secondary to-primary">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">{t('fix20.pages.securityCommitmentTitle')}</h2>
          <p className="text-light/90 mb-6 sm:mb-8 max-w-2xl mx-auto text-sm sm:text-base">
            {t('fix20.pages.securityCommitmentDesc')}
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-primary bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            {t('fix20.pages.securityContactBtn')}
          </Link>
        </div>
      </section>
    </MainLayout>
  );
}
