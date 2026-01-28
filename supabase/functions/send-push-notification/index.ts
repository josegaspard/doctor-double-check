import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  tag?: string;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string
) {
  // Create JWT for VAPID
  const header = { alg: 'ES256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const url = new URL(subscription.endpoint);
  
  const claims = {
    aud: `${url.protocol}//${url.host}`,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: 'mailto:push@docseek.app',
  };

  // Import the private key
  const privateKeyBuffer = Uint8Array.from(atob(vapidPrivateKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    privateKeyBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  // Create JWT
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const claimsB64 = btoa(JSON.stringify(claims)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerB64}.${claimsB64}`;
  
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${unsignedToken}.${signatureB64}`;

  // Prepare payload
  const payloadString = JSON.stringify(payload);

  // Send push notification
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
      'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
    },
    body: encoder.encode(payloadString),
  });

  return response;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { doctorId, liveId, title, message } = await req.json();

    if (!doctorId) {
      return new Response(
        JSON.stringify({ error: 'doctorId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all subscribers who follow this doctor and have push enabled
    const { data: subscriptions, error: subsError } = await supabase
      .from('subscriptions')
      .select('subscriber_id')
      .eq('creator_id', doctorId)
      .eq('is_active', true)
      .eq('notify_on_live', true);

    if (subsError) {
      console.error('Error fetching subscriptions:', subsError);
      return new Response(
        JSON.stringify({ error: 'Error fetching subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No subscribers found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subscriberIds = subscriptions.map(s => s.subscriber_id);

    // Get push subscriptions for these users
    const { data: pushSubs, error: pushError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', subscriberIds);

    if (pushError) {
      console.error('Error fetching push subscriptions:', pushError);
      return new Response(
        JSON.stringify({ error: 'Error fetching push subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pushSubs || pushSubs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No push subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send push notifications
    const payload: PushPayload = {
      title: title || '¡En vivo ahora!',
      body: message || 'Un doctor que sigues está transmitiendo',
      data: { liveId },
      tag: `live-${liveId}`,
    };

    let sentCount = 0;
    const errors: string[] = [];

    for (const sub of pushSubs) {
      try {
        const response = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapidPublicKey,
          vapidPrivateKey
        );

        if (response.ok || response.status === 201) {
          sentCount++;
        } else if (response.status === 410 || response.status === 404) {
          // Subscription is no longer valid, remove it
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
          console.log(`Removed invalid subscription: ${sub.id}`);
        } else {
          errors.push(`Failed to send to ${sub.id}: ${response.status}`);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error sending push to ${sub.id}:`, error);
        errors.push(`Error sending to ${sub.id}: ${errorMessage}`);
      }
    }

    console.log(`Sent ${sentCount}/${pushSubs.length} push notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        total: pushSubs.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-push-notification:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
