import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Eye,
  BadgeCheck,
  ChevronRight,
  CalendarDays,
  Briefcase,
  ClipboardList,
  Circle,
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
import { MySubscribedDoctorsCard } from '@/components/subscriptions/MySubscribedDoctorsCard';
import { ResidentBalanceCard } from '@/components/resident/ResidentBalanceCard';
import { DoctorCredentialsCard } from '@/components/profile/DoctorCredentialsCard';
import DoctorCredentials from '@/components/doctor/DoctorCredentials';
import { SenyeraIcon, LanguageOptionsList } from '@/components/settings/LanguageSwitcher';
import { CedulaVerifyLink } from '@/components/doctor/CedulaVerifyLink';
import { generatePlaceholderCedula, getSpecialistCredentialLabelKey } from '@/lib/cedulaVerification';
import { doctorHref } from '@/lib/doctorSections';
import { useSectionParam } from '@/components/common/SectionTabs';
import { SignatureUpload } from '@/components/doctor/SignatureUpload';
import { money } from '@/lib/proFormat';

type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'expired' | null;

interface DoctorProfile {
  specialty: string;
  bio: string | null;
  location: string | null;
  rating: number;
  followers_count: number;
  status: string;
  consultation_fee: number;
  cedula_profesional?: string | null;
  license?: string | null;
  numero_consejo?: string | null;
  // Campos que YA existían en doctor_profiles y que el perfil no leía: los usa
  // el diseño de la maqueta (10-sep-2026). Ninguno es columna nueva.
  secondary_specialties?: string[] | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  practice_hospital?: string | null;
  university?: string | null;
  total_consultations?: number | null;
  office_days?: string[] | null;
  office_hours_start?: string | null;
  office_hours_end?: string | null;
}

/** Pestañas de «Mi perfil profesional» en 4 bloques (reestructura 11-sep-2026):
 *  identidad y verificación · trayectoria · servicios y disponibilidad ·
 *  contenido y monetización. La disponibilidad se EDITA solo desde Agenda;
 *  aquí queda un resumen de solo lectura dentro de «servicios». Sincronizada
 *  con `?b=` para que un enlace lleve directo al bloque. */
type ProfTab = 'identidad' | 'trayectoria' | 'servicios' | 'contenido';
const PROF_TAB_IDS: readonly ProfTab[] = ['identidad', 'trayectoria', 'servicios', 'contenido'];

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

export interface UserProfileProps {
  /** Cuenta > Perfil incrusta aquí el perfil profesional en sus 4 bloques
   *  (b=identidad|trayectoria|servicios|contenido): sin MainLayout ni título
   *  propio. Solo afecta a la rama médico; paciente/residente ignoran la prop. */
  embedded?: boolean;
}

