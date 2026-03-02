import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Users,
  UserCheck,
  Stethoscope,
  GraduationCap,
  FileCheck,
  ArrowRight,
  LayoutDashboard,
  Loader2,
  Settings,
  RefreshCcw,
  Banknote,
  FileText,
  Newspaper,
  ShieldCheck,
  Flag,
} from 'lucide-react';

interface AdminModule {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: React.ElementType;
  href: string;
  color: string;
}

const adminModules: AdminModule[] = [
  { id: 'analytics', titleKey: 'admin.analytics', descriptionKey: 'admin.analytics', icon: LayoutDashboard, href: '/admin/analytics', color: 'text-primary' },
  { id: 'payouts', titleKey: 'admin.payouts', descriptionKey: 'admin.payouts', icon: Banknote, href: '/admin/payouts', color: 'text-success' },
  { id: 'invoice-review', titleKey: 'admin.invoiceReview', descriptionKey: 'admin.invoiceReview', icon: FileText, href: '/admin/invoices', color: 'text-secondary' },
  { id: 'payout-settings', titleKey: 'admin.payoutSettings', descriptionKey: 'admin.payoutSettings', icon: Settings, href: '/admin/payout-settings', color: 'text-muted-foreground' },
  { id: 'site-settings', titleKey: 'admin.siteSettings', descriptionKey: 'admin.siteSettings', icon: Settings, href: '/admin/site-settings', color: 'text-info' },
  { id: 'verifications', titleKey: 'admin.verifications', descriptionKey: 'admin.verifications', icon: FileCheck, href: '/admin/verifications', color: 'text-info' },
  { id: 'doctors', titleKey: 'admin.doctorManagement', descriptionKey: 'admin.doctorManagement', icon: Stethoscope, href: '/admin/doctors', color: 'text-success' },
  { id: 'residents', titleKey: 'admin.residentManagement', descriptionKey: 'admin.residentManagement', icon: GraduationCap, href: '/admin/residents', color: 'text-accent' },
  { id: 'users', titleKey: 'admin.userManagement', descriptionKey: 'admin.userManagement', icon: Users, href: '/admin/users', color: 'text-warning' },
  { id: 'refunds', titleKey: 'admin.refunds', descriptionKey: 'admin.refunds', icon: RefreshCcw, href: '/admin/refunds', color: 'text-destructive' },
  { id: 'news', titleKey: 'admin.news', descriptionKey: 'admin.news', icon: Newspaper, href: '/admin/news', color: 'text-primary' },
  { id: 'credentials', titleKey: 'admin.credentials', descriptionKey: 'admin.credentials', icon: ShieldCheck, href: '/admin/credentials', color: 'text-accent' },
  { id: 'reports', titleKey: 'admin.reports', descriptionKey: 'admin.reports', icon: Flag, href: '/admin/reports', color: 'text-destructive' },
];

// Localized module titles/descriptions
const moduleLabels: Record<string, { es: { title: string; desc: string }; en: { title: string; desc: string } }> = {
  analytics: { es: { title: 'Analytics y Reportes', desc: 'Visualiza estadísticas de ingresos, usuarios y actividad' }, en: { title: 'Analytics & Reports', desc: 'View revenue, users and activity statistics' } },
  payouts: { es: { title: 'Pagos a Doctores', desc: 'Paga a doctores por Stripe o transferencia manual' }, en: { title: 'Doctor Payouts', desc: 'Pay doctors via Stripe or manual transfer' } },
  'invoice-review': { es: { title: 'Revisión de Facturas', desc: 'Aprueba o rechaza facturas de doctores' }, en: { title: 'Invoice Review', desc: 'Approve or reject doctor invoices' } },
  'payout-settings': { es: { title: 'Configuración de Pagos', desc: 'Comisiones, frecuencia de pagos y payouts' }, en: { title: 'Payout Settings', desc: 'Commissions, payment frequency and payouts' } },
  'site-settings': { es: { title: 'Configuración del Sitio', desc: 'Redes sociales, términos y privacidad' }, en: { title: 'Site Settings', desc: 'Social media, terms and privacy' } },
  verifications: { es: { title: 'Verificaciones de Identidad', desc: 'Revisa solicitudes de verificación de pacientes' }, en: { title: 'Identity Verifications', desc: 'Review patient verification requests' } },
  doctors: { es: { title: 'Validación de Médicos', desc: 'Aprueba o rechaza solicitudes de médicos' }, en: { title: 'Doctor Validation', desc: 'Approve or reject doctor requests' } },
  residents: { es: { title: 'Validación de Residentes', desc: 'Gestiona solicitudes de residentes' }, en: { title: 'Resident Validation', desc: 'Manage resident requests' } },
  users: { es: { title: 'Gestión de Usuarios', desc: 'Administra todos los usuarios' }, en: { title: 'User Management', desc: 'Manage all users' } },
  refunds: { es: { title: 'Gestión de Reembolsos', desc: 'Procesa reembolsos y disputas' }, en: { title: 'Refund Management', desc: 'Process refunds and disputes' } },
  news: { es: { title: 'Noticias y Blog Médico', desc: 'Crea y publica artículos médicos' }, en: { title: 'Medical News & Blog', desc: 'Create and publish medical articles' } },
  credentials: { es: { title: 'Credenciales de Doctores', desc: 'Revisa educación y certificaciones' }, en: { title: 'Doctor Credentials', desc: 'Review education and certifications' } },
  reports: { es: { title: 'Reportes y Reclamos', desc: 'Gestiona reportes de usuarios y abuso' }, en: { title: 'Reports & Claims', desc: 'Manage user reports and abuse' } },
};

