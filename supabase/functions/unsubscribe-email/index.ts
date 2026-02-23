import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[UNSUBSCRIBE-EMAIL] ${step}${detailsStr}`);
};

// Simple encoding for unsubscribe token (subscriber_id:doctor_id:type)
const decodeToken = (token: string): { subscriberId: string; doctorId: string; type: string } | null => {
  try {
    const decoded = atob(token);
    const [subscriberId, doctorId, type] = decoded.split(':');
    if (subscriberId && doctorId && type) {
      return { subscriberId, doctorId, type };
    }
    return null;
  } catch {
    return null;
  }
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const action = url.searchParams.get('action') || 'page'; // 'page', 'confirm', or 'resubscribe'

    if (!token) {
      return new Response(
        generateErrorPage('Token de desuscripción no válido'),
        { status: 400, headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders } }
      );
    }

    const decoded = decodeToken(token);
    if (!decoded) {
      return new Response(
        generateErrorPage('Token de desuscripción expirado o no válido'),
        { status: 400, headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders } }
      );
    }

    logStep("Processing unsubscribe", decoded);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get subscriber and doctor info
    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('id, is_active, notify_on_live, notify_on_content, notify_on_availability')
      .eq('subscriber_id', decoded.subscriberId)
      .eq('creator_id', decoded.doctorId)
      .single();

    if (!subscription) {
      return new Response(
        generateErrorPage('Suscripción no encontrada'),
        { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders } }
      );
    }

    // Get doctor name for display
    const { data: doctorProfile } = await supabaseClient
      .from('profiles')
      .select('name')
      .eq('id', decoded.doctorId)
      .single();

    const doctorName = doctorProfile?.name || 'el doctor';

    if (action === 'confirm') {
      // Process the unsubscription
      const updates: Record<string, boolean> = {};
      
      if (decoded.type === 'all') {
        updates.notify_on_live = false;
        updates.notify_on_content = false;
        updates.notify_on_availability = false;
      } else if (decoded.type === 'content') {
        updates.notify_on_content = false;
      } else if (decoded.type === 'live') {
        updates.notify_on_live = false;
      } else if (decoded.type === 'availability') {
        updates.notify_on_availability = false;
      }

      const { error } = await supabaseClient
        .from('subscriptions')
        .update(updates)
        .eq('id', subscription.id);

      if (error) {
        logStep("Error updating subscription", { error: error.message });
        return new Response(
          generateErrorPage('Error al procesar la desuscripción. Inténtalo de nuevo.'),
          { status: 500, headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders } }
        );
      }

      logStep("Unsubscribe successful", { subscriptionId: subscription.id, type: decoded.type });

      return new Response(
        generateSuccessPage(token, doctorName, decoded.type),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders } }
      );
    }

    if (action === 'resubscribe') {
      // Process the re-subscription
      const updates: Record<string, boolean> = {};
      
      if (decoded.type === 'all') {
        updates.notify_on_live = true;
        updates.notify_on_content = true;
        updates.notify_on_availability = true;
      } else if (decoded.type === 'content') {
        updates.notify_on_content = true;
      } else if (decoded.type === 'live') {
        updates.notify_on_live = true;
      } else if (decoded.type === 'availability') {
        updates.notify_on_availability = true;
      }

      const { error } = await supabaseClient
        .from('subscriptions')
        .update(updates)
        .eq('id', subscription.id);

      if (error) {
        logStep("Error updating subscription", { error: error.message });
        return new Response(
          generateErrorPage('Error al procesar la re-suscripción. Inténtalo de nuevo.'),
          { status: 500, headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders } }
        );
      }

      logStep("Resubscribe successful", { subscriptionId: subscription.id, type: decoded.type });

      return new Response(
        generateResubscribeSuccessPage(doctorName, decoded.type),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders } }
      );
    }

    // Show confirmation page
    return new Response(
      generateConfirmationPage(token, doctorName, decoded.type, subscription),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders } }
    );

  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      generateErrorPage('Error interno del servidor'),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders } }
    );
  }
});

function generateConfirmationPage(token: string, doctorName: string, type: string, subscription: any): string {
  const typeLabels: Record<string, string> = {
    'all': 'todas las notificaciones',
    'content': 'notificaciones de nuevo contenido',
    'live': 'notificaciones de lives',
    'availability': 'notificaciones de disponibilidad',
  };
  
  const typeLabel = typeLabels[type] || 'notificaciones';
  const baseUrl = Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.functions.supabase.co') || '';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Desuscribirse - Dr Double Check</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); max-width: 480px; width: 100%; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0ea5e9, #0284c7); padding: 32px; text-align: center; }
    .header h1 { color: white; font-size: 24px; margin-bottom: 8px; }
    .header p { color: rgba(255,255,255,0.9); font-size: 14px; }
    .content { padding: 32px; }
    .content h2 { color: #1e293b; margin-bottom: 16px; font-size: 20px; }
    .content p { color: #64748b; line-height: 1.6; margin-bottom: 16px; }
    .highlight { background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #0ea5e9; }
    .highlight strong { color: #1e293b; }
    .buttons { display: flex; gap: 12px; margin-top: 24px; }
    .btn { flex: 1; padding: 14px 20px; border-radius: 8px; font-weight: 600; text-decoration: none; text-align: center; transition: all 0.2s; cursor: pointer; border: none; font-size: 14px; }
    .btn-primary { background: #ef4444; color: white; }
    .btn-primary:hover { background: #dc2626; }
    .btn-secondary { background: #f1f5f9; color: #475569; }
    .btn-secondary:hover { background: #e2e8f0; }
    .status { margin-top: 20px; padding: 12px; background: #f0fdf4; border-radius: 8px; font-size: 13px; color: #166534; }
    .status.inactive { background: #fef2f2; color: #991b1b; }
    .footer { padding: 16px 32px; background: #f8fafc; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>📧 Gestionar Notificaciones</h1>
      <p>Dr Double Check</p>
    </div>
    <div class="content">
      <h2>¿Deseas desuscribirte?</h2>
      <p>Estás a punto de desactivar <strong>${typeLabel}</strong> de <strong>${doctorName}</strong>.</p>
      
      <div class="highlight">
        <strong>Estado actual:</strong><br>
        ✉️ Contenido: ${subscription.notify_on_content ? '✅ Activo' : '❌ Desactivado'}<br>
        🔴 Lives: ${subscription.notify_on_live ? '✅ Activo' : '❌ Desactivado'}<br>
        📅 Disponibilidad: ${subscription.notify_on_availability ? '✅ Activo' : '❌ Desactivado'}
      </div>

      <p style="font-size: 14px;">Seguirás siendo suscriptor y podrás acceder al contenido, solo dejarás de recibir emails.</p>

      <div class="buttons">
        <a href="https://doc-seek-relay.lovable.app/settings" class="btn btn-secondary">Cancelar</a>
        <a href="${baseUrl}/unsubscribe-email?token=${token}&action=confirm" class="btn btn-primary">Confirmar Desuscripción</a>
      </div>
    </div>
    <div class="footer">
      © 2026 Dr Double Check. Todos los derechos reservados.
    </div>
  </div>
</body>
</html>
  `;
}

