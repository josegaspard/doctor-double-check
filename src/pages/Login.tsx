import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, User, Stethoscope, GraduationCap, Mail, CheckCircle } from 'lucide-react';
import { UserRole } from '@/types';
import { toast } from 'sonner';
import logoMedicalMasters from '@/assets/logo-medical-masters.png';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, isLoading, resetPassword } = useAuth();
  
  const preferredRole = (location.state as any)?.preferredRole || 'patient';
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerRole, setRegisterRole] = useState<Exclude<UserRole, 'visitor' | 'admin'>>(preferredRole);
  const [registerSpecialty, setRegisterSpecialty] = useState('');
  const [registerInstitution, setRegisterInstitution] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/onboarding`,
        },
      });
      
      if (error) {
        toast.error('Error al iniciar sesión con Google');
        console.error('Google login error:', error);
      }
    } catch (error) {
      toast.error('Error al conectar con Google');
      console.error('Google login error:', error);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setResetEmailSent(false);
    
    const result = await login(loginEmail, loginPassword);
    if (result.success) {
      navigate('/lives');
    } else {
      setLoginError(result.error || 'Error al iniciar sesión');
    }
  };

  const handleForgotPassword = async () => {
    if (!loginEmail) {
      setLoginError('Ingresa tu correo electrónico primero');
      return;
    }
    
    setResetLoading(true);
    setLoginError('');
    
    const result = await resetPassword(loginEmail);
    setResetLoading(false);
    
    if (result.success) {
      setResetEmailSent(true);
    } else {
      setLoginError(result.error || 'Error al enviar el correo de recuperación');
    }
  };

  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');
    
    const result = await register({
      email: registerEmail,
      password: registerPassword,
      name: registerName,
      role: registerRole,
      specialty: registerSpecialty,
      institution: registerInstitution,
    });
    
    if (result.success) {
      // For patients, redirect directly to lives
      if (registerRole === 'patient') {
        navigate('/lives');
      } else {
        // For doctors/residents, redirect to verification pending page
        navigate('/verification-pending');
      }
    } else {
      setRegisterError(result.error || 'Error al registrarse');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-dark">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-dark-foreground hover:bg-dark/80">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <img src={logoMedicalMasters} alt="Medical Masters" className="h-8 w-auto" />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
        <div className="w-full max-w-md">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="register">Registrarse</TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle>Bienvenido de vuelta</CardTitle>
                  <CardDescription>Ingresa tus credenciales para acceder</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Correo electrónico</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="tu@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Contraseña</Label>
                      <PasswordInput
                        id="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                    </div>
                    
                    {loginError && (
                      <p className="text-sm text-destructive">{loginError}</p>
                    )}
                    
                    {resetEmailSent && (
                      <Alert className="border-success/30 bg-success/5">
                        <CheckCircle className="h-4 w-4 text-success" />
                        <AlertTitle>Correo enviado</AlertTitle>
                        <AlertDescription>
                          Revisa tu bandeja de entrada para restablecer tu contraseña.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Iniciar Sesión'}
                    </Button>
                    
                    <Button 
                      type="button" 
                      variant="link" 
                      className="w-full text-muted-foreground"
                      onClick={handleForgotPassword}
                      disabled={resetLoading}
                    >
                      {resetLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      ¿Olvidaste tu contraseña?
                    </Button>
                  </form>
                  
                  <div className="relative my-6">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                      o continúa con
                    </span>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={handleGoogleLogin}
                    disabled={googleLoading}
                  >
                    {googleLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                    )}
                    Continuar con Google
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register">
              {showEmailConfirmation ? (
                <Card className="border-success/30 bg-success/5">
                  <CardContent className="p-6">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-full bg-success/20 flex items-center justify-center">
                        <CheckCircle className="w-8 h-8 text-success" />
                      </div>
                      <div>
                        <h3 className="font-heading text-xl font-bold text-foreground">
                          ¡Revisa tu correo!
                        </h3>
                        <p className="text-muted-foreground mt-2">
                          Hemos enviado un enlace de confirmación a:
                        </p>
                        <p className="font-medium text-foreground mt-1 flex items-center justify-center gap-2">
                          <Mail className="w-4 h-4" />
                          {registerEmail}
                        </p>
                      </div>
                      <Alert className="text-left">
                        <Mail className="h-4 w-4" />
                        <AlertTitle>Confirma tu email</AlertTitle>
                        <AlertDescription>
                          Haz clic en el enlace que te enviamos para activar tu cuenta. 
                          Si no lo encuentras, revisa tu carpeta de spam.
                        </AlertDescription>
                      </Alert>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => {
                          setShowEmailConfirmation(false);
                          setRegisterEmail('');
                          setRegisterPassword('');
                          setRegisterName('');
                        }}
                      >
                        Registrar otra cuenta
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Crear cuenta</CardTitle>
                    <CardDescription>Únete a la plataforma médica</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nombre completo</Label>
                        <Input
                          id="name"
                          placeholder="Dr. Juan Pérez"
                          value={registerName}
                          onChange={(e) => setRegisterName(e.target.value)}
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="reg-email">Correo electrónico</Label>
                        <Input
                          id="reg-email"
                          type="email"
                          placeholder="tu@email.com"
                          value={registerEmail}
                          onChange={(e) => setRegisterEmail(e.target.value)}
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="reg-password">Contraseña</Label>
                        <PasswordInput
                          id="reg-password"
                          placeholder="••••••••"
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Tipo de cuenta</Label>
                        <Select value={registerRole} onValueChange={(v) => setRegisterRole(v as any)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="patient">Paciente</SelectItem>
                            <SelectItem value="doctor">Médico</SelectItem>
                            <SelectItem value="resident">Residente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {(registerRole === 'doctor' || registerRole === 'resident') && (
                        <div className="space-y-2">
                          <Label>Especialidad</Label>
                          <Input
                            placeholder="Ej: Cardiología"
                            value={registerSpecialty}
                            onChange={(e) => setRegisterSpecialty(e.target.value)}
                          />
                        </div>
                      )}
                      
                      {registerRole === 'resident' && (
                        <div className="space-y-2">
                          <Label>Institución</Label>
                          <Input
                            placeholder="Nombre del hospital o universidad"
                            value={registerInstitution}
                            onChange={(e) => setRegisterInstitution(e.target.value)}
                          />
                        </div>
                      )}
                      
                      {registerError && (
                        <p className="text-sm text-destructive">{registerError}</p>
                      )}
                      
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear Cuenta'}
                      </Button>
                    </form>
                    
                    <div className="relative my-6">
                      <Separator />
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                        o regístrate con
                      </span>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={handleGoogleLogin}
                      disabled={googleLoading}
                    >
                      {googleLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="currentColor"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                      )}
                      Continuar con Google
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
