// Role types
export type UserRole = 'visitor' | 'patient' | 'doctor' | 'resident' | 'admin';
export type DoctorStatus = 'pending' | 'approved' | 'rejected';

// Extended user with role-specific data
export interface ExtendedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: Date;
  onboardingCompleted?: boolean;
  countryCode?: string;
  currencyCode?: string;
  countryFlag?: string;
  // Doctor-specific
  doctorProfile?: {
    id: string;
    specialty: string;
    license: string;
    bio?: string;
    status: DoctorStatus;
    consultationFee: number;
    rating: number;
    totalConsultations: number;
    followersCount: number;
    availableForDoubleCheck: boolean;
    availableForClinicalSessions: boolean;
    cedulaProfesional?: string;
    numeroConsejo?: string;
    location?: string;
  };
  // Resident-specific
  residentProfile?: {
    id: string;
    institution: string;
    specialty: string;
    year: number;
    status: DoctorStatus;
    followersCount: number;
    tituloMedicina?: string;
    cedulaProfesional?: string;
  };
  // Wallet info
  wallet?: {
    id: string;
    balance: number;
  };
  // Entitlements
  entitlements?: {
    type: string;
    isActive: boolean;
    expiresAt?: Date;
  }[];
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: Exclude<UserRole, 'visitor' | 'admin'>;
  specialty?: string;
  institution?: string;
  license?: string;
  year?: number;
  country?: string;
  cedula?: string;
  hospital?: string;
  university?: string;
  doctorCode?: string;
}

export interface AuthContextType {
  user: ExtendedUser | null;
  supabaseUser: import('@supabase/supabase-js').User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: UserRole | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; role?: UserRole }>;
  logout: () => Promise<void>;
  loginAsVisitor: () => void;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updateUser: (updates: Partial<ExtendedUser>) => void;
  refreshUser: () => Promise<void>;
}
