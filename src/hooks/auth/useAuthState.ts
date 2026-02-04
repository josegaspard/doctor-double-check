import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { ExtendedUser } from './types';
import { fetchUserProfile } from './fetchUserProfile';

export function useAuthState() {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Event:', event, 'Provider:', session?.user?.app_metadata?.provider);
      setSupabaseUser(session?.user ?? null);
      
      if (session?.user) {
        // Use setTimeout to avoid potential race conditions with Supabase triggers
        setTimeout(async () => {
          const profile = await fetchUserProfile(session.user.id);
          setUser(profile);
          setIsLoading(false);
          
          // Handle OAuth redirect - if user just signed in with OAuth
          if (event === 'SIGNED_IN') {
            const provider = session.user.app_metadata?.provider;
            const isOAuthProvider = provider && provider !== 'email';
            
            console.log('[Auth] OAuth check - Provider:', provider, 'IsOAuth:', isOAuthProvider, 'OnboardingCompleted:', profile?.onboardingCompleted);
            
            // Only redirect if we're on the root page or login (just came back from OAuth)
            const currentPath = window.location.pathname;
            const shouldRedirect = currentPath === '/' || currentPath === '/login';
            
            if (isOAuthProvider && shouldRedirect) {
              if (!profile?.onboardingCompleted) {
                // New OAuth user - go to onboarding to select role
                console.log('[Auth] Redirecting to onboarding');
                window.location.href = '/onboarding';
              } else {
                // Existing OAuth user with completed onboarding - go to appropriate dashboard
                console.log('[Auth] Redirecting based on role:', profile?.role);
                if (profile?.role === 'doctor') {
                  // Doctors go to dashboard (they may need verification)
                  window.location.href = '/doctor/dashboard';
                } else if (profile?.role === 'admin') {
                  window.location.href = '/admin';
                } else {
                  // Patients and residents go to lives
                  window.location.href = '/lives';
                }
              }
            }
          }
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

  const refreshUser = async () => {
    if (supabaseUser) {
      const profile = await fetchUserProfile(supabaseUser.id);
      if (profile) {
        setUser(profile);
      }
    }
  };

  const updateUser = (updates: Partial<ExtendedUser>) => {
    if (user) {
      setUser({ ...user, ...updates });
    }
  };

  return {
    user,
    setUser,
    supabaseUser,
    setSupabaseUser,
    isLoading,
    setIsLoading,
    refreshUser,
    updateUser,
  };
}