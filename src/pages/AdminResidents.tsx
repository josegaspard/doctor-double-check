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
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" /> {t('admin.pending')}</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> {t('admin.approved')}</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" /> {t('admin.rejected')}</Badge>;
      default:
        return null;
    }
  };

  const pendingCount = residents.filter((r) => r.status === 'pending').length;

  if (user?.role !== 'admin') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} className="hidden sm:flex">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              {t('admin.residentManagement')}
            </h1>
            <p className="text-muted-foreground">
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
              <div className="flex gap-2">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? 'default' : 'outline'}
                    size="sm"
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
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={resident.profile?.avatar_url || ''} />
                        <AvatarFallback>{resident.profile?.name?.[0] || 'R'}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{resident.profile?.name || t('admin.noName')}</h3>
                          {getStatusBadge(resident.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">{resident.profile?.email}</p>
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
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => setActionDialog({ open: true, resident, action: 'approve' })}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          {t('admin.approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setActionDialog({ open: true, resident, action: 'reject' })}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          {t('admin.reject')}
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
                className={actionDialog.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
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