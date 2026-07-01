import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useBackgroundUploadResumer } from "@/hooks/useBackgroundUploadResumer";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { useSiteToggles } from "@/hooks/useSiteToggles";
import { ToggleGate } from "@/components/ToggleGate";
import { WalletProvider } from "@/contexts/WalletContext";
import { LivesProvider } from "@/contexts/LivesContext";
import { VaultProvider } from "@/contexts/VaultContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { OtpProvider } from "@/contexts/OtpContext";
import { PostConsultationRatingProvider } from "@/components/ratings/PostConsultationRatingProvider";
import { IncomingCallProvider } from "@/components/videocall/IncomingCallProvider";
import { ActiveLiveProvider } from "@/contexts/ActiveLiveContext";
import React, { Suspense, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { SplashScreen } from "@/components/SplashScreen";
import { ChunkErrorBoundary } from "@/components/ChunkErrorBoundary";

// Wrapper that only mounts heavy providers when the user is authenticated
function AuthenticatedProviders({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { toggles } = useSiteToggles();
  // Reanudar uploads pendientes en segundo plano: si el doctor cerró el tab
  // a mitad de un upload, al volver a entrar autenticado lo retomamos.
  useBackgroundUploadResumer();
  if (!isAuthenticated) return <>{children}</>;
  return (
    <WalletProvider>
      <VaultProvider>
        <ChatProvider>
          <OtpProvider>
            <PostConsultationRatingProvider>
              {toggles.enable_video_calls ? (
                <IncomingCallProvider>
                  {children}
                </IncomingCallProvider>
              ) : (
                children
              )}
            </PostConsultationRatingProvider>
          </OtpProvider>
        </ChatProvider>
      </VaultProvider>
    </WalletProvider>
  );
}

// Eagerly loaded (landing + core navigation)
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import AccessGuard from "./components/AccessGuard";

// Lazy loaded pages
const LivesGrid = React.lazy(() => import("./pages/LivesGrid"));

// Lazy loaded pages
const RoleSelector = React.lazy(() => import("./pages/RoleSelector"));
const LivePlayer = React.lazy(() => import("./pages/LivePlayer"));
const RecordingsGrid = React.lazy(() => import("./pages/RecordingsGrid"));
const RecordingPlayer = React.lazy(() => import("./pages/RecordingPlayer"));
const Wallet = React.lazy(() => import("./pages/Wallet"));
const WalletLedger = React.lazy(() => import("./pages/WalletLedger"));
const Vault = React.lazy(() => import("./pages/Vault"));
const Chat = React.lazy(() => import("./pages/Chat"));
const DoctorProfile = React.lazy(() => import("./pages/DoctorProfile"));
const DoctorDashboard = React.lazy(() => import("./pages/DoctorDashboard"));
const DoctorUpload = React.lazy(() => import("./pages/DoctorUpload"));
const DoctorVault = React.lazy(() => import("./pages/DoctorVault"));
const ResidentGroups = React.lazy(() => import("./pages/ResidentGroups"));
const MedicalHistory = React.lazy(() => import("./pages/MedicalHistory"));
const ClinicalSessions = React.lazy(() => import("./pages/ClinicalSessions"));
const DoubleCheck = React.lazy(() => import("./pages/DoubleCheck"));
const Settings = React.lazy(() => import("./pages/Settings"));
const DoctorAvailability = React.lazy(() => import("./pages/DoctorAvailability"));
const DoctorRecordings = React.lazy(() => import("./pages/DoctorRecordings"));
const DoctorGoLive = React.lazy(() => import("./pages/DoctorGoLive"));
const UserProfile = React.lazy(() => import("./pages/UserProfile"));
const IdentityVerification = React.lazy(() => import("./pages/IdentityVerification"));
const AdminDashboard = React.lazy(() => import("./pages/AdminDashboard"));
const AdminVerifications = React.lazy(() => import("./pages/AdminVerifications"));
const AdminDoctors = React.lazy(() => import("./pages/AdminDoctors"));
const AdminResidents = React.lazy(() => import("./pages/AdminResidents"));
const AdminUsers = React.lazy(() => import("./pages/AdminUsers"));
const AdminAnalytics = React.lazy(() => import("./pages/AdminAnalytics"));
const VerificationPending = React.lazy(() => import("./pages/VerificationPending"));
const Doctors = React.lazy(() => import("./pages/Doctors"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));
const Terms = React.lazy(() => import("./pages/Terms"));
const Privacy = React.lazy(() => import("./pages/Privacy"));
const CodigoEtica = React.lazy(() => import("./pages/CodigoEtica"));
const BadgeChat = React.lazy(() => import("./pages/BadgeChat"));
const AdminReports = React.lazy(() => import("./pages/AdminReports"));
const AdminContentModeration = React.lazy(() => import("./pages/AdminContentModeration"));
const BookAppointment = React.lazy(() => import("./pages/BookAppointment"));
const MyAppointments = React.lazy(() => import("./pages/MyAppointments"));
const VendorProducts = React.lazy(() => import("./pages/VendorProducts"));
const AdminSiteSettings = React.lazy(() => import("./pages/AdminSiteSettings"));
const AdminRefunds = React.lazy(() => import("./pages/AdminRefunds"));
const AdminPayoutSettings = React.lazy(() => import("./pages/AdminPayoutSettings"));
const AdminPayouts = React.lazy(() => import("./pages/AdminPayouts"));
const SubscribersList = React.lazy(() => import("./pages/SubscribersList"));
const AdminInvoiceReview = React.lazy(() => import("./pages/AdminInvoiceReview"));
const Onboarding = React.lazy(() => import("./pages/Onboarding"));
const DoctorBankAccount = React.lazy(() => import("./pages/DoctorBankAccount"));
const DoctorInvoices = React.lazy(() => import("./pages/DoctorInvoices"));
const Contact = React.lazy(() => import("./pages/Contact"));
const DoctorContentLibrary = React.lazy(() => import("./pages/DoctorContentLibrary"));
const DoctorEarnings = React.lazy(() => import("./pages/DoctorEarnings"));
const DoctorEmailHistory = React.lazy(() => import("./pages/DoctorEmailHistory"));
const SuccessStories = React.lazy(() => import("./pages/SuccessStories"));
const Help = React.lazy(() => import("./pages/Help"));
const Security = React.lazy(() => import("./pages/Security"));
const Compliance = React.lazy(() => import("./pages/Compliance"));
const Dmca = React.lazy(() => import("./pages/Dmca"));
const ForDoctors = React.lazy(() => import("./pages/ForDoctors"));
const ForPatients = React.lazy(() => import("./pages/ForPatients"));
const Enterprise = React.lazy(() => import("./pages/Enterprise"));
const ContentGallery = React.lazy(() => import("./pages/ContentGallery"));
const Notifications = React.lazy(() => import("./pages/Notifications"));
const MedicalNews = React.lazy(() => import("./pages/MedicalNews"));
const Eventos = React.lazy(() => import("./pages/Eventos"));
const NewsArticle = React.lazy(() => import("./pages/NewsArticle"));
const VideoCall = React.lazy(() => import("./pages/VideoCall"));
const AdminCredentials = React.lazy(() => import("./pages/AdminCredentials"));
const AdminNews = React.lazy(() => import("./pages/AdminNews"));
const AdminEvents = React.lazy(() => import("./pages/AdminEvents"));
const Prescriptions = React.lazy(() => import("./pages/Prescriptions"));
const CreatePrescription = React.lazy(() => import("./pages/CreatePrescription"));
const PrescriptionDetail = React.lazy(() => import("./pages/PrescriptionDetail"));
const ReportIssue = React.lazy(() => import("./pages/ReportIssue"));
const EmailConfirmed = React.lazy(() => import("./pages/EmailConfirmed"));
const AdminRanks = React.lazy(() => import("./pages/AdminRanks"));
const AdminAds = React.lazy(() => import("./pages/AdminAds"));
const Advertising = React.lazy(() => import("./pages/Advertising"));
const AdvertiserDashboard = React.lazy(() => import("./pages/AdvertiserDashboard"));
const MedicalEducation = React.lazy(() => import("./pages/MedicalEducation"));
const PsychologyDirectory = React.lazy(() => import("./pages/PsychologyDirectory"));
const NutritionDirectory = React.lazy(() => import("./pages/NutritionDirectory"));
const ForResidents = React.lazy(() => import("./pages/ForResidents"));
const MedicalRecord = React.lazy(() => import("./pages/MedicalRecord"));
const Meetings = React.lazy(() => import("./pages/Meetings"));
const EmergencyDoctors = React.lazy(() => import("./pages/EmergencyDoctors"));
const HospitalLocator = React.lazy(() => import("./pages/HospitalLocator"));
const Foro = React.lazy(() => import("./pages/Foro"));
const MedicalSupplies = React.lazy(() => import("./pages/MedicalSupplies"));
const AdminHospitals = React.lazy(() => import("./pages/AdminHospitals"));
const AdminMarketplace = React.lazy(() => import("./pages/AdminMarketplace"));
const AdminMarketplaceFee = React.lazy(() => import("./pages/AdminMarketplaceFee"));
const MedicalMarketplace = React.lazy(() => import("./pages/MedicalMarketplace"));
const AdminAccounting = React.lazy(() => import("./pages/AdminAccounting"));
const VendorStripeSetup = React.lazy(() => import("./pages/VendorStripeSetup"));
const VendorEarnings = React.lazy(() => import("./pages/VendorEarnings"));
const VendorDashboard = React.lazy(() => import("./pages/VendorDashboard"));
const AdminFeatured = React.lazy(() => import("./pages/AdminFeatured"));
const MyOrders = React.lazy(() => import("./pages/MyOrders"));
const OrderSuccess = React.lazy(() => import("./pages/OrderSuccess"));
const AdminQAChecklist = React.lazy(() => import("./pages/AdminQAChecklist"));
const AccessDenied = React.lazy(() => import("./pages/AccessDenied"));
const ArcoRights = React.lazy(() => import("./pages/ArcoRights"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Prefetch popular route chunks during browser idle time
if (typeof window !== 'undefined') {
  const prefetch = () => {
    import("./pages/Doctors");
    import("./pages/RecordingsGrid");
    import("./pages/LivesGrid");
    import("./pages/DoctorProfile");
  };
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(prefetch, { timeout: 4000 });
  } else {
    setTimeout(prefetch, 3000);
  }
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const handleSplashFinish = useCallback(() => setShowSplash(false), []);

  return (
    <>
      {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" storageKey="theme" enableSystem={false}>
      <AuthProvider>
        <LanguageProvider>
          <LivesProvider>
            <ActiveLiveProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <ScrollToTop />
                <AuthenticatedProviders>
                  <ChunkErrorBoundary>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<Landing />} />
                      <Route path="/app" element={<RoleSelector />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/lives" element={<ToggleGate toggleKey="enable_lives" feature="lives"><LivesGrid /></ToggleGate>} />
                      <Route path="/live/:id" element={<ToggleGate toggleKey="enable_lives" feature="lives"><LivePlayer /></ToggleGate>} />
                      <Route path="/recordings" element={<ToggleGate toggleKey="enable_recordings" feature="recordings"><RecordingsGrid /></ToggleGate>} />
                      <Route path="/recording/:id" element={<ToggleGate toggleKey="enable_recordings" feature="recordings"><RecordingPlayer /></ToggleGate>} />
                      <Route path="/wallet" element={<AccessGuard allowedRoles={['patient','doctor','resident']} fallbackType="forbidden"><Wallet /></AccessGuard>} />
                      <Route path="/wallet/ledger" element={<AccessGuard allowedRoles={['patient','doctor','resident']} fallbackType="forbidden"><WalletLedger /></AccessGuard>} />
                      <Route path="/chat" element={<ToggleGate toggleKey="enable_patient_chat" feature="chat"><Chat /></ToggleGate>} />
                      {/* Chat exclusivo por distintivo (medalla/palomita) — solo doctores con badge. */}
                      <Route path="/badge-chat" element={<AccessGuard allowedRoles={['doctor','admin']} fallbackType="forbidden"><BadgeChat /></AccessGuard>} />
                      <Route path="/doctor/:id" element={<DoctorProfile />} />
                      <Route path="/profile" element={<UserProfile />} />
                      <Route path="/verify-identity" element={<IdentityVerification />} />
                      <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
                      <Route path="/doctor/upload" element={<DoctorUpload />} />
                      <Route path="/doctor/vault" element={<ToggleGate toggleKey="enable_vault" feature="vault"><DoctorVault /></ToggleGate>} />
                      <Route path="/doctor/availability" element={<DoctorAvailability />} />
                      <Route path="/doctor/recordings" element={<DoctorRecordings />} />
                      <Route path="/doctor/content" element={<DoctorContentLibrary />} />
                      <Route path="/doctor/go-live" element={<DoctorGoLive />} />
                      <Route path="/doctor/subscribers" element={<SubscribersList />} />
                      <Route path="/resident-groups" element={<ResidentGroups />} />
                      <Route path="/medical-history" element={<MedicalHistory />} />
                      <Route path="/medical-record" element={<MedicalRecord />} />
                      <Route path="/vault" element={<ToggleGate toggleKey="enable_vault" feature="vault"><Vault /></ToggleGate>} />
                      <Route path="/education" element={<AccessGuard allowedRoles={['patient', 'doctor', 'resident', 'admin']} fallbackType="forbidden"><MedicalEducation /></AccessGuard>} />
                      <Route path="/clinical-sessions" element={<AccessGuard allowedRoles={['doctor']} fallbackType="forbidden"><ClinicalSessions /></AccessGuard>} />
                      <Route path="/meetings" element={<Meetings />} />
                      <Route path="/foro" element={<AccessGuard allowedRoles={['doctor', 'resident', 'admin']} fallbackType="forbidden"><Foro /></AccessGuard>} />
                      <Route path="/hospital-locator" element={<HospitalLocator />} />
                      {/* Marketplace / venta de productos RESTAURADO (cliente 2026-06-29).
                          Gateado por el toggle enable_marketplace desde el admin. */}
                      <Route path="/medical-supplies" element={<AccessGuard allowedRoles={['patient']} fallbackType="forbidden"><ToggleGate toggleKey="enable_marketplace" feature="marketplace"><MedicalSupplies /></ToggleGate></AccessGuard>} />
                      <Route path="/my-orders" element={<MyOrders />} />
                      <Route path="/order-success" element={<OrderSuccess />} />
                      <Route path="/double-check" element={<ToggleGate toggleKey="enable_patient_chat" feature="chat"><DoubleCheck /></ToggleGate>} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/admin" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminDashboard /></AccessGuard>} />
                      <Route path="/admin/verifications" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminVerifications /></AccessGuard>} />
                      <Route path="/admin/doctors" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminDoctors /></AccessGuard>} />
                      <Route path="/admin/residents" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminResidents /></AccessGuard>} />
                      <Route path="/admin/users" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminUsers /></AccessGuard>} />
                      <Route path="/admin/analytics" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminAnalytics /></AccessGuard>} />
                      <Route path="/admin/reports" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminReports /></AccessGuard>} />
                      <Route path="/admin/content-moderation" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminContentModeration /></AccessGuard>} />
                      <Route path="/book/:doctorId" element={<AccessGuard allowedRoles={['patient','resident']} fallbackType="forbidden"><BookAppointment /></AccessGuard>} />
                      <Route path="/my-appointments" element={<AccessGuard allowedRoles={['patient','doctor','resident']} fallbackType="forbidden"><MyAppointments /></AccessGuard>} />
                      {FEATURE_FLAGS.marketplaceVendors && <Route path="/vendor/products" element={<VendorProducts />} />}
                      <Route path="/admin/site-settings" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminSiteSettings /></AccessGuard>} />
                      <Route path="/admin/refunds" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminRefunds /></AccessGuard>} />
                      <Route path="/admin/payout-settings" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminPayoutSettings /></AccessGuard>} />
                      <Route path="/admin/payouts" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminPayouts /></AccessGuard>} />
                      <Route path="/admin/invoices" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminInvoiceReview /></AccessGuard>} />
                      <Route path="/admin/credentials" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminCredentials /></AccessGuard>} />
                      <Route path="/admin/news" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminNews /></AccessGuard>} />
                      <Route path="/admin/events" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminEvents /></AccessGuard>} />
                      <Route path="/admin/ranks" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminRanks /></AccessGuard>} />
                      <Route path="/doctor/news" element={<AccessGuard allowedRoles={['doctor','admin']} fallbackType="forbidden"><AdminNews /></AccessGuard>} />
                      <Route path="/verification-pending" element={<VerificationPending />} />
                      <Route path="/doctors" element={<Doctors />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/onboarding" element={<Onboarding />} />
                      <Route path="/doctor/bank-account" element={<AccessGuard allowedRoles={['doctor']} fallbackType="forbidden"><DoctorBankAccount /></AccessGuard>} />
                      <Route path="/doctor/invoices" element={<AccessGuard allowedRoles={['doctor']} fallbackType="forbidden"><DoctorInvoices /></AccessGuard>} />
                      <Route path="/doctor/earnings" element={<AccessGuard allowedRoles={['doctor']} fallbackType="forbidden"><DoctorEarnings /></AccessGuard>} />
                      <Route path="/doctor/email-history" element={<AccessGuard allowedRoles={['doctor']} fallbackType="forbidden"><DoctorEmailHistory /></AccessGuard>} />
                      <Route path="/terms" element={<Terms />} />
                      <Route path="/privacy" element={<Privacy />} />
                      <Route path="/codigo-etica" element={<CodigoEtica />} />
                      <Route path="/contact" element={<Contact />} />
                      <Route path="/success-stories" element={<SuccessStories />} />
                      <Route path="/help" element={<Help />} />
                      <Route path="/security" element={<Security />} />
                      <Route path="/compliance" element={<Compliance />} />
                      <Route path="/dmca" element={<Dmca />} />
                      <Route path="/for-doctors" element={<ForDoctors />} />
                      <Route path="/for-patients" element={<ForPatients />} />
                      <Route path="/enterprise" element={<Enterprise />} />
                      <Route path="/content" element={<ContentGallery />} />
                      <Route path="/notifications" element={<AccessGuard allowedRoles={['patient','doctor','resident','admin']} fallbackType="forbidden"><Notifications /></AccessGuard>} />
                      <Route path="/news" element={<MedicalNews />} />
                      <Route path="/news/:slug" element={<NewsArticle />} />
                      <Route path="/eventos" element={<ToggleGate toggleKey="enable_events" feature="events"><Eventos /></ToggleGate>} />
                      <Route path="/events" element={<Navigate to="/eventos" replace />} />
                      <Route path="/video-call" element={<ToggleGate toggleKey="enable_video_calls" feature="videoCalls"><VideoCall /></ToggleGate>} />
                      <Route path="/prescriptions" element={<ToggleGate toggleKey="enable_prescriptions" feature="prescriptions"><Prescriptions /></ToggleGate>} />
                      <Route path="/prescriptions/new" element={<ToggleGate toggleKey="enable_prescriptions" feature="prescriptions"><CreatePrescription /></ToggleGate>} />
                      <Route path="/prescriptions/:id" element={<ToggleGate toggleKey="enable_prescriptions" feature="prescriptions"><PrescriptionDetail /></ToggleGate>} />
                      <Route path="/report-issue" element={<ReportIssue />} />
                      <Route path="/email-confirmed" element={<EmailConfirmed />} />
                      <Route path="/advertising" element={<Advertising />} />
                      <Route path="/advertiser/dashboard" element={<AdvertiserDashboard />} />
                      <Route path="/admin/ads" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminAds /></AccessGuard>} />
                      <Route path="/admin/hospitals" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminHospitals /></AccessGuard>} />
                      <Route path="/admin/marketplace" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminMarketplace /></AccessGuard>} />
                      <Route path="/admin/marketplace-fee" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminMarketplaceFee /></AccessGuard>} />
                      {FEATURE_FLAGS.marketplaceFeeModel && <Route path="/marketplace" element={<AccessGuard allowedRoles={['doctor', 'resident', 'admin']} fallbackType="forbidden"><MedicalMarketplace /></AccessGuard>} />}
                      <Route path="/admin/accounting" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminAccounting /></AccessGuard>} />
                      {FEATURE_FLAGS.marketplaceVendors && <Route path="/vendor/stripe-setup" element={<AccessGuard allowedRoles={['doctor','admin']} fallbackType="forbidden"><VendorStripeSetup /></AccessGuard>} />}
                      {FEATURE_FLAGS.marketplaceVendors && <Route path="/vendor/earnings" element={<AccessGuard allowedRoles={['doctor','admin']} fallbackType="forbidden"><VendorEarnings /></AccessGuard>} />}
                      {FEATURE_FLAGS.marketplaceVendors && <Route path="/vendor/dashboard" element={<VendorDashboard />} />}
                      <Route path="/admin/featured" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminFeatured /></AccessGuard>} />
                      <Route path="/admin/qa-checklist" element={<AccessGuard allowedRoles={['admin']} fallbackType="forbidden"><AdminQAChecklist /></AccessGuard>} />
                      <Route path="/psychology" element={<Navigate to="/psicologia" replace />} />
                      <Route path="/psicologia" element={<PsychologyDirectory />} />
                      <Route path="/nutrition" element={<Navigate to="/nutricion" replace />} />
                      <Route path="/nutricion" element={<NutritionDirectory />} />
                      <Route path="/for-residents" element={<ForResidents />} />
                      <Route path="/access-denied" element={<AccessDenied />} />
                      <Route path="/emergency" element={<EmergencyDoctors />} />
                      <Route path="/emergencia" element={<Navigate to="/emergency" replace />} />
                      <Route path="/doctores" element={<Navigate to="/doctors" replace />} />
                      <Route path="/arco" element={<ArcoRights />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                  </ChunkErrorBoundary>
                </AuthenticatedProviders>
              </BrowserRouter>
            </TooltipProvider>
            </ActiveLiveProvider>
          </LivesProvider>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
    </>
  );
};

export default App;