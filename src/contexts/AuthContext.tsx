import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';

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

interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: Exclude<UserRole, 'visitor' | 'admin'>;
  specialty?: string;
  institution?: string;
  license?: string;
  year?: number;
}

interface AuthContextType {
  user: ExtendedUser | null;
  supabaseUser: SupabaseUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: UserRole | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  loginAsVisitor: () => void;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updateUser: (updates: Partial<ExtendedUser>) => void;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchUserProfile(userId: string): Promise<ExtendedUser | null> {
  try {
    // Fetch base profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) return null;

    // Fetch role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    const role = (roleData?.role as UserRole) || 'patient';

    const extendedUser: ExtendedUser = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role,
      avatarUrl: profile.avatar_url || undefined,
      createdAt: new Date(profile.created_at),
      onboardingCompleted: profile.onboarding_completed ?? true,
    };

    // Fetch role-specific data
    if (role === 'doctor') {
      const { data: doctorProfile } = await supabase
        .from('doctor_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (doctorProfile) {
        extendedUser.doctorProfile = {
          id: doctorProfile.id,
          specialty: doctorProfile.specialty,
          license: doctorProfile.license,
          bio: doctorProfile.bio || undefined,
          status: doctorProfile.status as DoctorStatus,
          consultationFee: Number(doctorProfile.consultation_fee),
          rating: Number(doctorProfile.rating),
          totalConsultations: doctorProfile.total_consultations,
          followersCount: doctorProfile.followers_count,
          availableForDoubleCheck: doctorProfile.available_for_double_check,
          availableForClinicalSessions: doctorProfile.available_for_clinical_sessions,
          cedulaProfesional: doctorProfile.cedula_profesional || undefined,
          numeroConsejo: doctorProfile.numero_consejo || undefined,
          location: doctorProfile.location || undefined,
        };
      }
    }

    if (role === 'resident') {
      const { data: residentProfile } = await supabase
        .from('resident_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (residentProfile) {
        extendedUser.residentProfile = {
          id: residentProfile.id,
          institution: residentProfile.institution,
          specialty: residentProfile.specialty,
          year: residentProfile.year,
          status: residentProfile.status as DoctorStatus,
          followersCount: residentProfile.followers_count,
          tituloMedicina: residentProfile.titulo_medicina || undefined,
          cedulaProfesional: residentProfile.cedula_profesional || undefined,
        };
      }
    }

    // Fetch wallet for patients and residents
    if (role === 'patient' || role === 'resident') {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (wallet) {
        extendedUser.wallet = {
          id: wallet.id,
          balance: Number(wallet.balance),
        };
      }
    }

    // Fetch entitlements
    const { data: entitlements } = await supabase
      .from('entitlements')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (entitlements) {
      extendedUser.entitlements = entitlements.map(e => ({
        type: e.type,
        isActive: e.is_active,
        expiresAt: e.expires_at ? new Date(e.expires_at) : undefined,
      }));
    }

    return extendedUser;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSupabaseUser(session?.user ?? null);
      
      if (session?.user) {
        // Use setTimeout to avoid potential race conditions with Supabase triggers
        setTimeout(async () => {
          const profile = await fetchUserProfile(session.user.id);
          setUser(profile);
          setIsLoading(false);
        }, 0);
      } else {
        // Check for visitor session
        const visitorData = sessionStorage.getItem('drDoubleCheck_visitor');
        if (visitorData) {
          setUser(JSON.parse(visitorData));
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    });

    // THEN check current session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setSupabaseUser(session.user);
        const profile = await fetchUserProfile(session.user.id);
        setUser(profile);
      } else {
        // Check for visitor session
        const visitorData = sessionStorage.getItem('drDoubleCheck_visitor');
        if (visitorData) {
          setUser(JSON.parse(visitorData));
        }
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setIsLoading(false);
        return { success: false, error: error.message };
      }

      if (data.user) {
        const profile = await fetchUserProfile(data.user.id);
        setUser(profile);
        setSupabaseUser(data.user);
      }

      setIsLoading(false);
      return { success: true };
    } catch (error: any) {
      setIsLoading(false);
      return { success: false, error: error.message || 'Error al iniciar sesión' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem('drDoubleCheck_visitor');
    setUser(null);
    setSupabaseUser(null);
  };

  const loginAsVisitor = () => {
    const visitorUser: ExtendedUser = {
      id: `visitor-${Date.now()}`,
      email: '',
      name: 'Visitante',
      role: 'visitor',
      createdAt: new Date(),
    };
    setUser(visitorUser);
    sessionStorage.setItem('drDoubleCheck_visitor', JSON.stringify(visitorUser));
  };

  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            name: data.name,
            role: data.role,
            specialty: data.specialty,
            institution: data.institution,
            license: data.license,
            year: data.year,
          },
        },
      });

      if (authError) {
        setIsLoading(false);
        return { success: false, error: authError.message };
      }

      if (authData.user) {
        // Wait a bit for the trigger to create the profile
        await new Promise(resolve => setTimeout(resolve, 1000));
        const profile = await fetchUserProfile(authData.user.id);
        setUser(profile);
        setSupabaseUser(authData.user);
      }

      setIsLoading(false);
      return { success: true };
    } catch (error: any) {
      setIsLoading(false);
      return { success: false, error: error.message || 'Error al registrar' };
    }
  };

  const updateUser = (updates: Partial<ExtendedUser>) => {
    if (user) {
      setUser({ ...user, ...updates });
    }
  };

  const refreshUser = async () => {
    if (supabaseUser) {
      const profile = await fetchUserProfile(supabaseUser.id);
      if (profile) {
        setUser(profile);
      }
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Error al enviar el correo de recuperación' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        isAuthenticated: !!user,
        isLoading,
        role: user?.role || null,
        login,
        logout,
        loginAsVisitor,
        register,
        resetPassword,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
