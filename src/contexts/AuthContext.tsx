import React, { createContext, useContext, ReactNode } from 'react';
import { useAuthState } from '@/hooks/auth/useAuthState';
import { useAuthActions } from '@/hooks/auth/useAuthActions';
import { AuthContextType, ExtendedUser, RegisterData, UserRole, DoctorStatus } from '@/hooks/auth/types';

// Re-export types for backwards compatibility
export type { UserRole, DoctorStatus, ExtendedUser, RegisterData, AuthContextType };

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    user,
    setUser,
    supabaseUser,
    setSupabaseUser,
    isLoading,
    setIsLoading,
    refreshUser,
    updateUser,
  } = useAuthState();

  const {
    login,
    logout,
    loginAsVisitor,
    register,
    resetPassword,
  } = useAuthActions(setUser, setSupabaseUser, setIsLoading);

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
