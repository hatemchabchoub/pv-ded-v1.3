import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generatePassword(length = 12): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$";
  let pwd = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) {
    pwd += chars[arr[i] % chars.length];
  }
  return pwd;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Non autorisé");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) throw new Error("Non autorisé");

    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!callerRole) throw new Error("Droits administrateur requis");

    const { officer_ids, mode } = await req.json();
    // mode: "single" (one officer_id) or "bulk" (array or all)

    let officersToProcess: any[] = [];

    if (mode === "bulk") {
      // Get all officers without an auth_user_id
      const { data, error } = await supabaseAdmin
        .from("officers")
        .select("*")
        .is("auth_user_id", null)
        .eq("active", true);
      if (error) throw error;
      officersToProcess = data || [];
    } else {
      // Single or specific IDs
      const ids = Array.isArray(officer_ids) ? officer_ids : [officer_ids];
      const { data, error } = await supabaseAdmin
        .from("officers")
        .select("*")
        .in("id", ids);
      if (error) throw error;
      officersToProcess = data || [];
    }

    const results: any[] = [];

    for (const officer of officersToProcess) {
      // Skip if already has account
      if (officer.auth_user_id) {
        results.push({ officer_id: officer.id, status: "skipped", reason: "already_linked" });
        continue;
      }

      const badge = officer.badge_number || officer.id.substring(0, 8);
      const email = `${badge}@douane.app`;
      const password = generatePassword();

      // Create auth user
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: officer.full_name },
      });

      if (createErr) {
        results.push({ officer_id: officer.id, status: "error", error: createErr.message });
        continue;
      }

      const authUserId = newUser.user.id;

      // Update officer with auth link and credentials
      await supabaseAdmin
        .from("officers")
        .update({
          auth_user_id: authUserId,
          generated_email: email,
          initial_password: password,
        })
        .eq("id", officer.id);

      // Update profile with department/unit from officer
      await supabaseAdmin
        .from("profiles")
        .update({
          full_name: officer.full_name,
          department_id: officer.department_id,
          unit_id: officer.unit_id,
        })
        .eq("auth_user_id", authUserId);

      // Assign role based on fonction
      if (officer.fonction) {
        const { data: fonctionData } = await supabaseAdmin
          .from("fonctions")
          .select("mapped_role")
          .eq("label_ar", officer.fonction)
          .eq("active", true)
          .maybeSingle();

        const role = fonctionData?.mapped_role || "officer";

        // Delete existing roles and insert new one
        await supabaseAdmin.from("user_roles").delete().eq("user_id", authUserId);
        await supabaseAdmin.from("user_roles").insert({ user_id: authUserId, role });
      }

      results.push({
        officer_id: officer.id,
        status: "created",
        email,
        password,
        auth_user_id: authUserId,
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
