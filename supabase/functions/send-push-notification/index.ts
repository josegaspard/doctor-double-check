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

// Utility to convert URL-safe base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Simple push notification sender (without full encryption for now - sends to push service)
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<Response> {
  // For a production implementation, you would need to implement proper
  // Web Push encryption (AES-128-GCM) and VAPID signing.
  // This simplified version sends a request that may work with some push services.
  
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(JSON.stringify(payload));
  
  // Create JWT for VAPID
  const header = { alg: 'ES256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const url = new URL(subscription.endpoint);
  
  const claims = {
    aud: `${url.protocol}//${url.host}`,
    exp: now + 12 * 60 * 60,
    sub: 'mailto:push@docseek.app',
  };

  try {
    // Convert private key from URL-safe base64
    const privateKeyBytes = urlBase64ToUint8Array(vapidPrivateKey);
    
    // For ES256, we need to import as a JWK
    // The private key should be 32 bytes for P-256
    const privateKeyJwk = {
      kty: 'EC',
      crv: 'P-256',
      d: vapidPrivateKey,
      x: vapidPublicKey.substring(0, 43), // First part of public key
      y: vapidPublicKey.substring(43), // Second part of public key
    };

    // Create unsigned token parts
    const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const claimsB64 = btoa(JSON.stringify(claims)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const unsignedToken = `${headerB64}.${claimsB64}`;

    // For now, send without full VAPID (some services accept this)
    // In production, implement proper ECDSA signing
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TTL': '86400',
      },
      body: JSON.stringify(payload),
    });

    return response;
  } catch (error) {
    console.error('Error in sendWebPush:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    // Authentication check - verify the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authenticatedUserId = userData.user.id;

    const { doctorId, liveId, title, message } = await req.json();

    if (!doctorId) {
      return new Response(
        JSON.stringify({ error: 'doctorId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authorization check - only allow doctors to send notifications for themselves
    // or admins to send for any doctor
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if user is admin
    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', authenticatedUserId)
      .single();

    const isAdmin = userRole?.role === 'admin';

    if (authenticatedUserId !== doctorId && !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Can only send notifications for your own account' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('VAPID keys not configured, skipping push notifications');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'VAPID keys not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all subscribers who follow this doctor and have push enabled
    const { data: subscriptions, error: subsError } = await supabaseAdmin
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
    const { data: pushSubs, error: pushError } = await supabaseAdmin
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
          await supabaseAdmin
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
