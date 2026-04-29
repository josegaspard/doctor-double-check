/**
 * Session Guard
 * 
 * Forces users to log in again when they close ALL browser windows/tabs.
 * Refreshing a tab does NOT log them out (sessionStorage survives reloads).
 * Closing every tab DOES log them out (sessionStorage is wiped).
 * 
 * Visitors and in-flight OAuth callbacks are excluded.
 */
import { supabase } from '@/integrations/supabase/client';

const BROWSER_SESSION_FLAG = 'mm_browser_session_active';

export async function enforceBrowserSessionGuard(): Promise<void> {
  try {
    // If sessionStorage already has the flag, this is a reload/navigation in the same browser session.
    if (sessionStorage.getItem(BROWSER_SESSION_FLAG)) {
      return;
    }

    // Mark this browser session as active so future reloads keep the user logged in.
    sessionStorage.setItem(BROWSER_SESSION_FLAG, '1');

    // Skip if visitor session is active.
    if (sessionStorage.getItem('medicalMasters_visitor')) {
      return;
    }

    // Skip if we're in the middle of an OAuth callback or email confirmation.
    const url = new URL(window.location.href);
    const hash = window.location.hash || '';
    const isOAuthCallback =
      url.searchParams.has('code') ||
      hash.includes('access_token') ||
      hash.includes('type=recovery') ||
      url.pathname.startsWith('/~oauth') ||
      url.pathname === '/email-confirmed';
    if (isOAuthCallback) {
      return;
    }

    // Brand new browser session: force a sign-out so the user must log in again.
    try {
      localStorage.removeItem('mm_cached_user');
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[SessionGuard] signOut failed:', e);
    }
  } catch (e) {
    // Storage may be unavailable in some contexts (private mode, embedded webviews).
    console.warn('[SessionGuard] error:', e);
  }
}
