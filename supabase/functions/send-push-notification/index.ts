import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { requireUserOrService, AuthError } from '../_shared/auth-guards.ts';
import { getDoctorTimezone, formatInTimezone } from '../_shared/doctor-timezone.ts';

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
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    // Auth check: usuario con JWT o llamada interna con la clave de servicio.
    let caller: { id: string } | null;
    try {
      caller = await requireUserOrService(req);
    } catch (e) {
      const status = e instanceof AuthError ? e.status : 401;
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const isService = caller === null;
    const authenticatedUserId = caller?.id ?? '';

    let isAdmin = isService;
    if (!isService) {
      const { data: adminRole } = await supabaseAdmin
        .from('user_roles').select('role').eq('user_id', authenticatedUserId).eq('role', 'admin').maybeSingle();
      isAdmin = !!adminRole;
    }

    const reqBody = await req.json().catch(() => ({}));
    const { doctorId, liveId, title, message } = reqBody;

    // Push a usuarios concretos: {user_ids, title, body, url}. Solo admin/servicio,
    // el organizador de un congreso/reunión a sus ponentes/invitados (congressId/meetingId)
    // o un paciente que acaba de pedir cita (status requested, < 15 min) con ese médico.
    if (Array.isArray(reqBody.user_ids)) {
      const userIds: string[] = [...new Set<string>(
        reqBody.user_ids.filter((id: unknown) => typeof id === 'string' && id.length > 0),
      )];
      const congressId = typeof reqBody.congressId === 'string' ? reqBody.congressId : '';
      const meetingId = typeof reqBody.meetingId === 'string' ? reqBody.meetingId : '';
      const maxRecipients = isAdmin || congressId || meetingId ? 50 : 1;
      if (!userIds.length || userIds.length > maxRecipients) {
        return new Response(JSON.stringify({ error: 'Invalid user_ids' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const forbidden = () => new Response(JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Para usuarios normales el servidor fija la URL (y en citas también el texto).
      let fixedUrl: string | null = null;
      let fixedTitle: string | null = null;
      let fixedBody: string | null = null;
      if (!isAdmin && congressId) {
        const { data: congress } = await supabaseAdmin
          .from('congresses').select('organizer_id').eq('id', congressId).maybeSingle();
        if (!congress || congress.organizer_id !== authenticatedUserId) return forbidden();
        const { data: speakers } = await supabaseAdmin
          .from('congress_speakers').select('user_id').eq('congress_id', congressId).in('user_id', userIds);
        const speakerIds = new Set((speakers || []).map(s => s.user_id));
        if (!userIds.every(id => speakerIds.has(id))) return forbidden();
        fixedUrl = `/congreso/${congressId}`;
      } else if (!isAdmin && meetingId) {
        const { data: meeting } = await supabaseAdmin
          .from('clinical_sessions').select('organizer_id').eq('id', meetingId).maybeSingle();
        if (!meeting || meeting.organizer_id !== authenticatedUserId) return forbidden();
        const { data: invites } = await supabaseAdmin
          .from('clinical_session_invitations').select('doctor_id').eq('session_id', meetingId).in('doctor_id', userIds);
        const inviteeIds = new Set((invites || []).map(i => i.doctor_id));
        if (!userIds.every(id => inviteeIds.has(id))) return forbidden();
        fixedUrl = '/meetings';
      } else if (!isAdmin) {
        const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { data: recentAppt } = await supabaseAdmin
          .from('appointments')
          .select('id, scheduled_at')
          .eq('patient_id', authenticatedUserId)
          .eq('doctor_id', userIds[0])
          .eq('status', 'requested')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!recentAppt) return forbidden();
        // Texto fijado en servidor: el paciente no puede mandar contenido propio.
        const { data: patientProfile } = await supabaseAdmin
          .from('profiles').select('name').eq('id', authenticatedUserId).maybeSingle();
        const tz = await getDoctorTimezone(supabaseAdmin, userIds[0]);
        fixedTitle = 'Nueva solicitud de cita';
        fixedBody = `${patientProfile?.name || 'Un paciente'} ha solicitado una cita para el ${formatInTimezone(recentAppt.scheduled_at, tz)}`;
        fixedUrl = '/my-appointments';
      }

      if (!vapidPublicKey || !vapidPrivateKey) {
        console.warn('VAPID keys not configured');
        return new Response(JSON.stringify({ success: true, sent: 0, message: 'VAPID keys not configured' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      webpush.setVapidDetails('mailto:soporte@medical-masters.com', vapidPublicKey, vapidPrivateKey);

      const { data: userPrefs } = await supabaseAdmin
        .from('notification_preferences')
        .select('user_id, push_notifications')
        .in('user_id', userIds);
      const userOptedOut = new Set((userPrefs || []).filter(p => p.push_notifications === false).map(p => p.user_id));
      const targets = userIds.filter(id => !userOptedOut.has(id));
      if (!targets.length) {
        return new Response(JSON.stringify({ success: true, sent: 0, message: 'All recipients opted out of push' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: userSubs, error: userSubsError } = await supabaseAdmin
        .from('push_subscriptions')
        .select('*')
        .in('user_id', targets);
      if (userSubsError || !userSubs?.length) {
        return new Response(JSON.stringify({ success: true, sent: 0, message: 'No push subscriptions' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const rawUrl = fixedUrl ?? (typeof reqBody.url === 'string' ? reqBody.url : '');
      const userPayload = JSON.stringify({
        title: String(fixedTitle ?? (reqBody.title || 'Medical Masters')).slice(0, 120),
        body: String(fixedBody ?? (reqBody.body || reqBody.message || '')).slice(0, 400),
        // Solo rutas internas: nada de abrir dominios ajenos desde el aviso.
        data: { url: rawUrl.startsWith('/') && !rawUrl.startsWith('//') ? rawUrl : '/' },
        tag: 'user-push',
      });

      let userSent = 0;
      const userErrors: string[] = [];
      for (const sub of userSubs) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, userPayload);
          userSent++;
        } catch (error: any) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
          } else {
            console.error(`Push error for ${sub.id}:`, error.message);
            userErrors.push(`${sub.id}: ${error.message}`);
          }
        }
      }
      return new Response(
        JSON.stringify({ success: true, sent: userSent, total: userSubs.length, errors: userErrors.length ? userErrors : undefined }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!doctorId) {
      return new Response(JSON.stringify({ error: 'doctorId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Authorization: only self or admin
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
