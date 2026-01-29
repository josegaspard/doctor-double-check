// Database types that match Supabase schema

export type AppRole = 'visitor' | 'patient' | 'doctor' | 'resident' | 'admin';
export type DoctorStatus = 'pending' | 'approved' | 'rejected';
export type LiveStatus = 'live' | 'ended' | 'processing_recording' | 'recording_ready';
export type TransactionType = 'topup' | 'purchase' | 'refund' | 'subscription' | 'earning';
export type TransactionStatus = 'initiated' | 'paid' | 'failed';
export type ChatStatus = 'active' | 'closed';
export type VaultFileType = 'pdf' | 'image' | 'study';
export type ContentType = 'video' | 'pdf' | 'image';
export type ClinicalSessionStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
export type ChatParticipantType = 'patient' | 'doctor' | 'resident';

// Profile
export interface Profile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

// User Role
export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

// Doctor Profile
export interface DoctorProfile {
  id: string;
  user_id: string;
  specialty: string;
  license: string;
  cedula_profesional?: string | null;
  numero_consejo?: string | null;
  bio?: string | null;
  status: DoctorStatus;
  consultation_fee: number;
  rating: number;
  total_consultations: number;
  followers_count: number;
  available_for_double_check: boolean;
  available_for_clinical_sessions: boolean;
  location?: string | null;
  created_at: string;
  updated_at: string;
}

// Resident Profile
export interface ResidentProfile {
  id: string;
  user_id: string;
  institution: string;
  specialty: string;
  year: number;
  titulo_medicina?: string | null;
  cedula_profesional?: string | null;
  status: DoctorStatus;
  followers_count: number;
  created_at: string;
  updated_at: string;
}

// Wallet
export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

// Wallet Transaction
export interface WalletTransaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  description: string;
  status: TransactionStatus;
  metadata?: Record<string, any> | null;
  created_at: string;
}

// Live
export interface Live {
  id: string;
  doctor_id: string;
  title: string;
  description?: string | null;
  specialty: string;
  status: LiveStatus;
  viewer_count: number;
  likes_count: number;
  thumbnail_url?: string | null;
  recording_price?: number | null;
  tags: string[];
  started_at: string;
  ended_at?: string | null;
  daily_room_name?: string | null;
  // Joined data (partial profile for display purposes)
  doctor?: { id: string; name: string; avatar_url?: string | null };
  doctor_profile?: Partial<DoctorProfile>;
}

// Live Like
export interface LiveLike {
  id: string;
  live_id: string;
  user_id: string;
  created_at: string;
}

// Subscription
export interface Subscription {
  id: string;
  subscriber_id: string;
  creator_id: string;
  price_paid: number;
  is_active: boolean;
  created_at: string;
  expires_at?: string | null;
}

// Follower
export interface Follower {
  id: string;
  follower_id: string;
  followed_id: string;
  created_at: string;
}

// Recording
export interface Recording {
  id: string;
  live_id?: string | null;
  doctor_id: string;
  title: string;
  description?: string | null;
  specialty: string;
  duration: number;
  price: number;
  thumbnail_url?: string | null;
  video_url?: string | null;
  tags: string[];
  created_at: string;
  // Joined data (partial profile for display purposes)
  doctor?: { id: string; name: string; avatar_url?: string | null };
}

// Purchase
export interface Purchase {
  id: string;
  user_id: string;
  recording_id: string;
  amount: number;
  created_at: string;
}

// Entitlement
export interface Entitlement {
  id: string;
  user_id: string;
  type: string;
  is_active: boolean;
  expires_at?: string | null;
  created_at: string;
}

// Medical History
export interface MedicalHistory {
  id: string;
  patient_id: string;
  title: string;
  description?: string | null;
  file_type: VaultFileType;
  file_url: string;
  file_size: number;
  category: string;
  date_of_study?: string | null;
  created_at: string;
  updated_at: string;
}

// Vault File
export interface VaultFile {
  id: string;
  patient_id: string;
  medical_history_id?: string | null;
  name: string;
  file_type: VaultFileType;
  file_url: string;
  file_size: number;
  category: string;
  description?: string | null;
  created_at: string;
}

// Vault Access
export interface VaultAccess {
  id: string;
  file_id: string;
  doctor_id: string;
  granted_at: string;
  expires_at?: string | null;
  consultation_id?: string | null;
}

// Chat Session
export interface ChatSession {
  id: string;
  participant1_id: string;
  participant1_type: ChatParticipantType;
  participant2_id: string;
  participant2_type: ChatParticipantType;
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count_1: number;
  unread_count_2: number;
  status: ChatStatus;
  is_double_check: boolean;
  original_consultation_id?: string | null;
  created_at: string;
  // Joined data
  participant1?: Profile;
  participant2?: Profile;
}

// Chat Message
export interface ChatMessage {
  id: string;
  session_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  // Joined data
  sender?: Profile;
}

// Resident Group
export interface ResidentGroup {
  id: string;
  name: string;
  description?: string | null;
  specialty?: string | null;
  image_url?: string | null;
  member_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Resident Group Member
export interface ResidentGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
  // Joined data
  profile?: Profile;
}

// Resident Group Activity
export interface ResidentGroupActivity {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  created_at: string;
  // Joined data
  profile?: Profile;
}

// Clinical Session
export interface ClinicalSession {
  id: string;
  organizer_id: string;
  title: string;
  description?: string | null;
  case_summary?: string | null;
  specialty: string;
  status: ClinicalSessionStatus;
  scheduled_at?: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  organizer?: Profile;
  invitations?: ClinicalSessionInvitation[];
}

// Clinical Session Invitation
export interface ClinicalSessionInvitation {
  id: string;
  session_id: string;
  doctor_id: string;
  status: ClinicalSessionStatus;
  responded_at?: string | null;
  created_at: string;
  // Joined data
  doctor?: Profile;
  doctor_profile?: DoctorProfile;
}

// Doctor Content
export interface DoctorContent {
  id: string;
  creator_id: string;
  type: ContentType;
  title: string;
  description?: string | null;
  file_url: string;
  thumbnail_url?: string | null;
  is_public: boolean;
  category?: string | null;
  price: number;
  created_at: string;
  updated_at: string;
  // Joined data
  creator?: Profile;
}

// Consultation
export interface Consultation {
  id: string;
  patient_id: string;
  doctor_id: string;
  chat_session_id?: string | null;
  status: string;
  diagnosis?: string | null;
  notes?: string | null;
  started_at: string;
  ended_at?: string | null;
  // Joined data
  patient?: Profile;
  doctor?: Profile;
}

// Extended user type that combines all profile data
export interface ExtendedUser {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  role: AppRole;
  created_at: string;
  // Role-specific data
  doctor_profile?: DoctorProfile | null;
  resident_profile?: ResidentProfile | null;
  wallet?: Wallet | null;
  entitlements?: Entitlement[];
}
