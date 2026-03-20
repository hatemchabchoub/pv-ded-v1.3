import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLES = [
  "departments",
  "units",
  "officers",
  "profiles",
  "user_roles",
  "fonctions",
  "violation_reference",
  "goods_reference",
  "referral_sources",
  "pv",
  "offenders",
  "violations",
  "seizures",
  "notifications",
  "audit_logs",
  "document_imports",
  "document_field_candidates",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role using service role client
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Accès réservé aux administrateurs" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Export all tables using service role (bypasses RLS)
    const backup: Record<string, unknown[]> = {};
    const stats: Record<string, number> = {};

    for (const table of TABLES) {
      const { data, error } = await adminClient.from(table).select("*");
      if (error) {
        console.error(`Error exporting ${table}:`, error.message);
        backup[table] = [];
        stats[table] = 0;
      } else {
        backup[table] = data || [];
        stats[table] = data?.length || 0;
      }
    }

    const exportData = {
      metadata: {
        exported_at: new Date().toISOString(),
        exported_by: user.email,
        tables: stats,
        total_records: Object.values(stats).reduce((a, b) => a + b, 0),
      },
      data: backup,
    };

    const jsonString = JSON.stringify(exportData, null, 2);

    return new Response(jsonString, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="database_backup_${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    console.error("Backup error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
