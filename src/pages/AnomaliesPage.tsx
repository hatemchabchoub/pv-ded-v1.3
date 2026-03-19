import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Copy, Users, TrendingUp } from "lucide-react";

interface DuplicatePv {
  pv_number: string;
  count: number;
  ids: string[];
  dates: string[];
}

interface RepeatedOffender {
  normalized_name: string;
  count: number;
  departments: string[];
}

interface SuspiciousSeizure {
  id: string;
  pv_number: string;
  total_seizure: number;
  pv_date: string;
}

export default function AnomaliesPage() {
  const [tab, setTab] = useState("duplicates");

  // Duplicate PV numbers
  const { data: duplicates, isLoading: loadingDup } = useQuery({
    queryKey: ["anomalies-duplicates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pv")
        .select("id, pv_number, pv_date")
        .order("pv_number");
      if (error) throw error;

      const map = new Map<string, { ids: string[]; dates: string[] }>();
      (data || []).forEach((pv) => {
        const key = pv.pv_number.trim().toLowerCase();
        const entry = map.get(key) || { ids: [], dates: [] };
        entry.ids.push(pv.id);
        entry.dates.push(pv.pv_date);
        map.set(key, entry);
      });

      const results: DuplicatePv[] = [];
      map.forEach((val, key) => {
        if (val.ids.length > 1) {
          results.push({ pv_number: key, count: val.ids.length, ids: val.ids, dates: val.dates });
        }
      });
      return results.sort((a, b) => b.count - a.count);
    },
  });

  // Repeated offenders across different PVs
  const { data: repeatedOffenders, isLoading: loadingOff } = useQuery({
    queryKey: ["anomalies-offenders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offenders")
        .select("normalized_name, name_or_company, pv_id, pv:pv_id(department_id, departments:department_id(name_ar, name_fr))")
        .order("normalized_name");
      if (error) throw error;

      const map = new Map<string, { count: number; departments: Set<string> }>();
      (data || []).forEach((o: any) => {
        const key = (o.normalized_name || o.name_or_company || "").trim().toLowerCase();
        if (!key) return;
        const entry = map.get(key) || { count: 0, departments: new Set<string>() };
        entry.count++;
        const deptName = o.pv?.departments?.name_ar || o.pv?.departments?.name_fr;
        if (deptName) entry.departments.add(deptName);
        map.set(key, entry);
      });

      const results: RepeatedOffender[] = [];
      map.forEach((val, key) => {
        if (val.count > 1) {
          results.push({ normalized_name: key, count: val.count, departments: [...val.departments] });
        }
      });
      return results.sort((a, b) => b.count - a.count);
    },
  });

  // Suspicious seizure values (outliers - top values)
  const { data: suspiciousSeizures, isLoading: loadingSz } = useQuery({
    queryKey: ["anomalies-seizures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pv")
        .select("id, pv_number, total_seizure, pv_date")
        .not("total_seizure", "is", null)
        .gt("total_seizure", 0)
        .order("total_seizure", { ascending: false })
        .limit(50);
      if (error) throw error;

      if (!data || data.length < 5) return [];

      const values = data.map((d) => d.total_seizure || 0);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
      const threshold = mean + 2 * stdDev;

      return data
        .filter((d) => (d.total_seizure || 0) > threshold)
        .map((d) => ({
          id: d.id,
          pv_number: d.pv_number,
          total_seizure: d.total_seizure || 0,
          pv_date: d.pv_date,
        }));
    },
  });

  const stats = [
    { label: "محاضر مكررة", value: duplicates?.length || 0, icon: Copy, color: "text-destructive" },
    { label: "مخالفون متكررون", value: repeatedOffenders?.length || 0, icon: Users, color: "text-amber-500" },
    { label: "قيم شاذة", value: suspiciousSeizures?.length || 0, icon: TrendingUp, color: "text-orange-500" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          الشذوذ والتنبيهات
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          كشف التكرارات والقيم الشاذة في المحاضر والمخالفين
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="duplicates">
            محاضر مكررة ({duplicates?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="offenders">
            مخالفون متكررون ({repeatedOffenders?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="seizures">
            قيم شاذة ({suspiciousSeizures?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="duplicates" className="mt-4">
          {loadingDup ? (
            <div className="p-8 text-center text-sm text-muted-foreground">جاري التحميل...</div>
          ) : (
            <div className="surface-elevated rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم المحضر</TableHead>
                    <TableHead>عدد التكرارات</TableHead>
                    <TableHead>التواريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(duplicates || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        لا توجد محاضر مكررة ✓
                      </TableCell>
                    </TableRow>
                  ) : (
                    duplicates!.map((d) => (
                      <TableRow key={d.pv_number}>
                        <TableCell className="font-medium font-mono-data">{d.pv_number}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{d.count}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {d.dates.join("، ")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="offenders" className="mt-4">
          {loadingOff ? (
            <div className="p-8 text-center text-sm text-muted-foreground">جاري التحميل...</div>
          ) : (
            <div className="surface-elevated rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>اسم المخالف</TableHead>
                    <TableHead>عدد الظهور</TableHead>
                    <TableHead>الأقسام</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(repeatedOffenders || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        لا يوجد مخالفون متكررون ✓
                      </TableCell>
                    </TableRow>
                  ) : (
                    repeatedOffenders!.map((o) => (
                      <TableRow key={o.normalized_name}>
                        <TableCell className="font-medium">{o.normalized_name}</TableCell>
                        <TableCell>
                          <Badge variant={o.departments.length > 1 ? "destructive" : "secondary"}>
                            {o.count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {o.departments.join("، ") || "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="seizures" className="mt-4">
          {loadingSz ? (
            <div className="p-8 text-center text-sm text-muted-foreground">جاري التحميل...</div>
          ) : (
            <div className="surface-elevated rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم المحضر</TableHead>
                    <TableHead>قيمة الحجز</TableHead>
                    <TableHead>التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(suspiciousSeizures || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        لا توجد قيم شاذة ✓
                      </TableCell>
                    </TableRow>
                  ) : (
                    suspiciousSeizures!.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium font-mono-data">{s.pv_number}</TableCell>
                        <TableCell className="font-mono-data">
                          <Badge variant="destructive">
                            {s.total_seizure.toLocaleString("ar-MA")} MAD
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{s.pv_date}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
