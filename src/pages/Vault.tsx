import React, { useState, useRef, useEffect } from 'react';
import { useVault, VaultFile } from '@/contexts/VaultContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Folder,
  Upload,
  FileText,
  Image,
  Trash2,
  Share2,
  Lock,
  Plus,
  Loader2,
  UserPlus,
  UserMinus,
  Shield,
  Calendar,
  Stethoscope,
  CheckCircle,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['Laboratorios', 'Imagenología', 'Estudios Cardíacos', 'Recetas', 'Otros'];

interface AvailableDoctor {
  id: string;
  name: string;
  specialty: string;
  avatarUrl?: string;
  relationshipType?: 'subscription' | 'chat' | 'consultation';
}

export default function Vault() {
  const { files, uploadFile, deleteFile, grantAccess, revokeAccess, uploadProgress, isLoading, refreshVault } = useVault();
  const { role, supabaseUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState('Otros');
  const [description, setDescription] = useState('');
  const [permissionFile, setPermissionFile] = useState<VaultFile | null>(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [availableDoctors, setAvailableDoctors] = useState<AvailableDoctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [grantingAccess, setGrantingAccess] = useState<string | null>(null);
  const [revokingAccess, setRevokingAccess] = useState<string | null>(null);

  // Fetch doctors the patient has a relationship with (subscriptions, chats, consultations)
  const fetchRelatedDoctors = async () => {
    if (!supabaseUser?.id) {
      console.log('No user ID available');
      return;
    }
    
    setLoadingDoctors(true);
    console.log('Fetching related doctors for user:', supabaseUser.id);
    
    try {
      const doctorMap = new Map<string, 'subscription' | 'chat' | 'consultation'>();

      // 1. Get doctors from subscriptions (free follows + paid)
      const { data: subscriptions, error: subError } = await supabase
        .from('subscriptions')
        .select('creator_id')
        .eq('subscriber_id', supabaseUser.id)
        .eq('is_active', true);

      console.log('Subscriptions found:', subscriptions?.length, subError);

      subscriptions?.forEach(s => {
        if (s.creator_id && !doctorMap.has(s.creator_id)) {
          doctorMap.set(s.creator_id, 'subscription');
        }
      });

      // 2. Get doctors from chat sessions - fetch ALL user's sessions first
      const { data: chatSessions, error: chatError } = await supabase
        .from('chat_sessions')
        .select('participant1_id, participant1_type, participant2_id, participant2_type, status');

      console.log('Chat sessions found:', chatSessions?.length, chatError);

      // Filter locally for active sessions where user is participant
      chatSessions?.filter(cs => cs.status === 'active')?.forEach(cs => {
        let doctorId: string | null = null;
        if (cs.participant1_id === supabaseUser.id && cs.participant2_type === 'doctor') {
          doctorId = cs.participant2_id;
        } else if (cs.participant2_id === supabaseUser.id && cs.participant1_type === 'doctor') {
          doctorId = cs.participant1_id;
        }
        if (doctorId && !doctorMap.has(doctorId)) {
          doctorMap.set(doctorId, 'chat');
        }
      });

      // 3. Get doctors from consultations
      const { data: consultations, error: consError } = await supabase
        .from('consultations')
        .select('doctor_id')
        .eq('patient_id', supabaseUser.id);

      console.log('Consultations found:', consultations?.length, consError);

      consultations?.forEach(c => {
        if (c.doctor_id && !doctorMap.has(c.doctor_id)) {
          doctorMap.set(c.doctor_id, 'consultation');
        }
      });

      console.log('Total unique doctors found:', doctorMap.size, Array.from(doctorMap.keys()));

      if (doctorMap.size === 0) {
        setAvailableDoctors([]);
        setLoadingDoctors(false);
        return;
      }

      // Get doctor profiles for these IDs using direct query to profiles_public (no RLS issues)
      const doctorIdsArray = Array.from(doctorMap.keys());
      console.log('Looking up doctor profiles for IDs:', doctorIdsArray);
      
      // Get profiles first (profiles_public doesn't have security_invoker)
      const { data: profiles, error: profError } = await supabase
        .from('profiles_public')
        .select('id, name, avatar_url')
        .in('id', doctorIdsArray);

      console.log('Profiles found:', profiles?.length, profError);

      // For specialty info, we'll use the get_doctor_public_profile RPC for each doctor
      // Or we can get it from subscriptions/chats metadata - but let's try a different approach
      // Using doctor_profiles_public with explicit select
      
      // Actually let's try fetching from the base table if we're an authenticated user
      // The issue is security_invoker on the view - let's work around it
      
      if (profiles && profiles.length > 0) {
        // Get specialty from any source we can
        const doctors: AvailableDoctor[] = [];
        
        for (const profile of profiles) {
          if (profile.id) {
            // Try to get specialty via RPC call
            const { data: doctorData } = await supabase
              .rpc('get_doctor_public_profile', { p_user_id: profile.id });
            
            const specialty = doctorData?.[0]?.specialty || 'Medicina General';
            
            doctors.push({
              id: profile.id,
              name: profile.name || 'Doctor',
              specialty,
              avatarUrl: profile.avatar_url || undefined,
              relationshipType: doctorMap.get(profile.id),
            });
          }
        }

        console.log('Final doctors list:', doctors);
        setAvailableDoctors(doctors);
      } else {
        console.log('No profiles found for doctors');
        setAvailableDoctors([]);
      }
    } catch (error) {
      console.error('Error fetching related doctors:', error);
      toast.error('Error al cargar los médicos');
    } finally {
      setLoadingDoctors(false);
    }
  };

  useEffect(() => {
    if (role === 'patient' && supabaseUser?.id) {
      fetchRelatedDoctors();
    }
  }, [role, supabaseUser?.id]);

  if (role !== 'patient') return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadFile(file, selectedCategory, description);
    if (result.success) {
      toast.success('Archivo subido correctamente');
    } else {
      toast.error(result.error || 'Error al subir archivo');
    }
    setDescription('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getIcon = (type: string) => {
    if (type === 'image') return <Image className="w-5 h-5 text-info" />;
    return <FileText className="w-5 h-5 text-primary" />;
  };

  const handleGrantAccess = async (doctorId: string) => {
    if (!permissionFile) return;
    
    setGrantingAccess(doctorId);
    try {
      const result = await grantAccess(permissionFile.id, doctorId);
      if (result.success) {
        toast.success('Acceso otorgado correctamente');
        // Refresh the permission file state
        await refreshVault();
      } else {
        toast.error(result.error || 'Error al dar acceso');
      }
    } catch (error) {
      toast.error('Error al dar acceso');
    } finally {
      setGrantingAccess(null);
    }
  };

  const handleRevokeAccess = async (doctorId: string) => {
    if (!permissionFile) return;
    
    setRevokingAccess(doctorId);
    try {
      const result = await revokeAccess(permissionFile.id, doctorId);
      if (result.success) {
        toast.success('Acceso revocado correctamente');
        await refreshVault();
      } else {
        toast.error(result.error || 'Error al revocar acceso');
      }
    } catch (error) {
      toast.error('Error al revocar acceso');
    } finally {
      setRevokingAccess(null);
    }
  };

  const openPermissions = (file: VaultFile) => {
    setPermissionFile(file);
    setShowPermissionDialog(true);
    setDoctorSearch('');
  };

  // Get the current state of the permission file from files array
  const currentPermissionFile = permissionFile ? files.find(f => f.id === permissionFile.id) : null;

  // Filter doctors based on search and exclude those who already have access
  const filteredDoctors = availableDoctors.filter(doctor => {
    const hasAccess = currentPermissionFile?.permissions?.some(p => p.doctorId === doctor.id);
    const matchesSearch = !doctorSearch || 
      doctor.name.toLowerCase().includes(doctorSearch.toLowerCase()) ||
      doctor.specialty.toLowerCase().includes(doctorSearch.toLowerCase());
    return !hasAccess && matchesSearch;
  });

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Folder className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          Mi Vault Médico
        </h1>
        <p className="text-muted-foreground text-sm mb-4 sm:mb-6">
          Guarda tus estudios de forma segura y controla quién puede verlos
        </p>

        <Card className="mb-6 bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground text-sm">Tú controlas el acceso</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Solo los médicos que tú autorices podrán ver tus archivos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Subir Archivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Descripción" value={description} onChange={e => setDescription(e.target.value)} className="h-10" />
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleUpload} />
            <Button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="w-full">
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Seleccionar Archivo
            </Button>
            {uploadProgress !== null && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subiendo...</span>
                  <span className="font-medium">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mis Archivos ({files.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {files.length > 0 ? (
              <div className="space-y-2 sm:space-y-3">
                {files.map(file => (
                  <div key={file.id} className="flex flex-col sm:flex-row sm:items-start gap-3 p-3 sm:p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-background flex items-center justify-center flex-shrink-0">
                        {getIcon(file.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{file.name}</p>
                        <div className="flex items-center flex-wrap gap-1 sm:gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{file.category}</span>
                          <span>•</span>
                          <span>{formatSize(file.size)}</span>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(file.uploadedAt).toLocaleDateString('es-MX')}
                          </span>
                        </div>
                        
                        <div className="flex items-center flex-wrap gap-1 sm:gap-2 mt-2 sm:mt-3">
                          {file.permissions.length > 0 ? (
                            file.permissions.map(perm => (
                              <Badge key={perm.doctorId} variant="secondary" className="text-xs gap-1">
                                <Stethoscope className="w-3 h-3" />
                                <span className="truncate max-w-[80px]">{perm.doctorName || 'Doctor'}</span>
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Lock className="w-3 h-3" />
                              Sin accesos
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex sm:flex-col gap-2 sm:gap-1 mt-2 sm:mt-0">
                      <Button variant="outline" size="sm" onClick={() => openPermissions(file)} className="gap-1 flex-1 sm:flex-none h-8 text-xs">
                        <Share2 className="w-3 h-3" />
                        Permisos
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteFile(file.id)} className="text-destructive hover:text-destructive flex-1 sm:flex-none h-8 text-xs">
                        <Trash2 className="w-3 h-3 mr-1" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Lock className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <h3 className="font-semibold text-foreground mb-2">Tu vault está vacío</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  Sube tus estudios médicos para tenerlos siempre disponibles.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
          <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-primary" />
                Gestionar Permisos
              </DialogTitle>
              <DialogDescription className="truncate">{currentPermissionFile?.name}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {currentPermissionFile?.permissions && currentPermissionFile.permissions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-3">Con acceso actualmente:</h4>
                  <div className="space-y-2">
                    {currentPermissionFile.permissions.map(perm => (
                      <div key={perm.doctorId} className="flex items-center justify-between p-3 bg-success/5 border border-success/20 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                            <Stethoscope className="w-4 h-4 text-success" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{perm.doctorName || 'Doctor'}</p>
                            <p className="text-xs text-muted-foreground">
                              Desde {new Date(perm.grantedAt).toLocaleDateString('es-MX')}
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleRevokeAccess(perm.doctorId)} 
                          disabled={revokingAccess === perm.doctorId}
                          className="text-destructive hover:text-destructive gap-1"
                        >
                          {revokingAccess === perm.doctorId ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <UserMinus className="w-4 h-4" />
                          )}
                          Revocar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Dar acceso a:</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Solo aparecen médicos que sigues, con los que tienes consultas o chats activos.
                </p>
                
                {/* Search input for doctors */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar médico por nombre o especialidad..."
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>

                {loadingDoctors ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {filteredDoctors.length > 0 ? (
                      filteredDoctors.map(doctor => (
                        <div key={doctor.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                              {doctor.avatarUrl ? (
                                <img src={doctor.avatarUrl} alt={doctor.name} className="w-full h-full object-cover" />
                              ) : (
                                <Stethoscope className="w-4 h-4 text-primary" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{doctor.name}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground">{doctor.specialty}</p>
                                {doctor.relationshipType && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {doctor.relationshipType === 'subscription' && 'Siguiendo'}
                                    {doctor.relationshipType === 'chat' && 'Chat'}
                                    {doctor.relationshipType === 'consultation' && 'Consulta'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleGrantAccess(doctor.id)} 
                            disabled={grantingAccess === doctor.id}
                            className="gap-1"
                          >
                            {grantingAccess === doctor.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <UserPlus className="w-4 h-4" />
                            )}
                            Dar acceso
                          </Button>
                        </div>
                      ))
                    ) : availableDoctors.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        <Stethoscope className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-medium">No hay médicos disponibles</p>
                        <p className="text-xs mt-1">
                          Suscríbete a un médico o inicia una consulta para poder compartir archivos.
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-success" />
                        {doctorSearch 
                          ? 'No se encontraron médicos con ese criterio'
                          : 'Todos los médicos disponibles ya tienen acceso'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Button variant="outline" onClick={() => setShowPermissionDialog(false)} className="w-full">
              Cerrar
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
