// Supprime un superviseur (auth + profile). Réservé à un admin.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice("Bearer ".length);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Session invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", callerId);
    const isAdmin = (roles ?? []).some((r: { role?: string }) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Accès refusé" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const userId = (body?.userId ?? "").toString();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (userId === callerId) {
      return new Response(JSON.stringify({ error: "Impossible de supprimer son propre compte." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Empêche la suppression du dernier admin
    const { data: targetRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const targetIsAdmin = (targetRoles ?? []).some((r: { role?: string }) => r.role === "admin");
    if (targetIsAdmin) {
      const { count } = await admin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) {
        return new Response(
          JSON.stringify({ error: "Impossible de supprimer le dernier admin." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // profiles/user_roles ont ON DELETE CASCADE

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
