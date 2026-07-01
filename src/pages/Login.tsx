import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { socialAuth } from '@/integrations/social-auth/index';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
import { CedulaVerifyLink } from '@/components/doctor/CedulaVerifyLink';
import { PasswordStrength, getPasswordStrength } from '@/components/ui/password-strength';
import logoMedicalMastersWhite from '@/assets/logo-medical-masters-white.png';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { AppBackground } from '@/components/layout/AppBackground';
import { translateAuthError } from '@/lib/translateAuthError';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, isLoading, resetPassword } = useAuth();
  const { t } = useLanguage();
  
  const preferredRole = (location.state as any)?.preferredRole || 'patient';

  // Insignia de rol (cliente 2026-06-26): login y registro deben verse DISTINTOS según
  // el rol elegido en /app (paciente/residente/doctor). Cada rol = ícono + degradado de marca propio.
  const ROLE_META = {
    patient: { Icon: User, labelKey: 'roles.patient', accent: '#227787', gradient: 'linear-gradient(120deg, #227787 0%, #2a6a86 100%)' },
    doctor: { Icon: Stethoscope, labelKey: 'roles.doctor', accent: '#163a83', gradient: 'linear-gradient(120deg, #163a83 0%, #227787 100%)' },
    resident: { Icon: GraduationCap, labelKey: 'roles.resident', accent: '#5566b5', gradient: 'linear-gradient(120deg, #227787 0%, #839ed5 100%)' },
  } as const;
  type BarRole = keyof typeof ROLE_META;
  // Barra de acceso seleccionada. Por defecto la que llega desde /app (RoleSelector);
  // si se entró por el botón genérico, default 'patient' pero el usuario puede cambiarla
  // con el selector de abajo. La cuenta DEBE coincidir con la barra (cliente 2026-06-30).
  const [selectedRole, setSelectedRole] = useState<BarRole>(
    (['patient', 'doctor', 'resident'].includes(preferredRole) ? preferredRole : 'patient') as BarRole
  );
  const roleMeta = ROLE_META[selectedRole] || ROLE_META.patient;
  const RoleBadgeIcon = roleMeta.Icon;

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
  const [registerCountry, setRegisterCountry] = useState('');
  const [registerCedula, setRegisterCedula] = useState('');
  const [registerHospital, setRegisterHospital] = useState('');
  const [registerUniversity, setRegisterUniversity] = useState('');
  const [registerDoctorCode, setRegisterDoctorCode] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  // Casillas de aceptación obligatorias en el registro (pedido cliente 2026-06-30):
  // T&C + Privacidad para TODOS; Código de Ética solo doctor/residente.
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [acceptedEthics, setAcceptedEthics] = useState(false);
  const needsEthics = registerRole === 'doctor' || registerRole === 'resident';

  // El registro siempre crea la cuenta con el rol de la barra seleccionada.
  useEffect(() => {
    setRegisterRole(selectedRole);
  }, [selectedRole]);

  // MIGRATION 2026-05-08: OAuth temporalmente deshabilitado hasta que el cliente
  // tenga su propio OAuth client en Google Cloud. Flip a true para reactivar.
  const OAUTH_ENABLED = false;


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
      const result = await socialAuth.auth.signInWithOAuth('google', {
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
    
    // Gate de rol DESACTIVADO (2026-07-01): estaba bloqueando logins legítimos. Toda cuenta
    // válida entra directo a su panel según su rol real, sin importar la barra elegida.
    try { sessionStorage.removeItem('mm_role_gate'); } catch {}

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
      try { sessionStorage.removeItem('mm_role_gate'); } catch {}
      // Traducimos el mensaje crudo de Supabase ("Invalid login credentials", etc.)
      // al idioma activo. Si no reconocemos el error, cae al genérico traducido.
      setLoginError(translateAuthError(result.error, t));
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
      setLoginError(translateAuthError(result.error, t) || t('authErrors.resetError'));
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

    // Aceptación legal obligatoria
    if (!acceptedLegal) {
      setRegisterError(t('login.mustAcceptLegal'));
      return;
    }
    if (needsEthics && !acceptedEthics) {
      setRegisterError(t('login.mustAcceptEthics'));
      return;
    }

    const result = await register({
      email: registerEmail,
      password: registerPassword,
      name: registerName,
      role: registerRole,
      specialty: registerSpecialty,
      institution: registerHospital || registerUniversity || registerInstitution,
      country: registerCountry,
      cedula: registerCedula,
      hospital: registerHospital,
      university: registerUniversity,
      doctorCode: registerDoctorCode,
    });

    if (result.success) {
      // Email/password signups must confirm their email before proceeding.
      // After confirming, they'll be able to sign in normally.
      setShowEmailConfirmation(true);
      return;
    }

    setRegisterError(translateAuthError(result.error, t) || t('authErrors.registerError'));
  };

  return (
    <AppBackground className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="app-shell-header">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={() => navigate('/')} className="app-shell-icon-button">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <button type="button" onClick={() => navigate('/')} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-sm" aria-label="Inicio">
                <img src={logoMedicalMastersWhite} alt="Medical Masters" className="h-8 w-auto" />
              </button>
            </div>
            <LanguageSwitcher className="text-white hover:text-white hover:bg-white/15" />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 container mx-auto px-3 sm:px-4 py-4 sm:py-8 flex items-start sm:items-center justify-center">
        <div className="w-full max-w-md">
          {/* Insignia de rol (cliente 2026-06-26): muestra con qué rol estás entrando.
              El super admin entra por "Soy Médico" y el routing lo manda a /admin. */}
          <div
            className="mb-4 flex items-center gap-3 rounded-xl px-4 py-3 text-white shadow-lg"
            style={{ backgroundImage: roleMeta.gradient }}
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
              <RoleBadgeIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-white/75">{t('login.accessAs')}</p>
              <p className="text-base font-bold leading-tight truncate">{t(roleMeta.labelKey)}</p>
            </div>
          </div>

          {/* Selector de barra de acceso (cliente 2026-06-30): cada barra solo acepta su
              propio rol. Permite cambiar de acceso sin volver al selector de /app. */}
          <div className="mb-4 grid grid-cols-3 gap-2">
            {(Object.keys(ROLE_META) as BarRole[]).map((r) => {
              const meta = ROLE_META[r];
              const Icon = meta.Icon;
              const active = selectedRole === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setSelectedRole(r); setLoginError(''); }}
                  aria-pressed={active ? 'true' : 'false'}
                  style={active
                    ? { backgroundImage: meta.gradient, borderColor: 'transparent' }
                    : { borderColor: meta.accent }}
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 px-2 py-2 text-xs font-semibold transition-all ${
                    active
                      ? 'text-white shadow-md'
                      : 'bg-white text-slate-700 hover:bg-slate-50 hover:shadow-sm'
                  }`}
                >
                  <Icon className="h-4 w-4" style={active ? undefined : { color: meta.accent }} />
                  <span className="leading-none">{t(meta.labelKey)}</span>
                </button>
              );
            })}
          </div>

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
                    
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={resetLoading}
                        className="auth-link-inline w-full justify-center inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 underline underline-offset-4 disabled:opacity-60"
                      >
                        {resetLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {t('login.forgotPassword')}
                      </button>
                  </form>

                  {OAUTH_ENABLED && (
                    <>
                      <div className="relative my-4 sm:my-6">
                        <Separator />
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-card px-2 text-xs text-muted-foreground">
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
                    </>
                  )}

                </CardContent>
              </Card>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register">
              {showEmailConfirmation ? (
                <Card className="bg-white border-2 border-primary/30 shadow-xl overflow-hidden">
                  {/* Top accent ribbon */}
                  <div className="h-1.5 bg-gradient-to-r from-primary via-success to-secondary" />
                  <CardContent className="p-6">
                    <div className="text-center space-y-5">
                      <div className="relative w-20 h-20 mx-auto">
                        <div className="absolute inset-0 rounded-full bg-success/10 animate-ping" />
                        <div className="relative w-20 h-20 rounded-full bg-success flex items-center justify-center shadow-lg">
                          <CheckCircle className="w-10 h-10 text-white" strokeWidth={2.5} />
                        </div>
                      </div>
                      <div>
                        <h3 className="font-heading text-xl sm:text-2xl font-bold text-secondary">
                          {t('login.checkEmail')}
                        </h3>
                        <p className="text-muted-foreground mt-2 text-sm">
                          {t('login.confirmationSentTo')}
                        </p>
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                          <Mail className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="font-semibold text-primary text-sm break-all">{registerEmail}</span>
                        </div>
                      </div>
                      <div className="rounded-lg bg-secondary/5 border-l-4 border-l-secondary border border-secondary/20 p-4 text-left">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                            <Mail className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="font-semibold text-secondary mb-1 text-sm">{t('login.confirmEmail')}</h5>
                            <p className="text-xs text-muted-foreground leading-relaxed">{t('login.confirmEmailDescription')}</p>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full border-primary/30 text-primary hover:bg-primary/5 hover:text-primary hover:border-primary/50 h-11"
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
                          placeholder={t('fix20.pages.loginNamePlaceholder')}
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
                      
                      {/* Campos por rol (cliente 2026-06-26): el PACIENTE no ve NADA de doctor
                          (ni código de doctor, ni cédula, ni especialidad/hospital/universidad).
                          Residente: especialidad + universidad + código de doctor (sin cédula de médico).
                          Doctor: el set completo. El rol se eligió antes en /app (insignia arriba). */}
                      <div className="space-y-2">
                        <Label>{t('login.country')}</Label>
                        <Input
                          value={registerCountry}
                          onChange={(e) => setRegisterCountry(e.target.value)}
                        />
                      </div>

                      {/* Especialidad: doctor y residente */}
                      {(registerRole === 'doctor' || registerRole === 'resident') && (
                        <div className="space-y-2">
                          <Label>{t('login.specialty')}</Label>
                          <Input
                            placeholder={t('fix20.pages.loginSpecialtyPlaceholder')}
                            value={registerSpecialty}
                            onChange={(e) => setRegisterSpecialty(e.target.value)}
                          />
                        </div>
                      )}

                      {/* Cédula profesional + Hospital: SOLO doctor */}
                      {registerRole === 'doctor' && (
                        <>
                          <div className="space-y-2">
                            <Label>{t('login.cedula')}</Label>
                            <Input
                              value={registerCedula}
                              onChange={(e) => setRegisterCedula(e.target.value)}
                            />
                            <CedulaVerifyLink country={registerCountry} className="pt-0.5" />
                          </div>
                          <div className="space-y-2">
                            <Label>{t('login.hospital')}</Label>
                            <Input
                              value={registerHospital}
                              onChange={(e) => setRegisterHospital(e.target.value)}
                            />
                          </div>
                        </>
                      )}

                      {/* Universidad/Institución: doctor y residente */}
                      {(registerRole === 'doctor' || registerRole === 'resident') && (
                        <div className="space-y-2">
                          <Label>{t('login.university')}</Label>
                          <Input
                            value={registerUniversity}
                            onChange={(e) => setRegisterUniversity(e.target.value)}
                          />
                        </div>
                      )}

                      {/* Código de doctor: doctor y residente — NUNCA paciente */}
                      {(registerRole === 'doctor' || registerRole === 'resident') && (
                        <div className="space-y-2">
                          <Label>{t('login.doctorCode')} <span className="text-muted-foreground font-normal">({t('login.optional')})</span></Label>
                          <Input
                            value={registerDoctorCode}
                            onChange={(e) => setRegisterDoctorCode(e.target.value)}
                          />
                        </div>
                      )}

                      {/* Casillas de aceptación obligatorias (cliente 2026-06-30). */}
                      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <Checkbox
                            id="accept-legal"
                            checked={acceptedLegal}
                            onCheckedChange={(v) => setAcceptedLegal(v === true)}
                            className="mt-0.5"
                          />
                          <span className="text-xs sm:text-sm leading-snug text-muted-foreground">
                            {t('login.readAndAccept')}{' '}
                            <Link to="/terms" target="_blank" className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80">
                              {t('login.termsOfService')}
                            </Link>{' '}
                            {t('login.and')}{' '}
                            <Link to="/privacy" target="_blank" className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80">
                              {t('login.privacyPolicy')}
                            </Link>.
                          </span>
                        </label>

                        {needsEthics && (
                          <label className="flex items-start gap-2.5 cursor-pointer">
                            <Checkbox
                              id="accept-ethics"
                              checked={acceptedEthics}
                              onCheckedChange={(v) => setAcceptedEthics(v === true)}
                              className="mt-0.5"
                            />
                            <span className="text-xs sm:text-sm leading-snug text-muted-foreground">
                              {t('login.readAndAcceptEthics')}{' '}
                              <Link to="/codigo-etica" target="_blank" className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80">
                                {t('codeOfEthics.title')}
                              </Link>.
                            </span>
                          </label>
                        )}
                      </div>

                      {registerError && (
                        <p className="text-sm text-destructive">{registerError}</p>
                      )}

                      <Button type="submit" className="w-full" disabled={isLoading || !acceptedLegal || (needsEthics && !acceptedEthics)}>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('login.createAccount')}
                      </Button>
                    </form>

                    {OAUTH_ENABLED && (
                      <>
                        <div className="relative my-4 sm:my-6">
                          <Separator />
                          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-card px-2 text-xs text-muted-foreground">
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
                      </>
                    )}

                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <LandingFooter />
    </AppBackground>
  );
}
