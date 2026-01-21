import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Shield, Loader2, User, Stethoscope, GraduationCap, CheckCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { UserRole } from '@/types';

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

  // Check if user needs onboarding or should be redirected
  useEffect(() => {
    const checkOnboardingStatus = async () => {
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
        // User already completed onboarding, redirect to lives
        navigate('/lives');
        return;
      }

      setIsCheckingOnboarding(false);
    };

    checkOnboardingStatus();
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

      // Mark onboarding as completed
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', supabaseUser.id);

      if (profileError) throw profileError;

      // Refresh user data
      await refreshUser();

      toast.success('¡Perfil completado exitosamente!');
      
      // Redirect based on role
      if (selectedRole === 'patient') {
        navigate('/lives');
      } else {
        navigate('/verification-pending');
      }
    } catch (error: any) {
      console.error('Onboarding error:', error);
      toast.error(error.message || 'Error al completar el perfil');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isCheckingOnboarding) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
          {step === 1 && (
            <Card>
              <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">¡Bienvenido a Dr Double Check!</CardTitle>
                <CardDescription className="text-base">
                  Para personalizar tu experiencia, cuéntanos más sobre ti
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-base font-medium">¿Cuál es tu rol?</Label>
                  <RadioGroup 
                    value={selectedRole} 
                    onValueChange={(v) => handleRoleSelect(v as OnboardingRole)}
                    className="grid gap-3"
                  >
                    <Label
                      htmlFor="patient"
                      className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedRole === 'patient' 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value="patient" id="patient" className="sr-only" />
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        selectedRole === 'patient' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        <User className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">Paciente</p>
                        <p className="text-sm text-muted-foreground">
                          Accede a consultas médicas y contenido educativo
                        </p>
                      </div>
                      {selectedRole === 'patient' && (
                        <CheckCircle className="w-5 h-5 text-primary" />
                      )}
                    </Label>

                    <Label
                      htmlFor="doctor"
                      className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedRole === 'doctor' 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value="doctor" id="doctor" className="sr-only" />
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        selectedRole === 'doctor' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        <Stethoscope className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">Médico</p>
                        <p className="text-sm text-muted-foreground">
                          Ofrece consultas y comparte conocimiento médico
                        </p>
                      </div>
                      {selectedRole === 'doctor' && (
                        <CheckCircle className="w-5 h-5 text-primary" />
                      )}
                    </Label>

                    <Label
                      htmlFor="resident"
                      className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedRole === 'resident' 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value="resident" id="resident" className="sr-only" />
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        selectedRole === 'resident' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        <GraduationCap className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">Residente</p>
                        <p className="text-sm text-muted-foreground">
                          Accede a grupos de estudio y contenido con descuento
                        </p>
                      </div>
                      {selectedRole === 'resident' && (
                        <CheckCircle className="w-5 h-5 text-primary" />
                      )}
                    </Label>
                  </RadioGroup>
                </div>

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
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Completa tu perfil de {selectedRole === 'doctor' ? 'médico' : 'residente'}</CardTitle>
                <CardDescription>
                  Esta información nos ayudará a verificar tu identidad profesional
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="specialty">Especialidad</Label>
                  <Input
                    id="specialty"
                    placeholder="Ej: Cardiología, Medicina General"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                  />
                </div>

                {selectedRole === 'doctor' && (
                  <div className="space-y-2">
                    <Label htmlFor="license">Número de licencia médica</Label>
                    <Input
                      id="license"
                      placeholder="Número de cédula profesional"
                      value={license}
                      onChange={(e) => setLicense(e.target.value)}
                    />
                  </div>
                )}

                {selectedRole === 'resident' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="institution">Institución</Label>
                      <Input
                        id="institution"
                        placeholder="Nombre del hospital o universidad"
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="year">Año de residencia</Label>
                      <Input
                        id="year"
                        type="number"
                        min={1}
                        max={7}
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value) || 1)}
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-4">
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
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
