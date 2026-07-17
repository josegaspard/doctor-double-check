import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
import { Shield, Loader2, User, Stethoscope, GraduationCap, CheckCircle, Sparkles, PartyPopper, ArrowRight, AlertCircle, MapPin, Navigation, Globe, Phone, MessageSquare } from 'lucide-react';
import { COUNTRY_CURRENCIES, detectCountry } from '@/hooks/useCurrency';
import logoMedicalMasters from '@/assets/logo-medical-masters.png';
import { toast } from 'sonner';
import { AppRole as UserRole } from '@/types/database';
import { AvatarUpload } from '@/components/onboarding/AvatarUpload';
import { CedulaPhotoUpload } from '@/components/onboarding/CedulaPhotoUpload';
import { CedulaVerificationStatus, useCedulaStatus } from '@/components/onboarding/CedulaVerificationStatus';
import { CedulaAutoVerify } from '@/components/onboarding/CedulaAutoVerify';
import { ClinicalHistoryForm, ClinicalHistoryData } from '@/components/onboarding/ClinicalHistoryForm';
import { DocumentSignature } from '@/components/onboarding/DocumentSignature';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Badge } from '@/components/ui/badge';
import { AppBackground } from '@/components/layout/AppBackground';
import { UnifiedFooter } from '@/components/layout/UnifiedFooter';

// Known Mexican city coordinates for geocoding
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'ciudad de mexico': { lat: 19.4326, lng: -99.1332 },
  'cdmx': { lat: 19.4326, lng: -99.1332 },
  'guadalajara': { lat: 20.6597, lng: -103.3496 },
  'monterrey': { lat: 25.6866, lng: -100.3161 },
  'puebla': { lat: 19.0414, lng: -98.2063 },
  'tijuana': { lat: 32.5149, lng: -117.0382 },
  'merida': { lat: 20.9674, lng: -89.5926 },
  'cancun': { lat: 21.1619, lng: -86.8515 },
  'queretaro': { lat: 20.5888, lng: -100.3899 },
  'chihuahua': { lat: 28.6353, lng: -106.0889 },
  'morelia': { lat: 19.7060, lng: -101.1950 },
  'aguascalientes': { lat: 21.8853, lng: -102.2916 },
  'toluca': { lat: 19.2826, lng: -99.6557 },
  'hermosillo': { lat: 29.0729, lng: -110.9559 },
  'veracruz': { lat: 19.1738, lng: -96.1342 },
  'oaxaca': { lat: 17.0732, lng: -96.7266 },
  'culiacan': { lat: 24.7994, lng: -107.3940 },
  'san luis potosi': { lat: 22.1565, lng: -100.9855 },
  'cuernavaca': { lat: 18.9242, lng: -99.2216 },
  'pachuca': { lat: 20.1011, lng: -98.7591 },
  'mazatlan': { lat: 23.2494, lng: -106.4111 },
};

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function reverseGeocode(lat: number, lng: number): string {
  let nearest = 'Ciudad de Mexico';
  let minDist = Infinity;
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    const dist = haversineDistance(lat, lng, coords.lat, coords.lng);
    if (dist < minDist) { minDist = dist; nearest = city; }
  }
  return nearest.replace(/\b\w/g, c => c.toUpperCase());
}

import { useSpecialties } from '@/hooks/useSpecialties';

