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

import RoleSelector from "./pages/RoleSelector";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LanguageProvider>
        <WalletProvider>
          <LivesProvider>
            <VaultProvider>
              <ChatProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <BrowserRouter>
                    <Routes>
                      <Route path="/" element={<RoleSelector />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/lives" element={<LivesGrid />} />
                      <Route path="/live/:id" element={<LivePlayer />} />
                      <Route path="/recordings" element={<RecordingsGrid />} />
                      <Route path="/recording/:id" element={<RecordingPlayer />} />
                      <Route path="/wallet" element={<Wallet />} />
                      <Route path="/vault" element={<Vault />} />
                      <Route path="/chat" element={<Chat />} />
                      <Route path="/doctor/:id" element={<DoctorProfile />} />
                      <Route path="/profile" element={<Navigate to="/lives" />} />
                      <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
                      <Route path="/doctor/upload" element={<DoctorUpload />} />
                      <Route path="/doctor/vault" element={<DoctorVault />} />
                      <Route path="/doctor/availability" element={<DoctorAvailability />} />
                      <Route path="/doctor/recordings" element={<DoctorRecordings />} />
                      <Route path="/resident-groups" element={<ResidentGroups />} />
                      <Route path="/medical-history" element={<MedicalHistory />} />
                      <Route path="/clinical-sessions" element={<ClinicalSessions />} />
                      <Route path="/double-check" element={<DoubleCheck />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/admin" element={<Navigate to="/lives" />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </BrowserRouter>
                </TooltipProvider>
              </ChatProvider>
            </VaultProvider>
          </LivesProvider>
        </WalletProvider>
      </LanguageProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
