import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Authentication ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user identity
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = claimsData.claims.sub as string;

    // Service role client for DB operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { import_id } = await req.json();
    if (!import_id) throw new Error("import_id is required");

    // Get import record
    const { data: importRecord, error: fetchErr } = await supabase
      .from("document_imports")
      .select("*")
      .eq("id", import_id)
      .single();
    if (fetchErr || !importRecord) throw new Error("Import record not found");

    // --- Ownership check ---
    if (importRecord.uploaded_by !== userId) {
      return new Response(
        JSON.stringify({ error: "Forbidden: you do not own this import" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to processing
    await supabase
      .from("document_imports")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", import_id);

    // Download file from storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("pv-attachments")
      .download(importRecord.storage_path);
    if (dlErr || !fileData) throw new Error("Failed to download file: " + dlErr?.message);

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);

    // Determine MIME type
    const fileName = importRecord.source_file_name || "";
    const isPdf = fileName.toLowerCase().endsWith(".pdf");
    const mimeType = isPdf ? "application/pdf" : "image/jpeg";

    // Call Gemini via Lovable AI Gateway for structured extraction
    const systemPrompt = `You are an expert document analyzer specialized in Tunisian customs investigation reports (Procès-Verbaux / محاضر).

Extract ALL structured data from this document. The document may be in Arabic, French, or bilingual.

Return a JSON object with these fields (use null for fields not found):

{
  "pv_number": "string - N° PV / عدد المحضر",
  "pv_date": "string - Date in YYYY-MM-DD format",
  "department_name": "string - Department / القسم",
  "officer_name": "string - Officer name / الضابط",
  "officer_badge": "string - Badge number",
  "officer_rank": "string - Rank / الرتبة",
  "referral_type": "string - one of: internal, external, flagrante",
  "referral_source": "string - Source of referral",
  "pv_type": "string - محضر or ضلع",
  "customs_violation": "boolean",
  "currency_violation": "boolean",
  "public_law_violation": "boolean",
  "seizure_renewal": "boolean",
  "offenders": [
    {
      "name_or_company": "string",
      "identifier": "string - CIN/RC/Passport",
      "person_type": "string - physical or legal",
      "city": "string",
      "address": "string"
    }
  ],
  "violations": [
    {
      "violation_label": "string",
      "violation_category": "string - Douane, Change, Commerce, Droit commun",
      "legal_basis": "string"
    }
  ],
  "seizures": [
    {
      "goods_category": "string",
      "goods_type": "string",
      "quantity": "number",
      "unit": "string",
      "estimated_value": "number",
      "seizure_type": "string - actual, virtual, precautionary"
    }
  ],
  "total_actual_seizure": "number",
  "total_virtual_seizure": "number",
  "total_precautionary_seizure": "number",
  "notes": "string - any additional observations"
}

Also provide a confidence score (0-100) for each top-level field.
Return a second object called "confidence" with the same keys mapping to numbers 0-100.

Return ONLY valid JSON with two top-level keys: "extracted" and "confidence".`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract all structured PV data from this document. Return only the JSON.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 4096,
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      if (aiResponse.status === 429) {
        await supabase
          .from("document_imports")
          .update({ status: "error", validation_errors: { error: "Rate limit exceeded" } })
          .eq("id", import_id);
        return new Response(
          JSON.stringify({ error: "Rate limited, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        await supabase
          .from("document_imports")
          .update({ status: "error", validation_errors: { error: "Insufficient credits" } })
          .eq("id", import_id);
        return new Response(
          JSON.stringify({ error: "Insufficient credits. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error [${aiResponse.status}]: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse the JSON from the response (handle markdown code blocks)
    let parsed: any;
    try {
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawContent.trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      try {
        parsed = JSON.parse(rawContent);
      } catch {
        parsed = { extracted: {}, confidence: {} };
      }
    }

    const extracted = parsed.extracted || parsed;
    const confidence = parsed.confidence || {};

    // Calculate overall confidence
    const confValues = Object.values(confidence).filter(
      (v): v is number => typeof v === "number"
    );
    const overallConfidence =
      confValues.length > 0
        ? Math.round(confValues.reduce((a, b) => a + b, 0) / confValues.length)
        : 50;

    // Store field candidates
    const fieldCandidates = Object.entries(extracted)
      .filter(([_, v]) => v !== null && v !== undefined)
      .filter(([k]) => !["offenders", "violations", "seizures"].includes(k))
      .map(([fieldName, value]) => ({
        import_id,
        field_name: fieldName,
        extracted_value: typeof value === "object" ? JSON.stringify(value) : String(value),
        normalized_value: typeof value === "object" ? JSON.stringify(value) : String(value),
        confidence: confidence[fieldName] || 50,
        validated: false,
      }));

    // Add array fields as single entries
    if (extracted.offenders?.length) {
      fieldCandidates.push({
        import_id,
        field_name: "offenders",
        extracted_value: JSON.stringify(extracted.offenders),
        normalized_value: JSON.stringify(extracted.offenders),
        confidence: confidence.offenders || 60,
        validated: false,
      });
    }
    if (extracted.violations?.length) {
      fieldCandidates.push({
        import_id,
        field_name: "violations",
        extracted_value: JSON.stringify(extracted.violations),
        normalized_value: JSON.stringify(extracted.violations),
        confidence: confidence.violations || 60,
        validated: false,
      });
    }
    if (extracted.seizures?.length) {
      fieldCandidates.push({
        import_id,
        field_name: "seizures",
        extracted_value: JSON.stringify(extracted.seizures),
        normalized_value: JSON.stringify(extracted.seizures),
        confidence: confidence.seizures || 60,
        validated: false,
      });
    }

    if (fieldCandidates.length > 0) {
      await supabase.from("document_field_candidates").insert(fieldCandidates);
    }

    // Update import record
    await supabase
      .from("document_imports")
      .update({
        status: "extracted",
        finished_at: new Date().toISOString(),
        raw_text: rawContent.substring(0, 10000),
        extracted_json: extracted,
        confidence_score: overallConfidence,
      })
      .eq("id", import_id);

    return new Response(
      JSON.stringify({
        success: true,
        extracted,
        confidence,
        overall_confidence: overallConfidence,
        field_count: fieldCandidates.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("OCR extraction error:", error);
    return new Response(
      JSON.stringify({ error: "An internal error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
