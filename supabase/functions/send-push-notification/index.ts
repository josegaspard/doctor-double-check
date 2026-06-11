import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const authenticatedUserId = userData.user.id;
    const { doctorId, liveId, title, message } = await req.json();

    if (!doctorId) {
      return new Response(JSON.stringify({ error: 'doctorId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Authorization: only self or admin
    const { data: userRole } = await supabaseAdmin
      .from('user_roles').select('role').eq('user_id', authenticatedUserId).single();
    const isAdmin = userRole?.role === 'admin';

    if (authenticatedUserId !== doctorId && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('VAPID keys not configured');
      return new Response(JSON.stringify({ success: true, sent: 0, message: 'VAPID keys not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Configure web-push with VAPID
    webpush.setVapidDetails('mailto:soporte@medical-masters.com', vapidPublicKey, vapidPrivateKey);

    // Get subscribers
    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from('subscriptions')
      .select('subscriber_id')
      .eq('creator_id', doctorId)
      .eq('is_active', true)
      .eq('notify_on_live', true);

    if (subsError) {
      console.error('Error fetching subscriptions:', subsError);
      return new Response(JSON.stringify({ error: 'Error fetching subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!subscriptions?.length) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: 'No subscribers' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let subscriberIds = subscriptions.map(s => s.subscriber_id);

    // Respect each user's GLOBAL push preference, not just notify_on_live.
    const { data: prefs } = await supabaseAdmin
      .from('notification_preferences')
      .select('user_id, push_notifications')
      .in('user_id', subscriberIds);
    const optedOut = new Set((prefs || []).filter(p => p.push_notifications === false).map(p => p.user_id));
    subscriberIds = subscriberIds.filter(id => !optedOut.has(id));
    if (!subscriberIds.length) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: 'All recipients opted out of push' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: pushSubs, error: pushError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .in('user_id', subscriberIds);

    if (pushError || !pushSubs?.length) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: 'No push subscriptions' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const payload = JSON.stringify({
      title: title || '¡En vivo ahora!',
      body: message || 'Un doctor que sigues está transmitiendo',
      data: { liveId },
      tag: `live-${liveId}`,
    });

    let sentCount = 0;
    const errors: string[] = [];

    for (const sub of pushSubs) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };

        await webpush.sendNotification(pushSubscription, payload);
        sentCount++;
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
          console.log(`Removed invalid subscription: ${sub.id}`);
        } else {
          console.error(`Push error for ${sub.id}:`, error.message);
          errors.push(`${sub.id}: ${error.message}`);
        }
      }
    }

    console.log(`Sent ${sentCount}/${pushSubs.length} push notifications`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, total: pushSubs.length, errors: errors.length ? errors : undefined }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('send-push-notification error:', error);
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
