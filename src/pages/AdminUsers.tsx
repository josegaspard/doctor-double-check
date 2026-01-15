import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Users,
  User,
  Mail,
  Calendar,
  Search,
  Loader2,
  ArrowLeft,
  RefreshCw,
  Shield,
  Stethoscope,
  GraduationCap,
  UserCheck,
  Eye,
} from 'lucide-react';
import { UserRole } from '@/types';

interface UserWithDetails {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
  is_identity_verified: boolean;
  role: UserRole;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { language } = useLanguage();
  
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>('patient');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (role && role !== 'admin') {
      navigate('/');
      toast.error(language === 'es' ? 'Acceso denegado' : 'Access denied');
    }
  }, [role, navigate, language]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const usersWithRoles: UserWithDetails[] = [];
      
      for (const profile of profiles || []) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', profile.id)
          .single();

        usersWithRoles.push({
          ...profile,
          role: (roleData?.role as UserRole) || 'patient',
        });
      }

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'admin') {
      fetchUsers();
    }
  }, [role]);

  const handleChangeRole = async () => {
    if (!selectedUser) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', selectedUser.id);

      if (error) throw error;

      toast.success(language === 'es' ? 'Rol actualizado' : 'Role updated');
      setIsRoleDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const getRoleBadge = (userRole: UserRole) => {
    const configs: Record<UserRole, { variant: any; label: string; icon: React.ElementType }> = {
      visitor: { variant: 'secondary', label: 'Visitante', icon: User },
      patient: { variant: 'default', label: 'Paciente', icon: User },
      doctor: { variant: 'success', label: 'Médico', icon: Stethoscope },
      resident: { variant: 'warning', label: 'Residente', icon: GraduationCap },
      admin: { variant: 'destructive', label: 'Admin', icon: Shield },
    };
    const config = configs[userRole];
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = searchQuery === '' || 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    return matchesSearch && u.role === activeTab;
  });

  if (role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-6 h-6 text-orange-500" />
              {language === 'es' ? 'Gestión de Usuarios' : 'User Management'}
            </h1>
            <p className="text-muted-foreground">
              {language === 'es' ? 'Administra todos los usuarios de la plataforma' : 'Manage all platform users'}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={fetchUsers} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="grid grid-cols-5 gap-4 mb-6">
          <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold">{users.length}</div><div className="text-xs text-muted-foreground">Total</div></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold text-blue-500">{users.filter(u => u.role === 'patient').length}</div><div className="text-xs text-muted-foreground">Pacientes</div></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold text-green-500">{users.filter(u => u.role === 'doctor').length}</div><div className="text-xs text-muted-foreground">Médicos</div></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold text-purple-500">{users.filter(u => u.role === 'resident').length}</div><div className="text-xs text-muted-foreground">Residentes</div></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><div className="text-xl font-bold text-red-500">{users.filter(u => u.role === 'admin').length}</div><div className="text-xs text-muted-foreground">Admins</div></CardContent></Card>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={language === 'es' ? 'Buscar por nombre o email...' : 'Search by name or email...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 mb-4">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="patient">Pacientes</TabsTrigger>
            <TabsTrigger value="doctor">Médicos</TabsTrigger>
            <TabsTrigger value="resident">Residentes</TabsTrigger>
            <TabsTrigger value="admin">Admins</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {isLoading ? (
              <div className="space-y-4">{[1, 2, 3].map(i => (<Card key={i}><CardContent className="p-4"><div className="flex items-center gap-4"><Skeleton className="w-12 h-12 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/2" /></div></div></CardContent></Card>))}</div>
            ) : filteredUsers.length === 0 ? (
              <Card><CardContent className="p-12 text-center"><Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">{language === 'es' ? 'No se encontraron usuarios' : 'No users found'}</p></CardContent></Card>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map(user => (
                  <Card key={user.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={user.avatar_url || ''} />
                          <AvatarFallback><User className="w-4 h-4" /></AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">{user.name}</span>
                            {getRoleBadge(user.role)}
                            {user.is_identity_verified && (
                              <Badge variant="outline" className="text-xs"><UserCheck className="w-3 h-3 mr-1" />Verificado</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{user.email}</span>
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(user.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => { setSelectedUser(user); setNewRole(user.role); setIsRoleDialogOpen(true); }}>
                            <Shield className="w-4 h-4 mr-1" />{language === 'es' ? 'Cambiar rol' : 'Change role'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{language === 'es' ? 'Cambiar rol de usuario' : 'Change user role'}</DialogTitle>
              <DialogDescription>{selectedUser?.name} ({selectedUser?.email})</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium mb-2 block">{language === 'es' ? 'Nuevo rol' : 'New role'}</label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="patient">Paciente</SelectItem>
                  <SelectItem value="doctor">Médico</SelectItem>
                  <SelectItem value="resident">Residente</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)} disabled={isProcessing}>{language === 'es' ? 'Cancelar' : 'Cancel'}</Button>
              <Button onClick={handleChangeRole} disabled={isProcessing}>
                {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {language === 'es' ? 'Guardar' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
