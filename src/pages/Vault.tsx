import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useVault, VaultFile } from '@/contexts/VaultContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWallet } from '@/contexts/WalletContext';
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
  HardDrive,
  Zap,
  AlertTriangle,
  CreditCard,
  Wallet,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { VaultAuditPanel } from '@/components/vault/VaultAuditPanel';
import { VaultUploadSimulator } from '@/components/vault/VaultUploadSimulator';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const CATEGORIES_MAP = [
  { value: 'Laboratorios', labelKey: 'ads.vaultCatLab' },
  { value: 'Imagenología', labelKey: 'ads.vaultCatImaging' },
  { value: 'Estudios Cardíacos', labelKey: 'ads.vaultCatCardiac' },
  { value: 'Recetas', labelKey: 'ads.vaultCatPrescriptions' },
  { value: 'Otros', labelKey: 'ads.vaultCatOther' },
];
const CATEGORIES = CATEGORIES_MAP.map(c => c.value);

interface AvailableDoctor {
  id: string;
  name: string;
  specialty: string;
  avatarUrl?: string;
  relationshipType?: 'subscription' | 'chat' | 'consultation';
}

export default function Vault() {
  const { files, uploadFile, deleteFile, grantAccess, revokeAccess, uploadProgress, isLoading, refreshVault } = useVault();
  const [isDragging, setIsDragging] = useState(false);
  const { role, supabaseUser } = useAuth();
  const { t, language } = useLanguage();
  const { balance, canAfford, getEffectivePrice } = useWallet();
  const navigate = useNavigate();
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
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageLimit, setStorageLimit] = useState(1073741824); // 1GB default
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isStripeProcessing, setIsStripeProcessing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{ gb: number; price: number; label?: string } | null>(null);
  const [storagePlans, setStoragePlans] = useState<any[]>([
    { gb: 1, label: '+1 GB' },
    { gb: 5, label: '+5 GB', badge: 'Popular' },
    { gb: 10, label: '+10 GB', badge: 'Mejor valor' },
  ]);
  const [pricePerGb, setPricePerGb] = useState(49);
  const [showSimulator, setShowSimulator] = useState(false);

  // Fetch storage usage
  const fetchStorage = useCallback(async () => {
    if (!supabaseUser?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('storage_used_bytes, storage_limit_bytes')
      .eq('id', supabaseUser.id)
      .single();
    if (data) {
      setStorageUsed(data.storage_used_bytes || 0);
      setStorageLimit(data.storage_limit_bytes || 1073741824);
    }

    // Fetch pricing from site_settings
    const { data: pricingData } = await supabase
      .from('site_settings')
      .select('value')
      .eq('id', 'storage_pricing')
      .single();
    if (pricingData?.value) {
      const pricing = pricingData.value as any;
      if (pricing.plans && pricing.plans.length > 0) setStoragePlans(pricing.plans);
      if (pricing.price_per_gb) setPricePerGb(pricing.price_per_gb);
    }
  }, [supabaseUser?.id]);

  useEffect(() => {
    fetchStorage();
  }, [fetchStorage, files]);

  // Handle Stripe storage success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('storage_success') === 'true') {
      toast.success(t('ads.storageExpanded'));
      fetchStorage();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchStorage]);

  const storagePercentage = Math.min((storageUsed / storageLimit) * 100, 100);
  const isStorageFull = storageUsed >= storageLimit;
  const isStorageNearFull = storagePercentage >= 85;

  // Fetch doctors the patient has a relationship with (subscriptions, chats, consultations)
  const fetchRelatedDoctors = useCallback(async () => {
    if (!supabaseUser?.id) return;
    
    setLoadingDoctors(true);
    
    try {
      const doctorMap = new Map<string, 'subscription' | 'chat' | 'consultation'>();

      // 1. Get doctors from subscriptions (free follows + paid)
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('creator_id')
        .eq('subscriber_id', supabaseUser.id)
        .eq('is_active', true);

      subscriptions?.forEach(s => {
        if (s.creator_id && !doctorMap.has(s.creator_id)) {
          doctorMap.set(s.creator_id, 'subscription');
        }
      });

      // 2. Get doctors from chat sessions
      const { data: chatSessions } = await supabase
        .from('chat_sessions')
        .select('participant1_id, participant1_type, participant2_id, participant2_type, status');

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
      const { data: consultations } = await supabase
        .from('consultations')
        .select('doctor_id')
        .eq('patient_id', supabaseUser.id);

      consultations?.forEach(c => {
        if (c.doctor_id && !doctorMap.has(c.doctor_id)) {
          doctorMap.set(c.doctor_id, 'consultation');
        }
      });

      if (doctorMap.size === 0) {
        setAvailableDoctors([]);
        setLoadingDoctors(false);
        return;
      }

      // Get profiles for these doctors
      const doctorIdsArray = Array.from(doctorMap.keys());
      
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('id, name, avatar_url')
        .in('id', doctorIdsArray);
      
      if (profiles && profiles.length > 0) {
        // Batch fetch doctor specialties via doctor_profiles_public view instead of N+1 RPC calls
        const profileIds = profiles.filter(p => p.id).map(p => p.id!);
        const { data: doctorProfilesData } = await supabase
          .from('doctor_profiles_public')
          .select('user_id, specialty')
          .in('user_id', profileIds);

        const specialtyMap = new Map(
          (doctorProfilesData || []).map(d => [d.user_id, d.specialty])
        );

        const doctors: AvailableDoctor[] = profiles
          .filter(p => p.id)
          .map(profile => ({
            id: profile.id!,
            name: profile.name || 'Doctor',
            specialty: specialtyMap.get(profile.id!) || 'Medicina General',
            avatarUrl: profile.avatar_url || undefined,
            relationshipType: doctorMap.get(profile.id!),
          }));

        setAvailableDoctors(doctors);
      } else {
        setAvailableDoctors([]);
      }
    } catch (error) {
      console.error('Error fetching related doctors:', error);
      toast.error(t('ads.errorLoadingDoctors'));
    } finally {
      setLoadingDoctors(false);
    }
  }, [supabaseUser?.id]);

  useEffect(() => {
    if (role === 'patient' && supabaseUser?.id) {
      fetchRelatedDoctors();
    }
  }, [role, supabaseUser?.id, fetchRelatedDoctors]);

  if (role !== 'patient') return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check storage limit
    if (storageUsed + file.size > storageLimit) {
      setShowUpgradeDialog(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const result = await uploadFile(file, selectedCategory, description);
    if (result.success) {
      toast.success(t('ads.uploadSuccess'));
      await fetchStorage();
    } else {
      toast.error(result.error || t('ads.uploadError'));
    }
    setDescription('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpgradeStorage = async (extraGB: number, planPrice: number) => {
    if (!supabaseUser?.id) return;
    setIsUpgrading(true);

    const effectiveCost = getEffectivePrice(planPrice);

    try {
      const { data, error } = await supabase.rpc('process_wallet_purchase', {
        p_amount: effectiveCost,
        p_description: `Expansión de almacenamiento: +${extraGB}GB`,
        p_metadata: { type: 'storage_upgrade', extra_gb: extraGB },
      });

      if (error) throw error;
      const result = data as any;

      if (!result?.success) {
        toast.error(result?.error === 'Insufficient balance' 
          ? t('ads.insufficientBalance') 
          : (result?.error || t('ads.purchaseError')));
        return;
      }

      // Show debit notification
      toast.success(`${t('ads.walletDebited')} $${result.amount_charged} ${t('ads.fromWallet')} $${result.new_balance}`);

      const newLimit = storageLimit + (extraGB * 1073741824);
      await supabase
        .from('profiles')
        .update({ storage_limit_bytes: newLimit })
        .eq('id', supabaseUser.id);
      
      setStorageLimit(newLimit);
      setShowUpgradeDialog(false);
      setSelectedPlan(null);
      toast.success(`${t('ads.storageExpandedTo')} ${formatStorageSize(newLimit)}!`);
    } catch (error) {
      console.error('Upgrade error:', error);
      toast.error(t('ads.expandError'));
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleStripeStorageCheckout = async (extraGB: number, price: number) => {
    setIsStripeProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-storage-checkout', {
        body: { extraGB, price },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Storage checkout error:', error);
      toast.error(error.message || t('ads.checkoutStorageError'));
    } finally {
      setIsStripeProcessing(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatStorageSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(gb % 1 === 0 ? 0 : 1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
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
        toast.success(t('ads.accessGranted'));
        await refreshVault();
      } else {
        toast.error(result.error || t('ads.accessGrantError'));
      }
    } catch (error) {
      toast.error(t('ads.accessGrantError'));
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
        toast.success(t('ads.accessRevoked'));
        await refreshVault();
      } else {
        toast.error(result.error || t('ads.accessRevokeError'));
      }
    } catch (error) {
      toast.error(t('ads.accessRevokeError'));
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
          {t('ads.vaultTitle')}
        </h1>
        <p className="text-muted-foreground text-sm mb-4 sm:mb-6">
          {t('ads.vaultSubtitle')}
        </p>

        {/* Storage Usage Bar */}
        <Card className={`mb-6 ${isStorageFull ? 'border-destructive/50 bg-destructive/5' : isStorageNearFull ? 'border-warning/50 bg-warning/5' : 'border-border'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HardDrive className={`w-4 h-4 ${isStorageFull ? 'text-destructive' : isStorageNearFull ? 'text-warning' : 'text-primary'}`} />
                <span className="text-sm font-medium text-foreground">{t('ads.storage')}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatStorageSize(storageUsed)} {t('common.of')} {formatStorageSize(storageLimit)}
              </span>
            </div>
            <Progress 
              value={storagePercentage} 
              className={`h-2.5 ${isStorageFull ? '[&>div]:bg-destructive' : isStorageNearFull ? '[&>div]:bg-warning' : ''}`} 
            />
            <div className="flex items-center justify-between mt-3">
              {isStorageFull ? (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t('ads.storageFull')}
                </p>
              ) : isStorageNearFull ? (
                <p className="text-xs text-warning">{t('ads.storageNearFull')}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{t('ads.storageNeedMore')}</p>
              )}
              <Button 
                size="sm" 
                variant={isStorageFull ? 'default' : 'outline'} 
                className="gap-1 h-7 text-xs" 
                onClick={() => setShowUpgradeDialog(true)}
              >
                <Zap className="w-3 h-3" />
                {isStorageFull ? t('ads.expand') : t('ads.viewPlans')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground text-sm">{t('ads.accessControl')}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('ads.accessControlDesc')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="w-5 h-5" />
              {t('ads.uploadFile')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-3 sm:px-6">
            <div className="rounded-xl border-2 border-dashed border-primary/30 p-6 sm:p-8 text-center bg-primary/5">
              <Upload className="w-10 h-10 mx-auto mb-3 text-primary/60" />
              <p className="text-sm font-medium text-foreground">
                Subida segura paso a paso
              </p>
              <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-md mx-auto">
                Validación de tipo (PDF · JPG · PNG · DICOM), progreso en vivo y confirmación
                explícita de qué doctores tendrán acceso. Por defecto, ningún doctor verá tu archivo.
              </p>
              <Button
                onClick={() => {
                  if (isStorageFull) {
                    setShowUpgradeDialog(true);
                    return;
                  }
                  setShowSimulator(true);
                }}
                disabled={isLoading}
                className="gap-2"
                data-testid="vault-open-simulator"
              >
                {isStorageFull ? (
                  <>
                    <Lock className="w-4 h-4" />
                    {t('ads.storageFull')}
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Subir archivo
                  </>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground mt-3">
                {formatStorageSize(storageLimit - storageUsed)} {t('ads.available')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Upload simulator dialog */}
        <VaultUploadSimulator
          open={showSimulator}
          onOpenChange={(o) => {
            setShowSimulator(o);
            if (!o) fetchStorage();
          }}
          category={selectedCategory}
          onCategoryChange={setSelectedCategory}
          description={description}
          onDescriptionChange={setDescription}
          categories={CATEGORIES_MAP.map((c) => ({ value: c.value, label: t(c.labelKey) }))}
          availableDoctors={availableDoctors.map((d) => ({
            id: d.id,
            name: d.name,
            specialty: d.specialty,
          }))}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('ads.myFiles')} ({files.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {files.length > 0 ? (
              <div className="space-y-3">
                {files.map(file => (
                  <div key={file.id} className="flex flex-col sm:flex-row sm:items-start gap-3 p-3 sm:p-4 bg-muted/50 rounded-xl border border-border/50">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-background flex items-center justify-center flex-shrink-0 border border-border/50">
                        {getIcon(file.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{file.name}</p>
                        {file.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{file.description}</p>
                        )}
                        <div className="flex items-center flex-wrap gap-1.5 mt-1.5 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{file.category}</Badge>
                          <span>{formatSize(file.size)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(file.uploadedAt).toLocaleDateString('es-MX')}
                          </span>
                        </div>
                        
                        <div className="flex items-center flex-wrap gap-1.5 mt-2">
                          {file.permissions.length > 0 ? (
                            file.permissions.map(perm => (
                              <Badge key={perm.doctorId} variant="secondary" className="text-[10px] gap-1">
                                <Stethoscope className="w-3 h-3" />
                                <span className="truncate max-w-[80px]">{perm.doctorName || 'Doctor'}</span>
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="secondary" className="text-[10px] gap-1">
                              <Lock className="w-3 h-3" />
                              {t('ads.onlyYou')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex sm:flex-col gap-2 sm:gap-1.5 mt-1 sm:mt-0">
                      <Button variant="outline" size="sm" onClick={() => openPermissions(file)} className="gap-1.5 flex-1 sm:flex-none h-10 sm:h-8 text-xs min-w-[100px]">
                        <Share2 className="w-3.5 h-3.5" />
                        {t('ads.permissions')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={async () => {
                        const result = await deleteFile(file.id);
                        if (result.success) {
                          toast.success(t('ads.fileDeleted'));
                          await fetchStorage();
                        } else {
                          toast.error(result.error || t('ads.deleteError'));
                        }
                      }} className="text-destructive hover:text-destructive flex-1 sm:flex-none h-10 sm:h-8 text-xs min-w-[100px]">
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        {t('ads.deleteFile')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Folder className="w-8 h-8 text-primary/60" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{t('ads.emptyVaultTitle')}</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-4">
                  {t('ads.emptyVaultDesc')}
                </p>
                <Button
                  variant="outline"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {t('ads.uploadFirst')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Auditoría del Vault */}
        {supabaseUser?.id && (
          <div className="mt-6">
            <VaultAuditPanel mode="patient" userId={supabaseUser.id} />
          </div>
        )}

        <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
          <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-primary" />
                {t('ads.managePermissions')}
              </DialogTitle>
              <DialogDescription className="truncate">{currentPermissionFile?.name}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {currentPermissionFile?.permissions && currentPermissionFile.permissions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-3">{t('ads.currentAccess')}</h4>
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
                              {t('ads.since')} {new Date(perm.grantedAt).toLocaleDateString(language === 'en' ? 'en-US' : 'es-MX')}
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
                          {t('ads.revoke')}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">{t('ads.grantAccessTo')}</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  {t('ads.grantAccessHint')}
                </p>
                
                {/* Search input for doctors */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={t('inputs.searchDoctorVault')}
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
                                    {doctor.relationshipType === 'subscription' && t('ads.following')}
                                    {doctor.relationshipType === 'chat' && t('ads.chat')}
                                    {doctor.relationshipType === 'consultation' && t('ads.consultation')}
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
                            {t('ads.grantAccess')}
                          </Button>
                        </div>
                      ))
                    ) : availableDoctors.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        <Stethoscope className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-medium">{t('ads.noDocsAvailable')}</p>
                        <p className="text-xs mt-1">
                          {t('ads.noDocsAvailableDesc')}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-success" />
                        {doctorSearch 
                          ? t('ads.noDocsFound')
                          : t('ads.allDocsHaveAccess')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Button variant="outline" onClick={() => setShowPermissionDialog(false)} className="w-full">
              {t('ads.close')}
            </Button>
          </DialogContent>
        </Dialog>

        {/* Storage Upgrade Dialog */}
        <Dialog open={showUpgradeDialog} onOpenChange={(o) => { setShowUpgradeDialog(o); if (!o) setSelectedPlan(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-primary" />
                {t('ads.upgradeStorage')}
              </DialogTitle>
              <DialogDescription>
                {t('ads.storageCurrentUsage')} {formatStorageSize(storageUsed)} {t('common.of')} {formatStorageSize(storageLimit)} {t('ads.used')}
                {!selectedPlan ? ` ${t('ads.selectPlan')}` : ''}
              </DialogDescription>
            </DialogHeader>
            
            {!selectedPlan ? (
              /* Step 1: Pick a plan */
              <div className="space-y-3 mt-2">
                {storagePlans.map((plan: any) => {
                  const price = (plan.price != null) ? plan.price : plan.gb * pricePerGb;
                  return (
                    <button
                      key={plan.gb}
                      onClick={() => setSelectedPlan({ gb: plan.gb, price, label: plan.label })}
                      className="w-full flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <HardDrive className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{plan.label || `+${plan.gb} GB`}</p>
                          <p className="text-xs text-muted-foreground">Total: {formatStorageSize(storageLimit + plan.gb * 1073741824)}</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        {plan.badge && (
                          <Badge variant="secondary" className="text-[10px]">{plan.badge}</Badge>
                        )}
                        <span className="font-bold text-foreground">${getEffectivePrice(price)} MXN</span>
                      </div>
                    </button>
                  );
                })}
                <p className="text-xs text-muted-foreground text-center mt-2">
                  {t('ads.residentDiscount')}
                </p>
              </div>
            ) : (
              /* Step 2: Choose payment method */
              <div className="space-y-4 mt-2">
                <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <HardDrive className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{selectedPlan.label || `+${selectedPlan.gb} GB`}</p>
                      <p className="text-xs text-muted-foreground">Total: {formatStorageSize(storageLimit + selectedPlan.gb * 1073741824)}</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-foreground">${getEffectivePrice(selectedPlan.price)} MXN</p>
                </div>

                <Separator />

                {/* Stripe */}
                <Button 
                  onClick={() => handleStripeStorageCheckout(selectedPlan.gb, selectedPlan.price)}
                  disabled={isStripeProcessing}
                  className="w-full h-12 gap-2"
                >
                  {isStripeProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      {t('ads.payWithCard')}
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </>
                  )}
                </Button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">{t('ads.orUseBalance')}</span>
                  </div>
                </div>

                {/* Wallet */}
                {canAfford(selectedPlan.price) ? (
                  <Button 
                    onClick={() => handleUpgradeStorage(selectedPlan.gb, selectedPlan.price)}
                    disabled={isUpgrading}
                    variant="outline"
                    className="w-full h-12 gap-2"
                  >
                    {isUpgrading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Wallet className="w-4 h-4" />
                        {t('ads.payWithBalance')} (${balance.toLocaleString()})
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 p-3 bg-warning/10 rounded-lg border border-warning/30">
                      <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-warning">{t('ads.vaultInsufficientBalance')}</p>
                        <p className="text-warning/80 text-xs">
                          {t('ads.youHave')} ${balance.toLocaleString()} — {t('ads.needMore')} ${(getEffectivePrice(selectedPlan.price) - balance).toLocaleString()} {t('ads.more')}
                        </p>
                      </div>
                    </div>
                    <Button 
                      onClick={() => { setShowUpgradeDialog(false); navigate('/wallet'); }}
                      variant="outline"
                      className="w-full gap-2"
                    >
                      <Wallet className="w-4 h-4" />
                      {t('ads.rechargeWallet')}
                    </Button>
                  </div>
                )}

                <Button variant="ghost" size="sm" onClick={() => setSelectedPlan(null)} className="w-full">
                  {t('ads.changePlan')}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
