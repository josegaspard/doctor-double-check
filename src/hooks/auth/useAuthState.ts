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
    const forceSignedOutState = () => {
      setSupabaseUser(null);

      // Check for visitor session
      const visitorData = sessionStorage.getItem('drDoubleCheck_visitor');
      if (visitorData) {
        setUser(JSON.parse(visitorData));
      } else {
        setUser(null);
      }

      setIsLoading(false);
    };

    const validateAuthSession = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
        forceSignedOutState();
        return false;
      }
      return true;
    };

    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Event:', event, 'Provider:', session?.user?.app_metadata?.provider);
      setSupabaseUser(session?.user ?? null);

      if (!session?.user) {
        forceSignedOutState();
        return;
      }

      // Use setTimeout to avoid potential race conditions with triggers
      setTimeout(async () => {
        // If the user was deleted server-side, the session can become stale.
        const stillValid = await validateAuthSession();
        if (!stillValid) return;

        const profile = await fetchUserProfile(session.user.id);
        if (!profile) {
          // Profile missing (or access denied). Treat as signed out.
          try {
            await supabase.auth.signOut();
          } catch {
            // ignore
          }
          forceSignedOutState();
          return;
        }

        setUser(profile);
        setIsLoading(false);

        // Redirect signed users away from login/root regardless of provider metadata.
        // Some linked accounts can report provider=email even when login happened with Google.
        const currentPath = window.location.pathname;
        const shouldRedirect = currentPath === '/' || currentPath === '/login';

        if (shouldRedirect) {
          if (event === 'SIGNED_IN') {
            // Fresh login: check onboarding status
            console.log('[Auth] SIGNED_IN redirect - Role:', profile?.role, 'OnboardingCompleted:', profile?.onboardingCompleted);
            if (!profile?.onboardingCompleted) {
              console.log('[Auth] Redirecting to onboarding');
              window.location.replace('/onboarding');
              return;
            }
          }

          // Both SIGNED_IN (with completed onboarding) and INITIAL_SESSION: redirect to dashboard
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            console.log('[Auth] Redirecting based on role:', profile?.role);
            if (profile?.role === 'doctor') {
              window.location.replace('/doctor/dashboard');
            } else if (profile?.role === 'admin') {
              window.location.replace('/admin');
            } else {
              window.location.replace('/lives');
            }
          }
        }
      }, 0);
    });

    // THEN check current session — only set loading false if onAuthStateChange hasn't fired yet
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        forceSignedOutState();
      }
      // If session exists, onAuthStateChange will handle it — avoid duplicate fetchUserProfile calls
    });

    // Extra safety: validate on focus (no constant polling to save resources)
    const onFocus = () => {
      validateAuthSession();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
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