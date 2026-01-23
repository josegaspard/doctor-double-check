import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Shield, Loader2, User, Stethoscope, GraduationCap, CheckCircle, Sparkles, PartyPopper, ArrowRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { UserRole } from '@/types';
import { AvatarUpload } from '@/components/onboarding/AvatarUpload';

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
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 }
};

const pageTransition = {
  type: "tween" as const,
  ease: "easeInOut" as const,
  duration: 0.3
};

type OnboardingRole = Exclude<UserRole, 'visitor' | 'admin'>;

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, supabaseUser, refreshUser, isLoading: authLoading } = useAuth();
  
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
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedProgress = useRef(false);

  // Validation logic
  const validateForm = useMemo(() => {
    const errors: ValidationErrors = {};
    
    if (selectedRole === 'doctor' || selectedRole === 'resident') {
      if (!specialty.trim()) {
        errors.specialty = 'La especialidad es obligatoria';
      } else if (specialty.trim().length < 3) {
        errors.specialty = 'La especialidad debe tener al menos 3 caracteres';
      } else if (specialty.trim().length > 100) {
        errors.specialty = 'La especialidad no puede exceder 100 caracteres';
      }
    }

    if (selectedRole === 'doctor') {
      if (!license.trim()) {
        errors.license = 'El número de licencia es obligatorio';
      } else if (license.trim().length < 5) {
        errors.license = 'El número de licencia debe tener al menos 5 caracteres';
      } else if (license.trim().length > 50) {
        errors.license = 'El número de licencia no puede exceder 50 caracteres';
      }
    }

    if (selectedRole === 'resident') {
      if (!institution.trim()) {
        errors.institution = 'La institución es obligatoria';
      } else if (institution.trim().length < 3) {
        errors.institution = 'La institución debe tener al menos 3 caracteres';
      } else if (institution.trim().length > 150) {
        errors.institution = 'La institución no puede exceder 150 caracteres';
      }

      if (year < 1 || year > 7) {
        errors.year = 'El año debe estar entre 1 y 7';
      }
    }

    return errors;
  }, [selectedRole, specialty, license, institution, year]);

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

  const handleContinue = () => {
    if (selectedRole === 'patient') {
      handleSubmit();
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
        toast.error('Por favor completa todos los campos obligatorios');
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
        const { error: doctorError } = await supabase
          .from('doctor_profiles')
          .insert({
            user_id: supabaseUser.id,
            specialty: specialty || 'General',
            license: license || '',
            status: 'pending',
          });
        
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

      // Trigger celebration confetti
      triggerConfetti();

      // Show welcome screen
      setShowWelcome(true);
      
      toast.success('¡Perfil completado exitosamente!');
    } catch (error: any) {
      console.error('Onboarding error:', error);
      toast.error(error.message || 'Error al completar el perfil');
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
        return 'Paciente';
      case 'doctor':
        return 'Médico';
      case 'resident':
        return 'Residente';
      default:
        return 'Usuario';
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
        <p className="text-sm text-muted-foreground">Cargando tu progreso...</p>
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
              ¡Bienvenido{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
            </motion.h1>

            <motion.p 
              className="text-lg text-muted-foreground mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              Tu cuenta ha sido configurada exitosamente
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
                {selectedRole === 'patient' ? 'Explorar contenido' : 'Continuar con verificación'}
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
                Tu perfil será verificado por nuestro equipo
              </motion.p>
            )}
          </motion.div>
        </main>
      </div>
    );
  }

  const totalSteps = selectedRole === 'patient' ? 1 : 2;

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
          <div className="mb-8">
            <div className="flex items-center justify-center gap-3">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((stepNumber) => (
                <div key={stepNumber} className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                      step === stepNumber
                        ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                        : step > stepNumber
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {step > stepNumber ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      stepNumber
                    )}
                  </div>
                  {stepNumber < totalSteps && (
                    <div
                      className={`w-16 h-1 mx-2 rounded-full transition-all ${
                        step > stepNumber ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 mt-3">
              <p className="text-sm text-muted-foreground">
                Paso {step} de {totalSteps}
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
                    <span>Guardando...</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
              >
                <Card>
                  <CardHeader className="text-center">
                    <motion.div 
                      className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1, duration: 0.3 }}
                    >
                      <Sparkles className="w-8 h-8 text-primary" />
                    </motion.div>
                    <CardTitle className="text-2xl">¡Bienvenido a Dr Double Check!</CardTitle>
                    <CardDescription className="text-base">
                      Para personalizar tu experiencia, cuéntanos más sobre ti
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Avatar Upload */}
                    {supabaseUser && (
                      <AvatarUpload
                        userId={supabaseUser.id}
                        userName={user?.name}
                        currentAvatarUrl={avatarUrl}
                        onAvatarChange={setAvatarUrl}
                      />
                    )}

                    <div className="space-y-3">
                      <Label className="text-base font-medium">¿Cuál es tu rol?</Label>
                      <RadioGroup 
                        value={selectedRole} 
                        onValueChange={(v) => handleRoleSelect(v as OnboardingRole)}
                        className="grid gap-3"
                      >
                        {[
                          { value: 'patient', icon: User, label: 'Paciente', desc: 'Accede a consultas médicas y contenido educativo' },
                          { value: 'doctor', icon: Stethoscope, label: 'Médico', desc: 'Ofrece consultas y comparte conocimiento médico' },
                          { value: 'resident', icon: GraduationCap, label: 'Residente', desc: 'Accede a grupos de estudio y contenido con descuento' }
                        ].map((role, index) => (
                          <motion.div
                            key={role.value}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + index * 0.1, duration: 0.3 }}
                          >
                            <Label
                              htmlFor={role.value}
                              className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                selectedRole === role.value 
                                  ? 'border-primary bg-primary/5' 
                                  : 'border-border hover:border-primary/50'
                              }`}
                            >
                              <RadioGroupItem value={role.value} id={role.value} className="sr-only" />
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                                selectedRole === role.value ? 'bg-primary text-primary-foreground' : 'bg-muted'
                              }`}>
                                <role.icon className="w-6 h-6" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{role.label}</p>
                                <p className="text-sm text-muted-foreground">{role.desc}</p>
                              </div>
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: selectedRole === role.value ? 1 : 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              >
                                <CheckCircle className="w-5 h-5 text-primary" />
                              </motion.div>
                            </Label>
                          </motion.div>
                        ))}
                      </RadioGroup>
                    </div>

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4, duration: 0.3 }}
                    >
                      <Button 
                        onClick={handleContinue} 
                        className="w-full" 
                        size="lg"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        {selectedRole === 'patient' ? 'Completar registro' : 'Continuar'}
                      </Button>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Completa tu perfil de {selectedRole === 'doctor' ? 'médico' : 'residente'}</CardTitle>
                    <CardDescription>
                      Esta información nos ayudará a verificar tu identidad profesional
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <motion.div 
                      className="space-y-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.3 }}
                    >
                      <Label htmlFor="specialty" className="flex items-center gap-1">
                        Especialidad <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="specialty"
                        placeholder="Ej: Cardiología, Medicina General"
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        className={validationErrors.specialty ? 'border-destructive focus-visible:ring-destructive' : ''}
                        maxLength={100}
                      />
                      {validationErrors.specialty && (
                        <motion.p 
                          className="text-sm text-destructive flex items-center gap-1"
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <AlertCircle className="w-3 h-3" />
                          {validationErrors.specialty}
                        </motion.p>
                      )}
                    </motion.div>

                    {selectedRole === 'doctor' && (
                      <motion.div 
                        className="space-y-2"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.3 }}
                      >
                        <Label htmlFor="license" className="flex items-center gap-1">
                          Número de licencia médica <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="license"
                          placeholder="Número de cédula profesional"
                          value={license}
                          onChange={(e) => setLicense(e.target.value)}
                          className={validationErrors.license ? 'border-destructive focus-visible:ring-destructive' : ''}
                          maxLength={50}
                        />
                        {validationErrors.license && (
                          <motion.p 
                            className="text-sm text-destructive flex items-center gap-1"
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <AlertCircle className="w-3 h-3" />
                            {validationErrors.license}
                          </motion.p>
                        )}
                      </motion.div>
                    )}

                    {selectedRole === 'resident' && (
                      <>
                        <motion.div 
                          className="space-y-2"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2, duration: 0.3 }}
                        >
                          <Label htmlFor="institution" className="flex items-center gap-1">
                            Institución <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="institution"
                            placeholder="Nombre del hospital o universidad"
                            value={institution}
                            onChange={(e) => setInstitution(e.target.value)}
                            className={validationErrors.institution ? 'border-destructive focus-visible:ring-destructive' : ''}
                            maxLength={150}
                          />
                          {validationErrors.institution && (
                            <motion.p 
                              className="text-sm text-destructive flex items-center gap-1"
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                            >
                              <AlertCircle className="w-3 h-3" />
                              {validationErrors.institution}
                            </motion.p>
                          )}
                        </motion.div>
                        <motion.div 
                          className="space-y-2"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3, duration: 0.3 }}
                        >
                          <Label htmlFor="year" className="flex items-center gap-1">
                            Año de residencia <span className="text-destructive">*</span>
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
                          {validationErrors.year && (
                            <motion.p 
                              className="text-sm text-destructive flex items-center gap-1"
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                            >
                              <AlertCircle className="w-3 h-3" />
                              {validationErrors.year}
                            </motion.p>
                          )}
                        </motion.div>
                      </>
                    )}

                    <motion.div 
                      className="flex gap-3 pt-4"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4, duration: 0.3 }}
                    >
                      <Button 
                        variant="outline" 
                        onClick={() => setStep(1)}
                        className="flex-1"
                      >
                        Atrás
                      </Button>
                      <Button 
                        onClick={handleSubmit} 
                        className="flex-1"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Completar registro
                      </Button>
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
