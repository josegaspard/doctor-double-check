import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Scale, FileText, Globe, Building, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import DOMPurify from 'dompurify';

const complianceAreas = [
  {
    icon: FileText,
    title: 'HIPAA',
    region: 'Estados Unidos',
    description: 'Cumplimiento total con la Ley de Portabilidad y Responsabilidad del Seguro Médico para la protección de información de salud.',
  },
  {
    icon: Globe,
    title: 'GDPR',
    region: 'Unión Europea',
    description: 'Adherencia al Reglamento General de Protección de Datos para usuarios europeos.',
  },
  {
    icon: Building,
    title: 'NOM-024-SSA3',
    region: 'México',
    description: 'Cumplimiento con la Norma Oficial Mexicana para sistemas de información en salud.',
  },
  {
    icon: Scale,
    title: 'SOC 2 Tipo II',
    region: 'Global',
    description: 'Certificación de controles de seguridad, disponibilidad y confidencialidad.',
  },
];

const policies = [
  { title: 'Política de Privacidad', link: '/privacy', description: 'Cómo recopilamos y usamos tus datos' },
  { title: 'Términos de Servicio', link: '/terms', description: 'Condiciones de uso de la plataforma' },
  { title: 'Política de Cookies', link: '/privacy', description: 'Uso de cookies y tecnologías similares' },
  { title: 'Política de Seguridad', link: '/security', description: 'Medidas de protección implementadas' },
];

export default function Compliance() {
  // Sobrescribible desde /admin/site-settings (pestaña Páginas).
  const [customContent, setCustomContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.from('site_settings').select('value').eq('id', 'compliance_policy').maybeSingle()
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
              <CardTitle className="text-lg sm:text-xl">Cumplimiento</CardTitle>
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
              <Scale className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-light" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-light">Compliance</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              Cumplimiento <span className="text-transparent bg-clip-text bg-gradient-to-r from-light to-white">Normativo</span>
            </h1>
            <p className="text-sm sm:text-lg text-light/90 max-w-xl mx-auto px-4">
              Nos adherimos a los más altos estándares regulatorios en cada jurisdicción donde operamos.
            </p>
          </div>
        </div>
      </header>

      {/* Compliance Areas */}
      <section className="py-12 sm:py-20 bg-background">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-3xl font-bold text-center text-foreground mb-8 sm:mb-12">
            Áreas de Cumplimiento
          </h2>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
            {complianceAreas.map((area, index) => (
              <div key={index} className="bg-card p-5 sm:p-7 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-md">
                    <area.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] sm:text-xs font-semibold text-primary">Cumple</span>
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1">{area.title}</h3>
                <p className="text-xs sm:text-sm text-primary font-medium mb-2 sm:mb-3">{area.region}</p>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{area.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Policies */}
      <section className="py-12 sm:py-20 bg-card">
        <div className="container mx-auto px-4 sm:px-6">
          <h2 className="text-xl sm:text-3xl font-bold text-center text-foreground mb-8 sm:mb-12">
            Políticas y Documentación
          </h2>

          <div className="grid sm:grid-cols-2 gap-3 sm:gap-4 max-w-3xl mx-auto">
            {policies.map((policy, index) => (
              <Link
                key={index}
                to={policy.link}
                className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 bg-primary/5 border border-primary/15 rounded-xl hover:bg-primary/10 hover:border-primary/30 transition-colors group"
              >
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/25 transition-colors">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm sm:text-base">{policy.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">{policy.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Reporting */}
      <section className="py-12 sm:py-20 bg-background">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mx-auto text-center bg-card rounded-2xl p-6 sm:p-10 border border-border shadow-sm">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-md">
              <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <h2 className="text-xl sm:text-3xl font-bold text-foreground mb-3 sm:mb-4">
              Reportar una Preocupación
            </h2>
            <p className="text-muted-foreground mb-6 sm:mb-8 text-sm sm:text-base leading-relaxed">
              Si tienes alguna preocupación sobre el cumplimiento normativo o deseas reportar una posible violación,
              nuestro equipo de compliance está disponible para ayudarte de manera confidencial.
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-bold text-white bg-gradient-to-r from-primary to-secondary rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              Contactar Compliance
            </Link>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
