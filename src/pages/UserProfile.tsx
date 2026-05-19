import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
import { Textarea } from '@/components/ui/textarea';
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
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
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
  Stethoscope,
  GraduationCap,
  MapPin,
  Star,
  Users,
  Building,
  Award,
  X,
  Phone,
  Lock,
  Send,
} from 'lucide-react';

const COUNTRY_CODES = [
  { code: '+52', flag: '🇲🇽', label: 'MX' },
  { code: '+1', flag: '🇺🇸', label: 'US' },
  { code: '+57', flag: '🇨🇴', label: 'CO' },
  { code: '+54', flag: '🇦🇷', label: 'AR' },
  { code: '+56', flag: '🇨🇱', label: 'CL' },
  { code: '+51', flag: '🇵🇪', label: 'PE' },
  { code: '+34', flag: '🇪🇸', label: 'ES' },
];
import { ConsultationFeeEditor } from '@/components/doctor/ConsultationFeeEditor';
import { PatientClinicalHistoryCard } from '@/components/profile/PatientClinicalHistoryCard';
import { VaccinationSchedule } from '@/components/medical/VaccinationSchedule';
import { ResidentBalanceCard } from '@/components/resident/ResidentBalanceCard';
import { DoctorCredentialsCard } from '@/components/profile/DoctorCredentialsCard';

type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'expired' | null;

interface DoctorProfile {
  specialty: string;
  bio: string | null;
  location: string | null;
  rating: number;
  followers_count: number;
  status: string;
  consultation_fee: number;
}

interface ResidentProfile {
  specialty: string;
  institution: string;
  year: number;
  status: string;
  followers_count: number;
}

const containerVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05
    }
  }
};

const itemVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25
    }
  }
};