interface Stats {
  pendingVerifications: number;
  pendingDoctors: number;
  pendingResidents: number;
  totalUsers: number;
  totalDoctors: number;
  totalPatients: number;
  totalResidents: number;
}

const AdminDashboard = React.forwardRef<HTMLDivElement, object>(function AdminDashboard(_props, ref) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t, language } = useLanguage();
  const [stats, setStats] = useState<Stats>({ 
    pendingVerifications: 0, 
    pendingDoctors: 0, 
    pendingResidents: 0, 
    totalUsers: 0,
    totalDoctors: 0,
    totalPatients: 0,
    totalResidents: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (role && role !== 'admin') {
      navigate('/');
      toast.error(t('adminDashboard.accessDenied'));
    }
  }, [role, navigate, t]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { count: verifications } = await supabase
          .from('identity_verifications')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        const { count: pendingDoctors } = await supabase
          .from('doctor_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        const { count: totalDoctors } = await supabase
          .from('doctor_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'approved');

        const { count: pendingResidents } = await supabase
          .from('resident_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        const { count: totalResidents } = await supabase
          .from('resident_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'approved');

        const { count: users } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        const { count: totalPatients } = await supabase
          .from('user_roles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'patient');

        setStats({
          pendingVerifications: verifications || 0,
          pendingDoctors: pendingDoctors || 0,
          pendingResidents: pendingResidents || 0,
          totalUsers: users || 0,
          totalDoctors: totalDoctors || 0,
          totalPatients: totalPatients || 0,
          totalResidents: totalResidents || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (role === 'admin') {
      fetchStats();
    }
  }, [role]);

  if (role !== 'admin') {
    return null;
  }

  return (
    <MainLayout>
      <div ref={ref} className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <LayoutDashboard className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">
                {t('adminDashboard.title')}
              </h1>
              <p className="text-muted-foreground">
                {t('adminDashboard.subtitle')}
              </p>
            </div>
          </div>
        </div>

        <h2 className="font-heading text-lg font-semibold mb-3">
          {t('adminDashboard.platformTotals')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-secondary" onClick={() => navigate('/admin/users')}>
            <CardContent className="p-4 text-center">
              {isLoading ? <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground mb-2" /> : <p className="text-3xl font-bold text-secondary mb-1">{stats.totalDoctors}</p>}
              <Stethoscope className="w-5 h-5 mx-auto text-secondary mb-1" />
              <div className="text-xs text-muted-foreground">{t('adminDashboard.activeDoctors')}</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary" onClick={() => navigate('/admin/users')}>
            <CardContent className="p-4 text-center">
              {isLoading ? <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground mb-2" /> : <p className="text-3xl font-bold text-primary mb-1">{stats.totalPatients}</p>}
              <Users className="w-5 h-5 mx-auto text-primary mb-1" />
              <div className="text-xs text-muted-foreground">{t('adminDashboard.patients')}</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-accent" onClick={() => navigate('/admin/users')}>
            <CardContent className="p-4 text-center">
              {isLoading ? <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground mb-2" /> : <p className="text-3xl font-bold text-accent mb-1">{stats.totalResidents}</p>}
              <GraduationCap className="w-5 h-5 mx-auto text-accent mb-1" />
              <div className="text-xs text-muted-foreground">{t('adminDashboard.residents')}</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-warning" onClick={() => navigate('/admin/users')}>
            <CardContent className="p-4 text-center">
              {isLoading ? <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground mb-2" /> : <p className="text-3xl font-bold text-warning mb-1">{stats.totalUsers}</p>}
              <Users className="w-5 h-5 mx-auto text-warning mb-1" />
              <div className="text-xs text-muted-foreground">{t('adminDashboard.totalUsers')}</div>
            </CardContent>
          </Card>
        </div>

        <h2 className="font-heading text-lg font-semibold mb-3">
          {t('adminDashboard.pendingReview')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/verifications')}>
            <CardContent className="p-4 text-center">
              {isLoading ? <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground mb-2" /> : <p className="text-3xl font-bold text-info mb-1">{stats.pendingVerifications}</p>}
              <UserCheck className="w-5 h-5 mx-auto text-info mb-1" />
              <div className="text-xs text-muted-foreground">{t('adminDashboard.verifications')}</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/doctors')}>
            <CardContent className="p-4 text-center">
              {isLoading ? <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground mb-2" /> : <p className="text-3xl font-bold text-success mb-1">{stats.pendingDoctors}</p>}
              <Stethoscope className="w-5 h-5 mx-auto text-success mb-1" />
              <div className="text-xs text-muted-foreground">{t('adminDashboard.pendingDoctors')}</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/residents')}>
            <CardContent className="p-4 text-center">
              {isLoading ? <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground mb-2" /> : <p className="text-3xl font-bold text-accent mb-1">{stats.pendingResidents}</p>}
              <GraduationCap className="w-5 h-5 mx-auto text-accent mb-1" />
              <div className="text-xs text-muted-foreground">{t('adminDashboard.pendingResidents')}</div>
            </CardContent>
          </Card>
        </div>

        <h2 className="font-heading text-lg font-semibold mb-4">
          {t('adminDashboard.adminModules')}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {adminModules.map((module) => {
            const Icon = module.icon;
            const labels = moduleLabels[module.id];
            return (
              <Card 
                key={module.id}
                className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50 group"
                onClick={() => navigate(module.href)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${module.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-lg mb-1">
                    {labels?.[language]?.title || module.id}
                  </CardTitle>
                  <CardDescription>
                    {labels?.[language]?.desc || ''}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
});

AdminDashboard.displayName = 'AdminDashboard';
export default AdminDashboard;
