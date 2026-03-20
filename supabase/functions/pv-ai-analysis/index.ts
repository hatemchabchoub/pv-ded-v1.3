import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `أنت خبير تحقيق ديواني سامٍ مختص في الجرائم الديوانية والتهريب والمنازعات الديوانية وتحليل المحاضر، وله خبرة ميدانية وتحليلية تتجاوز 20 سنة في مجال البحث والتقصي وإعادة بناء الوقائع وربط المعطيات واستخلاص المؤشرات.

مهمتك هي تحليل محضر واحد أو عدة محاضر ديوانية تحليلا دقيقا وموضوعيا ومهنيا، ثم إعداد تقرير تلخيصي شامل باللغة العربية القانونية والإدارية، مع رسم تخطيطي يبرز أهم الكيانات والعلاقات والتقاطعات بينها.

الغاية من العمل:
- قراءة جميع المحاضر قراءة كاملة ومتأنية.
- استخراج جميع المعطيات الجوهرية.
- تحديد الأشخاص الطبيعيين والمعنويين، وسائل النقل، البضائع، الأماكن، الوثائق، الأرقام المرجعية، وسائل الاتصال، والتواريخ.
- إعادة ترتيب الوقائع ترتيبا زمنيا.
- إبراز نقاط الالتقاء والروابط بين الكيانات.
- كشف أوجه التناقض أو النقص أو الغموض.
- إعداد تقرير نهائي مهني باللغة العربية.
- إنشاء مخطط يوضح الروابط بين العناصر الأساسية الواردة بالمحاضر.

قواعد إلزامية:
- يمنع اختلاق أي معلومة غير واردة صراحة أو المستنتجة استنتاجا منطقيا حذرا من نص المحضر.
- يجب التمييز الواضح بين:
  1) الوقائع الثابتة بالنص،
  2) التصريحات،
  3) القرائن،
  4) الملاحظات التحليلية،
  5) الفرضيات غير الجازمة.
- عند غياب المعلومة يكتب: "غير مذكور" أو "غير واضح".
- عند تعدد المحاضر يجب إجراء تحليل تقاطعي ومقارن.
- عند ورود نص قانوني أو مرجع ترتيبي داخل المحضر، يجب نقله كما ورد دون تعديل.
- يجب اعتماد أسلوب رسمي، قانوني، إداري، محايد، ودقيق.
- لا يتم الجزم بالتكييف القانوني إلا إذا كان ذلك مسندا صراحة بما ورد في المحضر.

المنهجية الإلزامية:

المرحلة الأولى — التعريف بكل محضر
استخرج لكل محضر: رقم المحضر، تاريخ التحرير، توقيت الواقعة أو المعاينة، مكان المعاينة أو الضبط، الوحدة أو الفرقة أو الإدارة المتعهدة، الأعوان أو الإطارات المذكورون، موضوع المحضر، الأساس القانوني المذكور إن وجد، الإجراء الأساسي المتخذ.

المرحلة الثانية — استخراج الكيانات
قم ببناء جدول مفصل للكيانات: الأشخاص الطبيعيون، الأشخاص المعنويون/الشركات، وسائل النقل، البضائع أو المحجوزات، الأماكن، الوثائق والمعرفات.

المرحلة الثالثة — التسلسل الزمني
أعد بناء الوقائع زمنيا في جدول: التاريخ | الساعة | الحدث | الأطراف المعنية | المرجع

المرحلة الرابعة — التحليل الوقائعي
خصص فقرات للوقائع المادية الثابتة، تصريحات الأطراف، الأدلة، المؤشرات، الأسلوب المعتمد، والعناصر التي قد توحي بوجود تنظيم أو تكرار.

المرحلة الخامسة — التحليل المقارن والتقاطعات
عند وجود أكثر من محضر، أنشئ جدولا بالتقاطعات مع بيان طبيعة العلاقة ودرجة القوة.

المرحلة السادسة — التناقضات ونقاط الاسترعاء

المرحلة السابعة — التقرير النهائي باللغة العربية بالهيكلة: عنوان، مقدمة، ملخص تنفيذي، تعريف بالمحاضر، وقائع، أطراف، وسائل نقل وبضائع ووثائق، تسلسل زمني، تحليل مقارن، تناقضات، تقييم تحليلي، خلاصة، توصيات.

المرحلة الثامنة — المخطط البياني للعلاقات (مخطط نصي هرمي + مخطط Mermaid)
هام جدا: يجب إنشاء مخطط Mermaid صالح تقنيا داخل كتلة كود مميزة بـ \`\`\`mermaid حيث يمكن عرضه مباشرة. استعمل graph TD وتجنب الأحرف الخاصة في أسماء العقد.

المرحلة التاسعة — خلاصة الروابط الأهم

صيغة الإخراج الإلزامية:
القسم 1: بطاقة مختصرة لكل محضر
القسم 2: جدول الكيانات المستخرجة
القسم 3: التسلسل الزمني الموحّد
القسم 4: التحليل الوقائعي
القسم 5: التحليل المقارن
القسم 6: التناقضات ونقاط الاسترعاء
القسم 7: التقرير النهائي باللغة العربية
القسم 8: مخطط العلاقات
القسم 9: التوصيات

ابدأ أولا ببناء جدول عمل داخلي ثم انتقل إلى التحليل الكامل.`;

