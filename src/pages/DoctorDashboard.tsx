import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLives } from '@/contexts/LivesContext';
import { useVault } from '@/contexts/VaultContext';
import { useHasAdCampaigns } from '@/hooks/useHasAdCampaigns';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Folder, BarChart3, Settings, ChevronDown, Megaphone, ArrowLeft } from 'lucide-react';
import { EmailHistoryCard } from '@/components/doctor/EmailHistoryCard';
import { SignatureUpload } from '@/components/doctor/SignatureUpload';
import { EmailStatsCard } from '@/components/doctor/EmailStatsCard';
import { EmailTrendsChart } from '@/components/doctor/EmailTrendsChart';
import { EarningsCard } from '@/components/doctor/EarningsCard';
import { OfficeHoursConfig } from '@/components/doctor/OfficeHoursConfig';
import { DoctorAnalytics } from '@/components/doctor/DoctorAnalytics';
import { FundHoldsCard } from '@/components/doctor/FundHoldsCard';
import { DoctorDashboardHeader } from '@/components/doctor/DoctorDashboardHeader';
import { DoctorStatsGrid } from '@/components/doctor/DoctorStatsGrid';
import { DoctorQuickActions } from '@/components/doctor/DoctorQuickActions';
import { DoctorStatusAlert } from '@/components/doctor/DoctorStatusAlert';
import { DoctorProfileCard } from '@/components/doctor/DoctorProfileCard';
import { DoctorPatientsList } from '@/components/doctor/DoctorPatientsList';
import { DoctorPatientSearch } from '@/components/doctor/DoctorPatientSearch';
import { DoctorResidentRequests } from '@/components/doctor/DoctorResidentRequests';
import { MyNotesWidget } from '@/components/doctor/MyNotesWidget';
import { StorageWidget } from '@/components/storage/StorageWidget';

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] sm:text-xs uppercase tracking-widest font-semibold text-muted-foreground/70 pl-1">
      {children}
    </h3>
  );
}

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const { getLivesByDoctor } = useLives();
  const { getAccessibleFiles } = useVault();
  const { hasCampaigns } = useHasAdCampaigns();
  const [recordingsCount, setRecordingsCount] = useState(0);
  const [canPublishNews, setCanPublishNews] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const fetchData = async () => {
      const [recResult, permResult] = await Promise.all([
        supabase.from('recordings').select('*', { count: 'exact', head: true }).eq('doctor_id', user.id),
        supabase.from('doctor_profiles').select('can_publish_news').eq('user_id', user.id).single(),
      ]);
      if (!recResult.error && recResult.count !== null) setRecordingsCount(recResult.count);
      if (permResult.data) setCanPublishNews((permResult.data as any)?.can_publish_news || false);
    };
    fetchData();
  }, [user?.id]);

  if (role !== 'doctor') {
    return <Navigate to="/lives" replace />;
  }

  const doctorProfile = user?.doctorProfile;
  const myLives = getLivesByDoctor(user?.id || '');
  const accessibleVaultFiles = getAccessibleFiles(user?.id || '');
  const isApproved = doctorProfile?.status === 'approved';
  const isPending = doctorProfile?.status === 'pending';
  const isRejected = doctorProfile?.status === 'rejected';

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-6 max-w-7xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3 -ml-2 text-white hover:bg-white/10 hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Button>
        <DoctorDashboardHeader
          userName={user?.name}
          isApproved={isApproved}
          isPending={isPending}
          isRejected={isRejected}
          totalConsultations={doctorProfile?.totalConsultations}
          rating={doctorProfile?.rating}
        />

        {!isApproved && <DoctorStatusAlert isPending={isPending} />}

        <Tabs defaultValue="overview" className="mb-4 sm:mb-6">
          <TabsList className="mb-3 sm:mb-5 w-full sm:w-auto grid grid-cols-2 sm:flex" style={hasCampaigns ? { gridTemplateColumns: 'repeat(3, 1fr)' } : undefined}>
            <TabsTrigger value="overview" className="px-3 sm:px-6 text-xs sm:text-sm">General</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5 px-3 sm:px-6 text-xs sm:text-sm">
              <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Analytics
            </TabsTrigger>
            {hasCampaigns && (
              <TabsTrigger value="advertising" className="gap-1.5 px-3 sm:px-6 text-xs sm:text-sm" onClick={() => navigate('/advertiser/dashboard')}>
                <Megaphone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Publicidad
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="space-y-5 sm:space-y-6">
            {/* ── MI PRÁCTICA ── */}
            <section className="space-y-3">
              <SectionHeader>Mi Práctica</SectionHeader>
              <DoctorProfileCard />
              <DoctorStatsGrid
                recordingsCount={recordingsCount}
                vaultFilesCount={accessibleVaultFiles.length}
                rating={doctorProfile?.rating || 0}
              />
            </section>

            {/* ── ACCIONES RÁPIDAS ── */}
            <section className="space-y-3">
              <SectionHeader>Acciones Rápidas</SectionHeader>
              <DoctorQuickActions isApproved={isApproved} userId={user?.id} canPublishNews={canPublishNews} />
            </section>

            {/* ── SOLICITUDES DE RESIDENTES ── */}
            <DoctorResidentRequests />

            {/* ── ALMACENAMIENTO ── */}
            <section className="space-y-3">
              <SectionHeader>Mi almacenamiento</SectionHeader>
              <StorageWidget />
            </section>

            {/* ── MIS NOTAS ── */}
            <section className="space-y-3">
              <SectionHeader>Mis notas privadas</SectionHeader>
              <MyNotesWidget />
            </section>

            {/* ── PACIENTES ── */}
            <section className="space-y-3">
              <SectionHeader>Pacientes</SectionHeader>
              <DoctorPatientSearch />
              <DoctorPatientsList />
            </section>

            {/* ── FINANZAS ── */}
            <section className="space-y-3">
              <SectionHeader>Finanzas</SectionHeader>
              <div className="grid gap-3 md:grid-cols-2">
                <EarningsCard />
                <FundHoldsCard />
              </div>
            </section>

            {/* ── COMUNICACIONES ── */}
            <section className="space-y-3">
              <SectionHeader>Comunicaciones</SectionHeader>
              <div className="grid gap-3 md:grid-cols-2">
                <EmailStatsCard />
                <EmailHistoryCard />
              </div>
            </section>

            {/* ── CONFIGURACIÓN ── */}
            <section className="space-y-3">
              <SectionHeader>Configuración</SectionHeader>
              <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
                <CollapsibleTrigger asChild>
                  <Card className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-primary/40">
                    <CardContent className="p-3.5 sm:p-5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Settings className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm sm:text-base text-foreground">Configuración</h3>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Horarios, firma y tendencias de email</p>
                        </div>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${configOpen ? 'rotate-180' : ''}`} />
                    </CardContent>
                  </Card>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 sm:space-y-4 mt-3">
                  <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                    <OfficeHoursConfig />
                    <SignatureUpload />
                  </div>
                  <EmailTrendsChart />
                </CollapsibleContent>
              </Collapsible>
            </section>

            {/* ── ARCHIVOS ── */}
            {accessibleVaultFiles.length > 0 && (
              <section className="space-y-3">
                <SectionHeader>Archivos de Pacientes</SectionHeader>
                <Card>
                  <CardHeader className="pb-2 sm:pb-3">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                      <Folder className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      {t('dashboard.patientFiles')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {accessibleVaultFiles.slice(0, 5).map(file => (
                        <div
                          key={file.id}
                          className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer"
                          onClick={() => navigate('/doctor/vault')}
                        >
                          <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center flex-shrink-0">
                            <Folder className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{file.category}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] flex-shrink-0">{t('roles.patient')}</Badge>
                        </div>
                      ))}
                    </div>
                    {accessibleVaultFiles.length > 5 && (
                      <Button variant="ghost" className="w-full mt-2 text-sm" onClick={() => navigate('/doctor/vault')}>
                        Ver todos ({accessibleVaultFiles.length})
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </section>
            )}
          </TabsContent>

          <TabsContent value="analytics">
            <DoctorAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