const cardVariants = {
  initial: { opacity: 0, y: 30, scale: 0.98 },
  animate: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 350,
      damping: 30
    }
  }
};

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

  // Professional profiles
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [residentProfile, setResidentProfile] = useState<ResidentProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Edit professional info
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editedBio, setEditedBio] = useState('');
  const [isSavingBio, setIsSavingBio] = useState(false);

  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [editedLocation, setEditedLocation] = useState('');
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  // Phone editing
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [isLoadingPhone, setIsLoadingPhone] = useState(true);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editedPhone, setEditedPhone] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+52');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState('');
  const [phoneSendingOtp, setPhoneSendingOtp] = useState(false);
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  const [phoneRateLimited, setPhoneRateLimited] = useState(false);

  // Email editing
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editedEmail, setEditedEmail] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // Fetch verification status and phone
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.id) return;
      
      try {
        const [verRes, phoneRes] = await Promise.all([
          supabase
            .from('identity_verifications')
            .select('status')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('phone')
            .eq('id', user.id)
            .single()
        ]);

        if (verRes.data) {
          setVerificationStatus(verRes.data.status as VerificationStatus);
        }
        setUserPhone(phoneRes.data?.phone || null);
      } catch (error) {
        // No verification found
      } finally {
        setIsLoadingVerification(false);
        setIsLoadingPhone(false);
      }
    };

    fetchUserData();
  }, [user?.id]);

  // Fetch professional profile
  useEffect(() => {
    const fetchProfessionalProfile = async () => {
      if (!user?.id) return;

      setIsLoadingProfile(true);
      try {
        if (role === 'doctor') {
          const { data } = await supabase
            .from('doctor_profiles')
            .select('specialty, bio, location, rating, followers_count, status, consultation_fee')
            .eq('user_id', user.id)
            .maybeSingle();

          if (data) {
            setDoctorProfile(data);
            setEditedBio(data.bio || '');
            setEditedLocation(data.location || '');
          }
        } else if (role === 'resident') {
          const { data } = await supabase
            .from('resident_profiles')
            .select('specialty, institution, year, status, followers_count')
            .eq('user_id', user.id)
            .maybeSingle();

          if (data) {
            setResidentProfile(data);
          }
        }
      } catch (error) {
        console.error('Error fetching professional profile:', error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfessionalProfile();
  }, [user?.id, role]);

  useEffect(() => {
    if (user?.name) {
      setEditedName(user.name);
    }
  }, [user?.name]);

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleSendPhoneOtp = async () => {
    const fullPhone = phoneCountryCode.replace('+', '') + editedPhone.replace(/\D/g, '');
    if (editedPhone.replace(/\D/g, '').length < 10) {
      toast.error(t('userProfilePage.phoneInvalid'));
      return;
    }
    setPhoneSendingOtp(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('verify-phone-otp', {
        body: { phone: fullPhone, action: 'send' },
      });
      if (res.error) throw new Error(res.error.message);
      const result = res.data;
      if (result.rateLimited) {
        setPhoneRateLimited(true);
        toast.error(result.error || t('userProfilePage.phoneRateLimit'));
        return;
      }
      if (result.alreadyVerified) {
        toast.success(t('userProfilePage.phoneAlreadyVerified'));
        setUserPhone(fullPhone);
        setIsEditingPhone(false);
        return;
      }
      setPhoneOtpSent(true);
      toast.success(result.smsSent ? t('userProfilePage.otpSentSms') : t('userProfilePage.otpSentNotification'));
    } catch (err: any) {
      toast.error(err.message || t('userProfilePage.otpSendError'));
    } finally {
      setPhoneSendingOtp(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (phoneOtpCode.length !== 6) return;
    const fullPhone = phoneCountryCode.replace('+', '') + editedPhone.replace(/\D/g, '');
    setIsVerifyingPhone(true);
    try {
      const res = await supabase.functions.invoke('verify-phone-otp', {
        body: { phone: fullPhone, action: 'verify', otp_code: phoneOtpCode },
      });
      if (res.error) throw new Error(res.error.message);
      const result = res.data;
      if (!result.success) {
        toast.error(result.error || t('userProfilePage.otpInvalid'));
        return;
      }
      toast.success(t('userProfilePage.phoneVerifiedSuccess'));
      setUserPhone(fullPhone);
      setIsEditingPhone(false);
      setPhoneOtpSent(false);
      setPhoneOtpCode('');
    } catch (err: any) {
      toast.error(err.message || t('userProfilePage.phoneVerifyError'));
    } finally {
      setIsVerifyingPhone(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!editedEmail.trim() || !editedEmail.includes('@')) {
      toast.error(t('userProfilePage.emailInvalid'));
      return;
    }
    if (editedEmail.trim() === user.email) {
      toast.error(t('userProfilePage.emailSameAsCurrent'));
      return;
    }
    setIsSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: editedEmail.trim() });
      if (error) throw error;
      toast.success(t('userProfilePage.emailVerificationSent'));
      setIsEditingEmail(false);
      setEditedEmail('');
    } catch (err: any) {
      toast.error(err.message || t('userProfilePage.emailUpdateError'));
    } finally {
      setIsSavingEmail(false);
    }
  };

  const resetPhoneEdit = () => {
    setIsEditingPhone(false);
    setPhoneOtpSent(false);
    setPhoneOtpCode('');
    setEditedPhone('');
    setPhoneRateLimited(false);
  };

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
      toast.error(t('profile.nameEmpty'));
      return;
    }

    setIsSavingName(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: editedName.trim() })
        .eq('id', user.id);

      if (error) throw error;

      toast.success(t('profile.nameUpdated'));
      setIsEditingName(false);
      refreshUser?.();
    } catch (error: any) {
      toast.error(error.message || t('profile.nameError'));
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSaveBio = async () => {
    if (!user?.id) return;

    setIsSavingBio(true);
    try {
      const { error } = await supabase
        .from('doctor_profiles')
        .update({ bio: editedBio.trim() || null })
        .eq('user_id', user.id);

      if (error) throw error;

      setDoctorProfile(prev => prev ? { ...prev, bio: editedBio.trim() || null } : null);
      toast.success(t('profile.bioUpdated'));
      setIsEditingBio(false);
    } catch (error: any) {
      toast.error(error.message || t('profile.bioError'));
    } finally {
      setIsSavingBio(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!user?.id) return;

    setIsSavingLocation(true);
    try {
      const { error } = await supabase
        .from('doctor_profiles')
        .update({ location: editedLocation.trim() || null })
        .eq('user_id', user.id);

      if (error) throw error;

      setDoctorProfile(prev => prev ? { ...prev, location: editedLocation.trim() || null } : null);
      toast.success(t('profile.locationUpdated'));
      setIsEditingLocation(false);
    } catch (error: any) {
      toast.error(error.message || t('profile.locationError'));
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('profile.onlyImages'));
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('profile.maxFileSize'));
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

      toast.success(t('profile.photoUpdated'));
      setAvatarDialogOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      refreshUser?.();
    } catch (error: any) {
      toast.error(error.message || t('profile.photoError'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleLanguageChange = async (newLanguage: 'es' | 'en' | 'pt' | 'fr' | 'it' | 'de') => {
    setIsSavingLanguage(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ preferred_language: newLanguage } as any)
        .eq('id', user.id);

      if (error) throw error;

      setLanguage(newLanguage);
      toast.success(newLanguage === 'es' ? t('profile.languageUpdatedEs') : t('profile.languageUpdatedEn'));
    } catch (error: any) {
      toast.error(error.message || t('profile.languageError'));
    } finally {
      setIsSavingLanguage(false);
    }
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat(language === 'es' ? 'es-MX' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  };

  const getRoleBadge = () => {
    const roles: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline'; icon: React.ElementType }> = {
      patient: { label: t('roles.patient'), variant: 'default', icon: User },
      doctor: { label: t('roles.doctor'), variant: 'default', icon: Stethoscope },
      resident: { label: t('roles.resident'), variant: 'default', icon: GraduationCap },
      admin: { label: t('roles.admin'), variant: 'secondary', icon: Shield },
      visitor: { label: t('roles.visitor'), variant: 'outline', icon: User },
    };
    return roles[role] || roles.visitor;
  };

  const roleBadge = getRoleBadge();
  const RoleIcon = roleBadge.icon;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-success/10 text-success border-success">{t('profile.statusApproved')}</Badge>;
      case 'pending':
        return <Badge className="bg-warning/10 text-warning border-warning">{t('profile.statusPending')}</Badge>;
      case 'rejected':
        return <Badge className="bg-destructive/10 text-destructive border-destructive">{t('profile.statusRejected')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <MainLayout>
      <motion.div 
        className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-3xl"
        variants={containerVariants}
        initial="initial"
        animate="animate"
      >
        {/* Header */}
        <motion.div className="mb-6" variants={itemVariants}>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {t('profile.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('profile.subtitle')}
          </p>
        </motion.div>

        {/* Profile Card */}
        <motion.div variants={cardVariants}>
          <Card className="mb-6 overflow-hidden">
            <CardContent className="p-6 pt-8">
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                {/* Avatar */}
                <motion.div 
                  className="relative group"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <Avatar className="w-20 h-20 sm:w-28 sm:h-28 border-4 border-background shadow-xl">
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <motion.button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Camera className="w-6 h-6 text-white" />
                  </motion.button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </motion.div>

                {/* User Info */}
                <div className="flex-1 text-center sm:text-left min-w-0">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                    <AnimatePresence mode="wait">
                      {isEditingName ? (
                        <motion.div 
                          key="editing"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="flex items-center gap-2"
                        >
                          <Input
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            className="max-w-[160px] sm:max-w-[200px]"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                          />
                          <Button size="sm" onClick={handleSaveName} disabled={isSavingName}>
                            {isSavingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setIsEditingName(false); setEditedName(user.name); }}>
                            <X className="w-4 h-4" />
                          </Button>
                        </motion.div>
                      ) : (
                        <motion.div 
                          key="display"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center gap-2"
                        >
                          <h2 className="text-xl font-semibold">{user.name}</h2>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8"
                            onClick={() => setIsEditingName(true)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {/* Email - editable */}
                  <div className="mt-1">
                    <AnimatePresence mode="wait">
                      {isEditingEmail ? (
                        <motion.div
                          key="editing-email"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-2"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <Input
                              type="email"
                              value={editedEmail}
                              onChange={(e) => setEditedEmail(e.target.value)}
                              placeholder={t('userProfilePage.newEmailPlaceholder')}
                              className="flex-1 min-w-[180px] h-9 text-sm"
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && handleChangeEmail()}
                            />
                            <Button size="sm" onClick={handleChangeEmail} disabled={isSavingEmail} className="h-9 min-h-[44px] sm:min-h-0">
                              {isSavingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              <span className="ml-1 hidden sm:inline">{t('userProfilePage.send')}</span>
                            </Button>
                            <Button size="sm" variant="ghost" className="h-9" onClick={() => { setIsEditingEmail(false); setEditedEmail(''); }}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground ml-1">
                            {t('userProfilePage.emailVerificationNotice')}
                          </p>
                        </motion.div>
                      ) : (
                        <motion.div key="display-email" className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2 text-sm sm:text-base">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-muted-foreground break-all sm:break-normal truncate max-w-[200px] sm:max-w-none">{user.email}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge className="bg-success/10 text-success border-success text-[10px] whitespace-nowrap shrink-0">{t('userProfilePage.verified')}</Badge>
                            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => { setIsEditingEmail(true); setEditedEmail(''); }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Phone - editable */}
                  <div className="mt-1">
                    <AnimatePresence mode="wait">
                      {isEditingPhone ? (
                        <motion.div
                          key="editing-phone"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-3"
                        >
                          {!phoneOtpSent ? (
                            <>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Select value={phoneCountryCode} onValueChange={setPhoneCountryCode}>
                                  <SelectTrigger className="w-[90px] h-9 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {COUNTRY_CODES.map(c => (
                                      <SelectItem key={c.code} value={c.code}>
                                        {c.flag} {c.code}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="tel"
                                  inputMode="numeric"
                                  value={editedPhone}
                                  onChange={(e) => setEditedPhone(e.target.value.replace(/[^\d]/g, ''))}
                                  placeholder={t('userProfilePage.tenDigits')}
                                  className="flex-1 min-w-[140px] h-9 text-sm"
                                  maxLength={15}
                                  autoFocus
                                />
                                <Button size="sm" onClick={handleSendPhoneOtp} disabled={phoneSendingOtp || phoneRateLimited} className="h-9 min-h-[44px] sm:min-h-0">
                                  {phoneSendingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                  <span className="ml-1 hidden sm:inline">{t('userProfilePage.sendSms')}</span>
                                </Button>
                                <Button size="sm" variant="ghost" className="h-9" onClick={resetPhoneEdit}>
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                              {phoneRateLimited && (
                                <p className="text-[11px] text-destructive flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  {t('userProfilePage.phoneRateLimitTryTomorrow')}
                                </p>
                              )}
                              <p className="text-[11px] text-muted-foreground">
                                {t('userProfilePage.phoneUsageInfo')}
                              </p>
                            </>
                          ) : (
                            <div className="space-y-3">
                              <p className="text-sm text-muted-foreground">{t('userProfilePage.enterOtpInstruction')} {phoneCountryCode} {editedPhone}</p>
                              <div className="flex items-center justify-center sm:justify-start">
                                <InputOTP maxLength={6} value={phoneOtpCode} onChange={setPhoneOtpCode}>
                                  <InputOTPGroup>
                                    {[0,1,2,3,4,5].map(i => (
                                      <InputOTPSlot key={i} index={i} />
                                    ))}
                                  </InputOTPGroup>
                                </InputOTP>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button size="sm" onClick={handleVerifyPhoneOtp} disabled={isVerifyingPhone || phoneOtpCode.length !== 6} className="min-h-[44px] sm:min-h-0">
                                  {isVerifyingPhone ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                                  {t('userProfilePage.verify')}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={resetPhoneEdit}>
                                  {t('common.cancel')}
                                </Button>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ) : (
                        <motion.div key="display-phone" className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-2">
                          {!isLoadingPhone && (
                            userPhone ? (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                                  <span className="text-sm text-muted-foreground">
                                    {userPhone.replace(/(\d{2})(\d+)(\d{4})/, '$1****$3')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Badge className="bg-success/10 text-success border-success text-[10px] whitespace-nowrap shrink-0">{t('userProfilePage.verified')}</Badge>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs px-2 min-h-[44px] sm:min-h-0" onClick={() => setIsEditingPhone(true)}>
                                    {t('userProfilePage.change')}
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                                <span className="text-sm text-muted-foreground italic">{t('userProfilePage.notVerified')}</span>
                                <Button size="sm" variant="outline" className="h-7 text-xs px-2 min-h-[44px] sm:min-h-0" onClick={() => setIsEditingPhone(true)}>
                                  <Phone className="w-3 h-3 mr-1" />
                                  {t('userProfilePage.addPhone')}
                                </Button>
                              </div>
                            )
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 justify-center sm:justify-start">
                    <Lock className="w-3 h-3" />
                    {t('userProfilePage.privateDataNotice')}
                  </p>
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-3 flex-wrap">
                    {user.countryFlag && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <span>{user.countryFlag}</span>
                        {user.countryCode || 'MX'}
                      </Badge>
                    )}
                    <Badge variant={roleBadge.variant} className="gap-1.5">
                      <RoleIcon className="w-3.5 h-3.5" />
                      {roleBadge.label}
                    </Badge>
                    {(role === 'doctor' || role === 'resident') && !isLoadingProfile && (
                      <>
                        {doctorProfile && getStatusBadge(doctorProfile.status)}
                        {residentProfile && getStatusBadge(residentProfile.status)}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Clinical History Card - Patient Only */}
        {role === 'patient' && <PatientClinicalHistoryCard />}

        {/* Vaccination Schedule - Patient Only */}
        {role === 'patient' && <VaccinationSchedule />}

        {/* Professional Profile Card - Doctor */}
        {role === 'doctor' && doctorProfile && (
          <motion.div variants={cardVariants}>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-primary" />
                  {t('profile.professionalProfile')}
                </CardTitle>
                <CardDescription>
                  {t('profile.professionalSubtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Specialty */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Award className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t('profile.specialty')}</span>
                  </div>
                  <span className="font-medium">{doctorProfile.specialty}</span>
                </div>
                <Separator />

                {/* Location */}
                <div className="py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{t('profile.location')}</span>
                    </div>
                    {!isEditingLocation && (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8"
                        onClick={() => setIsEditingLocation(true)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <AnimatePresence mode="wait">
                    {isEditingLocation ? (
                      <motion.div 
                        key="editing"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 flex items-center gap-2"
                      >
                        <Input
                          value={editedLocation}
                          onChange={(e) => setEditedLocation(e.target.value)}
                          placeholder={t('profile.locationPlaceholder')}
                          className="flex-1"
                        />
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="flex-shrink-0 gap-1"
                          disabled={isSavingLocation}
                          onClick={() => {
                            if (!('geolocation' in navigator)) {
                              toast.error(t('userProfilePage.geolocationUnsupported'));
                              return;
                            }
                            navigator.geolocation.getCurrentPosition(
                              (pos) => {
                                // Simple reverse geocode using known cities
                                const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
                                  'ciudad de mexico': { lat: 19.4326, lng: -99.1332 },
                                  'guadalajara': { lat: 20.6597, lng: -103.3496 },
                                  'monterrey': { lat: 25.6866, lng: -100.3161 },
                                  'puebla': { lat: 19.0414, lng: -98.2063 },
                                  'tijuana': { lat: 32.5149, lng: -117.0382 },
                                  'merida': { lat: 20.9674, lng: -89.5926 },
                                  'cancun': { lat: 21.1619, lng: -86.8515 },
                                  'queretaro': { lat: 20.5888, lng: -100.3899 },
                                  'oaxaca': { lat: 17.0732, lng: -96.7266 },
                                  'veracruz': { lat: 19.1738, lng: -96.1342 },
                                  'toluca': { lat: 19.2826, lng: -99.6557 },
                                };
                                const R = 6371;
                                let nearest = t('userProfilePage.defaultCity');
                                let minDist = Infinity;
                                for (const [city, coords] of Object.entries(CITY_COORDS)) {
                                  const dLat = (coords.lat - pos.coords.latitude) * Math.PI / 180;
                                  const dLng = (coords.lng - pos.coords.longitude) * Math.PI / 180;
                                  const a = Math.sin(dLat / 2) ** 2 + Math.cos(pos.coords.latitude * Math.PI / 180) * Math.cos(coords.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
                                  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                  if (dist < minDist) { minDist = dist; nearest = city.replace(/\b\w/g, c => c.toUpperCase()); }
                                }
                                setEditedLocation(nearest);
                                toast.success(`${t('userProfilePage.locationDetected')}: ${nearest}`);
                              },
                              () => toast.error(t('userProfilePage.locationError'))
                            );
                          }}
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline text-xs">{t('profile.useMyLocation')}</span>
                        </Button>
                        <Button size="sm" onClick={handleSaveLocation} disabled={isSavingLocation}>
                          {isSavingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          setIsEditingLocation(false);
                          setEditedLocation(doctorProfile.location || '');
                        }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.p 
                        key="display"
                        className="mt-1 text-sm font-medium ml-7"
                      >
                        {doctorProfile.location || <span className="text-muted-foreground italic">{t('profile.locationNotSet')}</span>}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <Separator />

                {/* Bio */}
                <div className="py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{t('profile.biography')}</span>
                    </div>
                    {!isEditingBio && (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8"
                        onClick={() => setIsEditingBio(true)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <AnimatePresence mode="wait">
                    {isEditingBio ? (
                      <motion.div 
                        key="editing"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 space-y-2"
                      >
                        <Textarea
                          value={editedBio}
                          onChange={(e) => setEditedBio(e.target.value)}
                          placeholder={t('profile.biographyPlaceholder')}
                          rows={3}
                          maxLength={500}
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{editedBio.length}/500</span>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => {
                              setIsEditingBio(false);
                              setEditedBio(doctorProfile.bio || '');
                            }}>
                              {t('common.cancel')}
                            </Button>
                            <Button size="sm" onClick={handleSaveBio} disabled={isSavingBio}>
                              {isSavingBio ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                              {t('common.save')}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.p 
                        key="display"
                        className="mt-1 text-sm ml-7"
                      >
                        {doctorProfile.bio || <span className="text-muted-foreground italic">{t('profile.biographyEmpty')}</span>}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <Separator />

                {/* Consultation Fee - Editable */}
                <ConsultationFeeEditor 
                  initialFee={doctorProfile.consultation_fee} 
                  onFeeChanged={(newFee) => setDoctorProfile(prev => prev ? { ...prev, consultation_fee: newFee } : null)}
                  variant="inline"
                />
                <Separator />

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-2">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-center gap-1 text-warning mb-1">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="font-semibold">{doctorProfile.rating.toFixed(1)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('profile.rating')}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="font-semibold">{doctorProfile.followers_count}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('profile.followers')}</p>
                  </div>
                  <ConsultationFeeEditor 
                    initialFee={doctorProfile.consultation_fee} 
                    onFeeChanged={(newFee) => setDoctorProfile(prev => prev ? { ...prev, consultation_fee: newFee } : null)}
                    variant="card"
                  />
                </div>
              </CardContent>
            </Card>
            {user?.id && <DoctorCredentialsCard userId={user.id} />}
          </motion.div>
        )}

        {/* Professional Profile Card - Resident */}
        {role === 'resident' && residentProfile && (
          <motion.div variants={cardVariants}>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-primary" />
                  {t('profile.residentProfile')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Award className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t('profile.specialty')}</span>
                  </div>
                  <span className="font-medium">{residentProfile.specialty}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Building className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t('profile.institution')}</span>
                  </div>
                  <span className="font-medium text-right max-w-[150px] sm:max-w-[200px] truncate">{residentProfile.institution}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t('profile.residencyYear')}</span>
                  </div>
                  <Badge variant="outline">{residentProfile.year}{t('profile.yearSuffix')}</Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t('profile.followers')}</span>
                  </div>
                  <span className="font-medium">{residentProfile.followers_count}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Resident Balance Card */}
        {role === 'resident' && (
          <motion.div variants={cardVariants} className="mb-6">
            <ResidentBalanceCard />
          </motion.div>
        )}


        <motion.div className="grid gap-6" variants={containerVariants}>
          {/* Language Preference */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  {t('profile.language')}
                </CardTitle>
                <CardDescription>
                  {t('profile.languageSubtitle')}
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
                      <span className="flex items-center gap-2">🇲🇽 Español</span>
                    </SelectItem>
                    <SelectItem value="en">
                      <span className="flex items-center gap-2">🇺🇸 English</span>
                    </SelectItem>
                    <SelectItem value="pt">
                      <span className="flex items-center gap-2">🇵🇹 Português</span>
                    </SelectItem>
                    <SelectItem value="fr">
                      <span className="flex items-center gap-2">🇫🇷 Français</span>
                    </SelectItem>
                    <SelectItem value="it">
                      <span className="flex items-center gap-2">🇮🇹 Italiano</span>
                    </SelectItem>
                    <SelectItem value="de">
                      <span className="flex items-center gap-2">🇩🇪 Deutsch</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </motion.div>

          {/* Account Info */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5" />
                  {t('profile.accountInfo')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Email */}
                <div className="py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{t('profile.email')}</span>
                    </div>
                    {!isEditingEmail && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setIsEditingEmail(true); setEditedEmail(''); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <AnimatePresence mode="wait">
                    {isEditingEmail ? (
                      <motion.div
                        key="edit-email-acct"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 space-y-2"
                      >
                        <p className="text-sm font-medium ml-7 mb-2">{user.email} <Badge className="ml-1 bg-success/10 text-success border-success text-[10px] whitespace-nowrap shrink-0">{t('userProfilePage.current')}</Badge></p>
                        <div className="flex items-center gap-2 ml-7 flex-wrap">
                          <Input
                            type="email"
                            value={editedEmail}
                            onChange={(e) => setEditedEmail(e.target.value)}
                            placeholder={t('userProfilePage.newEmailPlaceholder')}
                            className="flex-1 min-w-[180px] h-9"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleChangeEmail()}
                          />
                          <Button size="sm" onClick={handleChangeEmail} disabled={isSavingEmail} className="min-h-[44px] sm:min-h-0">
                            {isSavingEmail ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                            {t('userProfilePage.sendVerification')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setIsEditingEmail(false); setEditedEmail(''); }}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground ml-7">
                          {t('userProfilePage.emailVerificationNotice')}
                        </p>
                      </motion.div>
                    ) : (
                      <p className="mt-1 text-sm font-medium ml-7 flex items-center gap-2">
                        {user.email}
                        <Badge className="bg-success/10 text-success border-success text-[10px] whitespace-nowrap shrink-0">{t('userProfilePage.verified')}</Badge>
                      </p>
                    )}
                  </AnimatePresence>
                </div>
                <Separator />

                {/* Phone */}
                <div className="py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{t('userProfilePage.phone')}</span>
                    </div>
                    {!isEditingPhone && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditingPhone(true)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <AnimatePresence mode="wait">
                    {isEditingPhone ? (
                      <motion.div
                        key="edit-phone-acct"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 ml-7 space-y-3"
                      >
                        {!phoneOtpSent ? (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Select value={phoneCountryCode} onValueChange={setPhoneCountryCode}>
                                <SelectTrigger className="w-[90px] h-9 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {COUNTRY_CODES.map(c => (
                                    <SelectItem key={c.code} value={c.code}>
                                      {c.flag} {c.code}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="tel"
                                inputMode="numeric"
                                value={editedPhone}
                                onChange={(e) => setEditedPhone(e.target.value.replace(/[^\d]/g, ''))}
                                placeholder={t('userProfilePage.tenDigits')}
                                className="flex-1 min-w-[130px] h-9"
                                maxLength={15}
                                autoFocus
                              />
                              <Button size="sm" onClick={handleSendPhoneOtp} disabled={phoneSendingOtp || phoneRateLimited} className="min-h-[44px] sm:min-h-0">
                                {phoneSendingOtp ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                                {t('userProfilePage.sendSms')}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={resetPhoneEdit}>
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                            {phoneRateLimited && (
                              <p className="text-[11px] text-destructive flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> {t('userProfilePage.phoneRateLimitShort')}
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">{t('userProfilePage.codeSentTo')} {phoneCountryCode} {editedPhone}</p>
                            <InputOTP maxLength={6} value={phoneOtpCode} onChange={setPhoneOtpCode}>
                              <InputOTPGroup>
                                {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
                              </InputOTPGroup>
                            </InputOTP>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleVerifyPhoneOtp} disabled={isVerifyingPhone || phoneOtpCode.length !== 6} className="min-h-[44px] sm:min-h-0">
                                {isVerifyingPhone ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                                {t('userProfilePage.verify')}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={resetPhoneEdit}>{t('common.cancel')}</Button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <p className="mt-1 text-sm font-medium ml-7 flex items-center gap-2">
                        {!isLoadingPhone && (
                          userPhone ? (
                            <>
                              {userPhone.replace(/(\d{2})(\d+)(\d{4})/, '$1****$3')}
                              <Badge className="bg-success/10 text-success border-success text-[10px] whitespace-nowrap shrink-0">{t('userProfilePage.verified')}</Badge>
                            </>
                          ) : (
                            <span className="text-muted-foreground italic">{t('userProfilePage.notVerified')}</span>
                          )
                        )}
                      </p>
                    )}
                  </AnimatePresence>
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {t('profile.memberSince')}
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
                      {t('profile.identityVerification')}
                    </span>
                  </div>
                  {isLoadingVerification ? (
                    <Badge variant="secondary">
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ...
                    </Badge>
                  ) : verificationStatus === 'approved' ? (
                    <Badge className="gap-1 bg-success/10 text-success border-success">
                      <Check className="w-3 h-3" />
                      {t('profile.verified')}
                    </Badge>
                  ) : verificationStatus === 'pending' ? (
                    <Badge className="gap-1 bg-warning/10 text-warning border-warning">
                      <Clock className="w-3 h-3" />
                      {t('profile.pending')}
                    </Badge>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate('/verify-identity')}
                    >
                      <FileCheck className="w-3 h-3 mr-1" />
                      {t('profile.verify')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Links */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  {t('profile.quickLinks')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {role === 'patient' && (
                    <>
                      <Button variant="outline" className="justify-start gap-2" onClick={() => navigate('/wallet')}>
                        <Wallet className="w-4 h-4" />
                        {t('profile.myWallet')}
                      </Button>
                      <Button variant="outline" className="justify-start gap-2" onClick={() => navigate('/vault')}>
                        <Shield className="w-4 h-4" />
                        {t('profile.myVault')}
                      </Button>
                      <Button variant="outline" className="justify-start gap-2" onClick={() => navigate('/medical-history')}>
                        <User className="w-4 h-4" />
                        {t('profile.medicalHistory')}
                      </Button>
                    </>
                  )}
                  {role === 'doctor' && (
                    <>
                      <Button variant="outline" className="justify-start gap-2" onClick={() => navigate('/doctor/dashboard')}>
                        <Stethoscope className="w-4 h-4" />
                        {t('userProfilePage.dashboard')}
                      </Button>
                      <Button variant="outline" className="justify-start gap-2" onClick={() => navigate('/doctor/recordings')}>
                        <Camera className="w-4 h-4" />
                        {t('profile.recordings')}
                      </Button>
                    </>
                  )}
                  {role === 'resident' && (
                    <Button variant="outline" className="justify-start gap-2" onClick={() => navigate('/groups')}>
                      <Users className="w-4 h-4" />
                      {t('profile.groups')}
                    </Button>
                  )}
                  <Button variant="outline" className="justify-start gap-2" onClick={() => navigate('/settings')}>
                    <Settings className="w-4 h-4" />
                    {t('nav.settings')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Avatar Upload Dialog */}
      <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('profile.changePhoto')}
            </DialogTitle>
            <DialogDescription>
              {t('profile.photoPreview')}
            </DialogDescription>
          </DialogHeader>
          <motion.div 
            className="flex justify-center py-6"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <Avatar className="w-32 h-32 border-4 border-background shadow-xl">
              <AvatarImage src={previewUrl || undefined} alt={t('userProfilePage.previewAlt')} />
              <AvatarFallback className="text-3xl bg-primary text-primary-foreground">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
          </motion.div>
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
              {t('common.cancel')}
            </Button>
            <Button onClick={handleUploadAvatar} disabled={isUploadingAvatar}>
              {isUploadingAvatar ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('profile.uploading')}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {t('common.save')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}