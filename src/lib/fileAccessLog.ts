import { supabase } from '@/integrations/supabase/client';

interface LogFileAccessParams {
  fileId: string;
  bucket?: string;
  fileType?: 'pdf' | 'image' | 'video' | 'audio' | 'unknown';
  action?: 'viewed' | 'access_denied' | 'download_attempt';
  error?: string;
}

/**
 * Fire-and-forget audit log of secure file access.
 * Combined with the dynamic watermark, enables forensic attribution
 * of leaked content (we know which user opened which file and when).
 *
 * RLS enforces user_id = auth.uid() on INSERT, so users can only
 * write their own audit trail — they cannot forge entries for others.
 */
export function logFileAccess({
  fileId,
  bucket,
  fileType = 'unknown',
  action = 'viewed',
  error,
}: LogFileAccessParams): void {
  try {
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user;
      if (!user) return;
      supabase
        .from('file_access_log' as any)
        .insert({
          user_id: user.id,
          user_email: user.email,
          file_id: String(fileId).slice(0, 500),
          bucket: bucket?.slice(0, 100),
          file_type: fileType,
          action,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
          error: error?.slice(0, 500),
        })
        .then(({ error: insErr }) => {
          if (insErr) console.debug('[fileAccessLog] insert failed', insErr);
        });
    });
  } catch (err) {
    console.debug('[fileAccessLog] unexpected', err);
  }
}
