import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { WalletProvider } from "@/contexts/WalletContext";
import { LivesProvider } from "@/contexts/LivesContext";
import { VaultProvider } from "@/contexts/VaultContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { PostConsultationRatingProvider } from "@/components/ratings/PostConsultationRatingProvider";

import RoleSelector from "./pages/RoleSelector";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import LivesGrid from "./pages/LivesGrid";
import LivePlayer from "./pages/LivePlayer";
import RecordingsGrid from "./pages/RecordingsGrid";
import RecordingPlayer from "./pages/RecordingPlayer";
import Wallet from "./pages/Wallet";
import Vault from "./pages/Vault";
import Chat from "./pages/Chat";
import DoctorProfile from "./pages/DoctorProfile";
import DoctorDashboard from "./pages/DoctorDashboard";
import DoctorUpload from "./pages/DoctorUpload";
import DoctorVault from "./pages/DoctorVault";
import NotFound from "./pages/NotFound";
import ResidentGroups from "./pages/ResidentGroups";
import MedicalHistory from "./pages/MedicalHistory";
import ClinicalSessions from "./pages/ClinicalSessions";
import DoubleCheck from "./pages/DoubleCheck";
import Settings from "./pages/Settings";
import DoctorAvailability from "./pages/DoctorAvailability";
import DoctorRecordings from "./pages/DoctorRecordings";
import DoctorGoLive from "./pages/DoctorGoLive";
import UserProfile from "./pages/UserProfile";
import IdentityVerification from "./pages/IdentityVerification";
import AdminDashboard from "./pages/AdminDashboard";
import AdminVerifications from "./pages/AdminVerifications";
import AdminDoctors from "./pages/AdminDoctors";
import AdminResidents from "./pages/AdminResidents";
import AdminUsers from "./pages/AdminUsers";
import AdminAnalytics from "./pages/AdminAnalytics";
import VerificationPending from "./pages/VerificationPending";
import Doctors from "./pages/Doctors";
import ResetPassword from "./pages/ResetPassword";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import AdminReports from "./pages/AdminReports";
import AdminSiteSettings from "./pages/AdminSiteSettings";
import AdminRefunds from "./pages/AdminRefunds";
import AdminPayoutSettings from "./pages/AdminPayoutSettings";
import AdminPayouts from "./pages/AdminPayouts";
import AdminInvoiceReview from "./pages/AdminInvoiceReview";
import Onboarding from "./pages/Onboarding";
import DoctorBankAccount from "./pages/DoctorBankAccount";
import DoctorInvoices from "./pages/DoctorInvoices";
import Contact from "./pages/Contact";
import DoctorContentLibrary from "./pages/DoctorContentLibrary";
import DoctorEarnings from "./pages/DoctorEarnings";
import SuccessStories from "./pages/SuccessStories";
import Help from "./pages/Help";
import Security from "./pages/Security";
import Compliance from "./pages/Compliance";
import ForDoctors from "./pages/ForDoctors";
import ForPatients from "./pages/ForPatients";
import Enterprise from "./pages/Enterprise";
import ContentGallery from "./pages/ContentGallery";
import Notifications from "./pages/Notifications";
import MedicalNews from "./pages/MedicalNews";
import VideoCall from "./pages/VideoCall";
import AdminCredentials from "./pages/AdminCredentials";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LanguageProvider>
        <WalletProvider>
          <LivesProvider>
            <VaultProvider>
              <ChatProvider>
                <PostConsultationRatingProvider>
                  <TooltipProvider>
                    <Toaster />
                    <Sonner />
                    <BrowserRouter>
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
                      <Route path="/video-call" element={<VideoCall />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </BrowserRouter>
                </TooltipProvider>
              </PostConsultationRatingProvider>
            </ChatProvider>
            </VaultProvider>
          </LivesProvider>
        </WalletProvider>
      </LanguageProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
