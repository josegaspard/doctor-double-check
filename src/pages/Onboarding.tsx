import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Loader2, User, Stethoscope, GraduationCap, CheckCircle, Sparkles, PartyPopper, ArrowRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AppRole as UserRole } from '@/types/database';
import { AvatarUpload } from '@/components/onboarding/AvatarUpload';
import { CedulaVerificationStatus, useCedulaStatus } from '@/components/onboarding/CedulaVerificationStatus';
import { CedulaAutoVerify } from '@/components/onboarding/CedulaAutoVerify';
import { ClinicalHistoryForm, ClinicalHistoryData } from '@/components/onboarding/ClinicalHistoryForm';
import { DocumentSignature } from '@/components/onboarding/DocumentSignature';

// Predefined medical specialties
const MEDICAL_SPECIALTIES = [
  'Medicina General',
  'Medicina Interna',
  'Cardiología',
  'Dermatología',
  'Endocrinología',
  'Gastroenterología',
  'Geriatría',
  'Ginecología y Obstetricia',
  'Hematología',
  'Infectología',
  'Medicina de Urgencias',
  'Medicina Familiar',
  'Nefrología',
  'Neumología',
  'Neurología',
  'Nutriología',
  'Oftalmología',
  'Oncología',
  'Ortopedia y Traumatología',
  'Otorrinolaringología',
  'Pediatría',
  'Psiquiatría',
  'Radiología',
  'Reumatología',
  'Urología',
  'Cirugía General',
  'Cirugía Cardiovascular',
  'Cirugía Plástica',
  'Anestesiología',
  'Medicina del Deporte',
  'Medicina Física y Rehabilitación',
  'Patología',
  'Alergología e Inmunología',
  'Otra especialidad'
] as const;

interface ValidationErrors {
  specialty?: string;
  license?: string;
  institution?: string;
  year?: string;
}
const triggerConfetti = () => {
  const duration = 3000;
  const end = Date.now() + duration;

  const colors = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444'];

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: colors
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: colors
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  // Initial burst
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: colors
  });

  frame();
};

const pageVariants = {
  initial: { opacity: 0, x: 50, scale: 0.98 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -50, scale: 0.98 }
};

const pageTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8
};

const containerVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  },
  exit: { opacity: 0 }
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
  initial: { opacity: 0, y: 30, scale: 0.95 },
  animate: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 350,
      damping: 30
    }
  },
  exit: { 
    opacity: 0, 
    y: -20, 
    scale: 0.95,
    transition: {
      duration: 0.2
    }
  }
};

