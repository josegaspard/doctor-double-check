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
} from 'lucide-react';

interface AdminModule {
  id: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  icon: React.ElementType;
  href: string;
  color: string;
}

const adminModules: AdminModule[] = [
  {
    id: 'verifications',
    title: 'Verificaciones de Identidad',
    titleEn: 'Identity Verifications',
    description: 'Revisa y aprueba las solicitudes de verificación de identidad de pacientes',
    descriptionEn: 'Review and approve patient identity verification requests',
    icon: FileCheck,
    href: '/admin/verifications',
    color: 'text-blue-500',
  },
  {
    id: 'doctors',
    title: 'Validación de Médicos',
    titleEn: 'Doctor Validation',
    description: 'Aprueba o rechaza las solicitudes de registro de médicos',
    descriptionEn: 'Approve or reject doctor registration requests',
    icon: Stethoscope,
    href: '/admin/doctors',
    color: 'text-green-500',
  },
  {
    id: 'residents',
    title: 'Validación de Residentes',
    titleEn: 'Resident Validation',
    description: 'Gestiona las solicitudes de registro de médicos residentes',
    descriptionEn: 'Manage resident doctor registration requests',
    icon: GraduationCap,
    href: '/admin/residents',
    color: 'text-purple-500',
  },
  {
    id: 'users',
    title: 'Gestión de Usuarios',
    titleEn: 'User Management',
    description: 'Administra todos los usuarios de la plataforma',
    descriptionEn: 'Manage all platform users',
    icon: Users,
    href: '/admin/users',
    color: 'text-orange-500',
  },
];

interface Stats {
  pendingVerifications: number;
  pendingDoctors: number;
  pendingResidents: number;
  totalUsers: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language } = useLanguage();
  const [stats, setStats] = useState<Stats>({ pendingVerifications: 0, pendingDoctors: 0, pendingResidents: 0, totalUsers: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (role && role !== 'admin') {
      navigate('/');
      toast.error(language === 'es' ? 'Acceso denegado' : 'Access denied');
    }
  }, [role, navigate, language]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch pending verifications
        const { count: verifications } = await supabase
          .from('identity_verifications')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        // Fetch pending doctors
        const { count: doctors } = await supabase
          .from('doctor_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        // Fetch pending residents
        const { count: residents } = await supabase
          .from('resident_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        // Fetch total users
        const { count: users } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        setStats({
          pendingVerifications: verifications || 0,
          pendingDoctors: doctors || 0,
          pendingResidents: residents || 0,
          totalUsers: users || 0,
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
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <LayoutDashboard className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">
                {language === 'es' ? 'Panel de Administración' : 'Admin Dashboard'}
              </h1>
              <p className="text-muted-foreground">
                {language === 'es' 
                  ? 'Gestiona la plataforma y sus usuarios' 
                  : 'Manage the platform and its users'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/verifications')}>
            <CardContent className="p-4 text-center">
              {isLoading ? (
                <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground mb-2" />
              ) : (
                <p className="text-3xl font-bold text-blue-600 mb-1">{stats.pendingVerifications}</p>
              )}
              <UserCheck className="w-5 h-5 mx-auto text-blue-500 mb-1" />
              <div className="text-xs text-muted-foreground">
                {language === 'es' ? 'Verificaciones' : 'Verifications'}
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/doctors')}>
            <CardContent className="p-4 text-center">
              {isLoading ? (
                <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground mb-2" />
              ) : (
                <p className="text-3xl font-bold text-green-600 mb-1">{stats.pendingDoctors}</p>
              )}
              <Stethoscope className="w-5 h-5 mx-auto text-green-500 mb-1" />
              <div className="text-xs text-muted-foreground">
                {language === 'es' ? 'Médicos' : 'Doctors'}
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/residents')}>
            <CardContent className="p-4 text-center">
              {isLoading ? (
                <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground mb-2" />
              ) : (
                <p className="text-3xl font-bold text-purple-600 mb-1">{stats.pendingResidents}</p>
              )}
              <GraduationCap className="w-5 h-5 mx-auto text-purple-500 mb-1" />
              <div className="text-xs text-muted-foreground">
                {language === 'es' ? 'Residentes' : 'Residents'}
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/admin/users')}>
            <CardContent className="p-4 text-center">
              {isLoading ? (
                <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground mb-2" />
              ) : (
                <p className="text-3xl font-bold text-orange-600 mb-1">{stats.totalUsers}</p>
              )}
              <Users className="w-5 h-5 mx-auto text-orange-500 mb-1" />
              <div className="text-xs text-muted-foreground">
                {language === 'es' ? 'Usuarios' : 'Users'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modules Grid */}
        <h2 className="font-heading text-lg font-semibold mb-4">
          {language === 'es' ? 'Módulos de administración' : 'Admin Modules'}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {adminModules.map((module) => {
            const Icon = module.icon;
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
                    {language === 'es' ? module.title : module.titleEn}
                  </CardTitle>
                  <CardDescription>
                    {language === 'es' ? module.description : module.descriptionEn}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
}
