import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdminOrCron, AuthError, corsHeaders } from "../_shared/auth-guards.ts";
import { Resend } from "npm:resend@2.0.0";

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
      
      // Generate unsubscribe token (base64 encoded: subscriberId:doctorId:type)
      const unsubscribeToken = btoa(`${profile.id}:${doctorId}:content`);
      const unsubscribeUrl = `${functionsUrl}/unsubscribe-email?token=${unsubscribeToken}`;
      const unsubscribeAllToken = btoa(`${profile.id}:${doctorId}:all`);
      const unsubscribeAllUrl = `${functionsUrl}/unsubscribe-email?token=${unsubscribeAllToken}`;
      
      try {
        await resend.emails.send({
          from: Deno.env.get("FROM_EMAIL") ?? "Medical Masters <no-reply@medical-masters.com>",
          to: [profile.email],
          subject,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
              <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <div style="background: linear-gradient(135deg, #0ea5e9, #0284c7); padding: 32px; text-align: center;">
                  <div style="width: 64px; height: 64px; background: white; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 32px;">${contentIcon}</span>
                  </div>
                  <h1 style="color: white; margin: 0; font-size: 24px;">Nuevo Contenido Disponible</h1>
                </div>
                <div style="padding: 32px;">
                  <h2 style="color: #1e293b; margin-top: 0;">¡Hola, ${profile.name}!</h2>
                  <p style="color: #64748b; font-size: 16px;">
                    <strong>${doctorName}</strong> ha subido nuevo contenido que podría interesarte.
                  </p>
                  
                  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #0ea5e9;">
                    <h3 style="margin: 0 0 8px; color: #1e293b; font-size: 18px;">${contentTitle}</h3>
                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                      <span style="background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 20px; font-size: 13px;">
                        ${contentTypeLabel}
                      </span>
                      <span style="background: #f1f5f9; color: #475569; padding: 4px 12px; border-radius: 20px; font-size: 13px;">
                        ${category}
                      </span>
                    </div>
                  </div>
                  
                  <p style="color: #64748b; font-size: 14px;">
                    Accede ahora para ver este nuevo contenido educativo.
                  </p>
                  
                  <div style="margin-top: 24px; text-align: center;">
                    <a href="${appUrl}/doctor/${doctorId}" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                      Ver Contenido
                    </a>
                  </div>
                </div>
                <div style="background: #f1f5f9; padding: 16px; text-align: center; color: #64748b; font-size: 12px;">
                  <p style="margin: 0 0 8px;">Recibes este email porque sigues a ${doctorName}.</p>
                  <p style="margin: 0 0 8px;">
                    <a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">Desuscribirse de emails de contenido</a> · 
                    <a href="${unsubscribeAllUrl}" style="color: #64748b; text-decoration: underline;">Desuscribirse de todos los emails</a>
                  </p>
                  <p style="margin: 0;">© 2026 Medical Masters. Todos los derechos reservados.</p>
                </div>
              </div>
            </body>
            </html>
          `,
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

        logStep("Email sent", { email: profile.email });
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

        logStep("Error sending email", { email: profile.email, error: error.message });
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
