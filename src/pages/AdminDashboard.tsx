import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Users, UserCheck, Stethoscope, GraduationCap, FileCheck, ArrowRight,
  LayoutDashboard, Loader2, Settings, RefreshCcw, Banknote, FileText,
  Newspaper, ShieldCheck, Flag, BarChart3, MessageSquare, Building2, Package, Star,
  ClipboardCheck,
} from 'lucide-react';

interface AdminModule {
  id: string; icon: React.ElementType; href: string; color: string; borderColor: string;
  title: string; desc: string; badge?: number;
}

const AdminDashboard = React.forwardRef<HTMLDivElement, object>(function AdminDashboard(_props, ref) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t, language } = useLanguage();
  const [stats, setStats] = useState({ 
    pendingVerifications: 0, pendingDoctors: 0, pendingResidents: 0,
    totalUsers: 0, totalDoctors: 0, totalPatients: 0, totalResidents: 0,
    pendingInvoices: 0, pendingRefundRequests: 0, pendingReports: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (role && role !== 'admin') { navigate('/'); toast.error(t('adminDashboard.accessDenied')); }
  }, [role, navigate, t]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [
          { count: verifications }, { count: pendingDoctors }, { count: totalDoctors },
          { count: pendingResidents }, { count: totalResidents }, { count: users },
          { count: totalPatients }, { count: pendingInvoices }, { count: pendingRefundRequests },
          { count: pendingReports },
        ] = await Promise.all([
          supabase.from('identity_verifications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('doctor_profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('doctor_profiles').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
          supabase.from('resident_profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('resident_profiles').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'patient'),
          supabase.from('doctor_invoices').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('refund_requests' as any).select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        ]);
        setStats({
          pendingVerifications: verifications || 0, pendingDoctors: pendingDoctors || 0,
          pendingResidents: pendingResidents || 0, totalUsers: users || 0,
          totalDoctors: totalDoctors || 0, totalPatients: totalPatients || 0,
          totalResidents: totalResidents || 0, pendingInvoices: pendingInvoices || 0,
          pendingRefundRequests: pendingRefundRequests || 0, pendingReports: pendingReports || 0,
        });
      } catch (error) { console.error(error); } finally { setIsLoading(false); }
    };
    if (role === 'admin') fetchStats();
  }, [role]);

  const es = language === 'es';

  const moduleCategories: { title: string; modules: AdminModule[] }[] = [
    {
      title: es ? '💰 Financiero' : '💰 Financial',
      modules: [
        { id: 'analytics', icon: BarChart3, href: '/admin/analytics', color: 'text-primary', borderColor: 'border-l-primary', title: es ? 'Analytics y Reportes' : 'Analytics & Reports', desc: es ? 'Estadísticas de ingresos, usuarios y actividad' : 'Revenue, users and activity stats' },
        { id: 'payouts', icon: Banknote, href: '/admin/payouts', color: 'text-success', borderColor: 'border-l-success', title: es ? 'Pagos a Doctores' : 'Doctor Payouts', desc: es ? 'Paga por Stripe o transferencia manual' : 'Pay via Stripe or manual transfer' },
        { id: 'invoices', icon: FileText, href: '/admin/invoices', color: 'text-secondary', borderColor: 'border-l-secondary', title: es ? 'Revisión de Facturas' : 'Invoice Review', desc: es ? 'Aprueba o rechaza facturas' : 'Approve or reject invoices', badge: stats.pendingInvoices },
        { id: 'payout-settings', icon: Settings, href: '/admin/payout-settings', color: 'text-muted-foreground', borderColor: 'border-l-muted-foreground', title: es ? 'Config. de Pagos' : 'Payout Settings', desc: es ? 'Comisiones, frecuencia y payouts' : 'Commissions, frequency and payouts' },
        { id: 'refunds', icon: RefreshCcw, href: '/admin/refunds', color: 'text-destructive', borderColor: 'border-l-destructive', title: es ? 'Reembolsos' : 'Refunds', desc: es ? 'Solicitudes y reembolsos manuales' : 'Requests and manual refunds', badge: stats.pendingRefundRequests },
      ],
    },
    {
      title: es ? '👥 Usuarios' : '👥 Users',
      modules: [
        { id: 'users', icon: Users, href: '/admin/users', color: 'text-warning', borderColor: 'border-l-warning', title: es ? 'Gestión de Usuarios' : 'User Management', desc: es ? 'Administra todos los usuarios' : 'Manage all users' },
        { id: 'doctors', icon: Stethoscope, href: '/admin/doctors', color: 'text-success', borderColor: 'border-l-success', title: es ? 'Validación de Médicos' : 'Doctor Validation', desc: es ? 'Aprueba solicitudes de médicos' : 'Approve doctor requests', badge: stats.pendingDoctors },
        { id: 'residents', icon: GraduationCap, href: '/admin/residents', color: 'text-accent', borderColor: 'border-l-accent', title: es ? 'Validación de Residentes' : 'Resident Validation', desc: es ? 'Gestiona solicitudes de residentes' : 'Manage resident requests', badge: stats.pendingResidents },
        { id: 'verifications', icon: FileCheck, href: '/admin/verifications', color: 'text-info', borderColor: 'border-l-info', title: es ? 'Verificaciones de Identidad' : 'Identity Verifications', desc: es ? 'Revisa solicitudes de pacientes' : 'Review patient requests', badge: stats.pendingVerifications },
        { id: 'credentials', icon: ShieldCheck, href: '/admin/credentials', color: 'text-accent', borderColor: 'border-l-accent', title: es ? 'Credenciales de Doctores' : 'Doctor Credentials', desc: es ? 'Educación y certificaciones' : 'Education and certifications' },
      ],
    },
    {
      title: es ? '📰 Contenido' : '📰 Content',
      modules: [
        { id: 'news', icon: Newspaper, href: '/admin/news', color: 'text-primary', borderColor: 'border-l-primary', title: es ? 'Noticias y Blog Médico' : 'Medical News & Blog', desc: es ? 'Crea y publica artículos' : 'Create and publish articles' },
        { id: 'ranks', icon: ShieldCheck, href: '/admin/ranks', color: 'text-warning', borderColor: 'border-l-warning', title: es ? 'Rangos de Doctores' : 'Doctor Ranks', desc: es ? 'Administra rangos y sus requisitos' : 'Manage ranks and requirements' },
        { id: 'ads', icon: MessageSquare, href: '/admin/ads', color: 'text-accent', borderColor: 'border-l-accent', title: es ? 'Publicidad' : 'Advertising', desc: es ? 'Campañas, placements y métricas' : 'Campaigns, placements and metrics' },
        { id: 'site-settings', icon: Settings, href: '/admin/site-settings', color: 'text-info', borderColor: 'border-l-info', title: es ? 'Config. del Sitio' : 'Site Settings', desc: es ? 'Redes sociales, términos y privacidad' : 'Social media, terms and privacy' },
      ],
    },
    {
      title: es ? '🛡️ Soporte' : '🛡️ Support',
      modules: [
        { id: 'reports', icon: Flag, href: '/admin/reports', color: 'text-destructive', borderColor: 'border-l-destructive', title: es ? 'Reportes y Reclamos' : 'Reports & Claims', desc: es ? 'Gestiona reportes de usuarios' : 'Manage user reports', badge: stats.pendingReports },
        { id: 'qa-checklist', icon: ClipboardCheck, href: '/admin/qa-checklist', color: 'text-info', borderColor: 'border-l-info', title: es ? 'QA Checklist E2E' : 'QA Checklist E2E', desc: es ? 'Pruebas end-to-end por rol con seguimiento' : 'End-to-end testing by role with tracking' },
      ],
    },
    {
      title: es ? '🏥 Directorio y Marketplace' : '🏥 Directory & Marketplace',
      modules: [
        { id: 'hospitals', icon: Building2, href: '/admin/hospitals', color: 'text-primary', borderColor: 'border-l-primary', title: es ? 'Hospitales y Clínicas' : 'Hospitals & Clinics', desc: es ? 'Administra el directorio de hospitales' : 'Manage hospital directory' },
        { id: 'marketplace', icon: Package, href: '/admin/marketplace', color: 'text-secondary', borderColor: 'border-l-secondary', title: es ? 'Marketplace Material Médico' : 'Medical Supplies Marketplace', desc: es ? 'Productos, proveedores y pedidos' : 'Products, vendors and orders' },
        { id: 'featured', icon: Star, href: '/admin/featured', color: 'text-warning', borderColor: 'border-l-warning', title: es ? 'Destacados y Promociones' : 'Featured & Promotions', desc: es ? 'Destaca hospitales y productos con métricas' : 'Feature hospitals & products with analytics' },
      ],
    },
  ];

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div ref={ref} className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8 rounded-2xl bg-white border-2 border-primary/30 shadow-md p-4 sm:p-6">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow flex-shrink-0">
              <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-lg sm:text-2xl font-bold text-secondary truncate">{t('adminDashboard.title')}</h1>
              <p className="text-secondary/70 text-xs sm:text-sm">{t('adminDashboard.subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Platform Totals */}
        <h2 className="font-heading text-lg font-semibold mb-3 text-white">{t('adminDashboard.platformTotals')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
          {[
            { value: stats.totalDoctors, label: t('adminDashboard.activeDoctors'), icon: Stethoscope },
            { value: stats.totalPatients, label: t('adminDashboard.patients'), icon: Users },
            { value: stats.totalResidents, label: t('adminDashboard.residents'), icon: GraduationCap },
            { value: stats.totalUsers, label: t('adminDashboard.totalUsers'), icon: Users },
          ].map((item, i) => (
            <Card key={i} className="cursor-pointer hover:shadow-md transition-all rounded-xl overflow-hidden bg-white border-2 border-primary/20" onClick={() => navigate('/admin/users')}>
              <CardContent className="p-3 sm:p-5 text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-2 shadow">
                  <item.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                {isLoading ? <Loader2 className="w-5 h-5 mx-auto animate-spin text-secondary/70 mb-2" /> : <p className="text-xl sm:text-3xl font-bold text-secondary mb-0.5">{item.value}</p>}
                <div className="text-[10px] sm:text-xs text-secondary/70 font-medium truncate">{item.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pending Review */}
        <h2 className="font-heading text-base sm:text-lg font-semibold mb-2 sm:mb-3 text-white">{t('adminDashboard.pendingReview')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
          {[
            { value: stats.pendingVerifications, label: t('adminDashboard.verifications'), icon: UserCheck, href: '/admin/verifications' },
            { value: stats.pendingDoctors, label: t('adminDashboard.pendingDoctors'), icon: Stethoscope, href: '/admin/doctors' },
            { value: stats.pendingResidents, label: t('adminDashboard.pendingResidents'), icon: GraduationCap, href: '/admin/residents' },
          ].map((item, i) => (
            <Card key={i} className="cursor-pointer hover:shadow-md transition-all rounded-xl bg-white border-2 border-primary/20" onClick={() => navigate(item.href)}>
              <CardContent className="p-4 sm:p-5 text-center relative">
                {!isLoading && item.value > 0 && (
                  <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
                )}
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-2.5 shadow">
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                {isLoading ? <Loader2 className="w-6 h-6 mx-auto animate-spin text-secondary/70 mb-2" /> : <p className="text-2xl sm:text-3xl font-bold text-secondary mb-1">{item.value}</p>}
                <div className="text-xs text-secondary/70 font-medium">{item.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Module Categories */}
        {moduleCategories.map((category) => (
          <div key={category.title} className="mb-8">
            <h2 className="font-heading text-lg font-semibold mb-4 text-white">{category.title}</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {category.modules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <Card
                    key={mod.id}
                    className="cursor-pointer hover:shadow-lg transition-all group rounded-xl overflow-hidden bg-white border-2 border-primary/20"
                    onClick={() => navigate(mod.href)}
                  >
                    <div className="h-1 bg-gradient-to-r from-primary to-secondary" />
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow">
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex items-center gap-2">
                          {mod.badge && mod.badge > 0 ? (
                            <Badge variant="destructive" className="text-xs animate-pulse">{mod.badge}</Badge>
                          ) : null}
                          <ArrowRight className="w-4 h-4 text-secondary/60 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                        </div>
                      </div>
                      <CardTitle className="text-sm sm:text-base mb-1 text-secondary">{mod.title}</CardTitle>
                      <CardDescription className="text-xs sm:text-sm text-secondary/70">{mod.desc}</CardDescription>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </MainLayout>
  );
});

AdminDashboard.displayName = 'AdminDashboard';
export default AdminDashboard;
