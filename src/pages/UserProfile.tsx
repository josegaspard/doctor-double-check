import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  User,
  Mail,
  Camera,
  Globe,
  Shield,
  Calendar,
  Loader2,
  Check,
  AlertCircle,
  Pencil,
  Wallet,
  Settings,
  FileCheck,
  Clock,
} from 'lucide-react';

type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'expired' | null;

export default function UserProfile() {
  const navigate = useNavigate();
  const { user, role, refreshUser } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');
  const [isSavingName, setIsSavingName] = useState(false);
  
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isSavingLanguage, setIsSavingLanguage] = useState(false);
  
  // Identity verification status
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(null);
  const [isLoadingVerification, setIsLoadingVerification] = useState(true);

  // Fetch verification status
  useEffect(() => {
    const fetchVerificationStatus = async () => {
      if (!user?.id) return;
      
      try {
        const { data } = await supabase
          .from('identity_verifications')
          .select('status')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (data) {
          setVerificationStatus(data.status as VerificationStatus);
        }
      } catch (error) {
        // No verification found
      } finally {
        setIsLoadingVerification(false);
      }
    };

    fetchVerificationStatus();
  }, [user?.id]);

  if (!user) {
    navigate('/login');
    return null;
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }

    setIsSavingName(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: editedName.trim() })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Nombre actualizado correctamente');
      setIsEditingName(false);
      refreshUser?.();
    } catch (error: any) {
      toast.error(error.message || 'Error al actualizar el nombre');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede superar 5MB');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setAvatarDialogOpen(true);
  };

  const handleUploadAvatar = async () => {
    if (!selectedFile) return;

    setIsUploadingAvatar(true);
    try {
      // Generate unique filename
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast.success('Foto de perfil actualizada');
      setAvatarDialogOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      refreshUser?.();
    } catch (error: any) {
      toast.error(error.message || 'Error al subir la imagen');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleLanguageChange = async (newLanguage: 'es' | 'en') => {
    setIsSavingLanguage(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ preferred_language: newLanguage })
        .eq('id', user.id);

      if (error) throw error;

      setLanguage(newLanguage);
      toast.success(newLanguage === 'es' ? 'Idioma actualizado a Español' : 'Language updated to English');
    } catch (error: any) {
      toast.error(error.message || 'Error al cambiar el idioma');
    } finally {
      setIsSavingLanguage(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat(language === 'es' ? 'es-MX' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  };

  const getRoleBadge = () => {
    const roles: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'info' }> = {
      patient: { label: 'Paciente', variant: 'default' },
      doctor: { label: 'Médico', variant: 'success' },
      resident: { label: 'Residente', variant: 'info' },
      admin: { label: 'Administrador', variant: 'secondary' },
      visitor: { label: 'Visitante', variant: 'secondary' },
    };
    return roles[role] || roles.visitor;
  };

  const roleBadge = getRoleBadge();

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {language === 'es' ? 'Mi Perfil' : 'My Profile'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'es' ? 'Gestiona tu información personal' : 'Manage your personal information'}
          </p>
        </div>

        {/* Profile Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Avatar */}
              <div className="relative group">
                <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <Camera className="w-6 h-6 text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* User Info */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="max-w-[200px]"
                        autoFocus
                      />
                      <Button size="sm" onClick={handleSaveName} disabled={isSavingName}>
                        {isSavingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setIsEditingName(false);
                        setEditedName(user.name);
                      }}>
                        ✕
                      </Button>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-xl font-semibold">{user.name}</h2>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8"
                        onClick={() => setIsEditingName(true)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
                <p className="text-muted-foreground flex items-center justify-center md:justify-start gap-2">
                  <Mail className="w-4 h-4" />
                  {user.email}
                </p>
                <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
                  <Badge variant={roleBadge.variant as any}>{roleBadge.label}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings Cards */}
        <div className="grid gap-6">
          {/* Language Preference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="w-5 h-5" />
                {language === 'es' ? 'Idioma' : 'Language'}
              </CardTitle>
              <CardDescription>
                {language === 'es' ? 'Selecciona tu idioma preferido' : 'Select your preferred language'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select 
                value={language} 
                onValueChange={handleLanguageChange}
                disabled={isSavingLanguage}
              >
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">
                    <span className="flex items-center gap-2">
                      🇲🇽 Español
                    </span>
                  </SelectItem>
                  <SelectItem value="en">
                    <span className="flex items-center gap-2">
                      🇺🇸 English
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5" />
                {language === 'es' ? 'Información de la Cuenta' : 'Account Information'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {language === 'es' ? 'Correo electrónico' : 'Email'}
                  </span>
                </div>
                <span className="font-medium">{user.email}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {language === 'es' ? 'Miembro desde' : 'Member since'}
                  </span>
                </div>
                <span className="font-medium">
                  {user.createdAt ? formatDate(user.createdAt) : '-'}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {language === 'es' ? 'Verificación de identidad' : 'Identity verification'}
                  </span>
                </div>
                {isLoadingVerification ? (
                  <Badge variant="secondary">...</Badge>
                ) : verificationStatus === 'approved' ? (
                  <Badge variant="success" className="gap-1">
                    <Check className="w-3 h-3" />
                    {language === 'es' ? 'Verificado' : 'Verified'}
                  </Badge>
                ) : verificationStatus === 'pending' ? (
                  <Badge variant="warning" className="gap-1">
                    <Clock className="w-3 h-3" />
                    {language === 'es' ? 'Pendiente' : 'Pending'}
                  </Badge>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate('/verify-identity')}
                  >
                    <FileCheck className="w-3 h-3 mr-1" />
                    {language === 'es' ? 'Verificar' : 'Verify'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-5 h-5" />
                {language === 'es' ? 'Accesos Rápidos' : 'Quick Links'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {role === 'patient' && (
                  <>
                    <Button variant="outline" className="justify-start gap-2" onClick={() => navigate('/wallet')}>
                      <Wallet className="w-4 h-4" />
                      {language === 'es' ? 'Mi Billetera' : 'My Wallet'}
                    </Button>
                    <Button variant="outline" className="justify-start gap-2" onClick={() => navigate('/vault')}>
                      <Shield className="w-4 h-4" />
                      {language === 'es' ? 'Mi Bóveda' : 'My Vault'}
                    </Button>
                    <Button variant="outline" className="justify-start gap-2" onClick={() => navigate('/medical-history')}>
                      <User className="w-4 h-4" />
                      {language === 'es' ? 'Historial Médico' : 'Medical History'}
                    </Button>
                  </>
                )}
                <Button variant="outline" className="justify-start gap-2" onClick={() => navigate('/settings')}>
                  <Settings className="w-4 h-4" />
                  {language === 'es' ? 'Configuración' : 'Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Avatar Upload Dialog */}
      <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'es' ? 'Cambiar foto de perfil' : 'Change profile photo'}
            </DialogTitle>
            <DialogDescription>
              {language === 'es' ? 'Vista previa de tu nueva foto' : 'Preview of your new photo'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-6">
            <Avatar className="w-32 h-32">
              <AvatarImage src={previewUrl || undefined} alt="Preview" />
              <AvatarFallback className="text-3xl bg-primary text-primary-foreground">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setAvatarDialogOpen(false);
                setSelectedFile(null);
                setPreviewUrl(null);
              }}
              disabled={isUploadingAvatar}
            >
              {language === 'es' ? 'Cancelar' : 'Cancel'}
            </Button>
            <Button onClick={handleUploadAvatar} disabled={isUploadingAvatar}>
              {isUploadingAvatar ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {language === 'es' ? 'Subiendo...' : 'Uploading...'}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {language === 'es' ? 'Guardar' : 'Save'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
