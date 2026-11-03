import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Search, Users, ArrowLeft, Shield, User, Stethoscope, GraduationCap, Settings2, Check } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserManagementDialog } from '@/components/admin/UserManagementDialog';

interface UserData {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  is_identity_verified: boolean;
  onboarding_completed: boolean;
  role?: string;
  providers?: string[];
}

// Registro de altas y accesos con Google y X (tabla auth_provider_events, 2026-11-03).
interface ProviderEvent {
  id: number;
  user_id: string;
  email: string | null;
  name: string | null;
  provider: string;
  event: 'signup' | 'login' | 'link';
  created_at: string;
}

const PROVIDER_LABEL: Record<string, string> = { google: 'Google', x: 'X', twitter: 'X', email: 'Correo' };
const EVENT_LABEL: Record<string, string> = { signup: 'Alta', login: 'Acceso', link: 'Vinculó cuenta' };

export default function AdminUsers() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [providerEvents, setProviderEvents] = useState<ProviderEvent[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  useEffect(() => {
    if (user?.role !== 'admin') {
      toast({ 
        title: t('admin.accessDenied'), 
        description: t('admin.onlyAdmins'), 
        variant: 'destructive' 
      });
      navigate('/');
      return;
    }
    fetchUsers();
    fetchProviderEvents();
  }, [user, navigate]);

  const fetchProviderEvents = async () => {
    const { data, error } = await supabase
      .from('auth_provider_events' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error) setProviderEvents((data || []) as unknown as ProviderEvent[]);
  };

  const fetchUsers = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: providerRows } = await supabase.rpc('admin_user_providers' as any);
      const providersByUser = new Map<string, string[]>(
        ((providerRows || []) as { user_id: string; providers: string[] }[]).map((r) => [r.user_id, r.providers])
      );

      const usersWithRoles = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id)
            .maybeSingle();
          return { 
            ...profile, 
            role: roleData?.role || 'patient',
            providers: providersByUser.get(profile.id) || [],
            onboarding_completed: profile.onboarding_completed || false,
          } as UserData;
        })
      );

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({ title: t('common.error'), description: t('admin.errorLoadingUsers'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesProvider =
      providerFilter === 'all' ||
      (providerFilter === 'email'
        ? !(u.providers || []).some((p) => p !== 'email')
        : (u.providers || []).includes(providerFilter));
    return matchesSearch && matchesRole && matchesProvider;
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4" />;
      case 'doctor':
        return <Stethoscope className="w-4 h-4" />;
      case 'resident':
        return <GraduationCap className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getRoleBadge = (role: string) => {
    // Todos los badges con bg sólido primary/secondary y texto BLANCO. Antes
    // tenían bg-<color> text-<color> (mismo color de fondo y texto → invisible).
    const colors: Record<string, string> = {
      admin: 'bg-secondary text-white border-secondary',
      doctor: 'bg-primary text-white border-primary',
      resident: 'bg-light/60 text-light-foreground border-light',
      patient: 'bg-muted text-secondary border-border',
      visitor: 'bg-warning text-warning-foreground border-warning',
    };
    return (
      <Badge variant="outline" className={`${colors[role] || colors.patient} font-semibold`}>
        {getRoleIcon(role)}
        <span className="ml-1 capitalize">{t(`roles.${role}`)}</span>
      </Badge>
    );
  };

  const userStats = {
    total: users.length,
    admins: users.filter((u) => u.role === 'admin').length,
    doctors: users.filter((u) => u.role === 'doctor').length,
    residents: users.filter((u) => u.role === 'resident').length,
    patients: users.filter((u) => u.role === 'patient').length,
  };

  if (user?.role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        {/* Header */}
        <Button variant="back" size="sm" onClick={() => navigate('/admin')} className="mb-3 -ml-2 text-white hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('admin.backToAdmin') || 'Volver al panel'}
        </Button>
        <div className="mb-4 sm:mb-6 rounded-2xl bg-white border-2 border-primary/30 shadow-md p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow flex-shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-secondary truncate">{t('admin.userManagement')}</h1>
              <p className="text-xs sm:text-sm text-secondary/70">
                {users.length} {t('admin.registeredUsers')}
              </p>
            </div>
          </div>
        </div>

        {/* Stats — todas las cards con ícono blanco sobre cuadro gradient primary→secondary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
          {[
            { value: userStats.total, label: 'Total', icon: Users },
            { value: userStats.admins, label: t('admin.administrators'), icon: Shield },
            { value: userStats.doctors, label: t('admin.doctors'), icon: Stethoscope },
            { value: userStats.residents, label: t('admin.residents'), icon: GraduationCap },
            { value: userStats.patients, label: t('admin.patients'), icon: User },
          ].map((s, i) => {
            const IconCmp = s.icon;
            return (
              <Card key={i} className="bg-white border-2 border-primary/20 shadow-sm">
                <CardContent className="p-3 sm:p-4 text-center">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow mx-auto mb-2">
                    <IconCmp className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-secondary">{s.value}</p>
                  <p className="text-[10px] sm:text-sm text-secondary/70 truncate">{s.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Accesos con Google y X */}
        <Card className="mb-6 bg-white border-2 border-primary/20 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="font-semibold text-secondary">Accesos con Google y X</h2>
              <span className="text-xs text-secondary/70">
                {providerEvents.filter((e) => e.event === 'signup').length} altas · {providerEvents.filter((e) => e.event === 'login').length} accesos (últimos 50 movimientos)
              </span>
            </div>
            {providerEvents.length === 0 ? (
              <p className="text-sm text-secondary/70">Todavía nadie ha entrado ni se ha registrado con Google o X.</p>
            ) : (
              <div className="divide-y divide-border max-h-72 overflow-y-auto">
                {providerEvents.map((e) => (
                  <div key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="font-medium text-secondary">{e.name || e.email || e.user_id}</span>
                      {e.name && e.email && <span className="text-secondary/70"> · {e.email}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className="text-[10px] h-5">{PROVIDER_LABEL[e.provider] || e.provider}</Badge>
                      <Badge variant="outline" className={`text-[10px] h-5 ${e.event === 'signup' ? 'bg-primary text-white border-primary' : ''}`}>
                        {EVENT_LABEL[e.event] || e.event}
                      </Badge>
                      <span className="text-xs text-secondary/70">{new Date(e.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('admin.searchByNameEmail')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('admin.filterByRole')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin.allRoles')}</SelectItem>
                  <SelectItem value="admin">{t('admin.administrators')}</SelectItem>
                  <SelectItem value="doctor">{t('admin.doctors')}</SelectItem>
                  <SelectItem value="resident">{t('admin.residents')}</SelectItem>
                  <SelectItem value="patient">{t('admin.patients')}</SelectItem>
                  <SelectItem value="visitor">{t('admin.visitors')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Cómo entra" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Cualquier acceso</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="x">X</SelectItem>
                  <SelectItem value="email">Solo correo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t('admin.noUsersFound')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((userData) => (
              <Card key={userData.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                     <div className="flex items-center gap-3">
                       <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
                         <AvatarImage src={userData.avatar_url || ''} />
                         <AvatarFallback className="text-xs">{userData.name?.[0] || 'U'}</AvatarFallback>
                       </Avatar>
                       <div className="min-w-0">
                         <div className="flex items-center gap-1.5 flex-wrap">
                           <h3 className="font-medium text-sm truncate">{userData.name || t('admin.noName')}</h3>
                           {getRoleBadge(userData.role || 'patient')}
                           {(userData.providers || []).filter((p) => p !== 'email').map((p) => (
                             <Badge key={p} variant="outline" className="text-[10px] h-5 font-semibold">
                               {PROVIDER_LABEL[p] || p}
                             </Badge>
                           ))}
                           {userData.is_identity_verified && (
                             <Badge variant="outline" className="bg-primary text-white border-primary text-[10px] h-5 font-semibold">
                               <Check className="inline w-3 h-3 mr-0.5" aria-hidden="true" />{t('admin.verified')}
                             </Badge>
                           )}
                         </div>
                         <p className="text-xs text-muted-foreground truncate">{userData.email}</p>
                       </div>
                     </div>
                    <div className="flex items-center gap-2 mt-2 sm:mt-0">
                      <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
                        {new Date(userData.created_at).toLocaleDateString()}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedUser(userData)}
                        className="text-xs h-8"
                      >
                        <Settings2 className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">{t('admin.manage')}</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* User Management Dialog */}
        <UserManagementDialog
          user={selectedUser}
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          onUserUpdated={fetchUsers}
        />
      </div>
    </MainLayout>
  );
}