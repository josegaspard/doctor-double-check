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
      const visitorData = sessionStorage.getItem('drDoubleCheck_visitor');
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
          console.warn('[Auth] getUser failed but session exists, keeping session');
          return true;
        }
        return true;
      } catch (e) {
        console.warn('[Auth] validateAuthSession network error, keeping session:', e);
        return true;
      }
    };

    // Set up auth state listener
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
        if (event === 'SIGNED_OUT') {
          forceSignedOutState();
        }
        return;
      }

      // For INITIAL_SESSION with cached user, update supabaseUser and refresh profile in background
      if (event === 'INITIAL_SESSION' && getCachedUser()) {
        // We already have cached user data showing in the UI — refresh in background
        fetchUserProfile(session.user.id).then(profile => {
          if (profile) {
            setUserAndCache(profile);
          } else {
            // Profile gone — sign out
            supabase.auth.signOut().catch(() => {});
            forceSignedOutState();
          }
        }).catch(e => {
          console.warn('[Auth] Background profile refresh failed:', e);
        });
        setIsLoading(false);
        return;
      }

      // For SIGNED_IN and INITIAL_SESSION (no cache): fetch profile directly (no validateAuthSession needed)
      let profile;
      try {
        profile = await fetchUserProfile(session.user.id);
      } catch (e) {
        console.warn('[Auth] fetchUserProfile network error, keeping session:', e);
        setIsLoading(false);
        return;
      }

      if (!profile) {
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

      // Redirect signed users away from login/root
      const currentPath = window.location.pathname;
      const shouldRedirect = currentPath === '/' || currentPath === '/login';

      if (shouldRedirect) {
        if (event === 'SIGNED_IN') {
          console.log('[Auth] SIGNED_IN redirect - Role:', profile?.role, 'OnboardingCompleted:', profile?.onboardingCompleted);
          if (!profile?.onboardingCompleted) {
            console.log('[Auth] Redirecting to onboarding');
            window.location.replace('/onboarding');
            return;
          }
        }

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
    });

    // Check current session — only set loading false if no session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        forceSignedOutState();
      }
    });

    // Validate on focus only (re-validation when returning to tab)
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
