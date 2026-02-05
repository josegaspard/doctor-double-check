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

        // Handle OAuth redirect - if user just signed in with OAuth
        if (event === 'SIGNED_IN') {
          const provider = session.user.app_metadata?.provider;
          const isOAuthProvider = provider && provider !== 'email';

          console.log(
            '[Auth] OAuth check - Provider:',
            provider,
            'IsOAuth:',
            isOAuthProvider,
            'OnboardingCompleted:',
            profile?.onboardingCompleted
          );

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
                window.location.href = '/doctor/dashboard';
              } else if (profile?.role === 'admin') {
                window.location.href = '/admin';
              } else {
                window.location.href = '/lives';
              }
            }
          }
        }
      }, 0);
    });

    // THEN check current session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const stillValid = await validateAuthSession();
        if (!stillValid) return;

        setSupabaseUser(session.user);
        const profile = await fetchUserProfile(session.user.id);
        if (!profile) {
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
      } else {
        forceSignedOutState();
      }
    });

    // Extra safety: validate on focus + periodically
    const onFocus = () => {
      validateAuthSession();
    };
    window.addEventListener('focus', onFocus);
    const intervalId = window.setInterval(validateAuthSession, 60_000);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(intervalId);
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