export default function UserProfile({ embedded = false }: UserProfileProps = {}) {
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

  const [isEditingCedula, setIsEditingCedula] = useState(false);
  const [editedCedula, setEditedCedula] = useState('');
  const [isSavingCedula, setIsSavingCedula] = useState(false);
  const [isEditingConsejo, setIsEditingConsejo] = useState(false);
  const [editedConsejo, setEditedConsejo] = useState('');
  const [isSavingConsejo, setIsSavingConsejo] = useState(false);

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

  // Perfil profesional PRO en 4 bloques (11-sep-2026): la pestaña activa vive
  // en `?b=` (así doctorHref('perfil', { b: 'servicios' }) etc. abren directo)
  // y las cifras de trayectoria y reseñas salen de tablas que ya existen.
  const [profTab, setProfTab] = useSectionParam('b', PROF_TAB_IDS, 'identidad');
  const [careerCounts, setCareerCounts] = useState({ certifications: 0, education: 0, experience: 0 });
  const [reviewsCount, setReviewsCount] = useState(0);

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
            .select('specialty, bio, location, rating, followers_count, status, consultation_fee, cedula_profesional, license, numero_consejo, secondary_specialties, city, state, country, practice_hospital, university, total_consultations, office_days, office_hours_start, office_hours_end')
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

  // Cifras de trayectoria y reseñas del propio médico. Se cuentan con `head` +
  // `count` (no traen filas) y solo se piden si el rol es médico.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id || role !== 'doctor') return;
      const q = (table: string) =>
        supabase.from(table as any).select('id', { count: 'exact', head: true }).eq('doctor_id', user.id);
      const [cert, edu, exp, rev] = await Promise.all([
        q('doctor_certifications'),
        q('doctor_education'),
        q('doctor_experience'),
        supabase.from('consultation_ratings').select('id', { count: 'exact', head: true }).eq('doctor_id', user.id),
      ]);
      if (!alive) return;
      setCareerCounts({
        certifications: cert.count || 0,
        education: edu.count || 0,
        experience: exp.count || 0,
      });
      setReviewsCount(rev.count || 0);
    })();
    return () => { alive = false; };
  }, [user?.id, role]);

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

  const handleSaveCedula = async () => {
    if (!user?.id) return;

    setIsSavingCedula(true);
    try {
      const value = editedCedula.trim() || null;
      const { error } = await supabase
        .from('doctor_profiles')
        .update({ cedula_profesional: value })
        .eq('user_id', user.id);

      if (error) throw error;

      setDoctorProfile(prev => prev ? { ...prev, cedula_profesional: value } : null);
      toast.success(t('profile.cedulaUpdated'));
      setIsEditingCedula(false);
    } catch (error: any) {
      toast.error(error.message || t('profile.cedulaError'));
    } finally {
      setIsSavingCedula(false);
    }
  };

  // Cédula de especialista / colegiado (según el país). Se persiste en la columna
  // existente `numero_consejo` de doctor_profiles (consejo/board de especialidad).
  const handleSaveConsejo = async () => {
    if (!user?.id) return;

    setIsSavingConsejo(true);
    try {
      const value = editedConsejo.trim() || null;
      const { error } = await supabase
        .from('doctor_profiles')
        .update({ numero_consejo: value })
        .eq('user_id', user.id);

      if (error) throw error;

      setDoctorProfile(prev => prev ? { ...prev, numero_consejo: value } : null);
      toast.success(t('profile.specialistUpdated'));
      setIsEditingConsejo(false);
    } catch (error: any) {
      toast.error(error.message || t('profile.specialistError'));
    } finally {
      setIsSavingConsejo(false);
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

  // ==========================================================================
  // MI PERFIL PROFESIONAL — maqueta del cliente (10-sep-2026), diseño PRO.
  // Solo diseño: cada campo que se pinta ya existía y se guarda donde se
  // guardaba (mismos handlers, misma base). Lo que la maqueta enseña y la base
  // NO tiene se ha dejado fuera a propósito: «Idiomas» que habla el médico y
  // «Modalidades de atención» no son columnas de doctor_profiles, y el número
  // de reseñas sale de consultation_ratings, que sí existe.
  // La pestaña Disponibilidad ya no edita el horario: desde el 11-sep-2026 vive en
  // Agenda › Disponibilidad (tramos por día de la semana y días sueltos). Aquí se enlaza.
  // ==========================================================================
  if (role === 'doctor' && doctorProfile) {
    const specialties = [doctorProfile.specialty, ...(doctorProfile.secondary_specialties || [])].filter(Boolean);
    const cedulaValue = doctorProfile.cedula_profesional || doctorProfile.license || '';
    const place = [doctorProfile.location, doctorProfile.city, doctorProfile.state, doctorProfile.country]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(', ');

    const checklist = [
      { done: !!user.avatarUrl, label: t('pro.profile.chkPhoto'), tab: 'identidad' as ProfTab },
      { done: !!doctorProfile.bio, label: t('pro.profile.chkBio'), tab: 'identidad' as ProfTab },
      { done: !!doctorProfile.location, label: t('pro.profile.chkLocation'), tab: 'identidad' as ProfTab },
      { done: !!cedulaValue, label: t('pro.profile.chkCedula'), tab: 'identidad' as ProfTab },
      { done: !!doctorProfile.numero_consejo, label: t(getSpecialistCredentialLabelKey(user.countryCode)), tab: 'identidad' as ProfTab },
      { done: Number(doctorProfile.consultation_fee) > 0, label: t('pro.profile.chkFee'), tab: 'servicios' as ProfTab },
      { done: careerCounts.certifications > 0, label: t('pro.profile.chkCertifications'), tab: 'trayectoria' as ProfTab },
      { done: careerCounts.education > 0, label: t('pro.profile.chkEducation'), tab: 'trayectoria' as ProfTab },
      { done: careerCounts.experience > 0, label: t('pro.profile.chkExperience'), tab: 'trayectoria' as ProfTab },
      { done: (doctorProfile.office_days?.length || 0) > 0, label: t('pro.profile.chkHours'), tab: 'servicios' as ProfTab },
    ];
    const completion = Math.round((checklist.filter(c => c.done).length / checklist.length) * 100);

    const profTabs: { key: ProfTab; label: string }[] = [
      { key: 'identidad', label: t('mm2.account.profileTabs.identidad') },
      { key: 'trayectoria', label: t('mm2.account.profileTabs.trayectoria') },
      { key: 'servicios', label: t('mm2.account.profileTabs.servicios') },
      { key: 'contenido', label: t('mm2.account.profileTabs.contenido') },
    ];

    const statusPill = () => {
      if (doctorProfile.status === 'approved') return <span className="pro-pill pro-pill-ok">{t('pro.profile.visible')}</span>;
      if (doctorProfile.status === 'pending') return <span className="pro-pill pro-pill-warn">{t('profile.statusPending')}</span>;
      return <span className="pro-pill pro-pill-live">{t('profile.statusRejected')}</span>;
    };

    const Wrapper = embedded ? React.Fragment : MainLayout;

    return (
      <Wrapper>
        <div className={embedded ? '' : 'pro-container pro-page'}>
          {!embedded && (
          <div className="pro-page-head">
            <div className="min-w-0">
              <h1 className="pro-page-title"><Stethoscope className="w-7 h-7" /> <span className="truncate">{t('pro.profile.title')}</span></h1>
              <p className="pro-page-sub">{t('pro.profile.subtitle')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Link to={`/doctor/${user.id}`} className="pro-btn pro-btn-ghost flex-1 sm:flex-none">
                <Eye /> {t('pro.profile.publicPreview')}
              </Link>
              <Link to="/settings" className="pro-btn pro-btn-white flex-1 sm:flex-none">
                <Settings /> {t('nav.settings')}
              </Link>
            </div>
          </div>
          )}

          {/* -------------------------------------------------- identidad */}
          <section className="pro-card pro-card-pad mb-3 sm:mb-4">
            <div className="pro-prof-head">
              <div className="pro-prof-avatar">
                <span className="pro-initials">
                  {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} /> : getInitials(user.name)}
                </span>
                <button type="button" className="cam" onClick={() => fileInputRef.current?.click()} aria-label={t('profile.changePhoto')}>
                  <Camera />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              </div>

              {/* Base de 220 px: incrustado en Cuenta (columna de ~620 px) el medidor de
                  progreso (flex 1 1 200px) aplastaba el nombre a una sílaba por línea;
                  con base propia, lo que no cabe salta de fila (pro-prof-head es wrap). */}
              <div className="min-w-0 flex-[1_1_220px]">
                {isEditingName ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="max-w-[240px] bg-white"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    />
                    <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={handleSaveName} disabled={isSavingName}>
                      {isSavingName ? <Loader2 className="animate-spin" /> : <Check />}
                    </button>
                    <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={() => { setIsEditingName(false); setEditedName(user.name); }}>
                      <X />
                    </button>
                  </div>
                ) : (
                  <div className="pro-prof-name">
                    <h2>{user.name}</h2>
                    {doctorProfile.status === 'approved' && <BadgeCheck className="verified" />}
                    <button type="button" className="pro-kebab" onClick={() => setIsEditingName(true)} aria-label={t('common.edit')}>
                      <Pencil />
                    </button>
                  </div>
                )}
                <p className="pro-prof-spec">{doctorProfile.specialty}</p>
              </div>

              <div className="pro-progress">
                <div className="top">
                  <span>{t('pro.profile.completed')}</span>
                  <b>{completion}%</b>
                </div>
                <div className="bar"><i style={{ width: `${completion}%` }} /></div>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-1 flex-shrink-0">
                {statusPill()}
                <span className="pro-row-sub">{t('pro.profile.visibleHint')}</span>
              </div>
            </div>

            <div className="pro-seg mt-4">
              {profTabs.map(pt => (
                <button
                  key={pt.key}
                  type="button"
                  className={profTab === pt.key ? 'is-active' : ''}
                  aria-pressed={profTab === pt.key}
                  onClick={() => setProfTab(pt.key)}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </section>

          <div className="pro-work pro-work-prof">
            <div className="min-w-0 space-y-3 sm:space-y-4">
              {/* ------------------------------ 1. Identidad y verificación */}
              {profTab === 'identidad' && (
                <>
                  <section className="pro-card pro-card-pad">
                    <div className="pro-card-head">
                      <h3 className="pro-card-title"><User /> {t('pro.profile.presentation')}</h3>
                      {!isEditingBio && (
                        <button type="button" className="pro-kebab" onClick={() => setIsEditingBio(true)} aria-label={t('common.edit')}>
                          <Pencil />
                        </button>
                      )}
                    </div>
                    {isEditingBio ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editedBio}
                          onChange={(e) => setEditedBio(e.target.value)}
                          placeholder={t('profile.biographyPlaceholder')}
                          rows={5}
                          maxLength={500}
                          className="bg-white"
                        />
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="pro-row-sub">{editedBio.length}/500</span>
                          <div className="flex gap-2">
                            <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={() => { setIsEditingBio(false); setEditedBio(doctorProfile.bio || ''); }}>
                              {t('common.cancel')}
                            </button>
                            <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={handleSaveBio} disabled={isSavingBio}>
                              {isSavingBio ? <Loader2 className="animate-spin" /> : <Check />} {t('common.save')}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm pro-ink-2 whitespace-pre-line">
                          {doctorProfile.bio || <span className="pro-muted italic">{t('profile.biographyEmpty')}</span>}
                        </p>
                        {doctorProfile.bio && <p className="pro-row-sub mt-2">{doctorProfile.bio.length}/500</p>}
                      </>
                    )}
                  </section>

                  <section className="pro-card pro-card-pad">
                    <div className="pro-card-head">
                      <h3 className="pro-card-title"><Camera /> {t('pro.profile.photoTitle')}</h3>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="pro-initials w-20 h-20 text-[22px]">
                        {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} /> : getInitials(user.name)}
                      </span>
                      <div className="min-w-0">
                        <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={() => fileInputRef.current?.click()}>
                          <Camera /> {t('profile.changePhoto')}
                        </button>
                        <p className="pro-row-sub mt-2">{t('pro.profile.photoHint')}</p>
                      </div>
                    </div>
                  </section>

                  <section className="pro-card pro-card-pad">
                    <div className="pro-card-head">
                      <h3 className="pro-card-title"><Award /> {t('pro.profile.specialties')}</h3>
                    </div>
                    <div className="pro-taglist">
                      {specialties.map(s => <span key={s} className="pro-tag pro-tag-teal">{s}</span>)}
                    </div>
                    <p className="pro-row-sub mt-2">{t('pro.profile.specialtiesHint')}</p>

                    {(doctorProfile.practice_hospital || doctorProfile.university) && (
                      <div className="mt-3">
                        {doctorProfile.practice_hospital && (
                          <div className="pro-ctx-line"><span className="k">{t('pro.profile.hospital')}</span><span className="v">{doctorProfile.practice_hospital}</span></div>
                        )}
                        {doctorProfile.university && (
                          <div className="pro-ctx-line"><span className="k">{t('pro.profile.university')}</span><span className="v">{doctorProfile.university}</span></div>
                        )}
                      </div>
                    )}
                  </section>

                  <section className="pro-card pro-card-pad">
                    <div className="pro-card-head">
                      <h3 className="pro-card-title"><MapPin /> {t('profile.location')}</h3>
                      {!isEditingLocation && (
                        <button type="button" className="pro-kebab" onClick={() => setIsEditingLocation(true)} aria-label={t('common.edit')}>
                          <Pencil />
                        </button>
                      )}
                    </div>
                    {isEditingLocation ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Input
                          value={editedLocation}
                          onChange={(e) => setEditedLocation(e.target.value)}
                          placeholder={t('profile.locationPlaceholder')}
                          className="flex-1 min-w-[180px] bg-white"
                        />
                        <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={handleSaveLocation} disabled={isSavingLocation}>
                          {isSavingLocation ? <Loader2 className="animate-spin" /> : <Check />}
                        </button>
                        <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={() => { setIsEditingLocation(false); setEditedLocation(doctorProfile.location || ''); }}>
                          <X />
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm pro-ink-2">
                        {place || <span className="pro-muted italic">{t('profile.locationNotSet')}</span>}
                      </p>
                    )}
                  </section>

                  <section className="pro-card pro-card-pad">
                    <div className="pro-card-head">
                      <h3 className="pro-card-title"><FileCheck /> {t('pro.profile.credentials')}</h3>
                    </div>

                    <div className="pro-field">
                      <span className="k">{t('profile.cedula')}</span>
                      {isEditingCedula ? (
                        <div className="row">
                          <Input value={editedCedula} onChange={(e) => setEditedCedula(e.target.value)} placeholder={t('profile.cedulaPlaceholder')} className="flex-1 font-mono bg-white" />
                          <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={handleSaveCedula} disabled={isSavingCedula}>
                            {isSavingCedula ? <Loader2 className="animate-spin" /> : <Check />}
                          </button>
                          <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" disabled={isSavingCedula} onClick={() => setIsEditingCedula(false)}>
                            <X />
                          </button>
                        </div>
                      ) : (
                        <div className="row">
                          <span className="box font-mono">{cedulaValue || generatePlaceholderCedula(user.id)}</span>
                          <button
                            type="button"
                            className="pro-btn pro-btn-outline pro-btn-sm"
                            aria-label={t('common.edit')}
                            onClick={() => { setEditedCedula(cedulaValue); setIsEditingCedula(true); }}
                          >
                            <Pencil />
                          </button>
                        </div>
                      )}
                      <div className="mt-2"><CedulaVerifyLink country={user.countryCode} /></div>
                    </div>

                    <div className="pro-field">
                      <span className="k">{t(getSpecialistCredentialLabelKey(user.countryCode))}</span>
                      {isEditingConsejo ? (
                        <div className="row">
                          <Input value={editedConsejo} onChange={(e) => setEditedConsejo(e.target.value)} placeholder={t('profile.specialistPlaceholder')} className="flex-1 font-mono bg-white" />
                          <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={handleSaveConsejo} disabled={isSavingConsejo}>
                            {isSavingConsejo ? <Loader2 className="animate-spin" /> : <Check />}
                          </button>
                          <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" disabled={isSavingConsejo} onClick={() => setIsEditingConsejo(false)}>
                            <X />
                          </button>
                        </div>
                      ) : (
                        <div className="row">
                          <span className="box font-mono">{doctorProfile.numero_consejo || t('profile.cedulaEmpty')}</span>
                          <button
                            type="button"
                            className="pro-btn pro-btn-outline pro-btn-sm"
                            aria-label={t('common.edit')}
                            onClick={() => { setEditedConsejo(doctorProfile.numero_consejo || ''); setIsEditingConsejo(true); }}
                          >
                            <Pencil />
                          </button>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Correo y teléfono: antes /profile y /settings se remitían el
                      uno al otro y el médico no podía cambiarlos (bug encontrado
                      11-sep-2026). Los mismos editores con OTP que ya usan
                      paciente y residente, ahora también aquí. */}
                  <section className="pro-card pro-card-pad">
                    <div className="pro-card-head">
                      <h3 className="pro-card-title"><Mail /> {t('pro.profile.contact')}</h3>
                    </div>
                    <div className="pro-field">
                      <span className="k">{t('profile.email')}</span>
                      <div className="row flex-wrap">
                        {isEditingEmail ? (
                          <div className="flex items-center gap-2 flex-wrap w-full">
                            <Input
                              type="email"
                              value={editedEmail}
                              onChange={(e) => setEditedEmail(e.target.value)}
                              placeholder={t('userProfilePage.newEmailPlaceholder')}
                              className="flex-1 min-w-[180px] h-9 text-sm bg-white"
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && handleChangeEmail()}
                            />
                            <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={handleChangeEmail} disabled={isSavingEmail}>
                              {isSavingEmail ? <Loader2 className="animate-spin" /> : <Send />}
                            </button>
                            <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={() => { setIsEditingEmail(false); setEditedEmail(''); }}>
                              <X />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="box"><Mail /><span className="min-w-0 break-all">{user.email}</span></span>
                            <span className="pro-pill pro-pill-ok">{t('userProfilePage.verified')}</span>
                            <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" aria-label={t('common.edit')} onClick={() => { setIsEditingEmail(true); setEditedEmail(''); }}>
                              <Pencil />
                            </button>
                          </>
                        )}
                      </div>
                      {isEditingEmail && <p className="hint">{t('userProfilePage.emailVerificationNotice')}</p>}
                    </div>

                    <div className="pro-field">
                      <span className="k">{t('userProfilePage.phone')}</span>
                      {isEditingPhone ? (
                        !phoneOtpSent ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Select value={phoneCountryCode} onValueChange={setPhoneCountryCode}>
                                <SelectTrigger className="w-[92px] h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {COUNTRY_CODES.map(c => (
                                    <SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="tel"
                                inputMode="numeric"
                                value={editedPhone}
                                onChange={(e) => setEditedPhone(e.target.value.replace(/[^\d]/g, ''))}
                                placeholder={t('userProfilePage.tenDigits')}
                                className="flex-1 min-w-[140px] h-9 text-sm bg-white"
                                maxLength={15}
                              />
                              <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={handleSendPhoneOtp} disabled={phoneSendingOtp || phoneRateLimited}>
                                {phoneSendingOtp ? <Loader2 className="animate-spin" /> : <Send />}
                              </button>
                              <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={resetPhoneEdit}>
                                <X />
                              </button>
                            </div>
                            {phoneRateLimited && (
                              <p className="hint" style={{ color: 'var(--pro-live)' }}>{t('userProfilePage.phoneRateLimitTryTomorrow')}</p>
                            )}
                            <p className="hint">{t('userProfilePage.phoneUsageInfo')}</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="pro-row-sub">{t('userProfilePage.enterOtpInstruction')} {phoneCountryCode} {editedPhone}</p>
                            <InputOTP maxLength={6} value={phoneOtpCode} onChange={setPhoneOtpCode}>
                              <InputOTPGroup>
                                {[0, 1, 2, 3, 4, 5].map(i => <InputOTPSlot key={i} index={i} />)}
                              </InputOTPGroup>
                            </InputOTP>
                            <div className="flex items-center gap-2">
                              <button type="button" className="pro-btn pro-btn-teal pro-btn-sm" onClick={handleVerifyPhoneOtp} disabled={isVerifyingPhone || phoneOtpCode.length !== 6}>
                                {isVerifyingPhone ? <Loader2 className="animate-spin" /> : <Check />} {t('userProfilePage.verify')}
                              </button>
                              <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={resetPhoneEdit}>{t('common.cancel')}</button>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="row">
                          <span className="box">
                            <Phone />
                            {!isLoadingPhone && (userPhone ? userPhone.replace(/(\d{2})(\d+)(\d{4})/, '$1****$3') : t('userProfilePage.notVerified'))}
                          </span>
                          {userPhone
                            ? <span className="pro-pill pro-pill-ok">{t('userProfilePage.verified')}</span>
                            : <span className="pro-pill pro-pill-muted">{t('userProfilePage.notVerified')}</span>}
                          <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" aria-label={t('common.edit')} onClick={() => setIsEditingPhone(true)}>
                            <Pencil />
                          </button>
                        </div>
                      )}
                      <p className="hint">{t('pro.profile.phoneHint')}</p>
                    </div>
                  </section>

                  <section className="pro-card pro-card-pad">
                    <div className="pro-card-head">
                      <h3 className="pro-card-title"><Shield /> {t('profile.identityVerification')}</h3>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {isLoadingVerification ? (
                        <span className="pro-pill pro-pill-muted">…</span>
                      ) : verificationStatus === 'approved' ? (
                        <span className="pro-pill pro-pill-ok">{t('profile.verified')}</span>
                      ) : verificationStatus === 'pending' ? (
                        <span className="pro-pill pro-pill-warn">{t('profile.pending')}</span>
                      ) : (
                        <button type="button" className="pro-btn pro-btn-outline pro-btn-sm" onClick={() => navigate('/verify-identity')}>
                          <FileCheck /> {t('profile.verify')}
                        </button>
                      )}
                      <span className="pro-row-sub">{t('mm2.account.identityHint')}</span>
                    </div>
                  </section>

                  <SignatureUpload />
                </>
              )}

              {/* ------------------------------------------- 2. Trayectoria */}
              {profTab === 'trayectoria' && (
                <>
                  <DoctorCredentialsCard userId={user.id} />
                  <DoctorCredentials doctorId={user.id} isOwner />
                </>
              )}

              {/* ------------------------------- 3. Servicios y disponibilidad */}
              {profTab === 'servicios' && (
                <>
                  <section className="pro-card pro-card-pad">
                    <div className="pro-card-head">
                      <h3 className="pro-card-title"><Wallet /> {t('pro.profile.consultPrice')}</h3>
                    </div>
                    <ConsultationFeeEditor
                      initialFee={doctorProfile.consultation_fee}
                      onFeeChanged={(newFee) => setDoctorProfile(prev => prev ? { ...prev, consultation_fee: newFee } : null)}
                      variant="inline"
                    />
                    <p className="pro-row-sub mt-2">{t('pro.profile.consultPriceHint')}</p>
                  </section>

                  {/* La disponibilidad se EDITA solo desde Agenda (petición del
                      cliente 11-sep-2026): aquí queda un resumen y el enlace. */}
                  <section className="pro-card pro-card-pad">
                    <div className="pro-card-head">
                      <h3 className="pro-card-title"><Clock /> {t('mm2.schedule.profileCard.title')}</h3>
                    </div>
                    <p className="pro-row-sub mb-3">{t('mm2.schedule.profileCard.desc')}</p>
                    <Link to={doctorHref('agenda', { tab: 'disponibilidad' })} className="pro-btn pro-btn-teal w-full sm:w-auto"><Clock /> {t('mm2.schedule.profileCard.cta')}</Link>
                  </section>
                  <section className="pro-card pro-card-pad">
                    <div className="pro-card-head">
                      <h3 className="pro-card-title"><CalendarDays /> {t('pro.profile.agendaTitle')}</h3>
                    </div>
                    <p className="pro-row-sub mb-3">{t('pro.profile.agendaHint')}</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Link to="/doctor/agenda" className="pro-btn pro-btn-teal flex-1"><CalendarDays /> {t('pro.nav.agenda')}</Link>
                      <Link to={doctorHref('agenda', { tab: 'disponibilidad' })} className="pro-btn pro-btn-outline flex-1"><Clock /> {t('nav.availability')}</Link>
                    </div>
                  </section>

                  <section className="pro-card pro-card-pad">
                    <div className="pro-card-head">
                      <h3 className="pro-card-title"><Star /> {t('pro.profile.numbers')}</h3>
                    </div>
                    <div className="pro-statbar">
                      <div className="pro-stat">
                        <span className="pro-icon-box"><Star /></span>
                        <span className="min-w-0">
                          <span className="k block">{t('profile.rating')}</span>
                          <span className="v block">{Number(doctorProfile.rating || 0).toFixed(1)}</span>
                        </span>
                      </div>
                      <div className="pro-stat">
                        <span className="pro-icon-box"><Users /></span>
                        <span className="min-w-0">
                          <span className="k block">{t('profile.followers')}</span>
                          <span className="v block">{doctorProfile.followers_count}</span>
                        </span>
                      </div>
                      <div className="pro-stat">
                        <span className="pro-icon-box"><Stethoscope /></span>
                        <span className="min-w-0">
                          <span className="k block">{t('pro.profile.consultationsDone')}</span>
                          <span className="v block">{doctorProfile.total_consultations ?? 0}</span>
                        </span>
                      </div>
                      <div className="pro-stat">
                        <span className="pro-icon-box"><Award /></span>
                        <span className="min-w-0">
                          <span className="k block">{t('pro.profile.reviews')}</span>
                          <span className="v block">{reviewsCount}</span>
                        </span>
                      </div>
                    </div>
                  </section>
                </>
              )}

              {/* --------------------------- 4. Contenido y monetización */}
              {profTab === 'contenido' && (
                <>
                  <section className="pro-card pro-card-pad">
                    <div className="pro-card-head">
                      <h3 className="pro-card-title"><Camera /> {t('mm2.account.content.title')}</h3>
                    </div>
                    <p className="pro-row-sub mb-3">{t('mm2.account.content.hint')}</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Link to={doctorHref('contenido', { tab: 'publicaciones' })} className="pro-btn pro-btn-teal flex-1"><Camera /> {t('mm2.account.content.goPublications')}</Link>
                      <Link to={doctorHref('contenido', { tab: 'crear' })} className="pro-btn pro-btn-outline flex-1">{t('mm2.account.content.goCreate')}</Link>
                    </div>
                  </section>

                  <section className="pro-card pro-card-pad">
                    <div className="pro-card-head">
                      <h3 className="pro-card-title"><Users /> {t('pro.profile.subscriptions')}</h3>
                    </div>
                    <p className="pro-row-sub mb-3">{t('pro.profile.subscriptionsHint')}</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Link to={doctorHref('cuenta', { tab: 'finanzas', f: 'suscriptores' })} className="pro-btn pro-btn-teal flex-1"><Users /> {t('pro.subs.title')}</Link>
                      <Link to={doctorHref('cuenta', { tab: 'finanzas', f: 'ingresos' })} className="pro-btn pro-btn-outline flex-1"><Wallet /> {t('pro.subs.goEarnings')}</Link>
                    </div>
                  </section>

                  {/* Los médicos también siguen a otros médicos: se queda aquí,
                      no en Cuenta (que ya no repite lo profesional). */}
                  <MySubscribedDoctorsCard />
                </>
              )}
            </div>

            {/* ------------------------------------ vista previa y estado */}
            <aside className="min-w-0 space-y-3 sm:space-y-4">
              <section className="pro-card pro-card-pad">
                <div className="pro-card-head">
                  <h3 className="pro-card-title"><Eye /> {t('pro.profile.previewTitle')}</h3>
                </div>
                <div className="pro-preview">
                  <div className="who">
                    <span className="pro-initials">
                      {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : getInitials(user.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="pro-row-name truncate flex items-center gap-1.5">
                        {user.name}
                        {doctorProfile.status === 'approved' && <BadgeCheck className="w-4 h-4 text-[color:var(--pro-info)]" />}
                      </p>
                      <p className="pro-row-sub truncate">{doctorProfile.specialty}</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    {place && <div className="line"><MapPin /><span className="v">{place}</span></div>}
                    <div className="line">
                      <span className="stars"><Star className="fill-current" /></span>
                      <span className="v">
                        {Number(doctorProfile.rating || 0).toFixed(1)}
                        {reviewsCount > 0 && ` (${reviewsCount} ${t('pro.profile.reviews').toLowerCase()})`}
                      </span>
                    </div>
                    <div className="line"><Users /><span className="v">{doctorProfile.followers_count} {t('profile.followers').toLowerCase()}</span></div>
                    <div className="line"><Wallet /><span className="v">{t('pro.profile.from')} {money(Number(doctorProfile.consultation_fee || 0), language)}</span></div>
                  </div>
                  <Link to={`/doctor/${user.id}`} className="pro-btn pro-btn-outline pro-btn-sm w-full mt-3">
                    <Eye /> {t('pro.profile.seeFullProfile')}
                  </Link>
                </div>
              </section>

              <section className="pro-card pro-card-pad">
                <div className="pro-card-head">
                  <h3 className="pro-card-title"><ClipboardList /> {t('pro.profile.statusTitle')}</h3>
                </div>
                {checklist.map(c => (
                  <button
                    key={c.label}
                    type="button"
                    className={`pro-sum ${c.done ? 'is-ok' : 'is-off'} w-full text-left`}
                    onClick={() => setProfTab(c.tab)}
                  >
                    {c.done ? <Check /> : <Circle />}
                    <span className="lbl">{c.label}</span>
                    <ChevronRight className="w-4 h-4 flex-shrink-0 text-[color:var(--pro-muted)]" />
                  </button>
                ))}
                <p className="pro-row-sub mt-3">{t('pro.profile.statusHint')}</p>
              </section>
            </aside>
          </div>

          {/* ---------------------------------- cifras de la trayectoria */}
          <div className="pro-statgrid mt-3 sm:mt-4">
            {[
              { Icon: FileCheck, label: t('pro.profile.chkCertifications'), value: careerCounts.certifications },
              { Icon: Briefcase, label: t('pro.profile.chkExperience'), value: careerCounts.experience },
              { Icon: GraduationCap, label: t('pro.profile.chkEducation'), value: careerCounts.education },
            ].map(s => (
              <button key={s.label} type="button" className="pro-card pro-stat" onClick={() => setProfTab('trayectoria')}>
                <span className="pro-icon-box"><s.Icon /></span>
                <span className="min-w-0">
                  <span className="k block">{s.label}</span>
                  <span className="v block">{s.value}</span>
                </span>
                <ChevronRight className="chev" />
              </button>
            ))}
          </div>
        </div>

        {/* Diálogo de la foto — el mismo de siempre */}
        <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('profile.changePhoto')}</DialogTitle>
              <DialogDescription>{t('profile.photoPreview')}</DialogDescription>
            </DialogHeader>
            <div className="flex justify-center py-6">
              <Avatar className="w-32 h-32 border-4 border-background shadow-xl">
                <AvatarImage src={previewUrl || undefined} alt={t('userProfilePage.previewAlt')} />
                <AvatarFallback className="text-3xl bg-primary text-primary-foreground">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => { setAvatarDialogOpen(false); setSelectedFile(null); setPreviewUrl(null); }}
                disabled={isUploadingAvatar}
              >
                {t('common.cancel')}
              </Button>
              <Button onClick={handleUploadAvatar} disabled={isUploadingAvatar}>
                {isUploadingAvatar
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('profile.uploading')}</>
                  : <><Check className="w-4 h-4 mr-2" />{t('common.save')}</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Wrapper>
    );
  }

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

        {/* Doctores que sigues / suscripciones. El MÉDICO las ve en la pestaña
            «Cuenta» de su perfil PRO (más arriba, en su propio return), así que
            aquí quedan paciente y residente: nada se ha quitado, cambió de sitio. */}
        {(role === 'patient' || role === 'resident') && <MySubscribedDoctorsCard />}

        {/* Clinical History Card - también visible para residentes (cada uno tiene su propio historial personal) */}
        {(role === 'patient' || role === 'resident') && <PatientClinicalHistoryCard />}

        {/* Esquema de vacunación movido al Expediente (cliente 2026-06-15): ahora vive en MedicalRecord, no en el perfil. */}

        {/* El MÉDICO ya no llega aquí: tiene su propio diseño PRO («Mi perfil
            profesional», más arriba en este mismo fichero), donde vive TODO lo
            que había en esta tarjeta: especialidad, cédulas, ubicación, bio,
            precio, cifras, credenciales y documentos. */}

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
                {/* Una sola lista de idiomas para toda la app (LanguageSwitcher): antes este
                    selector escribía profiles.preferred_language a mano y luego setLanguage
                    volvía a escribirlo (doble escritura), con banderas y nombres en duro. */}
                <LanguageOptionsList variant="panel" />
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
                        {/* div, no p: Badge pinta un div y React avisa de <div> dentro de <p> */}
                        <div className="text-sm font-medium ml-7 mb-2">{user.email} <Badge className="ml-1 bg-success/10 text-success border-success text-[10px] whitespace-nowrap shrink-0">{t('userProfilePage.current')}</Badge></div>
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
                      <div className="mt-1 text-sm font-medium ml-7 flex items-center gap-2">
                        {user.email}
                        <Badge className="bg-success/10 text-success border-success text-[10px] whitespace-nowrap shrink-0">{t('userProfilePage.verified')}</Badge>
                      </div>
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
                      <div className="mt-1 text-sm font-medium ml-7 flex items-center gap-2">
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
                      </div>
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
                  {role === 'resident' && (
                    <Button variant="outline" className="justify-start gap-2" onClick={() => navigate('/resident-groups')}>
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