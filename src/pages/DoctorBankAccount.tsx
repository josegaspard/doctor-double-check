import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, AlertCircle, Building, CreditCard, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface AccountStatus {
  hasAccount: boolean;
  status: string | null;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  bankLast4: string | null;
}

export default function DoctorBankAccount() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, role } = useAuth();
  const { t, language } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);

  useEffect(() => {
    if (role !== 'doctor') {
      navigate('/');
      return;
    }

    checkAccountStatus();
  }, [role, navigate]);

  useEffect(() => {
    // Handle return from Stripe
    if (searchParams.get('success') === 'true') {
      toast.success(language === 'es' ? 'Cuenta configurada exitosamente' : 'Account configured successfully');
      checkAccountStatus();
    }
    if (searchParams.get('refresh') === 'true') {
      toast.info(language === 'es' ? 'Continuando configuración...' : 'Continuing setup...');
      handleContinueSetup();
    }
  }, [searchParams]);

  const checkAccountStatus = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-stripe-account-status');
      
      if (error) throw error;
      
      setAccountStatus(data);
    } catch (error: any) {
      console.error('Error checking account status:', error);
      toast.error(language === 'es' ? 'Error al verificar cuenta' : 'Error checking account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-onboarding');
      
      if (error) throw error;
      
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Error creating account:', error);
      toast.error(error.message || (language === 'es' ? 'Error al crear cuenta' : 'Error creating account'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleContinueSetup = async () => {
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-onboarding');
      
      if (error) throw error;
      
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Error continuing setup:', error);
      toast.error(error.message || (language === 'es' ? 'Error al continuar' : 'Error continuing'));
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusBadge = () => {
    if (!accountStatus?.hasAccount) return null;
    
    switch (accountStatus.status) {
      case 'active':
        return <Badge variant="verified" className="gap-1"><CheckCircle className="w-3 h-3" />{language === 'es' ? 'Activa' : 'Active'}</Badge>;
      case 'pending':
      case 'pending_verification':
        return <Badge variant="warning" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" />{language === 'es' ? 'Pendiente' : 'Pending'}</Badge>;
      case 'restricted':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" />{language === 'es' ? 'Restringida' : 'Restricted'}</Badge>;
      default:
        return null;
    }
  };

  if (role !== 'doctor') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {language === 'es' ? 'Cuenta Bancaria' : 'Bank Account'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === 'es' 
              ? 'Configura tu cuenta para recibir pagos automáticos' 
              : 'Set up your account to receive automatic payments'}
          </p>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        ) : !accountStatus?.hasAccount ? (
          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Building className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>
                {language === 'es' ? 'Configura tu cuenta de pagos' : 'Set up your payment account'}
              </CardTitle>
              <CardDescription>
                {language === 'es' 
                  ? 'Para recibir tus ganancias, necesitas configurar una cuenta bancaria a través de Stripe. Este proceso es seguro y solo toma unos minutos.'
                  : 'To receive your earnings, you need to set up a bank account through Stripe. This process is secure and only takes a few minutes.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 mb-6 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {language === 'es' ? 'Pagos automáticos semanales' : 'Automatic weekly payments'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {language === 'es' ? 'Depósito directo a tu cuenta bancaria' : 'Direct deposit to your bank account'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {language === 'es' ? 'Panel para ver tus ganancias' : 'Dashboard to view your earnings'}
                </li>
              </ul>
              <Button onClick={handleCreateAccount} disabled={isCreating} className="w-full">
                {isCreating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{language === 'es' ? 'Conectando...' : 'Connecting...'}</>
                ) : (
                  <><CreditCard className="w-4 h-4 mr-2" />{language === 'es' ? 'Configurar cuenta bancaria' : 'Set up bank account'}</>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    {language === 'es' ? 'Estado de la cuenta' : 'Account Status'}
                  </CardTitle>
                  {getStatusBadge()}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">
                      {language === 'es' ? 'Pagos habilitados' : 'Payouts enabled'}
                    </p>
                    <p className="font-semibold">
                      {accountStatus.payoutsEnabled 
                        ? (language === 'es' ? 'Sí' : 'Yes')
                        : (language === 'es' ? 'No' : 'No')}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">
                      {language === 'es' ? 'Cuenta bancaria' : 'Bank account'}
                    </p>
                    <p className="font-semibold">
                      {accountStatus.bankLast4 
                        ? `****${accountStatus.bankLast4}`
                        : (language === 'es' ? 'No configurada' : 'Not configured')}
                    </p>
                  </div>
                </div>

                {!accountStatus.payoutsEnabled && (
                  <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                    <p className="text-sm text-warning-foreground">
                      {language === 'es' 
                        ? 'Tu cuenta aún no está lista para recibir pagos. Completa la configuración para habilitar los pagos automáticos.'
                        : 'Your account is not yet ready to receive payments. Complete the setup to enable automatic payments.'}
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={checkAccountStatus}
                    className="flex-1"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {language === 'es' ? 'Actualizar estado' : 'Refresh status'}
                  </Button>
                  {!accountStatus.payoutsEnabled && (
                    <Button 
                      onClick={handleContinueSetup}
                      disabled={isCreating}
                      className="flex-1"
                    >
                      {isCreating ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ExternalLink className="w-4 h-4 mr-2" />
                      )}
                      {language === 'es' ? 'Completar configuración' : 'Complete setup'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
