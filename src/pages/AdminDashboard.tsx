import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Shield,
  Users,
  UserCheck,
  Stethoscope,
  GraduationCap,
  FileCheck,
  ArrowRight,
  LayoutDashboard,
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

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language } = useLanguage();

  // Redirect non-admins
  React.useEffect(() => {
    if (role && role !== 'admin') {
      navigate('/');
      toast.error(language === 'es' ? 'Acceso denegado' : 'Access denied');
    }
  }, [role, navigate, language]);

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

        {/* Modules Grid */}
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

        {/* Quick Stats (placeholder) */}
        <div className="mt-8">
          <h2 className="font-heading text-lg font-semibold mb-4">
            {language === 'es' ? 'Resumen rápido' : 'Quick Overview'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <UserCheck className="w-6 h-6 mx-auto text-primary mb-2" />
                <div className="text-sm text-muted-foreground">
                  {language === 'es' ? 'Verificaciones pendientes' : 'Pending verifications'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Stethoscope className="w-6 h-6 mx-auto text-green-500 mb-2" />
                <div className="text-sm text-muted-foreground">
                  {language === 'es' ? 'Médicos pendientes' : 'Pending doctors'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <GraduationCap className="w-6 h-6 mx-auto text-purple-500 mb-2" />
                <div className="text-sm text-muted-foreground">
                  {language === 'es' ? 'Residentes pendientes' : 'Pending residents'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Users className="w-6 h-6 mx-auto text-orange-500 mb-2" />
                <div className="text-sm text-muted-foreground">
                  {language === 'es' ? 'Total usuarios' : 'Total users'}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
