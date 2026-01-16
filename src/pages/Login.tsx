import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, ArrowLeft, Loader2, User, Stethoscope, GraduationCap, Mail, CheckCircle } from 'lucide-react';
import { UserRole } from '@/types';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, isLoading } = useAuth();
  
  const preferredRole = (location.state as any)?.preferredRole || 'patient';
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerRole, setRegisterRole] = useState<Exclude<UserRole, 'visitor' | 'admin'>>(preferredRole);
  const [registerSpecialty, setRegisterSpecialty] = useState('');
  const [registerInstitution, setRegisterInstitution] = useState('');
  const [registerError, setRegisterError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    const result = await login(loginEmail, loginPassword);
    if (result.success) {
      navigate('/lives');
    } else {
      setLoginError(result.error || 'Error al iniciar sesión');
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
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-heading font-bold text-foreground">Dr Double Check</span>
            </div>
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
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                    </div>
                    
                    {loginError && (
                      <p className="text-sm text-destructive">{loginError}</p>
                    )}
                    
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Iniciar Sesión'}
                    </Button>
                  </form>
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
                        <Input
                          id="reg-password"
                          type="password"
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
