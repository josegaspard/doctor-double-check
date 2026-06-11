// Suspends (or reactivates) a user account FOR REAL.
//
// Before, the admin "Suspend user" button only inserted a notification and
// showed a success toast — the user kept full access. This bans the account at
// the GoTrue level (auth.users.banned_until), so the user can no longer log in
// or refresh their session. Admin-only, cannot suspend yourself or another admin.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: requestingUser } } = await supabaseClient.auth.getUser();
    if (!requestingUser) return json({ error: "Unauthorized" }, 401);

    const { data: roleData } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", requestingUser.id).single();
    if (roleData?.role !== "admin") return json({ error: "Only admins can suspend users" }, 403);

    const { userId, suspend = true, reason } = await req.json();
    if (!userId) return json({ error: "User ID is required" }, 400);
    if (userId === requestingUser.id) return json({ error: "Cannot suspend your own account" }, 400);

    // Don't allow suspending another admin.
    const { data: targetRole } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userId).single();
    if (targetRole?.role === "admin") return json({ error: "Cannot suspend another admin" }, 400);

    // ban_duration: a long ban to suspend, "none" to reactivate.
    const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: suspend ? "876000h" : "none", // ~100 years
    });
    if (banErr) return json({ error: banErr.message }, 500);

    // Mirror the state on the profile if the column exists (best-effort, the
    // ban above is the source of truth and already blocks access).
    await supabaseAdmin.from("profiles").update({ is_suspended: suspend }).eq("id", userId).then(
      () => {}, () => {},
    );

    // Inform the user (visible if/when reactivated).
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      type: "system",
      title: suspend ? "Cuenta suspendida" : "Cuenta reactivada",
      message: suspend
        ? (reason || "Tu cuenta ha sido suspendida. Contacta a soporte.")
        : "Tu cuenta ha sido reactivada.",
      data: { action: suspend ? "suspended" : "reactivated", reason: reason || null },
    });

    console.log(`User ${userId} ${suspend ? "suspended" : "reactivated"} by admin ${requestingUser.id}`);
    return json({ success: true, suspended: suspend });
  } catch (error: any) {
    console.error("admin-suspend-user error:", error);
    return json({ error: error.message || "Internal server error" }, 500);
  }
});
