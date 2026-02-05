import { supabase } from '@/integrations/supabase/client';
import { ExtendedUser, RegisterData } from './types';
import { fetchUserProfile } from './fetchUserProfile';

export function useAuthActions(
  setUser: (user: ExtendedUser | null) => void,
  setSupabaseUser: (user: import('@supabase/supabase-js').User | null) => void,
  setIsLoading: (loading: boolean) => void
) {
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
    // Clear state immediately for faster perceived logout
    setUser(null);
    setSupabaseUser(null);
    sessionStorage.removeItem('drDoubleCheck_visitor');
    
    // Navigate immediately, sign out in background
    window.location.replace('/lives');
    
    // Sign out from Supabase (will complete after redirect starts)
    supabase.auth.signOut();
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

      // If email confirmation is required, Supabase returns user but NO session.
      // Only set the authenticated state when we actually have a session.
      if (authData.session?.user) {
        // Wait a bit for the trigger to create the profile
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const profile = await fetchUserProfile(authData.session.user.id);
        setUser(profile);
        setSupabaseUser(authData.session.user);
      }

      setIsLoading(false);
      return { success: true };
    } catch (error: any) {
      setIsLoading(false);
      return { success: false, error: error.message || 'Error al registrar' };
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

  return {
    login,
    logout,
    loginAsVisitor,
    register,
    resetPassword,
  };
}
