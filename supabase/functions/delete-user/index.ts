import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the requesting user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token to verify they're admin
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: requestingUser } } = await supabaseClient.auth.getUser();
    if (!requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if requesting user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .single();

    if (roleData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only admins can delete users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user ID to delete from request body
    const { userId } = await req.json();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent self-deletion
    if (userId === requestingUser.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot delete your own account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if target user is also admin (optional: prevent admin deletion)
    const { data: targetRoleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    // =====================================================
    // FULL PURGE: We delete ALL data including shared tables
    // =====================================================
    const purge = async (label: string, fn: Promise<{ error: any }>) => {
      const { error } = await fn;
      if (error) {
        console.error(`[delete-user] purge ${label} error:`, error);
      }
    };

    // ------ CHATS & CONSULTATIONS (first because they depend on sessions) ------
    // Find chat sessions where the user is a participant
    const { data: chatSessions } = await supabaseAdmin
      .from('chat_sessions')
      .select('id')
      .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`);
    const sessionIds = (chatSessions || []).map((s) => s.id);

    // Delete messages in those sessions
    if (sessionIds.length) {
      await purge(
        'chat_messages_by_session',
        supabaseAdmin.from('chat_messages').delete().in('session_id', sessionIds)
      );
    }
    // Delete messages sent by user (safety: if FK not enforced)
    await purge('chat_messages_sender', supabaseAdmin.from('chat_messages').delete().eq('sender_id', userId));

    // Delete the sessions themselves
    if (sessionIds.length) {
      await purge(
        'chat_sessions_in',
        supabaseAdmin.from('chat_sessions').delete().in('id', sessionIds)
      );
    }

    // Consultation ratings (both as patient & doctor)
    await purge('consultation_ratings_patient', supabaseAdmin.from('consultation_ratings').delete().eq('patient_id', userId));
    await purge('consultation_ratings_doctor', supabaseAdmin.from('consultation_ratings').delete().eq('doctor_id', userId));

    // Consultations
    await purge('consultations_patient', supabaseAdmin.from('consultations').delete().eq('patient_id', userId));
    await purge('consultations_doctor', supabaseAdmin.from('consultations').delete().eq('doctor_id', userId));

    // Reports filed BY the user and reports ON the user (handled later via content ids)
    await purge('reports_reporter', supabaseAdmin.from('reports').delete().eq('reporter_id', userId));

    // ------ VAULT ------
    // Vault access granted TO the user as doctor
    await purge('vault_access_doctor', supabaseAdmin.from('vault_access').delete().eq('doctor_id', userId));
    // Vault access to files OWNED by user (find file ids first)
    const { data: vaultFiles } = await supabaseAdmin
      .from('vault_files')
      .select('id')
      .eq('patient_id', userId);
    const vaultFileIds = (vaultFiles || []).map((f) => f.id);
    if (vaultFileIds.length) {
      await purge('vault_access_file', supabaseAdmin.from('vault_access').delete().in('file_id', vaultFileIds));
    }
    // Vault files themselves
    await purge('vault_files', supabaseAdmin.from('vault_files').delete().eq('patient_id', userId));

    // Medical history
    await purge('medical_history', supabaseAdmin.from('medical_history').delete().eq('patient_id', userId));

    // ------ CLINICAL SESSIONS ------
    const { data: clinicalSessions } = await supabaseAdmin
      .from('clinical_sessions')
      .select('id')
      .eq('organizer_id', userId);
    const clinicalSessionIds = (clinicalSessions || []).map((s) => s.id);
    if (clinicalSessionIds.length) {
      await purge('clinical_session_invitations', supabaseAdmin.from('clinical_session_invitations').delete().in('session_id', clinicalSessionIds));
      await purge('clinical_sessions', supabaseAdmin.from('clinical_sessions').delete().in('id', clinicalSessionIds));
    }
    // Invitations where user is invited doctor
    await purge('clinical_session_invitations_doctor', supabaseAdmin.from('clinical_session_invitations').delete().eq('doctor_id', userId));

    // ------ RESIDENT GROUPS ------
    await purge('resident_group_members', supabaseAdmin.from('resident_group_members').delete().eq('user_id', userId));
    await purge('resident_group_activity', supabaseAdmin.from('resident_group_activity').delete().eq('user_id', userId));
    const { data: residentGroups } = await supabaseAdmin
      .from('resident_groups')
      .select('id')
      .eq('created_by', userId);
    const residentGroupIds = (residentGroups || []).map((g) => g.id);
    if (residentGroupIds.length) {
      await purge('resident_group_members_by_group', supabaseAdmin.from('resident_group_members').delete().in('group_id', residentGroupIds));
      await purge('resident_group_activity_by_group', supabaseAdmin.from('resident_group_activity').delete().in('group_id', residentGroupIds));
      await purge('resident_groups', supabaseAdmin.from('resident_groups').delete().in('id', residentGroupIds));
    }

    // ------ LIVES & RECORDINGS ------
    // Lives by doctor
    const { data: lives } = await supabaseAdmin.from('lives').select('id').eq('doctor_id', userId);
    const liveIds = (lives || []).map((l) => l.id);
    if (liveIds.length) {
      await purge('live_likes_by_live', supabaseAdmin.from('live_likes').delete().in('live_id', liveIds));
    }
    await purge('lives_doctor', supabaseAdmin.from('lives').delete().eq('doctor_id', userId));
    await purge('live_likes_user', supabaseAdmin.from('live_likes').delete().eq('user_id', userId));

    // Recordings by doctor
    const { data: recs } = await supabaseAdmin.from('recordings').select('id').eq('doctor_id', userId);
    const recIds = (recs || []).map((r) => r.id);
    if (recIds.length) {
      await purge('purchases_recording', supabaseAdmin.from('purchases').delete().in('recording_id', recIds));
    }
    await purge('recordings_doctor', supabaseAdmin.from('recordings').delete().eq('doctor_id', userId));

    // Purchases made by user
    await purge('purchases', supabaseAdmin.from('purchases').delete().eq('user_id', userId));

    // ------ DOCTOR CONTENT ------
    await purge('doctor_content', supabaseAdmin.from('doctor_content').delete().eq('creator_id', userId));

    // ------ NOTIFICATIONS & SUBSCRIPTIONS ------
    await purge('notification_preferences', supabaseAdmin.from('notification_preferences').delete().eq('user_id', userId));
    await purge('push_subscriptions', supabaseAdmin.from('push_subscriptions').delete().eq('user_id', userId));
    await purge('notifications', supabaseAdmin.from('notifications').delete().eq('user_id', userId));
    await purge('subscriptions_subscriber', supabaseAdmin.from('subscriptions').delete().eq('subscriber_id', userId));
    await purge('subscriptions_creator', supabaseAdmin.from('subscriptions').delete().eq('creator_id', userId));

    // ------ WALLET ------
    await purge('wallet_transactions', supabaseAdmin.from('wallet_transactions').delete().eq('user_id', userId));
    await purge('wallets', supabaseAdmin.from('wallets').delete().eq('user_id', userId));

    // ------ DOCTOR / RESIDENT PROFILES ------
    await purge('doctor_availability', supabaseAdmin.from('doctor_availability').delete().eq('doctor_id', userId));
    await purge('doctor_bank_accounts', supabaseAdmin.from('doctor_bank_accounts').delete().eq('doctor_id', userId));
    await purge('doctor_invoices', supabaseAdmin.from('doctor_invoices').delete().eq('doctor_id', userId));
    await purge('doctor_payouts', supabaseAdmin.from('doctor_payouts').delete().eq('doctor_id', userId));
    await purge('email_history', supabaseAdmin.from('email_history').delete().eq('doctor_id', userId));
    await purge('cedula_verifications', supabaseAdmin.from('cedula_verifications').delete().eq('user_id', userId));

    await purge('resident_profiles', supabaseAdmin.from('resident_profiles').delete().eq('user_id', userId));
    await purge('doctor_profiles', supabaseAdmin.from('doctor_profiles').delete().eq('user_id', userId));

    // ------ FOLLOWERS ------
    await purge('followers_follower', supabaseAdmin.from('followers').delete().eq('follower_id', userId));
    await purge('followers_followed', supabaseAdmin.from('followers').delete().eq('followed_id', userId));

    // ------ IDENTITY & ONBOARDING ------
    // Before deleting identity_verifications rows, grab any file_urls so we
    // can purge the actual files from Storage. Otherwise PII docs (cedulas,
    // ID scans) stay in the bucket forever.
    try {
      const { data: idFiles } = await supabaseAdmin
        .from('identity_verifications')
        .select('metadata, file_url')
        .eq('user_id', userId);
      const filePaths: string[] = [];
      for (const r of (idFiles ?? []) as any[]) {
        if (r.file_url && typeof r.file_url === 'string') filePaths.push(r.file_url);
        const mdUrl = r?.metadata?.file_url;
        if (mdUrl && typeof mdUrl === 'string') filePaths.push(mdUrl);
      }
      const storagePaths = filePaths
        .map(u => {
          try {
            const m = u.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(\?|$)/);
            return m ? { bucket: m[1], path: decodeURIComponent(m[2]) } : null;
          } catch { return null; }
        })
        .filter(Boolean) as { bucket: string; path: string }[];
      const byBucket = storagePaths.reduce<Record<string, string[]>>((acc, f) => {
        (acc[f.bucket] ||= []).push(f.path);
        return acc;
      }, {});
      for (const [bucket, paths] of Object.entries(byBucket)) {
        const { error: rmErr } = await supabaseAdmin.storage.from(bucket).remove(paths);
        if (rmErr) console.warn(`[delete-user] Storage purge failed for ${bucket}:`, rmErr.message);
      }
    } catch (e) {
      console.warn('[delete-user] Identity file cleanup failed (non-fatal):', e);
    }
    await purge('identity_verifications', supabaseAdmin.from('identity_verifications').delete().eq('user_id', userId));
    await purge('onboarding_progress', supabaseAdmin.from('onboarding_progress').delete().eq('user_id', userId));
    await purge('entitlements', supabaseAdmin.from('entitlements').delete().eq('user_id', userId));

    // ------ FINALLY: PROFILE & ROLE ------
    await purge('user_roles', supabaseAdmin.from('user_roles').delete().eq('user_id', userId));
    await purge('profiles', supabaseAdmin.from('profiles').delete().eq('id', userId));

    // Delete from auth.users - this will cascade where FKs exist
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${userId} deleted successfully by admin ${requestingUser.id}`);

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in delete-user function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
