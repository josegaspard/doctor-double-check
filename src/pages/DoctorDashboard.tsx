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
import { Folder, BarChart3 } from 'lucide-react';
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
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
        <DoctorDashboardHeader
          userName={user?.name}
          isApproved={isApproved}
          isPending={isPending}
          isRejected={isRejected}
          totalConsultations={doctorProfile?.totalConsultations}
          rating={doctorProfile?.rating}
        />

        {!isApproved && <DoctorStatusAlert isPending={isPending} />}

        <Tabs defaultValue="overview" className="mb-6 sm:mb-8">
          <TabsList className="mb-4 sm:mb-6 w-full sm:w-auto grid grid-cols-2 sm:flex">
            <TabsTrigger value="overview" className="px-3 sm:px-6 text-xs sm:text-sm">General</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5 sm:gap-2 px-3 sm:px-6 text-xs sm:text-sm">
              <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 sm:space-y-8">
            <DoctorStatsGrid
              activeLivesCount={myLives.filter(l => l.status === 'live').length}
              recordingsCount={recordingsCount}
              vaultFilesCount={accessibleVaultFiles.length}
              rating={doctorProfile?.rating || 0}
            />

            <DoctorQuickActions isApproved={isApproved} userId={user?.id} canPublishNews={canPublishNews} />

            <div className="grid gap-3 sm:gap-6 sm:grid-cols-2 lg:grid-cols-2">
              <EarningsCard />
              <EmailStatsCard />
              <EmailTrendsChart />
              <OfficeHoursConfig />
              <SignatureUpload />
            </div>

            <EmailHistoryCard />
            <FundHoldsCard />

            {accessibleVaultFiles.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Folder className="w-5 h-5 text-primary" />
                    {t('dashboard.patientFiles')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {accessibleVaultFiles.slice(0, 5).map(file => (
                      <div
                        key={file.id}
                        className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer"
                        onClick={() => navigate('/doctor/vault')}
                      >
                        <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                          <Folder className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{file.category}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{t('roles.patient')}</Badge>
                      </div>
                    ))}
                  </div>
                  {accessibleVaultFiles.length > 5 && (
                    <Button variant="ghost" className="w-full mt-3" onClick={() => navigate('/doctor/vault')}>
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
