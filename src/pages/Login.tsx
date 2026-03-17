import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { lovable } from '@/integrations/lovable/index';
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
import { AppRole as UserRole } from '@/types/database';
import { toast } from 'sonner';
import { LanguageSwitcher } from '@/components/settings/LanguageSwitcher';
import { PasswordStrength, getPasswordStrength } from '@/components/ui/password-strength';
import logoMedicalMastersWhite from '@/assets/logo-medical-masters-white.png';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, isLoading, resetPassword } = useAuth();
  const { t } = useLanguage();
  
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
  const [appleLoading, setAppleLoading] = useState(false);

  const resolvePostLoginRoute = async (userId: string) => {
    const [profileResult, roleResult] = await Promise.all([
      supabase.from('profiles').select('onboarding_completed').eq('id', userId).single(),
      supabase.from('user_roles').select('role').eq('user_id', userId).single(),
    ]);

    if (!profileResult.data?.onboarding_completed) return '/onboarding';

    const role = roleResult.data?.role;
    if (role === 'doctor') return '/doctor/dashboard';
    if (role === 'admin') return '/admin';
    return '/lives';
  };

  const recoverGoogleSession = async () => {
    // cloud auth can return a "cancelled" error even after the session was established in background
    for (let i = 0; i < 6; i += 1) {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user;

      if (sessionUser) {
        const destination = await resolvePostLoginRoute(sessionUser.id);
        navigate(destination, { replace: true });
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return false;
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: `${window.location.origin}/login`,
      });

      if (result.error) {
        const message = result.error.message?.toLowerCase() || '';
        const isFalseCancellation = message.includes('cancelled') || message.includes('canceled');

        if (isFalseCancellation) {
          const recovered = await recoverGoogleSession();
          if (recovered) return;
        }

        toast.error(t('authErrors.googleLoginError'));
        console.error('Google login error:', result.error);
        return;
      }

      if (!result.redirected) {
        await recoverGoogleSession();
      }
    } catch (error) {
      toast.error(t('authErrors.googleConnectError'));
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
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (uid) {
        const destination = await resolvePostLoginRoute(uid);
        navigate(destination);
      } else {
        navigate('/lives');
      }
    } else {
      setLoginError(result.error || t('authErrors.loginError'));
    }
  };

  const handleForgotPassword = async () => {
    if (!loginEmail) {
      setLoginError(t('authErrors.emailRequired'));
      return;
    }
    
    setResetLoading(true);
    setLoginError('');
    
    const result = await resetPassword(loginEmail);
    setResetLoading(false);
    
    if (result.success) {
      setResetEmailSent(true);
    } else {
      setLoginError(result.error || t('authErrors.resetError'));
    }
  };

  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');

    // Validate password strength before submitting
    const { score } = getPasswordStrength(registerPassword);
    if (score < 60) {
      setRegisterError(t('authErrors.weakPassword'));
      return;
    }

    const result = await register({
      email: registerEmail,
      password: registerPassword,
      name: registerName,
      role: registerRole,
      specialty: registerSpecialty,
      institution: registerInstitution,
    });

    if (result.success) {
      // Email/password signups must confirm their email before proceeding.
      // After confirming, they'll be able to sign in normally.
      setShowEmailConfirmation(true);
      return;
    }

    setRegisterError(result.error || t('authErrors.registerError'));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-dark">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-dark-foreground hover:bg-dark/80">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <img src={logoMedicalMastersWhite} alt="Medical Masters" className="h-8 w-auto" />
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 container mx-auto px-3 sm:px-4 py-4 sm:py-8 flex items-start sm:items-center justify-center">
        <div className="w-full max-w-md">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6">
              <TabsTrigger value="login">{t('login.loginTab')}</TabsTrigger>
              <TabsTrigger value="register">{t('login.registerTab')}</TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login">
              <Card>
              <CardHeader className="p-4 sm:p-6 pb-2">
                   <CardTitle className="text-lg sm:text-2xl">{t('login.title')}</CardTitle>
                   <CardDescription className="text-xs sm:text-sm">{t('login.loginDescription') || 'Ingresa con tu cuenta'}</CardDescription>
                 </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">{t('login.email')}</Label>
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
                      <Label htmlFor="password">{t('login.password')}</Label>
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
                        <AlertTitle>{t('login.checkEmail')}</AlertTitle>
                        <AlertDescription>
                          {t('login.resetEmailSent')}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('login.loginTab')}
                    </Button>
                    
                    <Button 
                      type="button" 
                      variant="link" 
                      className="w-full text-muted-foreground"
                      onClick={handleForgotPassword}
                      disabled={resetLoading}
                    >
                      {resetLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {t('login.forgotPassword')}
                    </Button>
                  </form>
                  
                  <div className="relative my-4 sm:my-6">
                    <Separator />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                      {t('login.orContinueWith')}
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
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                    )}
                    {t('login.continueWithGoogle')}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full mt-2" 
                    onClick={handleAppleLogin}
                    disabled={appleLoading}
                  >
                    {appleLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                    )}
                    {t('login.continueWithApple') || 'Continuar con Apple'}
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
                          {t('login.checkEmail')}
                        </h3>
                        <p className="text-muted-foreground mt-2">
                          {t('login.confirmationSentTo')}
                        </p>
                        <p className="font-medium text-foreground mt-1 flex items-center justify-center gap-2">
                          <Mail className="w-4 h-4" />
                          {registerEmail}
                        </p>
                      </div>
                      <Alert className="text-left">
                        <Mail className="h-4 w-4" />
                        <AlertTitle>{t('login.confirmEmail')}</AlertTitle>
                        <AlertDescription>
                          {t('login.confirmEmailDescription')}
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
                        {t('login.registerAnother')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="p-4 sm:p-6 pb-2">
                    <CardTitle className="text-lg sm:text-2xl">{t('login.createAccount')}</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">{t('login.registerTab')}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0">
                    <form onSubmit={handleRegister} className="space-y-3 sm:space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">{t('login.name')}</Label>
                        <Input
                          id="name"
                          placeholder="Dr. Juan Pérez"
                          value={registerName}
                          onChange={(e) => setRegisterName(e.target.value)}
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="reg-email">{t('login.email')}</Label>
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
                        <Label htmlFor="reg-password">{t('login.password')}</Label>
                        <PasswordInput
                          id="reg-password"
                          placeholder="••••••••"
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          required
                          minLength={8}
                        />
                        <PasswordStrength password={registerPassword} />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>{t('login.role')}</Label>
                        <Select value={registerRole} onValueChange={(v) => setRegisterRole(v as any)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="patient">{t('roles.patient')}</SelectItem>
                            <SelectItem value="doctor">{t('roles.doctor')}</SelectItem>
                            <SelectItem value="resident">{t('roles.resident')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {(registerRole === 'doctor' || registerRole === 'resident') && (
                        <div className="space-y-2">
                          <Label>{t('login.specialty')}</Label>
                          <Input
                            placeholder="Ej: Cardiología"
                            value={registerSpecialty}
                            onChange={(e) => setRegisterSpecialty(e.target.value)}
                          />
                        </div>
                      )}
                      
                      {registerRole === 'resident' && (
                        <div className="space-y-2">
                          <Label>{t('login.institution')}</Label>
                          <Input
                            placeholder="Ej: Hospital General"
                            value={registerInstitution}
                            onChange={(e) => setRegisterInstitution(e.target.value)}
                          />
                        </div>
                      )}
                      
                      {registerError && (
                        <p className="text-sm text-destructive">{registerError}</p>
                      )}
                      
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('login.createAccount')}
                      </Button>
                    </form>
                    
                    <div className="relative my-4 sm:my-6">
                      <Separator />
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                        {t('login.orContinueWith')}
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
                      {t('login.continueWithGoogle')}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-dark py-4">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <nav className="flex items-center gap-6">
              <Link to="/terms" className="text-sm text-dark-foreground/70 hover:text-dark-foreground transition-colors">
                {t('footer.termsOfService')}
              </Link>
              <Link to="/privacy" className="text-sm text-dark-foreground/70 hover:text-dark-foreground transition-colors">
                {t('footer.privacyPolicy')}
              </Link>
            </nav>
            <p className="text-sm text-dark-foreground/70">
              {t('footer.copyright')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
