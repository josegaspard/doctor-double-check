import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLives } from '@/contexts/LivesContext';
import { useVault } from '@/contexts/VaultContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Folder, BarChart3, Settings, ChevronDown } from 'lucide-react';
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

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const { getLivesByDoctor } = useLives();
  const { getAccessibleFiles } = useVault();
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
          <TabsList className="mb-3 sm:mb-5 w-full sm:w-auto grid grid-cols-2 sm:flex">
            <TabsTrigger value="overview" className="px-3 sm:px-6 text-xs sm:text-sm">General</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5 px-3 sm:px-6 text-xs sm:text-sm">
              <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 sm:space-y-6">
            {/* Section 1: Stats */}
            <DoctorStatsGrid
              activeLivesCount={myLives.filter(l => l.status === 'live').length}
              recordingsCount={recordingsCount}
              vaultFilesCount={accessibleVaultFiles.length}
              rating={doctorProfile?.rating || 0}
            />

            {/* Section 2: Quick Actions */}
            <DoctorQuickActions isApproved={isApproved} userId={user?.id} canPublishNews={canPublishNews} />

            {/* Section 3: Finance & Communications - side by side on desktop */}
            <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
              <EarningsCard />
              <EmailStatsCard />
            </div>

            {/* Section 4: Configuration - collapsible */}
            <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between h-10 px-3 text-sm font-medium text-muted-foreground hover:text-foreground">
                  <span className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Configuración
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${configOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 sm:space-y-4 mt-2">
                <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
                  <OfficeHoursConfig />
                  <SignatureUpload />
                </div>
                <EmailTrendsChart />
              </CollapsibleContent>
            </Collapsible>

            {/* Section 5: History */}
            <EmailHistoryCard />
            <FundHoldsCard />

            {/* Vault Files */}
            {accessibleVaultFiles.length > 0 && (
              <Card>
                <CardHeader className="pb-2 sm:pb-3">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
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
