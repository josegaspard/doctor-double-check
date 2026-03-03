import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { ExtendedUser } from './types';
import { fetchUserProfile } from './fetchUserProfile';

function getCachedUser(): ExtendedUser | null {
  try {
    const cached = localStorage.getItem('mm_cached_user');
    if (cached) return JSON.parse(cached);
  } catch {}
  return null;
}

export function useAuthState() {
  const [user, setUser] = useState<ExtendedUser | null>(getCachedUser);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(!getCachedUser());

  const setUserAndCache = useCallback((u: ExtendedUser | null) => {
    setUser(u);
    if (u) {
      localStorage.setItem('mm_cached_user', JSON.stringify(u));
    } else {
      localStorage.removeItem('mm_cached_user');
    }
  }, []);

  useEffect(() => {
    const forceSignedOutState = () => {
      setSupabaseUser(null);
      localStorage.removeItem('mm_cached_user');

      // Check for visitor session
      const visitorData = sessionStorage.getItem('medicalMasters_visitor');
      if (visitorData) {
        setUser(JSON.parse(visitorData));
      } else {
        setUser(null);
      }

      setIsLoading(false);
    };

    const validateAuthSession = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          // Only sign out if there's genuinely no valid session
          // Check if we have a local session first to avoid false positives from network errors
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session) {
            try {
              await supabase.auth.signOut();
            } catch {
              // ignore
            }
            forceSignedOutState();
            return false;
          }
          // We have a local session but getUser failed - likely a transient network error
          // Don't sign out, just return true to keep the session alive
          console.warn('[Auth] getUser failed but session exists, keeping session');
          return true;
        }
        return true;
      } catch (e) {
        // Network error - don't sign out
        console.warn('[Auth] validateAuthSession network error, keeping session:', e);
        return true;
      }
    };

    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Event:', event, 'Provider:', session?.user?.app_metadata?.provider);
      setSupabaseUser(session?.user ?? null);

      // TOKEN_REFRESHED: just update supabaseUser, no need to re-validate
      if (event === 'TOKEN_REFRESHED') {
        console.log('[Auth] Token refreshed, keeping session');
        return;
      }

      if (!session?.user) {
        // Only sign out on explicit SIGNED_OUT events
        if (event === 'SIGNED_OUT') {
          forceSignedOutState();
        }
        return;
      }

      // Use setTimeout to avoid potential race conditions with triggers
      setTimeout(async () => {
        // If the user was deleted server-side, the session can become stale.
        const stillValid = await validateAuthSession();
        if (!stillValid) return;

        let profile;
        try {
          profile = await fetchUserProfile(session.user.id);
        } catch (e) {
          console.warn('[Auth] fetchUserProfile network error, keeping session:', e);
          setIsLoading(false);
          return;
        }
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

        setUserAndCache(profile);
        setIsLoading(false);

        // Redirect signed users away from login/root regardless of provider metadata.
        // Some linked accounts can report provider=email even when login happened with Google.
        const currentPath = window.location.pathname;
        const shouldRedirect = currentPath === '/' || currentPath === '/login' || currentPath === '/email-confirmed';

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
        setUserAndCache(profile);
      }
    }
  };

  const updateUser = (updates: Partial<ExtendedUser>) => {
    if (user) {
      setUserAndCache({ ...user, ...updates });
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