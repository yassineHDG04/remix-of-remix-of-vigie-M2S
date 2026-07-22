// Invite un superviseur : crée le compte auth avec un mot de passe temporaire,
// upsert le profil (statut=invite, must_reset_password=true).
// Sécurité : l'appelant doit être admin.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { corsHeaders } from "../_shared/cors.ts";

function genPassword(len = 14): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  const chars: string[] = [
    upper[buf[0] % upper.length],
    lower[buf[1] % lower.length],
    digits[buf[2] % digits.length],
    symbols[buf[3] % symbols.length],
  ];
  for (let i = 4; i < len; i++) chars.push(all[buf[i] % all.length]);
  return chars.sort(() => Math.random() - 0.5).join("");
}

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
    const email = (body?.email ?? "").toString().trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Email invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const fullName = (body?.full_name ?? email.split("@")[0]).toString();

    const tempPassword = genPassword(14);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName, invited: true },
    });
    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const newId = created.user.id;

    // Assure le profil (le trigger l'a créé mais on force)
    await admin.from("profiles").upsert({
      id: newId,
      email,
      full_name: fullName,
      status: "invite",
      must_reset_password: true,
    });

    // Le trigger a déjà mis le rôle superviseur
    await admin
      .from("user_roles")
      .upsert({ user_id: newId, role: "superviseur" }, { onConflict: "user_id,role" });

    return new Response(JSON.stringify({ email, tempPassword, userId: newId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