interface ValidationErrors {
  specialty?: string;
  license?: string;
  cedulaPhoto?: string;
  institution?: string;
  year?: string;
  signerName?: string;
  termsAccepted?: string;
  privacyAccepted?: string;
  doctorContract?: string;
  codeOfEthics?: string;
}
const triggerConfetti = () => {
  const duration = 3000;
  const end = Date.now() + duration;

  // Brand palette confetti: navy + teal + lavanda + mint
  const colors = ['#163a83', '#227787', '#00879f', '#839ed5', '#aed3d9'];

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
  const { specialtiesList: MEDICAL_SPECIALTIES } = useSpecialties();

  const resolveInitialRole = (): OnboardingRole => {
    const r = (user?.role || (supabaseUser?.user_metadata as any)?.role) as OnboardingRole | undefined;
    return r === 'doctor' || r === 'resident' || r === 'patient' ? r : 'patient';
  };

  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<OnboardingRole>(resolveInitialRole);
  const [roleHydrated, setRoleHydrated] = useState(false);

  // Hydrate role from auth context once the user object is available (it loads async).
  // Only override before the user manually changes anything (i.e. on first hydration).
  useEffect(() => {
    if (roleHydrated) return;
    const r = (user?.role || (supabaseUser?.user_metadata as any)?.role) as OnboardingRole | undefined;
    if (r === 'doctor' || r === 'resident' || r === 'patient') {
      setSelectedRole(r);
      setRoleHydrated(true);
    }
  }, [user?.role, supabaseUser, roleHydrated]);
  const [specialty, setSpecialty] = useState('');
  const [institution, setInstitution] = useState('');
  const [license, setLicense] = useState('');
  // Cédula de especialista (opcional), además de la profesional — solo doctor (cliente 2026-07-07)
  const [cedulaEspecialidad, setCedulaEspecialidad] = useState('');
  // Universidad y hospital (opcionales) — alimentan los filtros públicos por membrete
  // del doctor (país/universidad/hospital) en contenido premium y lives (cliente 2026-07-15)
  const [university, setUniversity] = useState('');
  const [hospital, setHospital] = useState('');
  // Foto de la cédula profesional (obligatoria) para checar identidad — solo doctor (cliente 2026-07-08).
  // Guarda el PATH dentro del bucket privado 'doctor-credentials'.
  const [cedulaPhotoUrl, setCedulaPhotoUrl] = useState<string | null>(null);
  // Distintivo que el médico elige al verificarse (cliente 2026-06-29):
  // 'gold' = 🥇 medalla dorada, 'verified' = ✔️ palomita, null = ninguno.
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
  const [doctorLocation, setDoctorLocation] = useState('');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [username, setUsername] = useState('');
  // Default a MX (app de telemedicina mexicana). Si el navegador es de otra región el usuario puede cambiar.
  const [selectedCountry, setSelectedCountry] = useState(() => {
    const detected = detectCountry();
    return COUNTRY_CURRENCIES['MX'] && detected === 'US' ? 'MX' : detected;
  });
  
  // Phone verification state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+52');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneSendingOtp, setPhoneSendingOtp] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState('');
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  const [phoneRateLimited, setPhoneRateLimited] = useState(false);
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
  // Código de Ética: obligatorio SOLO para médicos antes de ingresar (cliente 2026-06-29).
  const [codeOfEthicsAccepted, setCodeOfEthicsAccepted] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedProgress = useRef(false);
  
  // Cedula verification status.
  // El hook debe llamarse SIEMPRE (Rules of Hooks): llamarlo dentro del ternario
  // cambiaba el conteo de hooks al verificarse la cédula → "Rendered fewer hooks"
  // y pantalla blanca en el onboarding.
  const rawCedulaStatus = useCedulaStatus(license);
  const cedulaStatus = cedulaVerified ? 'verified' : rawCedulaStatus;
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

      // Foto de la cédula obligatoria para checar identidad (cliente 2026-07-08)
      if (!cedulaPhotoUrl) {
        errors.cedulaPhoto = t('onboarding.validationCedulaPhoto');
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
        errors.institution = t('onboardingPage.validationEmergencyContact');
      }
    }

    // Step 2 validation for signatures (all roles)
    if (step === 2) {
      if (!signerName.trim()) errors.signerName = t('onboardingPage.validationSignatureRequired');
      if (!termsAccepted) errors.termsAccepted = t('onboardingPage.validationAcceptTerms');
      if (!privacyAccepted) errors.privacyAccepted = t('onboardingPage.validationAcceptPrivacy');
      if (selectedRole === 'doctor' && !doctorContractAccepted) errors.doctorContract = t('onboardingPage.validationAcceptDoctorContract');
      if (selectedRole === 'doctor' && !codeOfEthicsAccepted) errors.codeOfEthics = t('onboardingPage.validationAcceptCodeOfEthics');
    }

    return errors;
  }, [selectedRole, specialty, license, cedulaPhotoUrl, institution, year, step, clinicalHistory, signerName, termsAccepted, privacyAccepted, doctorContractAccepted, codeOfEthicsAccepted]);

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
      const progressData: any = {
        user_id: supabaseUser.id,
        step,
        selected_role: selectedRole,
        specialty: specialty || null,
        license: license || null,
        institution: institution || null,
        year,
        avatar_url: avatarUrl,
        cedula_photo_url: cedulaPhotoUrl,
        phone: phoneNumber ? `${phoneCountryCode}${phoneNumber}` : null,
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
  }, [supabaseUser, step, selectedRole, specialty, license, institution, year, avatarUrl, cedulaPhotoUrl, phoneNumber, phoneCountryCode]);

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
  }, [step, selectedRole, specialty, license, institution, year, avatarUrl, cedulaPhotoUrl, debouncedSave, supabaseUser]);

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

      // Foto de la cédula ya ligada al perfil: precargarla para no pedirla dos veces.
      // También universidad/hospital (pudieron llegar vía metadata del registro) para
      // no pisarlos con null en el upsert final (cliente 2026-07-15).
      const { data: dp } = await (supabase as any)
        .from('doctor_profiles')
        .select('cedula_photo_url, university, practice_hospital')
        .eq('user_id', supabaseUser.id)
        .maybeSingle();
      if (dp?.university) setUniversity(dp.university);
      if (dp?.practice_hospital) setHospital(dp.practice_hospital);
      if (dp?.cedula_photo_url) {
        setCedulaPhotoUrl(dp.cedula_photo_url);
      } else {
        // Foto elegida en el REGISTRO (cliente 2026-07-08): el form la deja en
        // IndexedDB porque el redirect duro post-signUp mata cualquier subida en
        // vuelo y antes del signUp no hay sesión. Aquí ya hay sesión → subirla.
        try {
          const { takeCedulaFoto } = await import('@/lib/cedulaFotoHandoff');
          const pending = await takeCedulaFoto();
          if (pending) {
            const { compressImageIfNeeded, withTimeout } = await import('@/lib/imageUpload');
            const upload = await compressImageIfNeeded(pending);
            const ext = (upload.name.split('.').pop() || 'jpg').toLowerCase();
            const path = `${supabaseUser.id}/cedula-foto-${Date.now()}.${ext}`;
            const { error: upErr } = await withTimeout(
              supabase.storage.from('doctor-credentials').upload(path, upload, {
                upsert: true,
                contentType: upload.type || 'image/jpeg',
              }),
              60_000,
              'subida de foto de cédula',
            );
            if (!upErr) {
              setCedulaPhotoUrl(path);
              await (supabase as any)
                .from('doctor_profiles')
                .update({ cedula_photo_url: path })
                .eq('user_id', supabaseUser.id);
            } else {
              console.error('[Onboarding] cedula foto handoff upload error', upErr);
            }
          }
        } catch (handoffErr) {
          console.error('[Onboarding] cedula foto handoff error', handoffErr);
        }
      }

      // Load saved progress
      const { data: savedProgress } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('user_id', supabaseUser.id)
        .maybeSingle();

      if (savedProgress) {
        if (savedProgress.step) setStep(savedProgress.step);
        if (savedProgress.selected_role) setSelectedRole(savedProgress.selected_role as OnboardingRole);
        if (savedProgress.specialty) setSpecialty(savedProgress.specialty);
        if (savedProgress.license) setLicense(savedProgress.license);
        if (savedProgress.institution) setInstitution(savedProgress.institution);
        if (savedProgress.year) setYear(savedProgress.year);
        if (savedProgress.avatar_url) setAvatarUrl(savedProgress.avatar_url);
        // Columna nueva (2026-07-08), aún no está en los tipos generados
        if ((savedProgress as any).cedula_photo_url) setCedulaPhotoUrl((savedProgress as any).cedula_photo_url);
        
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
    
    // Validate form for all roles
    {
      const errors = validateForm;
      setValidationErrors(errors);
      
      if (Object.keys(errors).length > 0) {
        toast.error(t('onboarding.requiredFields'));
        return;
      }
    }
    
    setIsSubmitting(true);
    
    try {
      // Update user role. UPSERT (no UPDATE): si la fila user_roles no existiera
      // (trigger que no corrió / fila borrada), un UPDATE afectaba 0 filas SIN error
      // y el usuario quedaba como 'patient' en silencio (un doctor terminaba como
      // paciente). El upsert garantiza que el rol quede escrito.
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({ user_id: supabaseUser.id, role: selectedRole }, { onConflict: 'user_id' });

      if (roleError) throw roleError;

      // Create role-specific profile if needed
      if (selectedRole === 'doctor') {
        // Create wallet for doctor (for pending_earnings tracking)
        const { error: walletError } = await supabase
          .from('wallets')
          .upsert({ user_id: supabaseUser.id, balance: 0 }, { onConflict: 'user_id' });
        
        if (walletError) {
          console.error('Wallet creation error:', walletError);
        }

        // Build doctor profile data, including cedula_verification_id if verified
        const doctorProfileData: any = {
          user_id: supabaseUser.id,
          specialty: specialty || 'General',
          license: license || '',
          status: 'pending',
          location: doctorLocation.trim() || null,
          cedula_especialidad: cedulaEspecialidad.trim() || null,
          cedula_especialidad_status: cedulaEspecialidad.trim() ? 'pending' : null,
          cedula_photo_url: cedulaPhotoUrl,
          // Universidad y hospital — alimentan los filtros públicos por membrete (cliente 2026-07-15)
          university: university.trim() || null,
          practice_hospital: hospital.trim() || null,
        };

        // Link cedula verification if available
        if (cedulaVerificationId) {
          doctorProfileData.cedula_verification_id = cedulaVerificationId;
        }

        const { error: doctorError } = await supabase
          .from('doctor_profiles')
          .upsert(doctorProfileData, { onConflict: 'user_id' });
        
        if (doctorError) {
          throw doctorError;
        }
      }

      if (selectedRole === 'resident') {
        // Create wallet for resident
        const { error: walletError } = await supabase
          .from('wallets')
          .upsert({ user_id: supabaseUser.id, balance: 0 }, { onConflict: 'user_id' });
        
        if (walletError) {
          console.error('Wallet creation error:', walletError);
        }

        const { error: residentError } = await supabase
          .from('resident_profiles')
          .upsert({
            user_id: supabaseUser.id,
            institution: institution || '',
            specialty: specialty || 'General',
            year: year,
            status: 'pending',
          }, { onConflict: 'user_id' });
        
        if (residentError) {
          throw residentError;
        }
      }

      if (selectedRole === 'patient') {
        // Create wallet for patient
        const { error: walletError } = await supabase
          .from('wallets')
          .upsert({ user_id: supabaseUser.id, balance: 0 }, { onConflict: 'user_id' });
        
        if (walletError) {
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

        if (selectedRole === 'doctor' && codeOfEthicsAccepted) {
          signatures.push({ type: 'code_of_ethics', version: '1.0' });
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

      // Mark onboarding as completed and save avatar + country
      const countryInfo = COUNTRY_CURRENCIES[selectedCountry] || COUNTRY_CURRENCIES['MX'];
      const updateData: Record<string, any> = { 
        onboarding_completed: true,
        country_code: selectedCountry,
        currency_code: countryInfo.currency,
        country_flag: countryInfo.flag,
      };
      
      if (avatarUrl) {
        updateData.avatar_url = avatarUrl;
      }

      if (username.trim()) {
        updateData.username = username.trim();
      }

      // Save verified phone
      if (phoneVerified && phoneNumber) {
        updateData.phone = `${phoneCountryCode}${phoneNumber}`;
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

      // Send welcome email + admin notification for doctor/resident pending review
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

          // Notify admins about new doctor/resident signups (patients don't need admin review)
          if (selectedRole === 'doctor') {
            await supabase.functions.invoke('notify-admin', {
              body: {
                type: 'doctor_signup',
                data: {
                  userName: profileData.name,
                  userEmail: profileData.email,
                  specialty,
                  license,
                },
              },
            });
          } else if (selectedRole === 'resident') {
            await supabase.functions.invoke('notify-admin', {
              body: {
                type: 'resident_signup',
                data: {
                  userName: profileData.name,
                  userEmail: profileData.email,
                  institution,
                  specialty,
                  year,
                },
              },
            });
          }
        }
      } catch (emailErr) {
        console.error('Welcome/admin email error:', emailErr);
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
      <AppBackground className="min-h-[100dvh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="relative z-10 w-8 h-8 animate-spin text-primary" />
        <p className="relative z-10 text-sm text-muted-foreground">{t('onboarding.loadingProgress')}</p>
      </AppBackground>
    );
  }

  // Welcome screen after successful onboarding
  if (showWelcome) {
    const RoleIcon = getRoleIcon();
    return (
      <AppBackground className="min-h-[100dvh] flex flex-col">
      <header className="app-shell-header">
          <div className="container mx-auto px-4 py-3">
            <div className="relative flex items-center justify-between min-h-14">
              {/* Logo GRANDE y centrado, mismo tamaño que el landing (cliente 10-jul); meta solo en tablet+ para no chocar */}
              <Link to="/" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center">
                <img src={logoMedicalMasters} alt="Medical Masters" className="h-14 w-auto" />
              </Link>
              <span className="app-shell-header-meta text-xs font-medium ml-auto hidden sm:inline">{t('onboardingPage.headerAccountSetup')}</span>
            </div>
          </div>
        </header>

        {/* Welcome Content */}
        <main className="relative z-10 flex-1 container mx-auto px-4 py-8 sm:py-12 flex items-start justify-center overflow-y-auto">
          <motion.div
            className="w-full max-w-lg text-center pb-10 sm:pb-14"
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

            {selectedRole === 'patient' && (
              <motion.div
                className="w-full max-w-md mx-auto mb-6 p-4 rounded-lg border border-primary/30 bg-primary/10 text-left"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.4 }}
              >
                <p className="text-sm font-semibold text-primary mb-1">{t('onboardingPage.welcomeWalletTipTitle')}</p>
                <p className="text-xs text-secondary">
                  {t('onboardingPage.welcomeWalletTipBodyPrefix')}<strong className="text-primary">{t('onboardingPage.welcomeWalletTipWalletWord')}</strong>{t('onboardingPage.welcomeWalletTipBodySuffix')}
                </p>
              </motion.div>
            )}

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

        {/* Footer COMPLETO — el mismo de toda la app (no solo el copyright). */}
        <UnifiedFooter variant="app" />
      </AppBackground>
    );
  }

  const totalSteps = 2; // Always 2 steps now (Patient has Clinical History, Doctors have Verification/Signature)

  return (
    <AppBackground className="min-h-[100dvh] flex flex-col">
      <header className="app-shell-header">
        <div className="container mx-auto px-4 py-3">
          <div className="relative flex items-center justify-between min-h-14">
            {/* Logo GRANDE y centrado, mismo tamaño que el landing (cliente 10-jul); meta solo en tablet+ para no chocar */}
            <Link to="/" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center">
              <img src={logoMedicalMasters} alt="Medical Masters" className="h-14 w-auto" />
            </Link>
            <span className="app-shell-header-meta text-xs font-medium ml-auto hidden sm:inline">{t('onboardingPage.headerAccountSetup')}</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 container mx-auto px-3 sm:px-4 py-6 sm:py-12 flex items-start justify-center overflow-y-auto">
        <div className="w-full max-w-lg pb-10 sm:pb-14">
          {/* Progress Indicator */}
          <motion.div 
            className="mb-4 sm:mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((stepNumber) => (
                <div key={stepNumber} className="flex items-center">
                  <motion.div
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold ${
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
                      className="w-8 sm:w-16 h-1 mx-1 sm:mx-2 rounded-full bg-muted overflow-hidden"
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
                      className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full bg-primary/10 flex items-center justify-center"
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
                        <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                      </motion.div>
                    </motion.div>
                    <CardTitle className="text-xl sm:text-2xl">{t('onboarding.welcomeSubtitle')}</CardTitle>
                    <CardDescription className="text-sm sm:text-base">
                      {t('onboarding.personalizeExperience')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <motion.div 
                      className="space-y-4 sm:space-y-6"
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

                      {/* Username Field */}
                      <motion.div className="space-y-2" variants={itemVariants}>
                        <Label htmlFor="username" className="text-sm font-medium">
                          {t('onboardingPage.usernameLabel')}
                        </Label>
                        <Input
                          id="username"
                          placeholder={t('onboardingPage.usernamePlaceholder')}
                          value={username}
                          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                          maxLength={30}
                          className="lowercase"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          {t('onboardingPage.usernameHelp')}
                        </p>
                      </motion.div>

                      {/* Country Selector */}
                      <motion.div className="space-y-2" variants={itemVariants}>
                        <Label htmlFor="country" className="text-sm font-medium flex items-center gap-1.5">
                          <Globe className="w-4 h-4" />
                          {t('onboardingPage.countryLabel')}
                        </Label>
                        <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                          <SelectTrigger id="country">
                            <SelectValue placeholder={t('onboardingPage.countryPlaceholder')} />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {Object.entries(COUNTRY_CURRENCIES).map(([code, info]) => (
                              <SelectItem key={code} value={code}>
                                <span className="flex items-center gap-2">
                                  <span>{info.flag}</span>
                                  <span>{info.name}</span>
                                  <span className="text-muted-foreground text-xs">({info.currency})</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">
                          {t('onboardingPage.countryHelp')}
                        </p>
                      </motion.div>

                      {/* Phone Verification (Optional) */}
                      <motion.div className="space-y-3" variants={itemVariants}>
                        <Label className="text-sm font-medium flex items-center gap-1.5">
                          <Phone className="w-4 h-4" />
                          {t('onboardingPage.phoneLabel')} <span className="text-muted-foreground font-normal text-xs">{t('onboardingPage.phoneOptional')}</span>
                        </Label>
                        <div className="flex gap-2">
                          <Select value={phoneCountryCode} onValueChange={setPhoneCountryCode}>
                            <SelectTrigger className="w-[100px] flex-shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="+52">🇲🇽 +52</SelectItem>
                              <SelectItem value="+1">🇺🇸 +1</SelectItem>
                              <SelectItem value="+57">🇨🇴 +57</SelectItem>
                              <SelectItem value="+56">🇨🇱 +56</SelectItem>
                              <SelectItem value="+54">🇦🇷 +54</SelectItem>
                              <SelectItem value="+34">🇪🇸 +34</SelectItem>
                              <SelectItem value="+51">🇵🇪 +51</SelectItem>
                              <SelectItem value="+593">🇪🇨 +593</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder={t('onboardingPage.phonePlaceholder')}
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 15))}
                            disabled={phoneVerified}
                            className="flex-1"
                            type="tel"
                            inputMode="numeric"
                          />
                          {phoneVerified ? (
                            <Badge className="bg-success/10 text-success border-success flex items-center gap-1 whitespace-nowrap self-center">
                              <CheckCircle className="w-3.5 h-3.5" />
                              {t('onboardingPage.phoneVerifiedBadge')}
                            </Badge>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={phoneSendingOtp || phoneNumber.length < 10 || phoneOtpSent || phoneRateLimited}
                              className="whitespace-nowrap self-center"
                              onClick={async () => {
                                setPhoneSendingOtp(true);
                                try {
                                  const fullPhone = `${phoneCountryCode}${phoneNumber}`;
                                  const { data, error } = await supabase.functions.invoke('verify-phone-otp', {
                                    body: { phone: fullPhone, action: 'send' },
                                  });
                                  if (error) throw new Error(error.message);
                                  if (data?.rateLimited) {
                                    setPhoneRateLimited(true);
                                    toast.error(t('onboardingPage.phoneRateLimited'));
                                    return;
                                  }
                                  if (data?.alreadyVerified) {
                                    setPhoneVerified(true);
                                    toast.success(t('onboardingPage.phoneAlreadyVerified'));
                                    return;
                                  }
                                  setPhoneOtpSent(true);
                                  toast.success(data?.smsSent ? t('onboardingPage.phoneCodeSentSms') : t('onboardingPage.phoneCodeSentNotif'));
                                } catch (err: any) {
                                  toast.error(err.message || t('onboardingPage.phoneSendError'));
                                } finally {
                                  setPhoneSendingOtp(false);
                                }
                              }}
                            >
                              {phoneSendingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : t('onboardingPage.phoneSendCode')}
                            </Button>
                          )}
                        </div>

                        {/* OTP Input when sent */}
                        {phoneOtpSent && !phoneVerified && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="space-y-3 p-3 rounded-lg border border-border bg-muted/30"
                          >
                            <p className="text-sm text-muted-foreground">
                              {t('onboardingPage.phoneOtpPrompt')}
                            </p>
                            <div className="flex items-center gap-3">
                              <InputOTP
                                maxLength={6}
                                value={phoneOtpCode}
                                onChange={setPhoneOtpCode}
                              >
                                <InputOTPGroup>
                                  {[0, 1, 2, 3, 4, 5].map(i => (
                                    <InputOTPSlot key={i} index={i} />
                                  ))}
                                </InputOTPGroup>
                              </InputOTP>
                              <Button
                                type="button"
                                size="sm"
                                disabled={phoneOtpCode.length !== 6 || isVerifyingPhone}
                                onClick={async () => {
                                  setIsVerifyingPhone(true);
                                  try {
                                    const fullPhone = `${phoneCountryCode}${phoneNumber}`;
                                    const { data, error } = await supabase.functions.invoke('verify-phone-otp', {
                                      body: { phone: fullPhone, action: 'verify', otp_code: phoneOtpCode },
                                    });
                                    if (error) throw new Error(error.message);
                                    if (data?.verified) {
                                      setPhoneVerified(true);
                                      setPhoneOtpSent(false);
                                      toast.success(t('onboardingPage.phoneVerifySuccess'));
                                    } else {
                                      toast.error(data?.error || t('onboardingPage.phoneVerifyInvalid'));
                                    }
                                  } catch (err: any) {
                                    toast.error(err.message || t('onboardingPage.phoneVerifyError'));
                                  } finally {
                                    setIsVerifyingPhone(false);
                                  }
                                }}
                              >
                                {isVerifyingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : t('onboardingPage.phoneVerifyButton')}
                              </Button>
                            </div>
                          </motion.div>
                        )}

                        <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                          <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          {t('onboardingPage.phoneHelp')}
                        </p>
                      </motion.div>

                      <motion.div className="space-y-3" variants={itemVariants}>
                        <Label className="text-base font-medium">{t('onboarding.selectRole')}</Label>
                        {/* Selector de rol QUITADO (cliente 2026-06-16): el rol ya se eligió en
                            /app (médico/paciente/etc.), aquí solo se MUESTRA, no se puede cambiar. */}
                        <div className="grid gap-3">
                          {[
                            { value: 'patient', icon: User, label: t('onboarding.patient'), desc: t('onboarding.patientDesc') },
                            { value: 'doctor', icon: Stethoscope, label: t('onboarding.doctor'), desc: t('onboarding.doctorDesc') },
                            { value: 'resident', icon: GraduationCap, label: t('onboarding.resident'), desc: t('onboarding.residentDesc') }
                          ].filter(role => role.value === selectedRole).map((role) => (
                            <div
                              key={role.value}
                              className="flex items-center gap-4 p-4 rounded-lg border-2 border-primary bg-primary/5"
                            >
                              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center bg-primary text-primary-foreground">
                                <role.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{role.label}</p>
                                <p className="text-sm text-muted-foreground">{role.desc}</p>
                              </div>
                              <CheckCircle className="w-5 h-5 text-primary" />
                            </div>
                          ))}
                        </div>
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

                          {/* SEP Verification UX Text */}
                          {supabaseUser && cedulaStatus === 'valid_pending' && !cedulaVerified && (
                            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                                <Shield className="w-4 h-4 text-primary" />
                                {t('onboardingPage.sepAccelerateTitle')}
                              </p>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {t('onboardingPage.sepAccelerateBody')}
                              </p>
                              <CedulaAutoVerify
                                cedula={license.trim()}
                                userId={supabaseUser.id}
                                onVerified={handleCedulaVerified}
                                onClaimed={handleCedulaClaimed}
                                language={language}
                              />
                            </div>
                          )}
                        </motion.div>
                      )}

                      {/* Foto de la cédula profesional (obligatoria) — para checar identidad (cliente 2026-07-08) */}
                      {selectedRole === 'doctor' && supabaseUser && (
                        <motion.div className="space-y-2" variants={itemVariants}>
                          <Label className="flex items-center gap-1">
                            {t('onboarding.cedulaPhoto')} <span className="text-destructive">*</span>
                          </Label>
                          <CedulaPhotoUpload
                            userId={supabaseUser.id}
                            currentPath={cedulaPhotoUrl}
                            onChange={setCedulaPhotoUrl}
                            hasError={!!validationErrors.cedulaPhoto}
                          />
                          <AnimatePresence>
                            {validationErrors.cedulaPhoto && (
                              <motion.p
                                className="text-sm text-destructive flex items-center gap-1"
                                initial={{ opacity: 0, y: -10, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: "auto" }}
                                exit={{ opacity: 0, y: -10, height: 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              >
                                <AlertCircle className="w-3 h-3" />
                                {validationErrors.cedulaPhoto}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}

                      {/* Cédula de especialista (opcional) — debajo de la profesional (cliente 2026-07-07) */}
                      {selectedRole === 'doctor' && (
                        <motion.div className="space-y-2" variants={itemVariants}>
                          <Label htmlFor="cedula-especialidad">
                            {t('onboarding.cedulaEspecialidad')} <span className="text-muted-foreground font-normal text-xs">{t('onboardingPage.phoneOptional')}</span>
                          </Label>
                          <Input
                            id="cedula-especialidad"
                            placeholder={t('onboarding.cedulaEspecialidadPlaceholder')}
                            value={cedulaEspecialidad}
                            onChange={(e) => setCedulaEspecialidad(e.target.value.slice(0, 50))}
                            maxLength={50}
                          />
                        </motion.div>
                      )}

                      {/* Universidad (opcional) — alimenta el filtro público por universidad (cliente 2026-07-15) */}
                      {selectedRole === 'doctor' && (
                        <motion.div className="space-y-2" variants={itemVariants}>
                          <Label htmlFor="doctor-university">
                            {t('doctorFilters.universityLabel')} <span className="text-muted-foreground font-normal text-xs">{t('onboardingPage.phoneOptional')}</span>
                          </Label>
                          <Input
                            id="doctor-university"
                            value={university}
                            onChange={(e) => setUniversity(e.target.value.slice(0, 200))}
                            maxLength={200}
                          />
                        </motion.div>
                      )}

                      {/* Hospital / lugar de trabajo (opcional) — alimenta el filtro público por hospital (cliente 2026-07-15) */}
                      {selectedRole === 'doctor' && (
                        <motion.div className="space-y-2" variants={itemVariants}>
                          <Label htmlFor="doctor-hospital">
                            {t('doctorFilters.hospitalProfileLabel')} <span className="text-muted-foreground font-normal text-xs">{t('onboardingPage.phoneOptional')}</span>
                          </Label>
                          <Input
                            id="doctor-hospital"
                            value={hospital}
                            onChange={(e) => setHospital(e.target.value.slice(0, 200))}
                            maxLength={200}
                          />
                        </motion.div>
                      )}

                      {/* El distintivo (medalla/palomita) lo asigna el SUPER-ADMIN al verificar
                          el perfil (cliente 2026-06-30), NO el propio doctor. Ver AdminDoctors. */}

                      {/* Identity Verification with Veriff (doctors & residents) */}
                      {(selectedRole === 'doctor' || selectedRole === 'resident') && supabaseUser && (
                        <motion.div variants={itemVariants} className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                          <p className="text-sm font-medium text-foreground flex items-center gap-2">
                            <Shield className="w-4 h-4 text-primary" />
                            {t('onboardingPage.identityVerificationTitle')}
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {t('onboardingPage.identityVerificationBody')}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => window.open('/verify-identity', '_blank')}
                          >
                            <Shield className="w-3.5 h-3.5" />
                            {t('onboardingPage.identityVerificationButton')}
                          </Button>
                          <p className="text-[10px] text-muted-foreground">
                            {t('onboardingPage.identityVerificationLater')}
                          </p>
                        </motion.div>
                      )}

                      {/* Location field for doctors */}
                      {selectedRole === 'doctor' && (
                        <motion.div className="space-y-2" variants={itemVariants}>
                          <Label htmlFor="doctor-location" className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {t('onboarding.location')}
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              id="doctor-location"
                              placeholder={t('onboarding.locationPlaceholder')}
                              value={doctorLocation}
                              onChange={(e) => setDoctorLocation(e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="flex-shrink-0 gap-1.5 h-10"
                              disabled={isDetectingLocation}
                              onClick={() => {
                                if (!('geolocation' in navigator)) {
                                  toast.error(t('onboardingPage.geoNotSupported'));
                                  return;
                                }
                                setIsDetectingLocation(true);
                                navigator.geolocation.getCurrentPosition(
                                  (pos) => {
                                    const city = reverseGeocode(pos.coords.latitude, pos.coords.longitude);
                                    setDoctorLocation(city);
                                    setIsDetectingLocation(false);
                                    toast.success(t('onboardingPage.geoDetected').replace('{city}', city));
                                  },
                                  () => {
                                    setIsDetectingLocation(false);
                                    toast.error(t('onboardingPage.geoError'));
                                  }
                                );
                              }}
                            >
                              {isDetectingLocation ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Navigation className="w-3.5 h-3.5" />
                              )}
                              <span className="hidden sm:inline">
                                {isDetectingLocation ? t('onboarding.detectingLocation') : t('onboarding.useMyLocation')}
                              </span>
                            </Button>
                          </div>
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
                          codeOfEthicsAccepted={codeOfEthicsAccepted}
                          onCodeOfEthicsChange={setCodeOfEthicsAccepted}
                          showCodeOfEthics={selectedRole === 'doctor'}
                        />
                        <AnimatePresence>
                          {(validationErrors.signerName || validationErrors.termsAccepted || validationErrors.privacyAccepted || validationErrors.doctorContract || validationErrors.codeOfEthics) && (
                            <motion.p 
                              className="text-sm text-destructive flex items-center gap-1 mt-2"
                              initial={{ opacity: 0, y: -10, height: 0 }}
                              animate={{ opacity: 1, y: 0, height: "auto" }}
                              exit={{ opacity: 0, y: -10, height: 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            >
                              <AlertCircle className="w-3 h-3" />
                              {validationErrors.signerName || validationErrors.termsAccepted || validationErrors.privacyAccepted || validationErrors.doctorContract || validationErrors.codeOfEthics}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </motion.div>

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

      {/* Footer COMPLETO — el mismo de toda la app (no solo el copyright). */}
      <UnifiedFooter variant="app" />
    </AppBackground>
  );
}