type OnboardingRole = Exclude<UserRole, 'visitor' | 'admin'>;

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, supabaseUser, refreshUser, isLoading: authLoading } = useAuth();
  const { t, language } = useLanguage();
  
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<OnboardingRole>('patient');
  const [specialty, setSpecialty] = useState('');
  const [institution, setInstitution] = useState('');
  const [license, setLicense] = useState('');
  const [year, setYear] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [cedulaVerified, setCedulaVerified] = useState(false);
  const [cedulaVerificationId, setCedulaVerificationId] = useState<string | null>(null);
  
  // Clinical History State
  const [clinicalHistory, setClinicalHistory] = useState<ClinicalHistoryData>({
    bloodType: '',
    allergies: '',
    chronicConditions: '',
    currentMedications: '',
    previousSurgeries: '',
    familyHistory: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    heightCm: '',
    weightKg: ''
  });

  // Document Signatures State
  const [signerName, setSignerName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [doctorContractAccepted, setDoctorContractAccepted] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedProgress = useRef(false);
  
  // Cedula verification status
  const cedulaStatus = cedulaVerified ? 'verified' : useCedulaStatus(license);
  const validateForm = useMemo(() => {
    const errors: ValidationErrors = {};
    
    if (selectedRole === 'doctor' || selectedRole === 'resident') {
      if (!specialty) {
        errors.specialty = t('onboarding.validationSpecialty');
      }
    }

    if (selectedRole === 'doctor') {
      const trimmedLicense = license.trim();
      // Mexican cédula profesional format: 7-8 digits
      const cedulaRegex = /^\d{7,8}$/;
      
      if (!trimmedLicense) {
        errors.license = t('onboarding.validationCedula');
      } else if (!cedulaRegex.test(trimmedLicense)) {
        errors.license = t('onboarding.validationCedulaFormat');
      }
    }

    if (selectedRole === 'resident') {
      if (!institution.trim()) {
        errors.institution = t('onboarding.validationInstitution');
      } else if (institution.trim().length < 3) {
        errors.institution = t('onboarding.validationInstitutionMin');
      } else if (institution.trim().length > 150) {
        errors.institution = t('onboarding.validationInstitutionMax');
      }

      if (year < 1 || year > 7) {
        errors.year = t('onboarding.validationYear');
      }
    }

    // Step 2 validation for patient (Clinical History)
    if (selectedRole === 'patient' && step === 2) {
      // Basic validation for clinical history - can be optional or required depending on rules
      // For now, let's just require emergency contact
      if (!clinicalHistory.emergencyContactName.trim()) {
        errors.institution = 'El nombre de contacto de emergencia es recomendado'; 
      }
    }

    // Step 2 validation for doctor/resident (Signatures)
    if ((selectedRole === 'doctor' || selectedRole === 'resident') && step === 2) {
      if (!signerName.trim()) errors.license = 'Firma requerida';
      if (!termsAccepted) errors.specialty = 'Acepta términos';
      if (!privacyAccepted) errors.specialty = 'Acepta privacidad';
      if (selectedRole === 'doctor' && !doctorContractAccepted) errors.specialty = 'Acepta contrato';
    }

    return errors;
  }, [selectedRole, specialty, license, institution, year, step, clinicalHistory, signerName, termsAccepted, privacyAccepted, doctorContractAccepted]);

  const isFormValid = Object.keys(validateForm).length === 0;

  // Update validation errors when form changes (only after first submit attempt)
  useEffect(() => {
    if (hasAttemptedSubmit) {
      setValidationErrors(validateForm);
    }
  }, [validateForm, hasAttemptedSubmit]);

  // Save progress to database with debounce
  const saveProgress = useCallback(async () => {
    if (!supabaseUser || !hasLoadedProgress.current) return;
    
    setIsSavingProgress(true);
    try {
      const progressData = {
        user_id: supabaseUser.id,
        step,
        selected_role: selectedRole,
        specialty: specialty || null,
        license: license || null,
        institution: institution || null,
        year,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('onboarding_progress')
        .upsert(progressData, { onConflict: 'user_id' });

      if (error) {
        console.error('Error saving progress:', error);
      }
    } catch (error) {
      console.error('Error saving progress:', error);
    } finally {
      setIsSavingProgress(false);
    }
  }, [supabaseUser, step, selectedRole, specialty, license, institution, year, avatarUrl]);

  // Debounced save - saves 1 second after last change
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveProgress();
    }, 1000);
  }, [saveProgress]);

  // Auto-save when form data changes
  useEffect(() => {
    if (hasLoadedProgress.current && supabaseUser) {
      debouncedSave();
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [step, selectedRole, specialty, license, institution, year, avatarUrl, debouncedSave, supabaseUser]);

  // Load saved progress and check onboarding status
  useEffect(() => {
    const loadProgressAndCheck = async () => {
      if (authLoading) return;
      
      if (!supabaseUser) {
        navigate('/login');
        return;
      }

      // Check if onboarding is already completed
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', supabaseUser.id)
        .single();

      if (profile?.onboarding_completed) {
        navigate('/lives');
        return;
      }

      // Load saved progress
      const { data: savedProgress } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('user_id', supabaseUser.id)
        .single();

      if (savedProgress) {
        if (savedProgress.step) setStep(savedProgress.step);
        if (savedProgress.selected_role) setSelectedRole(savedProgress.selected_role as OnboardingRole);
        if (savedProgress.specialty) setSpecialty(savedProgress.specialty);
        if (savedProgress.license) setLicense(savedProgress.license);
        if (savedProgress.institution) setInstitution(savedProgress.institution);
        if (savedProgress.year) setYear(savedProgress.year);
        if (savedProgress.avatar_url) setAvatarUrl(savedProgress.avatar_url);
        
        // Show toast when restoring previous session
        toast.success(t('onboarding.restoringSession'), {
          duration: 3000,
          icon: '🔄'
        });
      }

      hasLoadedProgress.current = true;
      setIsLoadingProgress(false);
      setIsCheckingOnboarding(false);
    };

    loadProgressAndCheck();
  }, [authLoading, supabaseUser, navigate]);

  const handleRoleSelect = (role: OnboardingRole) => {
    setSelectedRole(role);
  };

  // Handle cedula verification success
  const handleCedulaVerified = (verificationId: string) => {
    setCedulaVerified(true);
    setCedulaVerificationId(verificationId);
  };

  // Handle cedula claimed (auto-approved)
  const handleCedulaClaimed = () => {
    // Refresh user data since they may have been auto-approved
    refreshUser();
  };

  const handleContinue = () => {
    if (selectedRole === 'patient') {
      // Patient goes to step 2 (Clinical History)
      setStep(2);
    } else {
      setStep(2);
    }
  };

  const handleSubmit = async () => {
    if (!supabaseUser) return;
    
    // Mark that user has attempted to submit
    setHasAttemptedSubmit(true);
    
    // Validate form for doctors and residents
    if (selectedRole !== 'patient') {
      const errors = validateForm;
      setValidationErrors(errors);
      
      if (Object.keys(errors).length > 0) {
        toast.error(t('onboarding.requiredFields'));
        return;
      }
    }
    
    setIsSubmitting(true);
    
    try {
      // Update user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role: selectedRole })
        .eq('user_id', supabaseUser.id);
      
      if (roleError) throw roleError;

      // Create role-specific profile if needed
      if (selectedRole === 'doctor') {
        // Create wallet for doctor (for pending_earnings tracking)
        const { error: walletError } = await supabase
          .from('wallets')
          .insert({ user_id: supabaseUser.id, balance: 0 });
        
        if (walletError && !walletError.message.includes('duplicate')) {
          console.error('Wallet creation error:', walletError);
        }

        // Build doctor profile data, including cedula_verification_id if verified
        const doctorProfileData: any = {
          user_id: supabaseUser.id,
          specialty: specialty || 'General',
          license: license || '',
          status: 'pending',
        };

        // Link cedula verification if available
        if (cedulaVerificationId) {
          doctorProfileData.cedula_verification_id = cedulaVerificationId;
        }

        const { error: doctorError } = await supabase
          .from('doctor_profiles')
          .insert(doctorProfileData);
        
        if (doctorError && !doctorError.message.includes('duplicate')) {
          throw doctorError;
        }
      }

      if (selectedRole === 'resident') {
        // Create wallet for resident
        const { error: walletError } = await supabase
          .from('wallets')
          .insert({ user_id: supabaseUser.id, balance: 0 });
        
        if (walletError && !walletError.message.includes('duplicate')) {
          console.error('Wallet creation error:', walletError);
        }

        const { error: residentError } = await supabase
          .from('resident_profiles')
          .insert({
            user_id: supabaseUser.id,
            institution: institution || '',
            specialty: specialty || 'General',
            year: year,
            status: 'pending',
          });
        
        if (residentError && !residentError.message.includes('duplicate')) {
          throw residentError;
        }
      }

      if (selectedRole === 'patient') {
        // Create wallet for patient
        const { error: walletError } = await supabase
          .from('wallets')
          .insert({ user_id: supabaseUser.id, balance: 0 });
        
        if (walletError && !walletError.message.includes('duplicate')) {
          console.error('Wallet creation error:', walletError);
        }

        // Save Clinical History
        const { error: historyError } = await supabase
          .from('patient_clinical_history')
          .insert({
            patient_id: supabaseUser.id,
            blood_type: clinicalHistory.bloodType || null,
            allergies: clinicalHistory.allergies || null,
            chronic_conditions: clinicalHistory.chronicConditions || null,
            current_medications: clinicalHistory.currentMedications || null,
            previous_surgeries: clinicalHistory.previousSurgeries || null,
            family_history: clinicalHistory.familyHistory || null,
            emergency_contact_name: clinicalHistory.emergencyContactName || null,
            emergency_contact_phone: clinicalHistory.emergencyContactPhone || null,
            height_cm: clinicalHistory.heightCm ? parseFloat(clinicalHistory.heightCm) : null,
            weight_kg: clinicalHistory.weightKg ? parseFloat(clinicalHistory.weightKg) : null,
          });

        if (historyError) {
          console.error('Error saving clinical history:', historyError);
          // Don't block onboarding for this
        }
      }

      // Save Signatures
      if (signerName && termsAccepted && privacyAccepted) {
        const signatures = [
          { type: 'terms_of_service', version: '1.0' },
          { type: 'privacy_policy', version: '1.0' },
        ];
        
        if (selectedRole === 'doctor' && doctorContractAccepted) {
          signatures.push({ type: 'doctor_contract', version: '1.0' });
        }

        for (const sig of signatures) {
          await supabase.from('document_signatures').insert({
            user_id: supabaseUser.id,
            document_type: sig.type,
            document_version: sig.version,
            signer_name: signerName,
            ip_address: 'unknown', // Would need edge function to get real IP
          });
        }
      }

      // Mark onboarding as completed and save avatar
      const updateData: { onboarding_completed: boolean; avatar_url?: string } = { 
        onboarding_completed: true 
      };
      
      if (avatarUrl) {
        updateData.avatar_url = avatarUrl;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', supabaseUser.id);

      if (profileError) throw profileError;

      // Delete saved progress since onboarding is complete
      await supabase
        .from('onboarding_progress')
        .delete()
        .eq('user_id', supabaseUser.id);

      // Refresh user data
      await refreshUser();

      // Send welcome email
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('email, name')
          .eq('id', supabaseUser.id)
          .single();

        if (profileData) {
          await supabase.functions.invoke('send-welcome-email', {
            body: {
              email: profileData.email,
              name: profileData.name,
              role: selectedRole,
            },
          });
        }
      } catch (emailErr) {
        console.error('Welcome email error:', emailErr);
        // Don't block onboarding for email failure
      }

      // Trigger celebration confetti
      triggerConfetti();

      // Show welcome screen
      setShowWelcome(true);
      
      toast.success(t('onboarding.profileCompleted'));
    } catch (error: any) {
      console.error('Onboarding error:', error);
      toast.error(error.message || t('onboarding.completeError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueToApp = () => {
    if (selectedRole === 'patient') {
      navigate('/lives');
    } else {
      navigate('/verification-pending');
    }
  };

  const getRoleLabel = () => {
    switch (selectedRole) {
      case 'patient':
        return t('onboarding.patient');
      case 'doctor':
        return t('onboarding.doctor');
      case 'resident':
        return t('onboarding.resident');
      default:
        return t('roles.visitor');
    }
  };

  const getRoleIcon = () => {
    switch (selectedRole) {
      case 'patient':
        return User;
      case 'doctor':
        return Stethoscope;
      case 'resident':
        return GraduationCap;
      default:
        return User;
    }
  };

  if (authLoading || isCheckingOnboarding || isLoadingProgress) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t('onboarding.loadingProgress')}</p>
      </div>
    );
  }

  // Welcome screen after successful onboarding
  if (showWelcome) {
    const RoleIcon = getRoleIcon();
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-heading font-bold text-foreground">Dr Double Check</span>
            </div>
          </div>
        </header>

        {/* Welcome Content */}
        <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
          <motion.div 
            className="w-full max-w-lg text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <motion.div
              className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
            >
              <PartyPopper className="w-12 h-12 text-primary-foreground" />
            </motion.div>

            <motion.h1 
              className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              {t('onboarding.welcomeTitle').replace('{name}', user?.name ? `, ${user.name.split(' ')[0]}` : '')}
            </motion.h1>

            <motion.p 
              className="text-lg text-muted-foreground mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              {t('onboarding.accountConfigured')}
            </motion.p>

            <motion.div
              className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-primary/10 border border-primary/20 mb-8"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, type: "spring", stiffness: 300, damping: 20 }}
            >
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <RoleIcon className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-medium text-foreground">
                {getRoleLabel()}
              </span>
              <CheckCircle className="w-5 h-5 text-primary" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.4 }}
            >
              <Button 
                size="lg" 
                onClick={handleContinueToApp}
                className="gap-2"
              >
                {selectedRole === 'patient' ? t('onboarding.exploreContent') : t('onboarding.continueVerification')}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>

            {selectedRole !== 'patient' && (
              <motion.p
                className="mt-4 text-sm text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 0.4 }}
              >
                {t('onboarding.profileVerification')}
              </motion.p>
            )}
          </motion.div>
        </main>
      </div>
    );
  }

  const totalSteps = 2; // Always 2 steps now (Patient has Clinical History, Doctors have Verification/Signature)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-heading font-bold text-foreground">Dr Double Check</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
        <div className="w-full max-w-lg">
          {/* Progress Indicator */}
          <motion.div 
            className="mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <div className="flex items-center justify-center gap-3">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((stepNumber) => (
                <div key={stepNumber} className="flex items-center">
                  <motion.div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                      step === stepNumber
                        ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                        : step > stepNumber
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                    initial={false}
                    animate={{ 
                      scale: step === stepNumber ? 1.1 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  >
                    <AnimatePresence mode="wait">
                      {step > stepNumber ? (
                        <motion.div
                          key="check"
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 25 }}
                        >
                          <CheckCircle className="w-5 h-5" />
                        </motion.div>
                      ) : (
                        <motion.span
                          key="number"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                        >
                          {stepNumber}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                  {stepNumber < totalSteps && (
                    <motion.div
                      className="w-16 h-1 mx-2 rounded-full bg-muted overflow-hidden"
                    >
                      <motion.div
                        className="h-full bg-primary"
                        initial={{ width: "0%" }}
                        animate={{ width: step > stepNumber ? "100%" : "0%" }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 mt-3">
              <p className="text-sm text-muted-foreground">
                {t('onboarding.step')} {step} {t('onboarding.of')} {totalSteps}
              </p>
              <AnimatePresence>
                {isSavingProgress && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-1 text-xs text-muted-foreground"
                  >
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>{t('onboarding.saving')}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                variants={cardVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <Card className="overflow-hidden">
                  <CardHeader className="text-center">
                    <motion.div 
                      className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 260, 
                        damping: 20,
                        delay: 0.2 
                      }}
                    >
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ 
                          duration: 2, 
                          repeat: Infinity, 
                          repeatDelay: 3,
                          ease: "easeInOut"
                        }}
                      >
                        <Sparkles className="w-8 h-8 text-primary" />
                      </motion.div>
                    </motion.div>
                    <CardTitle className="text-2xl">{t('onboarding.welcomeSubtitle')}</CardTitle>
                    <CardDescription className="text-base">
                      {t('onboarding.personalizeExperience')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <motion.div 
                      className="space-y-6"
                      variants={containerVariants}
                      initial="initial"
                      animate="animate"
                    >
                      {/* Avatar Upload */}
                      {supabaseUser && (
                        <motion.div variants={itemVariants}>
                          <AvatarUpload
                            userId={supabaseUser.id}
                            userName={user?.name}
                            currentAvatarUrl={avatarUrl}
                            onAvatarChange={setAvatarUrl}
                          />
                        </motion.div>
                      )}

                      <motion.div className="space-y-3" variants={itemVariants}>
                        <Label className="text-base font-medium">{t('onboarding.selectRole')}</Label>
                        <RadioGroup 
                          value={selectedRole} 
                          onValueChange={(v) => handleRoleSelect(v as OnboardingRole)}
                          className="grid gap-3"
                        >
                          {[
                            { value: 'patient', icon: User, label: t('onboarding.patient'), desc: t('onboarding.patientDesc') },
                            { value: 'doctor', icon: Stethoscope, label: t('onboarding.doctor'), desc: t('onboarding.doctorDesc') },
                            { value: 'resident', icon: GraduationCap, label: t('onboarding.resident'), desc: t('onboarding.residentDesc') }
                          ].map((role, index) => (
                            <motion.div
                              key={role.value}
                              variants={itemVariants}
                              whileHover={{ scale: 1.02, x: 4 }}
                              whileTap={{ scale: 0.98 }}
                              transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            >
                              <Label
                                htmlFor={role.value}
                                className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                                  selectedRole === role.value 
                                    ? 'border-primary bg-primary/5' 
                                    : 'border-border hover:border-primary/50'
                                }`}
                              >
                                <RadioGroupItem value={role.value} id={role.value} className="sr-only" />
                                <motion.div 
                                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                    selectedRole === role.value ? 'bg-primary text-primary-foreground' : 'bg-muted'
                                  }`}
                                  animate={{ 
                                    scale: selectedRole === role.value ? 1.1 : 1,
                                    rotate: selectedRole === role.value ? [0, -5, 5, 0] : 0
                                  }}
                                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                >
                                  <role.icon className="w-6 h-6" />
                                </motion.div>
                                <div className="flex-1">
                                  <p className="font-medium">{role.label}</p>
                                  <p className="text-sm text-muted-foreground">{role.desc}</p>
                                </div>
                                <motion.div
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ 
                                    scale: selectedRole === role.value ? 1 : 0,
                                    opacity: selectedRole === role.value ? 1 : 0
                                  }}
                                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                >
                                  <CheckCircle className="w-5 h-5 text-primary" />
                                </motion.div>
                              </Label>
                            </motion.div>
                          ))}
                        </RadioGroup>
                      </motion.div>

                      <motion.div variants={itemVariants}>
                        <Button 
                          onClick={handleContinue} 
                          className="w-full" 
                          size="lg"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          {t('onboarding.continue')}
                        </Button>
                      </motion.div>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                variants={cardVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <Card className="overflow-hidden">
                  <CardHeader>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    >
                      <CardTitle>
                        {selectedRole === 'patient' 
                          ? t('onboarding.clinicalHistoryTitle')
                          : selectedRole === 'doctor' 
                            ? t('onboarding.doctorProfileTitle')
                            : t('onboarding.residentProfileTitle')
                        }
                      </CardTitle>
                      <CardDescription>
                        {selectedRole === 'patient'
                          ? t('onboarding.clinicalHistorySubtitle')
                          : t('onboarding.professionalInfo')
                        }
                      </CardDescription>
                    </motion.div>
                  </CardHeader>
                  <CardContent>
                    <motion.div 
                      className="space-y-4"
                      variants={containerVariants}
                      initial="initial"
                      animate="animate"
                    >
                      {selectedRole === 'patient' ? (
                        <motion.div variants={itemVariants}>
                          <ClinicalHistoryForm 
                            data={clinicalHistory}
                            onChange={setClinicalHistory}
                          />
                        </motion.div>
                      ) : (
                        <>
                          <motion.div className="space-y-2" variants={itemVariants}>
                        <Label htmlFor="specialty" className="flex items-center gap-1">
                          {t('onboarding.specialty')} <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={specialty}
                          onValueChange={setSpecialty}
                        >
                          <SelectTrigger 
                            id="specialty"
                            className={validationErrors.specialty ? 'border-destructive focus:ring-destructive' : ''}
                          >
                            <SelectValue placeholder={t('onboarding.selectSpecialty')} />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {MEDICAL_SPECIALTIES.map((spec) => (
                              <SelectItem key={spec} value={spec}>
                                {spec}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <AnimatePresence>
                          {validationErrors.specialty && (
                            <motion.p 
                              className="text-sm text-destructive flex items-center gap-1"
                              initial={{ opacity: 0, y: -10, height: 0 }}
                              animate={{ opacity: 1, y: 0, height: "auto" }}
                              exit={{ opacity: 0, y: -10, height: 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            >
                              <AlertCircle className="w-3 h-3" />
                              {validationErrors.specialty}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </motion.div>

                      {selectedRole === 'doctor' && (
                        <motion.div className="space-y-3" variants={itemVariants}>
                          <Label htmlFor="license" className="flex items-center gap-1">
                            {t('onboarding.cedula')} <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="license"
                            placeholder={t('onboarding.cedulaPlaceholder')}
                            value={license}
                            onChange={(e) => {
                              // Only allow numeric input
                              const value = e.target.value.replace(/\D/g, '');
                              setLicense(value);
                            }}
                            className={validationErrors.license ? 'border-destructive focus-visible:ring-destructive' : ''}
                            maxLength={8}
                            inputMode="numeric"
                            pattern="[0-9]*"
                          />
                          <AnimatePresence>
                            {validationErrors.license && (
                              <motion.p 
                                className="text-sm text-destructive flex items-center gap-1"
                                initial={{ opacity: 0, y: -10, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: "auto" }}
                                exit={{ opacity: 0, y: -10, height: 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              >
                                <AlertCircle className="w-3 h-3" />
                                {validationErrors.license}
                              </motion.p>
                            )}
                          </AnimatePresence>
                          
                          {/* Verification Status Indicator */}
                          <CedulaVerificationStatus 
                            status={cedulaStatus} 
                            cedula={license.trim()}
                          />

                          {/* Auto Verification Component */}
                          {supabaseUser && cedulaStatus === 'valid_pending' && !cedulaVerified && (
                            <CedulaAutoVerify
                              cedula={license.trim()}
                              userId={supabaseUser.id}
                              onVerified={handleCedulaVerified}
                              onClaimed={handleCedulaClaimed}
                              language={language}
                            />
                          )}
                        </motion.div>
                      )}

                      {selectedRole === 'resident' && (
                        <>
                          <motion.div className="space-y-2" variants={itemVariants}>
                            <Label htmlFor="institution" className="flex items-center gap-1">
                              {t('onboarding.institution')} <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="institution"
                              placeholder={t('onboarding.institutionPlaceholder')}
                              value={institution}
                              onChange={(e) => setInstitution(e.target.value)}
                              className={validationErrors.institution ? 'border-destructive focus-visible:ring-destructive' : ''}
                              maxLength={150}
                            />
                            <AnimatePresence>
                              {validationErrors.institution && (
                                <motion.p 
                                  className="text-sm text-destructive flex items-center gap-1"
                                  initial={{ opacity: 0, y: -10, height: 0 }}
                                  animate={{ opacity: 1, y: 0, height: "auto" }}
                                  exit={{ opacity: 0, y: -10, height: 0 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                >
                                  <AlertCircle className="w-3 h-3" />
                                  {validationErrors.institution}
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </motion.div>
                          <motion.div className="space-y-2" variants={itemVariants}>
                            <Label htmlFor="year" className="flex items-center gap-1">
                              {t('onboarding.residencyYear')} <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="year"
                              type="number"
                              min={1}
                              max={7}
                              value={year}
                              onChange={(e) => setYear(parseInt(e.target.value) || 1)}
                              className={validationErrors.year ? 'border-destructive focus-visible:ring-destructive' : ''}
                            />
                            <AnimatePresence>
                              {validationErrors.year && (
                                <motion.p 
                                  className="text-sm text-destructive flex items-center gap-1"
                                  initial={{ opacity: 0, y: -10, height: 0 }}
                                  animate={{ opacity: 1, y: 0, height: "auto" }}
                                  exit={{ opacity: 0, y: -10, height: 0 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                >
                                  <AlertCircle className="w-3 h-3" />
                                  {validationErrors.year}
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        </>
                          )}
                        </>
                      )}

                      {/* Document Signature for everyone in Step 2 */}
                      {(selectedRole === 'doctor' || selectedRole === 'resident') && (
                        <motion.div variants={itemVariants} className="mt-6">
                          <DocumentSignature
                            signerName={signerName}
                            onSignerNameChange={setSignerName}
                            termsAccepted={termsAccepted}
                            onTermsChange={setTermsAccepted}
                            privacyAccepted={privacyAccepted}
                            onPrivacyChange={setPrivacyAccepted}
                            doctorContractAccepted={doctorContractAccepted}
                            onDoctorContractChange={setDoctorContractAccepted}
                            showDoctorContract={selectedRole === 'doctor'}
                          />
                        </motion.div>
                      )}

                      <motion.div 
                        className="flex gap-3 pt-4"
                        variants={itemVariants}
                      >
                        <Button 
                          variant="outline" 
                          onClick={() => setStep(1)}
                          className="flex-1"
                        >
                          {t('onboarding.back')}
                        </Button>
                        <Button 
                          onClick={handleSubmit} 
                          className="flex-1"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          {t('onboarding.completeRegistration')}
                        </Button>
                      </motion.div>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
