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
import { Search, CheckCircle, XCircle, Clock, User, GraduationCap, ArrowLeft } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ResidentRequest {
  id: string;
  user_id: string;
  specialty: string;
  institution: string;
  year: number;
  cedula_profesional: string | null;
  titulo_medicina: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  profile?: {
    name: string;
    email: string;
    avatar_url: string | null;
  };
}

export default function AdminResidents() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [residents, setResidents] = useState<ResidentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [actionDialog, setActionDialog] = useState<{ open: boolean; resident: ResidentRequest | null; action: 'approve' | 'reject' }>({
    open: false,
    resident: null,
    action: 'approve',
  });

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
    fetchResidents();
  }, [user, navigate]);

  const fetchResidents = async () => {
    try {
      const { data: residentProfiles, error } = await supabase
        .from('resident_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const residentsWithProfiles = await Promise.all(
        (residentProfiles || []).map(async (res) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, email, avatar_url')
            .eq('id', res.user_id)
            .single();
          return { ...res, profile } as ResidentRequest;
        })
      );

      setResidents(residentsWithProfiles);
    } catch (error) {
      console.error('Error fetching residents:', error);
      toast({ title: t('common.error'), description: t('admin.errorLoadingResidents'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async () => {
    if (!actionDialog.resident) return;

    try {
      const newStatus = actionDialog.action === 'approve' ? 'approved' : 'rejected';
      const { error } = await supabase
        .from('resident_profiles')
        .update({ status: newStatus })
        .eq('id', actionDialog.resident.id);

      if (error) throw error;

      // Send approval email and in-app notification
      if (newStatus === 'approved' && actionDialog.resident.profile?.email) {
        try {
          await supabase.functions.invoke('send-approval-email', {
            body: {
              email: actionDialog.resident.profile.email,
              name: actionDialog.resident.profile.name || 'Residente',
              role: 'resident',
            },
          });
        } catch (emailErr) {
          console.error('Approval email error:', emailErr);
        }

        await supabase.from('notifications').insert({
          user_id: actionDialog.resident.user_id,
          type: 'system' as any,
          title: '¡Tu cuenta ha sido aprobada!',
          message: 'Tu perfil de residente ha sido verificado y aprobado. Ya puedes acceder a todas las funciones con descuento del 50%.',
          data: { action_url: '/lives' },
        });
      }

      toast({
        title: actionDialog.action === 'approve' ? t('admin.residentApproved') : t('admin.residentRejected'),
        description: `${actionDialog.resident.profile?.name} ${newStatus === 'approved' ? t('admin.hasBeenApproved') : t('admin.hasBeenRejected')}`,
      });

      fetchResidents();
    } catch (error) {
      console.error('Error updating resident:', error);
      toast({ title: t('common.error'), description: t('admin.errorUpdatingStatus'), variant: 'destructive' });
    } finally {
      setActionDialog({ open: false, resident: null, action: 'approve' });
    }
  };

  const filteredResidents = residents.filter((res) => {
    const matchesSearch =
      res.profile?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.specialty?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.institution?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.profile?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || res.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-warning text-warning"><Clock className="w-3 h-3 mr-1" /> {t('admin.pending')}</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-success text-success"><CheckCircle className="w-3 h-3 mr-1" /> {t('admin.approved')}</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-destructive text-destructive"><XCircle className="w-3 h-3 mr-1" /> {t('admin.rejected')}</Badge>;
      default:
        return null;
    }
  };

  const pendingCount = residents.filter((r) => r.status === 'pending').length;

  if (user?.role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Button variant="back" size="icon" onClick={() => navigate('/admin')} className="flex-shrink-0">
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-2xl font-bold flex items-center gap-1.5 sm:gap-2">
              <GraduationCap className="h-4 w-4 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
              <span className="truncate">{t('admin.residentManagement')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {pendingCount} {t('admin.pendingRequests')}
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('admin.searchByNameEmailInstitution')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs h-8 flex-shrink-0"
                    onClick={() => setStatusFilter(status)}
                  >
                    {status === 'all' ? t('admin.all') : t(`admin.${status}`)}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Residents List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredResidents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t('admin.noResidentsFound')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredResidents.map((resident) => (
              <Card key={resident.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
                        <AvatarImage src={resident.profile?.avatar_url || ''} />
                        <AvatarFallback className="text-xs">{resident.profile?.name?.[0] || 'R'}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-semibold text-sm truncate">{resident.profile?.name || t('admin.noName')}</h3>
                          {getStatusBadge(resident.status)}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{resident.profile?.email}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="secondary">{resident.specialty}</Badge>
                          <Badge variant="outline">{t('admin.year')} {resident.year}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t('admin.institution')}: {resident.institution}
                        </p>
                        {resident.cedula_profesional && (
                          <p className="text-xs text-muted-foreground">
                            {t('admin.cedula')}: {resident.cedula_profesional}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {t('admin.registered')}: {new Date(resident.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {resident.status === 'pending' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-success hover:bg-success text-xs h-8"
                          onClick={() => setActionDialog({ open: true, resident, action: 'approve' })}
                        >
                          <CheckCircle className="w-3.5 h-3.5 sm:mr-1" />
                          <span className="hidden sm:inline">{t('admin.approve')}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="text-xs h-8"
                          onClick={() => setActionDialog({ open: true, resident, action: 'reject' })}
                        >
                          <XCircle className="w-3.5 h-3.5 sm:mr-1" />
                          <span className="hidden sm:inline">{t('admin.reject')}</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Confirmation Dialog */}
        <AlertDialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {actionDialog.action === 'approve' ? t('admin.approveResident') : t('admin.rejectResident')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {actionDialog.action === 'approve'
                  ? `${actionDialog.resident?.profile?.name} ${t('admin.residentApproveMessage')}`
                  : `${actionDialog.resident?.profile?.name} ${t('admin.residentRejectMessage')}`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('admin.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleAction}
                className={actionDialog.action === 'approve' ? 'bg-success hover:bg-success' : ''}
              >
                {actionDialog.action === 'approve' ? t('admin.approve') : t('admin.reject')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}