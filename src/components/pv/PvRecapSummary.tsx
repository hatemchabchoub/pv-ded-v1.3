import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3 }).format(v);

interface Props {
  parentPvId: string;
}

export default function PvRecapSummary({ parentPvId }: Props) {
  // Get all child PVs
  const { data: childPvs } = useQuery({
    queryKey: ["pv-children", parentPvId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pv")
        .select("id, pv_number, pv_type, pv_date, case_status, total_actual_seizure, total_virtual_seizure, total_precautionary_seizure, total_seizure")
        .eq("parent_pv_id", parentPvId)
        .order("pv_number");
      return data || [];
    },
  });

  // Get parent PV info
  const { data: parentPv } = useQuery({
    queryKey: ["pv-parent-info", parentPvId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pv")
        .select("id, pv_number, pv_type, pv_date, total_actual_seizure, total_virtual_seizure, total_precautionary_seizure, total_seizure, departments(name_ar, name_fr), officers(full_name, rank_label)")
        .eq("id", parentPvId)
        .single();
      return data;
    },
  });

  const allPvIds = [parentPvId, ...(childPvs?.map(c => c.id) || [])];
  
  // Only include PVs that are seizure type (not معاينة or إستدراك)
  const { data: allPvsForFilter } = useQuery({
    queryKey: ["pv-types-filter", allPvIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("pv")
        .select("id, pv_type")
        .in("id", allPvIds);
      return data || [];
    },
    enabled: allPvIds.length > 0,
  });

  const seizurePvIds = allPvsForFilter
    ?.filter(p => p.pv_type !== "معاينة" && p.pv_type !== "إستدراك")
    .map(p => p.id) || [];

  // Get all offenders from seizure PVs only
  const { data: allOffenders } = useQuery({
    queryKey: ["recap-offenders", seizurePvIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("offenders")
        .select("*, pv_id")
        .in("pv_id", seizurePvIds)
        .order("name_or_company");
      return data || [];
    },
    enabled: seizurePvIds.length > 0,
  });

  // Get all violations from all PVs
  const { data: allViolations } = useQuery({
    queryKey: ["recap-violations", allPvIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("violations")
        .select("*, pv_id")
        .in("pv_id", allPvIds)
        .order("violation_label");
      return data || [];
    },
    enabled: allPvIds.length > 0,
  });

  // Get all seizures from all PVs
  const { data: allSeizures } = useQuery({
    queryKey: ["recap-seizures", allPvIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("seizures")
        .select("*, pv_id")
        .in("pv_id", allPvIds)
        .order("goods_type");
      return data || [];
    },
    enabled: allPvIds.length > 0,
  });

  // Deduplicate offenders by normalized_name or name_or_company
  const uniqueOffenders = (() => {
    const seen = new Set<string>();
    return (allOffenders || []).filter(o => {
      const key = (o.name_or_company).toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  // Deduplicate violations by violation_label
  const uniqueViolations = (() => {
    const seen = new Set<string>();
    return (allViolations || []).filter(v => {
      const key = v.violation_label.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  // Deduplicate seizures by goods_type + goods_category + seizure_type
  const uniqueSeizures = (() => {
    const seen = new Set<string>();
    return (allSeizures || []).filter(s => {
      const key = `${(s.goods_type || "").toLowerCase().trim()}|${(s.goods_category || "").toLowerCase().trim()}|${s.seizure_type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  // Totals
  const totalActual = uniqueSeizures
    .filter(s => s.seizure_type === "actual")
    .reduce((sum, s) => sum + (Number(s.estimated_value) || 0), 0);
  const totalVirtual = uniqueSeizures
    .filter(s => s.seizure_type === "virtual")
    .reduce((sum, s) => sum + (Number(s.estimated_value) || 0), 0);
  const totalPrecautionary = uniqueSeizures
    .filter(s => s.seizure_type === "precautionary")
    .reduce((sum, s) => sum + (Number(s.estimated_value) || 0), 0);
  const totalAll = totalActual + totalVirtual + totalPrecautionary;

  const handlePrintRecap = () => {
    window.print();
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">الفهرس التجميعي للمحضر</h2>
          <p className="text-sm text-muted-foreground">
            المحضر {parentPv?.pv_number} — {(childPvs?.length || 0)} أضلع
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handlePrintRecap}>
          <Printer className="h-4 w-4" />طباعة الفهرس
        </Button>
      </div>

      {/* Sub-PVs list */}
      <div className="surface-elevated p-4">
        <h3 className="text-sm font-medium mb-3">الأضلع المرتبطة</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>النوع</TableHead>
              <TableHead>عدد المحضر</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead className="text-end">حجز فعلي</TableHead>
              <TableHead className="text-end">حجز صوري</TableHead>
              <TableHead className="text-end">حجز تحفظي</TableHead>
              <TableHead className="text-end">المجموع</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parentPv && (
              <TableRow className="bg-primary/5 font-medium">
                <TableCell>محضر</TableCell>
                <TableCell className="font-mono-data">{parentPv.pv_number}</TableCell>
                <TableCell>{parentPv.pv_date}</TableCell>
                <TableCell className="text-end font-mono-data">{fmt(Number(parentPv.total_actual_seizure) || 0)}</TableCell>
                <TableCell className="text-end font-mono-data">{fmt(Number(parentPv.total_virtual_seizure) || 0)}</TableCell>
                <TableCell className="text-end font-mono-data">{fmt(Number(parentPv.total_precautionary_seizure) || 0)}</TableCell>
                <TableCell className="text-end font-mono-data">{fmt(Number(parentPv.total_seizure) || 0)}</TableCell>
              </TableRow>
            )}
            {childPvs?.map(c => (
              <TableRow key={c.id}>
                <TableCell className="text-muted-foreground">↳ ضلع</TableCell>
                <TableCell className="font-mono-data">{c.pv_number}</TableCell>
                <TableCell>{c.pv_date}</TableCell>
                <TableCell className="text-end font-mono-data">{fmt(Number(c.total_actual_seizure) || 0)}</TableCell>
                <TableCell className="text-end font-mono-data">{fmt(Number(c.total_virtual_seizure) || 0)}</TableCell>
                <TableCell className="text-end font-mono-data">{fmt(Number(c.total_precautionary_seizure) || 0)}</TableCell>
                <TableCell className="text-end font-mono-data">{fmt(Number(c.total_seizure) || 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Aggregated Offenders */}
      <div className="surface-elevated p-4">
        <h3 className="text-sm font-medium mb-3">المخالفون (تجميعي — {uniqueOffenders.length})</h3>
        <p className="text-xs text-muted-foreground mb-2">محاضر الحجز فقط (بدون معاينة أو إستدراك)</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>الإسم / الشركة</TableHead>
              <TableHead>المعرف</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>المدينة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {uniqueOffenders.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">لا يوجد مخالفون</TableCell></TableRow>
            ) : uniqueOffenders.map((o: any, i) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono-data">{i + 1}</TableCell>
                <TableCell className="font-medium">{o.name_or_company}</TableCell>
                <TableCell className="font-mono-data text-sm">{o.identifier || "—"}</TableCell>
                <TableCell>{o.person_type === "physical" ? "شخص طبيعي" : "شخص معنوي"}</TableCell>
                <TableCell>{o.city || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Aggregated Violations */}
      <div className="surface-elevated p-4">
        <h3 className="text-sm font-medium mb-3">المخالفات (تجميعي — {uniqueViolations.length})</h3>
        <p className="text-xs text-muted-foreground mb-2">المخالفات غير المكررة فقط</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>المخالفة</TableHead>
              <TableHead>الصنف</TableHead>
              <TableHead>الأساس القانوني</TableHead>
              <TableHead>الخطورة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {uniqueViolations.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">لا توجد مخالفات</TableCell></TableRow>
            ) : uniqueViolations.map((v: any, i) => (
              <TableRow key={v.id}>
                <TableCell className="font-mono-data">{i + 1}</TableCell>
                <TableCell className="font-medium text-sm">{v.violation_label}</TableCell>
                <TableCell>{v.violation_category || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{v.legal_basis || "—"}</TableCell>
                <TableCell>
                  {v.severity_level ? (
                    <span className={`text-xs px-2 py-0.5 rounded-sm ${
                      v.severity_level === "Grave" ? "bg-destructive/10 text-destructive" :
                      v.severity_level === "Moyen" ? "bg-accent/10 text-accent-foreground" :
                      "bg-muted text-muted-foreground"
                    }`}>{v.severity_level === "Grave" ? "خطيرة" : v.severity_level === "Moyen" ? "متوسطة" : v.severity_level === "Mineur" ? "بسيطة" : v.severity_level}</span>
                  ) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Aggregated Seizures */}
      <div className="surface-elevated p-4">
        <h3 className="text-sm font-medium mb-3">المحجوزات (تجميعي — {uniqueSeizures.length})</h3>
        <p className="text-xs text-muted-foreground mb-2">المحجوزات غير المكررة فقط</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الصنف</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead className="text-end">الكمية</TableHead>
              <TableHead>الوحدة</TableHead>
              <TableHead className="text-end">القيمة</TableHead>
              <TableHead>نوع الحجز</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {uniqueSeizures.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">لا توجد محجوزات</TableCell></TableRow>
            ) : uniqueSeizures.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell>{s.goods_category || "—"}</TableCell>
                <TableCell className="font-medium">{s.goods_type || "—"}</TableCell>
                <TableCell className="text-end font-mono-data">{Number(s.quantity).toLocaleString()}</TableCell>
                <TableCell>{s.unit || "—"}</TableCell>
                <TableCell className="text-end font-mono-data">{fmt(Number(s.estimated_value) || 0)}</TableCell>
                <TableCell className="text-xs">{s.seizure_type === "actual" ? "فعلي" : s.seizure_type === "virtual" ? "صوري" : s.seizure_type === "precautionary" ? "تحفظي" : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Totals */}
        <div className="mt-4 grid grid-cols-4 gap-4 border-t pt-4 [direction:rtl]">
          {([
            ["حجز فعلي", totalActual],
            ["حجز صوري", totalVirtual],
            ["حجز تحفظي", totalPrecautionary],
            ["المجموع الكلي", totalAll],
          ] as [string, number][]).map(([label, val]) => (
            <div key={label} className="text-start">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-lg font-semibold font-mono-data">{fmt(val)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
