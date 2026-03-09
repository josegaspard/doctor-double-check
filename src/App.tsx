import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { WalletProvider } from "@/contexts/WalletContext";
import { LivesProvider } from "@/contexts/LivesContext";
import { VaultProvider } from "@/contexts/VaultContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { PostConsultationRatingProvider } from "@/components/ratings/PostConsultationRatingProvider";
import { IncomingCallProvider } from "@/components/videocall/IncomingCallProvider";
import React, { Suspense } from "react";
import { Loader2 } from "lucide-react";

// Wrapper that only mounts heavy providers when the user is authenticated
function AuthenticatedProviders({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <>{children}</>;
  return (
    <WalletProvider>
      <VaultProvider>
        <ChatProvider>
          <PostConsultationRatingProvider>
            <IncomingCallProvider>
              {children}
            </IncomingCallProvider>
          </PostConsultationRatingProvider>
        </ChatProvider>
      </VaultProvider>
    </WalletProvider>
  );
}

// Eagerly loaded (landing + core navigation)
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Lazy loaded pages
const LivesGrid = React.lazy(() => import("./pages/LivesGrid"));

// Lazy loaded pages
const RoleSelector = React.lazy(() => import("./pages/RoleSelector"));
const LivePlayer = React.lazy(() => import("./pages/LivePlayer"));
const RecordingsGrid = React.lazy(() => import("./pages/RecordingsGrid"));
const RecordingPlayer = React.lazy(() => import("./pages/RecordingPlayer"));
const Wallet = React.lazy(() => import("./pages/Wallet"));
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
const AdminReports = React.lazy(() => import("./pages/AdminReports"));
const AdminSiteSettings = React.lazy(() => import("./pages/AdminSiteSettings"));
const AdminRefunds = React.lazy(() => import("./pages/AdminRefunds"));
const AdminPayoutSettings = React.lazy(() => import("./pages/AdminPayoutSettings"));
const AdminPayouts = React.lazy(() => import("./pages/AdminPayouts"));
const AdminInvoiceReview = React.lazy(() => import("./pages/AdminInvoiceReview"));
const Onboarding = React.lazy(() => import("./pages/Onboarding"));
const DoctorBankAccount = React.lazy(() => import("./pages/DoctorBankAccount"));
const DoctorInvoices = React.lazy(() => import("./pages/DoctorInvoices"));
const Contact = React.lazy(() => import("./pages/Contact"));
const DoctorContentLibrary = React.lazy(() => import("./pages/DoctorContentLibrary"));
const DoctorEarnings = React.lazy(() => import("./pages/DoctorEarnings"));
const SuccessStories = React.lazy(() => import("./pages/SuccessStories"));
const Help = React.lazy(() => import("./pages/Help"));
const Security = React.lazy(() => import("./pages/Security"));
const Compliance = React.lazy(() => import("./pages/Compliance"));
const ForDoctors = React.lazy(() => import("./pages/ForDoctors"));
const ForPatients = React.lazy(() => import("./pages/ForPatients"));
const Enterprise = React.lazy(() => import("./pages/Enterprise"));
const ContentGallery = React.lazy(() => import("./pages/ContentGallery"));
const Notifications = React.lazy(() => import("./pages/Notifications"));
const MedicalNews = React.lazy(() => import("./pages/MedicalNews"));
const NewsArticle = React.lazy(() => import("./pages/NewsArticle"));
const VideoCall = React.lazy(() => import("./pages/VideoCall"));
const AdminCredentials = React.lazy(() => import("./pages/AdminCredentials"));
const AdminNews = React.lazy(() => import("./pages/AdminNews"));
const Prescriptions = React.lazy(() => import("./pages/Prescriptions"));
const CreatePrescription = React.lazy(() => import("./pages/CreatePrescription"));
const PrescriptionDetail = React.lazy(() => import("./pages/PrescriptionDetail"));
const ReportIssue = React.lazy(() => import("./pages/ReportIssue"));
const EmailConfirmed = React.lazy(() => import("./pages/EmailConfirmed"));
const AdminRanks = React.lazy(() => import("./pages/AdminRanks"));

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

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" storageKey="theme" enableSystem={false}>
      <AuthProvider>
        <LanguageProvider>
          <LivesProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <ScrollToTop />
                <AuthenticatedProviders>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<Landing />} />
                      <Route path="/app" element={<RoleSelector />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/lives" element={<LivesGrid />} />
                      <Route path="/live/:id" element={<LivePlayer />} />
                      <Route path="/recordings" element={<RecordingsGrid />} />
                      <Route path="/recording/:id" element={<RecordingPlayer />} />
                      <Route path="/wallet" element={<Wallet />} />
                      <Route path="/vault" element={<Vault />} />
                      <Route path="/chat" element={<Chat />} />
                      <Route path="/doctor/:id" element={<DoctorProfile />} />
                      <Route path="/profile" element={<UserProfile />} />
                      <Route path="/verify-identity" element={<IdentityVerification />} />
                      <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
                      <Route path="/doctor/upload" element={<DoctorUpload />} />
                      <Route path="/doctor/vault" element={<DoctorVault />} />
                      <Route path="/doctor/availability" element={<DoctorAvailability />} />
                      <Route path="/doctor/recordings" element={<DoctorRecordings />} />
                      <Route path="/doctor/content" element={<DoctorContentLibrary />} />
                      <Route path="/doctor/go-live" element={<DoctorGoLive />} />
                      <Route path="/resident-groups" element={<ResidentGroups />} />
                      <Route path="/medical-history" element={<MedicalHistory />} />
                      <Route path="/clinical-sessions" element={<ClinicalSessions />} />
                      <Route path="/double-check" element={<DoubleCheck />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/admin" element={<AdminDashboard />} />
                      <Route path="/admin/verifications" element={<AdminVerifications />} />
                      <Route path="/admin/doctors" element={<AdminDoctors />} />
                      <Route path="/admin/residents" element={<AdminResidents />} />
                      <Route path="/admin/users" element={<AdminUsers />} />
                      <Route path="/admin/analytics" element={<AdminAnalytics />} />
                      <Route path="/admin/reports" element={<AdminReports />} />
                      <Route path="/admin/site-settings" element={<AdminSiteSettings />} />
                      <Route path="/admin/refunds" element={<AdminRefunds />} />
                      <Route path="/admin/payout-settings" element={<AdminPayoutSettings />} />
                      <Route path="/admin/payouts" element={<AdminPayouts />} />
                      <Route path="/admin/invoices" element={<AdminInvoiceReview />} />
                      <Route path="/admin/credentials" element={<AdminCredentials />} />
                      <Route path="/admin/news" element={<AdminNews />} />
                      <Route path="/doctor/news" element={<AdminNews />} />
                      <Route path="/verification-pending" element={<VerificationPending />} />
                      <Route path="/doctors" element={<Doctors />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/onboarding" element={<Onboarding />} />
                      <Route path="/doctor/bank-account" element={<DoctorBankAccount />} />
                      <Route path="/doctor/invoices" element={<DoctorInvoices />} />
                      <Route path="/doctor/earnings" element={<DoctorEarnings />} />
                      <Route path="/terms" element={<Terms />} />
                      <Route path="/privacy" element={<Privacy />} />
                      <Route path="/contact" element={<Contact />} />
                      <Route path="/success-stories" element={<SuccessStories />} />
                      <Route path="/help" element={<Help />} />
                      <Route path="/security" element={<Security />} />
                      <Route path="/compliance" element={<Compliance />} />
                      <Route path="/for-doctors" element={<ForDoctors />} />
                      <Route path="/for-patients" element={<ForPatients />} />
                      <Route path="/enterprise" element={<Enterprise />} />
                      <Route path="/content" element={<ContentGallery />} />
                      <Route path="/notifications" element={<Notifications />} />
                      <Route path="/news" element={<MedicalNews />} />
                      <Route path="/news/:slug" element={<NewsArticle />} />
                      <Route path="/video-call" element={<VideoCall />} />
                      <Route path="/prescriptions" element={<Prescriptions />} />
                      <Route path="/prescriptions/new" element={<CreatePrescription />} />
                      <Route path="/prescriptions/:id" element={<PrescriptionDetail />} />
                      <Route path="/report-issue" element={<ReportIssue />} />
                      <Route path="/email-confirmed" element={<EmailConfirmed />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </AuthenticatedProviders>
              </BrowserRouter>
            </TooltipProvider>
          </LivesProvider>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;