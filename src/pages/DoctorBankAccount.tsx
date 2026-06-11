import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle, AlertCircle, Building, CreditCard, RefreshCw, ExternalLink, ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

const MEXICAN_BANKS = [
  'BBVA', 'Santander', 'Banorte', 'HSBC', 'Scotiabank', 'Banamex/Citibanamex',
  'Banco Azteca', 'Inbursa', 'Banregio', 'Afirme', 'Multiva', 'BanBajío',
  'Compartamos', 'Intercam', 'Monex', 'Mifel', 'Otro',
];

interface AccountStatus {
  hasAccount: boolean;
  status: string | null;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  bankLast4: string | null;
}

interface BankDetails {
  bank_name: string;
  clabe: string;
  clabe_last4: string;
  account_holder_name: string;
  rfc: string;
  bank_branch: string;
  payment_method: string;
  stripe_account_id: string | null;
}

export default function DoctorBankAccount() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    bank_name: '', clabe: '', clabe_last4: '', account_holder_name: '',
    rfc: '', bank_branch: '', payment_method: 'none', stripe_account_id: null,
  });
  const [activeTab, setActiveTab] = useState('bank');

  useEffect(() => {
    if (role !== 'doctor') { navigate('/'); return; }
    loadBankData();
  }, [role, navigate]);

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success(t('doctorBankAccount.stripeConfigured'));
      loadBankData();
      setActiveTab('stripe');
    }
    if (searchParams.get('refresh') === 'true') {
      toast.info(t('doctorBankAccount.continuingSetup'));
      handleContinueStripeSetup();
    }
  }, [searchParams]);

  const loadBankData = async () => {
    setIsLoading(true);
    try {
      // Load bank account record
      const { data: bankAccount } = await supabase
        .from('doctor_bank_accounts')
        .select('*')
        .eq('doctor_id', user?.id)
        .maybeSingle();

      if (bankAccount) {
        const ba = bankAccount as any;
        setBankDetails({
          bank_name: ba.bank_name || '',
          clabe: ba.clabe || '',
          clabe_last4: ba.clabe_last4 || '',
          account_holder_name: ba.account_holder_name || '',
          rfc: ba.rfc || '',
          bank_branch: ba.bank_branch || '',
          payment_method: ba.payment_method || 'none',
          stripe_account_id: ba.stripe_account_id || null,
        });
      }

      // Check Stripe status if connected
      const { data: stripeData } = await supabase.functions.invoke('check-stripe-account-status');
      if (stripeData) setAccountStatus(stripeData);
    } catch (error: any) {
      console.error('Error loading bank data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveBankDetails = async () => {
    if (!user?.id) return;

    // Validate CLABE (18 digits)
    if (bankDetails.clabe && !/^\d{18}$/.test(bankDetails.clabe)) {
      toast.error(t('doctorBankAccount.clabe18Digits'));
      return;
    }

    // Validate RFC
    if (bankDetails.rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(bankDetails.rfc)) {
      toast.error(t('doctorBankAccount.invalidRfc'));
      return;
    }

    if (!bankDetails.bank_name || !bankDetails.clabe || !bankDetails.account_holder_name) {
      toast.error(t('doctorBankAccount.fillBankClabeHolder'));
      return;
    }

    setIsSavingBank(true);
    try {
      const clabeLast4 = bankDetails.clabe.slice(-4);
      const newPaymentMethod = bankDetails.stripe_account_id
        ? (bankDetails.clabe ? 'both' : 'stripe')
        : (bankDetails.clabe ? 'bank' : 'none');

      const upsertData: any = {
        doctor_id: user.id,
        bank_name: bankDetails.bank_name,
        clabe: bankDetails.clabe,
        clabe_last4: clabeLast4,
        account_holder_name: bankDetails.account_holder_name,
        rfc: bankDetails.rfc || null,
        bank_branch: bankDetails.bank_branch || null,
        payment_method: newPaymentMethod,
      };

      const { error } = await supabase
        .from('doctor_bank_accounts')
        .upsert(upsertData, { onConflict: 'doctor_id' } as any);

      if (error) throw error;

      setBankDetails(prev => ({ ...prev, clabe_last4: clabeLast4, payment_method: newPaymentMethod }));
      toast.success(t('doctorBankAccount.bankDetailsSaved'));
    } catch (error: any) {
      console.error('Error saving bank details:', error);
      toast.error(error.message || t('doctorBankAccount.errorSaving'));
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleCreateStripeAccount = async () => {
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-onboarding');
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (error: any) {
      console.error('Error creating Stripe account:', error);
      toast.error(error.message || t('doctorBankAccount.errorCreatingAccount'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleContinueStripeSetup = async () => {
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-onboarding');
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (error: any) {
      console.error('Error continuing setup:', error);
      toast.error(error.message || t('doctorBankAccount.errorContinuing'));
    } finally {
      setIsCreating(false);
    }
  };

  const getStripeStatusBadge = () => {
    if (!accountStatus?.hasAccount) return null;
    switch (accountStatus.status) {
      case 'active':
        return <Badge variant="verified" className="gap-1"><CheckCircle className="w-3 h-3" />{t('doctorBankAccount.active')}</Badge>;
      case 'pending':
      case 'pending_verification':
        return <Badge variant="warning" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" />{t('doctorBankAccount.pending')}</Badge>;
      case 'restricted':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" />{t('doctorBankAccount.restricted')}</Badge>;
      default:
        return null;
    }
  };

  const getPaymentMethodBadge = () => {
    switch (bankDetails.payment_method) {
      case 'both':
        return <Badge variant="verified" className="gap-1"><CheckCircle className="w-3 h-3" />{t('doctorBankAccount.stripePlusBank')}</Badge>;
      case 'stripe':
        return <Badge variant="verified" className="gap-1"><CreditCard className="w-3 h-3" />Stripe</Badge>;
      case 'bank':
        return <Badge variant="verified" className="gap-1"><Building className="w-3 h-3" />{t('doctorBankAccount.bank')}</Badge>;
      default:
        return <Badge variant="warning" className="gap-1"><AlertCircle className="w-3 h-3" />{t('doctorBankAccount.notConfigured')}</Badge>;
    }
  };

  if (role !== 'doctor') return null;

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Button variant="back" size="sm" onClick={() => navigate('/doctor/dashboard')} className="mb-4 gap-2 hidden sm:inline-flex">
          <ArrowLeft className="w-4 h-4" />
          {t('doctorBankAccount.backToDashboard')}
        </Button>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              {t('doctorBankAccount.pageTitle')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('doctorBankAccount.pageSubtitle')}
            </p>
          </div>
          {getPaymentMethodBadge()}
        </div>

        {isLoading ? (
          <Card><CardContent className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></CardContent></Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full mb-4">
              <TabsTrigger value="bank" className="flex-1 gap-2">
                <Building className="w-4 h-4" />
                {t('doctorBankAccount.bankAccount')}
              </TabsTrigger>
              <TabsTrigger value="stripe" className="flex-1 gap-2">
                <CreditCard className="w-4 h-4" />
                Stripe
              </TabsTrigger>
            </TabsList>

            {/* BANK ACCOUNT TAB */}
            <TabsContent value="bank">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="w-5 h-5" />
                    {t('doctorBankAccount.bankDetailsMexico')}
                  </CardTitle>
                  <CardDescription>
                    {t('doctorBankAccount.bankDetailsDesc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('doctorBankAccount.accountHolderName')}</Label>
                    <Input
                      placeholder={t('doctorBankAccount.accountHolderPlaceholder')}
                      value={bankDetails.account_holder_name}
                      onChange={(e) => setBankDetails(prev => ({ ...prev, account_holder_name: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('doctorBankAccount.bankLabel')}</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={bankDetails.bank_name}
                      onChange={(e) => setBankDetails(prev => ({ ...prev, bank_name: e.target.value }))}
                    >
                      <option value="">{t('doctorBankAccount.selectYourBank')}</option>
                      {MEXICAN_BANKS.map(bank => (
                        <option key={bank} value={bank}>{bank}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>CLABE Interbancaria * (18 {t('doctorBankAccount.digits')})</Label>
                    <Input
                      placeholder="012345678901234567"
                      maxLength={18}
                      value={bankDetails.clabe}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 18);
                        setBankDetails(prev => ({ ...prev, clabe: val }));
                      }}
                    />
                    {bankDetails.clabe && bankDetails.clabe.length !== 18 && (
                      <p className="text-xs text-destructive">{bankDetails.clabe.length}/18 {t('doctorBankAccount.digits')}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>RFC ({t('doctorBankAccount.optional')})</Label>
                      <Input
                        placeholder="XXXX000000XXX"
                        maxLength={13}
                        value={bankDetails.rfc}
                        onChange={(e) => setBankDetails(prev => ({ ...prev, rfc: e.target.value.toUpperCase() }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('doctorBankAccount.branchOptional')}</Label>
                      <Input
                        placeholder={t('doctorBankAccount.branchPlaceholder')}
                        value={bankDetails.bank_branch}
                        onChange={(e) => setBankDetails(prev => ({ ...prev, bank_branch: e.target.value }))}
                      />
                    </div>
                  </div>

                  <Button onClick={handleSaveBankDetails} disabled={isSavingBank} className="w-full">
                    {isSavingBank ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('doctorBankAccount.saving')}</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" />{t('doctorBankAccount.saveBankDetails')}</>
                    )}
                  </Button>

                  {bankDetails.clabe_last4 && bankDetails.payment_method !== 'none' && (
                    <div className="p-4 bg-success/10 border border-success/20 rounded-lg flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-success">
                          {t('doctorBankAccount.bankAccountConfigured')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {bankDetails.bank_name} · ****{bankDetails.clabe_last4}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* STRIPE TAB */}
            <TabsContent value="stripe">
              {!accountStatus?.hasAccount ? (
                <Card>
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <CreditCard className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle>
                      {t('doctorBankAccount.setUpStripeConnect')}
                    </CardTitle>
                    <CardDescription>
                      {t('doctorBankAccount.stripeConnectDesc')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 mb-6 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success" />
                        {t('doctorBankAccount.automaticPayments')}
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success" />
                        {t('doctorBankAccount.directDeposit')}
                      </li>
                    </ul>
                    <Button onClick={handleCreateStripeAccount} disabled={isCreating} className="w-full">
                      {isCreating ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('doctorBankAccount.connecting')}</>
                      ) : (
                        <><CreditCard className="w-4 h-4 mr-2" />{t('doctorBankAccount.setUpStripeConnect')}</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        Stripe Connect
                      </CardTitle>
                      {getStripeStatusBadge()}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">{t('doctorBankAccount.payoutsEnabled')}</p>
                        <p className="font-semibold">{accountStatus.payoutsEnabled ? t('doctorBankAccount.yes') : 'No'}</p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">{t('doctorBankAccount.account')}</p>
                        <p className="font-semibold">{accountStatus.bankLast4 ? `****${accountStatus.bankLast4}` : t('doctorBankAccount.notConfiguredFem')}</p>
                      </div>
                    </div>

                    {!accountStatus.payoutsEnabled && (
                      <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                        <p className="text-sm text-primary font-medium">
                          {t('doctorBankAccount.accountNotReady')}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={loadBankData} className="flex-1">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        {t('doctorBankAccount.refresh')}
                      </Button>
                      {!accountStatus.payoutsEnabled && (
                        <Button onClick={handleContinueStripeSetup} disabled={isCreating} className="flex-1">
                          {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                          {t('doctorBankAccount.completeSetup')}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}
