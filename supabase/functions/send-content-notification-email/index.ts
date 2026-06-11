import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdminOrCron, AuthError, corsHeaders } from "../_shared/auth-guards.ts";
import { Resend } from "npm:resend@2.0.0";
import { renderEmail } from "../_shared/email-template.ts";
import { maskEmail } from "../_shared/log-redact.ts";
import { generateUnsubscribeToken } from "../_shared/unsubscribe-token.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CONTENT-NOTIFICATION-EMAIL] ${step}${detailsStr}`);
};

interface ContentNotificationRequest {
  doctorId: string;
  doctorName: string;
  contentId: string;
  contentTitle: string;
  contentType: 'video' | 'pdf' | 'image';
  category: string;
}

const getContentTypeLabel = (type: string): string => {
  switch (type) {
    case 'video': return 'Video';
    case 'pdf': return 'Documento PDF';
    case 'image': return 'Imagen';
    default: return 'Contenido';
  }
};

const getContentIcon = (type: string): string => {
  switch (type) {
    case 'video': return '🎬';
    case 'pdf': return '📄';
    case 'image': return '🖼️';
    default: return '📁';
  }
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY (2026-05-11 audit): admin JWT or x-cron-secret. Previously open Resend relay.
  try { await requireAdminOrCron(req); } catch (__e) {
    if (__e instanceof AuthError) return __e.toResponse();
    return new Response(JSON.stringify({ error: 'auth failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const appUrl = "https://medical-masters.com";
    logStep("Processing content notification request");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { doctorId, doctorName, contentId, contentTitle, contentType, category }: ContentNotificationRequest = await req.json();

    if (!doctorId || !contentTitle || !contentType) {
      throw new Error("Missing required fields");
    }

    logStep("Fetching subscribers", { doctorId });

    // Get all active subscribers who want content notifications
    const { data: subscriptions, error: subError } = await supabaseClient
      .from('subscriptions')
      .select(`
        subscriber_id,
        tier
      `)
      .eq('creator_id', doctorId)
      .eq('is_active', true)
      .eq('notify_on_content', true);

    if (subError) {
      logStep("Error fetching subscriptions", { error: subError.message });
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      logStep("No subscribers to notify");
      return new Response(
        JSON.stringify({ success: true, emailsSent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    logStep("Found subscribers", { count: subscriptions.length });

    // Get subscriber emails from profiles
    const subscriberIds = subscriptions.map(s => s.subscriber_id);
    const { data: profiles, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, email, name')
      .in('id', subscriberIds);

    if (profileError) {
      logStep("Error fetching profiles", { error: profileError.message });
      throw profileError;
    }

    if (!profiles || profiles.length === 0) {
      logStep("No profiles found for subscribers");
      return new Response(
        JSON.stringify({ success: true, emailsSent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    logStep("Sending emails", { count: profiles.length });

    const contentTypeLabel = getContentTypeLabel(contentType);
    const contentIcon = getContentIcon(contentType);
    
    // Generate unsubscribe URL base
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || '';
    const functionsUrl = supabaseUrl.replace('.supabase.co', '.functions.supabase.co');

    // Send emails to all subscribers and log each one
    const emailPromises = profiles.map(async (profile) => {
      const subject = `${contentIcon} Nuevo ${contentTypeLabel.toLowerCase()} de ${doctorName}`;
      
      // HMAC-signed unsubscribe token (unsigned tokens are rejected by unsubscribe-email)
      const unsubscribeToken = await generateUnsubscribeToken(profile.id, doctorId, 'content');
      const unsubscribeUrl = `${functionsUrl}/unsubscribe-email?token=${unsubscribeToken}`;
      const unsubscribeAllToken = await generateUnsubscribeToken(profile.id, doctorId, 'all');
      const unsubscribeAllUrl = `${functionsUrl}/unsubscribe-email?token=${unsubscribeAllToken}`;
      
      try {
        await resend.emails.send({
          from: Deno.env.get("FROM_EMAIL") ?? "Medical Masters <no-reply@medical-masters.com>",
          to: [profile.email],
          subject,
          html: renderEmail({
            preheader: `${doctorName} publicó un nuevo ${contentTypeLabel.toLowerCase()}: ${contentTitle}`,
            accent: "info",
            eyebrow: "Nuevo contenido",
            title: contentTitle,
            subtitle: `${doctorName} publicó un nuevo ${contentTypeLabel.toLowerCase()}.`,
            greeting: `Hola, ${profile.name}`,
            bodyHtml: `
              <div style="margin:6px 0 16px;">
                <span style="display:inline-block;background:#e0f2fe;color:#0369a1;font-size:12px;padding:5px 10px;border-radius:999px;margin-right:6px;">${contentTypeLabel}</span>
                <span style="display:inline-block;background:#f1f5f9;color:#475569;font-size:12px;padding:5px 10px;border-radius:999px;">${category}</span>
              </div>
              <p style="margin:8px 0 0;color:#475569;">Accede ahora para verlo en la plataforma.</p>
            `,
            ctaText: "Ver contenido",
            ctaUrl: `${appUrl}/doctor/${doctorId}`,
            appUrl,
            secondaryNote: `Recibes este correo porque sigues a ${doctorName}.<br/>
              <a href="${unsubscribeUrl}" style="color:#64748b;">Pausar notificaciones de contenido</a>
              &nbsp;·&nbsp;
              <a href="${unsubscribeAllUrl}" style="color:#64748b;">Cancelar todos los correos</a>`,
          }),
        });

        // Log successful email to history
        await supabaseClient.from('email_history').insert({
          doctor_id: doctorId,
          recipient_email: profile.email,
          recipient_name: profile.name,
          email_type: 'new_content',
          subject,
          content_id: contentId || null,
          content_title: contentTitle,
          status: 'sent',
        });

        logStep("Email sent", { email: maskEmail(profile.email) });
        return { success: true, email: profile.email };
      } catch (error: any) {
        // Log failed email to history
        await supabaseClient.from('email_history').insert({
          doctor_id: doctorId,
          recipient_email: profile.email,
          recipient_name: profile.name,
          email_type: 'new_content',
          subject,
          content_id: contentId || null,
          content_title: contentTitle,
          status: 'failed',
          error_message: error.message,
        });

        logStep("Error sending email", { email: maskEmail(profile.email), error: error.message });
        return { success: false, email: profile.email, error: error.message };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;

    logStep("Emails sent", { total: results.length, success: successCount });

    return new Response(
      JSON.stringify({ success: true, emailsSent: successCount, total: results.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
