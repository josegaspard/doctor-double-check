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
import { Search, Users, ArrowLeft, Shield, User, Stethoscope, GraduationCap, Settings2 } from 'lucide-react';
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
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
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
  }, [user, navigate]);

  const fetchUsers = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const usersWithRoles = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id)
            .single();
          return { 
            ...profile, 
            role: roleData?.role || 'patient',
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
    return matchesSearch && matchesRole;
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
    const colors: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-800',
      doctor: 'bg-blue-100 text-blue-800',
      resident: 'bg-green-100 text-green-800',
      patient: 'bg-gray-100 text-gray-800',
      visitor: 'bg-yellow-100 text-yellow-800',
    };
    return (
      <Badge variant="outline" className={colors[role] || colors.patient}>
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
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} className="hidden sm:flex">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
              <span className="truncate">{t('admin.userManagement')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {users.length} {t('admin.registeredUsers')}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{userStats.total}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{userStats.admins}</p>
              <p className="text-sm text-muted-foreground">{t('admin.administrators')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{userStats.doctors}</p>
              <p className="text-sm text-muted-foreground">{t('admin.doctors')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{userStats.residents}</p>
              <p className="text-sm text-muted-foreground">{t('admin.residents')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-600">{userStats.patients}</p>
              <p className="text-sm text-muted-foreground">{t('admin.patients')}</p>
            </CardContent>
          </Card>
        </div>

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
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={userData.avatar_url || ''} />
                        <AvatarFallback>{userData.name?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{userData.name || t('admin.noName')}</h3>
                          {getRoleBadge(userData.role || 'patient')}
                          {userData.is_identity_verified && (
                            <Badge variant="outline" className="bg-green-100 text-green-800">
                              {t('admin.verified')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{userData.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(userData.created_at).toLocaleDateString()}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedUser(userData)}
                      >
                        <Settings2 className="h-4 w-4 mr-1" />
                        {t('admin.manage')}
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