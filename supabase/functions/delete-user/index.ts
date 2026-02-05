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

    // Purge user data from public tables (best-effort) BEFORE removing auth user.
    // We intentionally do not delete shared conversation/session tables here to avoid
    // accidentally deleting other users' records without an explicit policy decision.
    const purge = async (label: string, fn: Promise<{ error: any }>) => {
      const { error } = await fn;
      if (error) {
        console.error(`[delete-user] purge ${label} error:`, error);
      }
    };

    await purge('notification_preferences', supabaseAdmin.from('notification_preferences').delete().eq('user_id', userId));
    await purge('push_subscriptions', supabaseAdmin.from('push_subscriptions').delete().eq('user_id', userId));
    await purge('notifications', supabaseAdmin.from('notifications').delete().eq('user_id', userId));
    await purge('onboarding_progress', supabaseAdmin.from('onboarding_progress').delete().eq('user_id', userId));
    await purge('entitlements', supabaseAdmin.from('entitlements').delete().eq('user_id', userId));

    await purge('wallet_transactions', supabaseAdmin.from('wallet_transactions').delete().eq('user_id', userId));
    await purge('wallets', supabaseAdmin.from('wallets').delete().eq('user_id', userId));

    await purge('purchases', supabaseAdmin.from('purchases').delete().eq('user_id', userId));
    await purge('subscriptions_subscriber', supabaseAdmin.from('subscriptions').delete().eq('subscriber_id', userId));
    await purge('subscriptions_creator', supabaseAdmin.from('subscriptions').delete().eq('creator_id', userId));

    await purge('doctor_availability', supabaseAdmin.from('doctor_availability').delete().eq('doctor_id', userId));
    await purge('doctor_bank_accounts', supabaseAdmin.from('doctor_bank_accounts').delete().eq('doctor_id', userId));
    await purge('doctor_invoices', supabaseAdmin.from('doctor_invoices').delete().eq('doctor_id', userId));
    await purge('email_history', supabaseAdmin.from('email_history').delete().eq('doctor_id', userId));

    await purge('resident_profiles', supabaseAdmin.from('resident_profiles').delete().eq('user_id', userId));
    await purge('doctor_profiles', supabaseAdmin.from('doctor_profiles').delete().eq('user_id', userId));

    await purge('followers_follower', supabaseAdmin.from('followers').delete().eq('follower_id', userId));
    await purge('followers_followed', supabaseAdmin.from('followers').delete().eq('followed_id', userId));
    await purge('live_likes', supabaseAdmin.from('live_likes').delete().eq('user_id', userId));

    // Finally remove profile + role rows (if they don't cascade)
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
