import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth, DEMO_USERS } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, ArrowLeft, Loader2, User, Stethoscope, GraduationCap } from 'lucide-react';
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
      navigate('/lives');
    } else {
      setRegisterError(result.error || 'Error al registrarse');
    }
  };

  const handleDemoLogin = async (type: keyof typeof DEMO_USERS) => {
    const user = DEMO_USERS[type];
    const result = await login(user.email, (user as any).password);
    if (result.success) {
      navigate('/lives');
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

                  {/* Demo Users */}
                  <div className="mt-6 pt-6 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-3 text-center">Accesos rápidos demo:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDemoLogin('patient')}
                        className="flex items-center gap-2"
                      >
                        <User className="w-4 h-4" />
                        Paciente
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDemoLogin('doctor')}
                        className="flex items-center gap-2"
                      >
                        <Stethoscope className="w-4 h-4" />
                        Médico
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDemoLogin('resident')}
                        className="flex items-center gap-2"
                      >
                        <GraduationCap className="w-4 h-4" />
                        Residente
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDemoLogin('admin')}
                        className="flex items-center gap-2"
                      >
                        <Shield className="w-4 h-4" />
                        Admin
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register">
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
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
