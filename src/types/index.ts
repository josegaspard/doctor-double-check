// User Roles
export type UserRole = 'visitor' | 'patient' | 'doctor' | 'resident' | 'admin';

// Doctor Verification Status
export type DoctorStatus = 'pending' | 'approved' | 'rejected';

// Live Status
export type LiveStatus = 'live' | 'ended' | 'processing_recording' | 'recording_ready';

// Transaction Status
export type TransactionStatus = 'initiated' | 'paid' | 'failed';

// User Base
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  createdAt: Date;
}

// Patient specific
export interface Patient extends User {
  role: 'patient';
  walletBalance: number;
  entitlements: {
    chat: boolean;
    recordings: string[]; // IDs of purchased recordings
  };
}

// Doctor specific
export interface Doctor extends User {
  role: 'doctor';
  status: DoctorStatus;
  specialty: string;
  license: string;
  bio: string;
  isVerified: boolean;
  consultationFee: number;
  rating: number;
  totalConsultations: number;
}

// Resident specific
export interface Resident extends User {
  role: 'resident';
  walletBalance: number;
  institution: string;
  specialty: string;
  year: number;
  entitlements: {
    recordings: string[];
  };
}

// Admin
export interface Admin extends User {
  role: 'admin';
  permissions: string[];
}

// Live Stream
export interface Live {
  id: string;
  title: string;
  description: string;
  doctorId: string;
  doctorName: string;
  doctorAvatar?: string;
  specialty: string;
  status: LiveStatus;
  viewerCount: number;
  startedAt: Date;
  endedAt?: Date;
  thumbnailUrl?: string;
  recordingPrice?: number;
  tags: string[];
}

// Recording (from ended live)
export interface Recording {
  id: string;
  liveId: string;
  title: string;
  description: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  duration: number; // in minutes
  price: number;
  thumbnailUrl?: string;
  createdAt: Date;
  tags: string[];
}

// Wallet Transaction
export interface Transaction {
  id: string;
  userId: string;
  type: 'topup' | 'purchase' | 'refund';
  amount: number;
  description: string;
  status: TransactionStatus;
  createdAt: Date;
  metadata?: {
    recordingId?: string;
    chatSessionId?: string;
  };
}

// Chat Message
export interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderRole: 'patient' | 'doctor';
  content: string;
  timestamp: Date;
  read: boolean;
}

// Chat Session
export interface ChatSession {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadCount: number;
  status: 'active' | 'closed';
  createdAt: Date;
}

// Vault File
export interface VaultFile {
  id: string;
  patientId: string;
  name: string;
  type: 'pdf' | 'image' | 'study';
  size: number; // in bytes
  uploadedAt: Date;
  description?: string;
  category: string;
  permissions: VaultPermission[];
}

// Vault Permission
export interface VaultPermission {
  doctorId: string;
  doctorName: string;
  grantedAt: Date;
  expiresAt?: Date;
}

// Content Upload (Doctor)
export interface DoctorContent {
  id: string;
  doctorId: string;
  type: 'video' | 'pdf' | 'image';
  title: string;
  description: string;
  url: string;
  createdAt: Date;
  isPublic: boolean;
}
