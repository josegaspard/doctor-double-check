import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, ExtendedUser, DoctorProfile, ResidentProfile, Wallet, Entitlement } from '@/types/database';

interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: Exclude<AppRole, 'visitor' | 'admin'>;
  specialty?: string;
  institution?: string;
  license?: string;
  year?: number;
}

export function useSupabaseAuth() {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVisitor, setIsVisitor] = useState(false);

  // Fetch extended user data
  const fetchUserData = useCallback(async (authUser: User): Promise<ExtendedUser | null> => {
    try {
      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return null;
      }

      // Fetch role
      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', authUser.id)
        .single();

      if (roleError) {
        console.error('Error fetching role:', roleError);
        return null;
      }

      const role = userRole.role as AppRole;

      // Build extended user
      const extendedUser: ExtendedUser = {
        id: authUser.id,
        email: profile.email,
        name: profile.name,
        avatar_url: profile.avatar_url,
        role,
        created_at: profile.created_at,
      };

      // Fetch doctor profile if doctor
      if (role === 'doctor') {
        const { data: doctorProfile } = await supabase
          .from('doctor_profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .single();
        
        extendedUser.doctor_profile = doctorProfile as DoctorProfile;
      }

      // Fetch resident profile if resident
      if (role === 'resident') {
        const { data: residentProfile } = await supabase
          .from('resident_profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .single();
        
        extendedUser.resident_profile = residentProfile as ResidentProfile;
      }

      // Fetch wallet for patient/resident
      if (role === 'patient' || role === 'resident') {
        const { data: wallet } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', authUser.id)
          .single();
        
        extendedUser.wallet = wallet as Wallet;
      }

      // Fetch entitlements
      const { data: entitlements } = await supabase
        .from('entitlements')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('is_active', true);
      
      extendedUser.entitlements = (entitlements || []) as Entitlement[];

      return extendedUser;
    } catch (error) {
      console.error('Error in fetchUserData:', error);
      return null;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        
        if (session?.user) {
          setIsVisitor(false);
          // Use setTimeout to avoid potential deadlock with Supabase
          setTimeout(async () => {
            const userData = await fetchUserData(session.user);
            setUser(userData);
            setIsLoading(false);
          }, 0);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserData(session.user).then(userData => {
          setUser(userData);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  // Login
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setIsLoading(false);
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  // Register
  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    const { error } = await supabase.auth.signUp({
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

    if (error) {
      setIsLoading(false);
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  // Logout
  const logout = async () => {
    setIsVisitor(false);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  // Login as visitor (local only, no Supabase)
  const loginAsVisitor = () => {
    setIsVisitor(true);
    setUser({
      id: `visitor-${Date.now()}`,
      email: '',
      name: 'Visitante',
      role: 'visitor',
      created_at: new Date().toISOString(),
    });
    setIsLoading(false);
  };

  // Update user profile
  const updateProfile = async (updates: Partial<{ name: string; avatar_url: string }>) => {
    if (!session?.user) return { success: false, error: 'No session' };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    // Refresh user data
    const userData = await fetchUserData(session.user);
    setUser(userData);

    return { success: true };
  };

  // Refresh user data
  const refreshUser = async () => {
    if (session?.user) {
      const userData = await fetchUserData(session.user);
      setUser(userData);
    }
  };

  return {
    user,
    session,
    isAuthenticated: !!user,
    isLoading,
    isVisitor,
    role: user?.role || null,
    login,
    register,
    logout,
    loginAsVisitor,
    updateProfile,
    refreshUser,
  };
}