function generateSuccessPage(token: string, doctorName: string, type: string): string {
  const typeLabels: Record<string, string> = {
    'all': 'todas las notificaciones',
    'content': 'notificaciones de nuevo contenido',
    'live': 'notificaciones de lives',
    'availability': 'notificaciones de disponibilidad',
  };
  
  const typeLabel = typeLabels[type] || 'notificaciones';
  const baseUrl = Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.functions.supabase.co') || '';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Desuscripción Exitosa - Dr Double Check</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); max-width: 480px; width: 100%; overflow: hidden; text-align: center; }
    .header { background: linear-gradient(135deg, #22c55e, #16a34a); padding: 32px; }
    .icon { width: 64px; height: 64px; background: white; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 32px; }
    .header h1 { color: white; font-size: 24px; }
    .content { padding: 32px; }
    .content h2 { color: #1e293b; margin-bottom: 16px; font-size: 20px; }
    .content p { color: #64748b; line-height: 1.6; margin-bottom: 16px; }
    .buttons { display: flex; gap: 12px; margin-top: 24px; justify-content: center; flex-wrap: wrap; }
    .btn { display: inline-block; padding: 14px 24px; border-radius: 8px; font-weight: 600; text-decoration: none; transition: all 0.2s; }
    .btn-primary { background: #0ea5e9; color: white; }
    .btn-primary:hover { background: #0284c7; }
    .btn-secondary { background: #f1f5f9; color: #475569; }
    .btn-secondary:hover { background: #e2e8f0; }
    .undo-section { margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
    .undo-section p { font-size: 14px; margin-bottom: 12px; }
    .footer { padding: 16px 32px; background: #f8fafc; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="icon">✅</div>
      <h1>¡Listo!</h1>
    </div>
    <div class="content">
      <h2>Te has desuscrito correctamente</h2>
      <p>Ya no recibirás <strong>${typeLabel}</strong> de <strong>${doctorName}</strong> por email.</p>
      
      <div class="undo-section">
        <p>¿Cambiaste de opinión? Puedes volver a activar las notificaciones:</p>
        <div class="buttons">
          <a href="${baseUrl}/unsubscribe-email?token=${token}&action=resubscribe" class="btn btn-secondary">🔔 Volver a Suscribirme</a>
          <a href="https://doc-seek-relay.lovable.app/settings" class="btn btn-primary">Ir a Configuración</a>
        </div>
      </div>
    </div>
    <div class="footer">
      © 2026 Dr Double Check. Todos los derechos reservados.
    </div>
  </div>
</body>
</html>
  `;
}

function generateResubscribeSuccessPage(doctorName: string, type: string): string {
  const typeLabels: Record<string, string> = {
    'all': 'todas las notificaciones',
    'content': 'notificaciones de nuevo contenido',
    'live': 'notificaciones de lives',
    'availability': 'notificaciones de disponibilidad',
  };
  
  const typeLabel = typeLabels[type] || 'notificaciones';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Re-suscripción Exitosa - Dr Double Check</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); max-width: 480px; width: 100%; overflow: hidden; text-align: center; }
    .header { background: linear-gradient(135deg, #0ea5e9, #0284c7); padding: 32px; }
    .icon { width: 64px; height: 64px; background: white; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 32px; }
    .header h1 { color: white; font-size: 24px; }
    .content { padding: 32px; }
    .content h2 { color: #1e293b; margin-bottom: 16px; font-size: 20px; }
    .content p { color: #64748b; line-height: 1.6; margin-bottom: 16px; }
    .btn { display: inline-block; padding: 14px 28px; background: #0ea5e9; color: white; border-radius: 8px; font-weight: 600; text-decoration: none; margin-top: 16px; }
    .btn:hover { background: #0284c7; }
    .footer { padding: 16px 32px; background: #f8fafc; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="icon">🔔</div>
      <h1>¡Bienvenido de nuevo!</h1>
    </div>
    <div class="content">
      <h2>Te has re-suscrito correctamente</h2>
      <p>Volverás a recibir <strong>${typeLabel}</strong> de <strong>${doctorName}</strong> por email.</p>
      <p style="font-size: 14px;">¡Gracias por seguir con nosotros! No te perderás ninguna actualización importante.</p>
      <a href="https://doc-seek-relay.lovable.app" class="btn">Ir a la App</a>
    </div>
    <div class="footer">
      © 2026 Dr Double Check. Todos los derechos reservados.
    </div>
  </div>
</body>
</html>
  `;
}

function generateErrorPage(message: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error - Dr Double Check</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); max-width: 480px; width: 100%; overflow: hidden; text-align: center; }
    .header { background: linear-gradient(135deg, #ef4444, #dc2626); padding: 32px; }
    .icon { width: 64px; height: 64px; background: white; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 32px; }
    .header h1 { color: white; font-size: 24px; }
    .content { padding: 32px; }
    .content p { color: #64748b; line-height: 1.6; margin-bottom: 16px; }
    .btn { display: inline-block; padding: 14px 28px; background: #0ea5e9; color: white; border-radius: 8px; font-weight: 600; text-decoration: none; margin-top: 16px; }
    .footer { padding: 16px 32px; background: #f8fafc; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="icon">❌</div>
      <h1>Error</h1>
    </div>
    <div class="content">
      <p>${message}</p>
      <a href="https://doc-seek-relay.lovable.app" class="btn">Ir al Inicio</a>
    </div>
    <div class="footer">
      © 2026 Dr Double Check. Todos los derechos reservados.
    </div>
  </div>
</body>
</html>
  `;
}