function buildPvText(pv: any, offenders: any[], violations: any[], seizures: any[]): string {
  let text = `=== محضر رقم: ${pv.pv_number} ===\n`;
  text += `التاريخ: ${pv.pv_date}\n`;
  text += `النوع: ${pv.pv_type || "غير مذكور"}\n`;
  text += `الحالة: ${pv.case_status || "غير مذكور"}\n`;
  text += `الأولوية: ${pv.priority_level || "غير مذكور"}\n`;
  text += `المرجع الداخلي: ${pv.internal_reference || "غير مذكور"}\n`;
  text += `الإدارة: ${pv.departments?.name_ar || pv.departments?.name_fr || "غير مذكور"}\n`;
  text += `الوحدة: ${pv.units?.name_ar || pv.units?.name_fr || "غير مذكور"}\n`;
  text += `العون المحرر: ${pv.officers?.full_name || "غير مذكور"} - الرتبة: ${pv.officers?.rank_label || "غير مذكور"} - الرقم: ${pv.officers?.badge_number || "غير مذكور"}\n`;
  text += `مصدر الإحالة: ${pv.referral_sources?.label_ar || pv.referral_sources?.label_fr || "غير مذكور"}\n`;
  text += `نوع الإحالة: ${pv.referral_type || "غير مذكور"}\n`;
  text += `مخالفة ديوانية: ${pv.customs_violation ? "نعم" : "لا"}\n`;
  text += `مخالفة صرف: ${pv.currency_violation ? "نعم" : "لا"}\n`;
  text += `مخالفة قانون عام: ${pv.public_law_violation ? "نعم" : "لا"}\n`;
  text += `تجديد حجز: ${pv.seizure_renewal ? "نعم" : "لا"}\n`;
  text += `القيمة الإجمالية للحجز الفعلي: ${pv.total_actual_seizure || 0}\n`;
  text += `القيمة الإجمالية للحجز الافتراضي: ${pv.total_virtual_seizure || 0}\n`;
  text += `القيمة الإجمالية للحجز التحفظي: ${pv.total_precautionary_seizure || 0}\n`;
  text += `القيمة الإجمالية: ${pv.total_seizure || 0}\n`;
  text += `ملاحظات: ${pv.notes || "لا توجد"}\n`;

  if (offenders.length > 0) {
    text += `\n--- المخالفون ---\n`;
    for (const o of offenders) {
      text += `• ${o.name_or_company} | النوع: ${o.person_type || "غير مذكور"} | المعرف: ${o.identifier || "غير مذكور"} | المدينة: ${o.city || "غير مذكور"} | العنوان: ${o.address || "غير مذكور"}\n`;
    }
  }

  if (violations.length > 0) {
    text += `\n--- المخالفات ---\n`;
    for (const v of violations) {
      text += `• ${v.violation_label} | الصنف: ${v.violation_category || "غير مذكور"} | الأساس القانوني: ${v.legal_basis || "غير مذكور"} | الخطورة: ${v.severity_level || "غير مذكور"}\n`;
    }
  }

  if (seizures.length > 0) {
    text += `\n--- المحجوزات ---\n`;
    for (const s of seizures) {
      text += `• الصنف: ${s.goods_category || "غير مذكور"} | النوع: ${s.goods_type || "غير مذكور"} | الكمية: ${s.quantity || 0} ${s.unit || ""} | القيمة: ${s.estimated_value || 0} | نوع الحجز: ${s.seizure_type || "غير مذكور"}\n`;
    }
  }

  return text;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { pvIds, rawTexts, action, reportText, targetPvIds } = body;

    // Action: save report to PV(s)
    if (action === "save_report" && reportText && targetPvIds?.length > 0) {
      for (const pvId of targetPvIds) {
        await adminClient
          .from("pv")
          .update({ ai_analysis_report: reportText })
          .eq("id", pvId);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build texts from PV database entries
    const pvTexts: string[] = [];

    if (pvIds && Array.isArray(pvIds) && pvIds.length > 0) {
      for (const pvId of pvIds) {
        const [pvRes, offendersRes, violationsRes, seizuresRes] = await Promise.all([
          adminClient.from("pv").select("*, departments(name_fr, name_ar), units(name_fr, name_ar), officers(full_name, badge_number, rank_label), referral_sources(label_fr, label_ar)").eq("id", pvId).single(),
          adminClient.from("offenders").select("*").eq("pv_id", pvId).order("display_order"),
          adminClient.from("violations").select("*").eq("pv_id", pvId).order("display_order"),
          adminClient.from("seizures").select("*").eq("pv_id", pvId).order("display_order"),
        ]);
        if (!pvRes.data) continue;
        pvTexts.push(buildPvText(pvRes.data, offendersRes.data || [], violationsRes.data || [], seizuresRes.data || []));
      }
    }

    // Add raw text from uploaded PDFs
    if (rawTexts && Array.isArray(rawTexts)) {
      for (const rt of rawTexts) {
        if (typeof rt === "string" && rt.trim()) {
          pvTexts.push(`=== وثيقة مستوردة ===\n${rt}`);
        }
      }
    }

    if (pvTexts.length === 0) {
      return new Response(JSON.stringify({ error: "No data to analyze" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `فيما يلي المحضر أو المحاضر المطلوب تحليلها:\n\n${pvTexts.join("\n\n")}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقا" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "يرجى إعادة شحن الرصيد" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("pv-ai-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
