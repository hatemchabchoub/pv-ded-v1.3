import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import WeeklyReportPrintTemplate from "@/components/print/WeeklyReportPrintTemplate";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/KpiCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import {
  FileText,
  Download,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Filter,
  Printer,
  Calendar,
  ArrowRightLeft,
  BarChart3,
} from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 0 }).format(v);

const CHART_COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(262, 83%, 58%)",
  "hsl(0, 84%, 60%)",
  "hsl(195, 74%, 44%)",
  "hsl(340, 82%, 52%)",
  "hsl(174, 72%, 40%)",
];

type Period = "month" | "quarter" | "year" | "custom" | "all";

const ReportsPage = () => {
  const [period, setPeriod] = useState<Period>("year");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const dateRange = useMemo(() => {
    const now = new Date();
    let from: string;
    let to = now.toISOString().split("T")[0];
    if (period === "custom" && customFrom && customTo) {
      return { from: customFrom, to: customTo };
    }
    switch (period) {
      case "month":
        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        break;
      case "quarter":
        from = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString().split("T")[0];
        break;
      case "year":
        from = `${now.getFullYear()}-01-01`;
        break;
      default:
        from = "2000-01-01";
    }
    return { from, to };
  }, [period, customFrom, customTo]);

  // Previous period for comparison
  const prevDateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "month": {
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return { from: prev.toISOString().split("T")[0], to: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0] };
      }
      case "quarter": {
        const qStart = Math.floor(now.getMonth() / 3) * 3;
        const prev = new Date(now.getFullYear(), qStart - 3, 1);
        return { from: prev.toISOString().split("T")[0], to: new Date(now.getFullYear(), qStart, 0).toISOString().split("T")[0] };
      }
      case "year":
        return { from: `${now.getFullYear() - 1}-01-01`, to: `${now.getFullYear() - 1}-12-31` };
      default:
        return null;
    }
  }, [period]);

  const { data: departments } = useQuery({
    queryKey: ["report-departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id, name_ar, code").order("code");
      return data || [];
    },
  });

  const { data: pvData, isLoading } = useQuery({
    queryKey: ["report-pvs", dateRange, departmentFilter],
    queryFn: async () => {
      let query = supabase
        .from("pv")
        .select(`
          id, pv_number, pv_date, case_status, pv_type,
          customs_violation, currency_violation, public_law_violation,
          total_actual_seizure, total_virtual_seizure, total_precautionary_seizure, total_seizure,
          department_id, departments (name_ar, code),
          officer_id, officers (full_name, badge_number)
        `)
        .gte("pv_date", dateRange.from)
        .lte("pv_date", dateRange.to);

      if (departmentFilter !== "all") query = query.eq("department_id", departmentFilter);
      const { data } = await query;
      return data || [];
    },
  });

  // Previous period data
  const { data: prevPvData } = useQuery({
    queryKey: ["report-prev-pvs", prevDateRange, departmentFilter],
    queryFn: async () => {
      if (!prevDateRange) return [];
      let query = supabase
        .from("pv")
        .select("id, total_seizure, department_id, departments(name_ar, code)")
        .gte("pv_date", prevDateRange.from)
        .lte("pv_date", prevDateRange.to);
      if (departmentFilter !== "all") query = query.eq("department_id", departmentFilter);
      const { data } = await query;
      return data || [];
    },
    enabled: !!prevDateRange,
  });

  const stats = useMemo(() => {
    if (!pvData) return null;

    const totalPv = pvData.length;
    const totalSeizure = pvData.reduce((s, p: any) => s + (Number(p.total_seizure) || 0), 0);
    const totalActual = pvData.reduce((s, p: any) => s + (Number(p.total_actual_seizure) || 0), 0);
    const totalVirtual = pvData.reduce((s, p: any) => s + (Number(p.total_virtual_seizure) || 0), 0);
    const totalPrecautionary = pvData.reduce((s, p: any) => s + (Number(p.total_precautionary_seizure) || 0), 0);

    const prevTotal = prevPvData?.length || 0;
    const prevSeizure = prevPvData?.reduce((s, p: any) => s + (Number(p.total_seizure) || 0), 0) || 0;
    const pvTrend = prevTotal > 0 ? ((totalPv - prevTotal) / prevTotal * 100) : null;
    const seizureTrend = prevSeizure > 0 ? ((totalSeizure - prevSeizure) / prevSeizure * 100) : null;

    const byDept: Record<string, { name: string; code: string; count: number; seizure: number; prevCount: number; prevSeizure: number }> = {};
    pvData.forEach((pv: any) => {
      const key = pv.department_id || "UNK";
      if (!byDept[key]) byDept[key] = { name: pv.departments?.name_ar || "غير محدد", code: pv.departments?.code || "UNK", count: 0, seizure: 0, prevCount: 0, prevSeizure: 0 };
      byDept[key].count++;
      byDept[key].seizure += Number(pv.total_seizure) || 0;
    });
    // Add previous period data for comparison
    prevPvData?.forEach((pv: any) => {
      const key = pv.department_id || "UNK";
      if (!byDept[key]) byDept[key] = { name: pv.departments?.name_ar || "غير محدد", code: pv.departments?.code || "UNK", count: 0, seizure: 0, prevCount: 0, prevSeizure: 0 };
      byDept[key].prevCount++;
      byDept[key].prevSeizure += Number(pv.total_seizure) || 0;
    });

    const byOfficer: Record<string, { name: string; count: number; seizure: number }> = {};
    pvData.forEach((pv: any) => {
      const key = pv.officer_id || "UNK";
      if (!byOfficer[key]) byOfficer[key] = { name: pv.officers?.full_name || "غير محدد", count: 0, seizure: 0 };
      byOfficer[key].count++;
      byOfficer[key].seizure += Number(pv.total_seizure) || 0;
    });

    const byMonth: Record<string, { month: string; count: number; seizure: number }> = {};
    const monthNames = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    pvData.forEach((pv: any) => {
      const key = pv.pv_date?.substring(0, 7);
      if (!key) return;
      if (!byMonth[key]) {
        const [y, m] = key.split("-");
        byMonth[key] = { month: `${monthNames[parseInt(m) - 1]} ${y}`, count: 0, seizure: 0 };
      }
      byMonth[key].count++;
      byMonth[key].seizure += Number(pv.total_seizure) || 0;
    });

    const byStatus: Record<string, number> = {};
    pvData.forEach((pv: any) => {
      const s = pv.case_status || "draft";
      byStatus[s] = (byStatus[s] || 0) + 1;
    });

    let customs = 0, currency = 0, publicLaw = 0;
    pvData.forEach((pv: any) => {
      if (pv.customs_violation) customs++;
      if (pv.currency_violation) currency++;
      if (pv.public_law_violation) publicLaw++;
    });

    // Top seizure PVs
    const topSeizures = [...pvData]
      .sort((a: any, b: any) => (Number(b.total_seizure) || 0) - (Number(a.total_seizure) || 0))
      .slice(0, 10);

    return {
      totalPv, totalSeizure, totalActual, totalVirtual, totalPrecautionary,
      pvTrend, seizureTrend,
      customs, currency, publicLaw,
      byDept: Object.values(byDept).sort((a, b) => b.count - a.count),
      byOfficer: Object.values(byOfficer).sort((a, b) => b.count - a.count),
      byMonth: Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v),
      byStatus,
      topSeizures,
      violationTypes: [
        { name: "ديوانية", value: customs },
        { name: "صرفية", value: currency },
        { name: "حق عام", value: publicLaw },
      ].filter((v) => v.value > 0),
    };
  }, [pvData, prevPvData]);

  const handleExportCSV = () => {
    if (!stats) return;
    const headers = ["القسم,Code,عدد المحاضر,المحجوز الكلي"];
    const rows = stats.byDept.map((d) => `${d.name},${d.code},${d.count},${d.seizure.toFixed(3)}`);
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport_pv_${dateRange.from}_${dateRange.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusLabels: Record<string, string> = { draft: "مسودة", under_review: "قيد المراجعة", validated: "مصادق", archived: "مؤرشف" };
  const statusColors: Record<string, string> = { draft: CHART_COLORS[5], under_review: CHART_COLORS[2], validated: CHART_COLORS[1], archived: CHART_COLORS[3] };

  const trendIcon = (val: number | null) => {
    if (val === null) return null;
    return val >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-success" /> : <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
  };

  const trendText = (val: number | null) => {
    if (val === null) return undefined;
    return `${val >= 0 ? "+" : ""}${Math.round(val)}% مقارنة بالفترة السابقة`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">التقارير</h1>
          <p className="text-sm text-muted-foreground">التقارير التشغيلية والتحليلية مع مقارنة الفترات</p>
        </div>
        <div className="flex items-center gap-2 no-print flex-wrap">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <Calendar className="h-3.5 w-3.5 ml-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">هذا الشهر</SelectItem>
              <SelectItem value="quarter">هذا الثلاثي</SelectItem>
              <SelectItem value="year">هذه السنة</SelectItem>
              <SelectItem value="custom">فترة مخصصة</SelectItem>
              <SelectItem value="all">الكل</SelectItem>
            </SelectContent>
          </Select>
          {period === "custom" && (
            <div className="flex items-center gap-1">
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 text-xs w-[130px]" />
              <span className="text-xs text-muted-foreground">—</span>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-8 text-xs w-[130px]" />
            </div>
          )}
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <Filter className="h-3.5 w-3.5 ml-1" />
              <SelectValue placeholder="القسم" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأقسام</SelectItem>
              {departments?.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.code} — {d.name_ar}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            طباعة
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="surface-elevated p-8 text-center text-sm text-muted-foreground">جاري تحميل البيانات…</div>
      ) : stats ? (
        <>
          {/* KPIs with trends */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard label="مجموع المحاضر" value={stats.totalPv} icon={FileText} variant="primary" trend={trendText(stats.pvTrend)} />
            <KpiCard label="المحجوز الكلي" value={fmt(stats.totalSeizure)} icon={DollarSign} variant="success" trend={trendText(stats.seizureTrend)} />
            <KpiCard label="المحجوز الفعلي" value={fmt(stats.totalActual)} icon={DollarSign} />
            <KpiCard label="المحجوز الصوري" value={fmt(stats.totalVirtual)} icon={DollarSign} />
            <KpiCard label="المحجوز التحفظي" value={fmt(stats.totalPrecautionary)} icon={TrendingUp} />
          </div>

          {/* Comparison summary */}
          {stats.pvTrend !== null && period !== "all" && period !== "custom" && (
            <div className="surface-elevated p-4 border flex items-center gap-4 flex-wrap">
              <ArrowRightLeft className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium">مقارنة مع الفترة السابقة:</span>
              <div className="flex items-center gap-1 text-xs">
                {trendIcon(stats.pvTrend)}
                <span>المحاضر: </span>
                <span className={`font-bold ${(stats.pvTrend ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
                  {(stats.pvTrend ?? 0) >= 0 ? "+" : ""}{Math.round(stats.pvTrend ?? 0)}%
                </span>
                <span className="text-muted-foreground">({stats.totalPv} مقابل {prevPvData?.length || 0})</span>
              </div>
              {stats.seizureTrend !== null && (
                <div className="flex items-center gap-1 text-xs">
                  {trendIcon(stats.seizureTrend)}
                  <span>المحجوزات: </span>
                  <span className={`font-bold ${(stats.seizureTrend ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
                    {(stats.seizureTrend ?? 0) >= 0 ? "+" : ""}{Math.round(stats.seizureTrend ?? 0)}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Tabs for different report views */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="no-print">
            <TabsList className="grid w-full grid-cols-4 max-w-lg">
              <TabsTrigger value="overview" className="text-xs">نظرة عامة</TabsTrigger>
              <TabsTrigger value="departments" className="text-xs">الأقسام</TabsTrigger>
              <TabsTrigger value="officers" className="text-xs">الضباط</TabsTrigger>
              <TabsTrigger value="top-seizures" className="text-xs">أكبر المحجوزات</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Monthly trend */}
              {stats.byMonth.length > 1 && (
                <div className="surface-elevated p-4 border">
                  <h2 className="text-sm font-medium mb-4">الاتجاه الشهري</h2>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={stats.byMonth}>
                      <defs>
                        <linearGradient id="rGradCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.2} />
                          <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="rGradSeizure" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_COLORS[1]} stopOpacity={0.15} />
                          <stop offset="100%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="count" stroke={CHART_COLORS[0]} fill="url(#rGradCount)" strokeWidth={2.5} name="عدد المحاضر" dot={{ r: 3, fill: CHART_COLORS[0], strokeWidth: 0 }} />
                      <Area type="monotone" dataKey="seizure" stroke={CHART_COLORS[1]} fill="url(#rGradSeizure)" strokeWidth={1.5} name="المحجوزات (د.ت)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="surface-elevated p-4 border">
                  <h2 className="text-sm font-medium mb-4">أنواع المخالفات</h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={stats.violationTypes} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                        {stats.violationTypes.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-3 mt-2 justify-center">
                    {stats.violationTypes.map((v, i) => (
                      <div key={v.name} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        {v.name} ({v.value})
                      </div>
                    ))}
                  </div>
                </div>

                <div className="surface-elevated p-4 border">
                  <h2 className="text-sm font-medium mb-4">حالة الملفات</h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={Object.entries(stats.byStatus).map(([k, v]) => ({ name: statusLabels[k] || k, value: v, color: statusColors[k] || CHART_COLORS[5] }))}
                        cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}
                      >
                        {Object.entries(stats.byStatus).map(([k], i) => (
                          <Cell key={i} fill={statusColors[k] || CHART_COLORS[5]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-3 mt-2 justify-center">
                    {Object.entries(stats.byStatus).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: statusColors[k] || CHART_COLORS[5] }} />
                        {statusLabels[k] || k} ({v})
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="departments" className="space-y-4 mt-4">
              <div className="surface-elevated p-4 border">
                <h2 className="text-sm font-medium mb-4">المحاضر حسب القسم (مع مقارنة)</h2>
                {stats.byDept.length > 0 ? (
                  <div dir="ltr">
                    <ResponsiveContainer width="100%" height={Math.max(250, stats.byDept.length * 45)}>
                      <BarChart data={stats.byDept.slice(0, 12)} layout="vertical" barGap={2} margin={{ left: 8, right: 48, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" orientation="right" tick={{ fontSize: 10 }} width={180} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} name="الفترة الحالية" />
                        {prevPvData && prevPvData.length > 0 && (
                          <Bar dataKey="prevCount" fill={CHART_COLORS[5]} radius={[0, 4, 4, 0]} name="الفترة السابقة" opacity={0.5} />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">لا توجد بيانات</div>
                )}
              </div>

              <div className="surface-elevated p-4 border">
                <h2 className="text-sm font-medium mb-4">التفصيل حسب القسم</h2>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>القسم</TableHead>
                        <TableHead>الرمز</TableHead>
                        <TableHead className="text-end">المحاضر</TableHead>
                        {prevPvData && prevPvData.length > 0 && <TableHead className="text-end">السابق</TableHead>}
                        {prevPvData && prevPvData.length > 0 && <TableHead className="text-end">التغيّر</TableHead>}
                        <TableHead className="text-end">المحجوز (د.ت)</TableHead>
                        <TableHead className="text-end">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.byDept.map((d, i) => {
                        const change = d.prevCount > 0 ? ((d.count - d.prevCount) / d.prevCount * 100) : null;
                        return (
                          <TableRow key={d.code}>
                            <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                            <TableCell className="text-sm" dir="rtl">{d.name}</TableCell>
                            <TableCell className="font-mono text-xs">{d.code}</TableCell>
                            <TableCell className="text-end font-mono text-sm">{d.count}</TableCell>
                            {prevPvData && prevPvData.length > 0 && (
                              <TableCell className="text-end font-mono text-xs text-muted-foreground">{d.prevCount}</TableCell>
                            )}
                            {prevPvData && prevPvData.length > 0 && (
                              <TableCell className="text-end text-xs">
                                {change !== null ? (
                                  <span className={change >= 0 ? "text-success font-medium" : "text-destructive font-medium"}>
                                    {change >= 0 ? "+" : ""}{Math.round(change)}%
                                  </span>
                                ) : "—"}
                              </TableCell>
                            )}
                            <TableCell className="text-end font-mono text-sm">{fmt(d.seizure)}</TableCell>
                            <TableCell className="text-end font-mono text-xs text-muted-foreground">
                              {stats.totalPv > 0 ? ((d.count / stats.totalPv) * 100).toFixed(1) : 0}%
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {stats.byDept.length > 0 && (
                        <TableRow className="font-medium bg-muted/50">
                          <TableCell />
                          <TableCell>المجموع</TableCell>
                          <TableCell />
                          <TableCell className="text-end font-mono">{stats.totalPv}</TableCell>
                          {prevPvData && prevPvData.length > 0 && <TableCell className="text-end font-mono text-xs">{prevPvData.length}</TableCell>}
                          {prevPvData && prevPvData.length > 0 && <TableCell />}
                          <TableCell className="text-end font-mono">{fmt(stats.totalSeizure)}</TableCell>
                          <TableCell className="text-end font-mono text-xs">100%</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="officers" className="mt-4">
              <div className="surface-elevated p-4 border">
                <h2 className="text-sm font-medium mb-4">التفصيل حسب الضابط</h2>
                <div className="overflow-auto max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>الضابط</TableHead>
                        <TableHead className="text-end">عدد المحاضر</TableHead>
                        <TableHead className="text-end">المحجوز (د.ت)</TableHead>
                        <TableHead className="text-end">المعدل / محضر</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.byOfficer.slice(0, 30).map((o, i) => (
                        <TableRow key={o.name + i}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="text-sm" dir="auto">{o.name}</TableCell>
                          <TableCell className="text-end font-mono text-sm">{o.count}</TableCell>
                          <TableCell className="text-end font-mono text-sm">{fmt(o.seizure)}</TableCell>
                          <TableCell className="text-end font-mono text-xs text-muted-foreground">
                            {o.count > 0 ? fmt(Math.round(o.seizure / o.count)) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="top-seizures" className="mt-4">
              <div className="surface-elevated p-4 border">
                <h2 className="text-sm font-medium mb-4">أكبر 10 محجوزات</h2>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>رقم المحضر</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>القسم</TableHead>
                        <TableHead>الضابط</TableHead>
                        <TableHead className="text-end">المحجوز الكلي (د.ت)</TableHead>
                        <TableHead className="text-end">فعلي</TableHead>
                        <TableHead className="text-end">صوري</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.topSeizures.map((pv: any, i) => (
                        <TableRow key={pv.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-mono text-sm font-medium">{pv.pv_number}</TableCell>
                          <TableCell className="text-xs">{pv.pv_date}</TableCell>
                          <TableCell className="text-xs">{pv.departments?.name_ar || "—"}</TableCell>
                          <TableCell className="text-xs">{pv.officers?.full_name || "—"}</TableCell>
                          <TableCell className="text-end font-mono text-sm font-bold text-primary">{fmt(Number(pv.total_seizure) || 0)}</TableCell>
                          <TableCell className="text-end font-mono text-xs">{fmt(Number(pv.total_actual_seizure) || 0)}</TableCell>
                          <TableCell className="text-end font-mono text-xs">{fmt(Number(pv.total_virtual_seizure) || 0)}</TableCell>
                        </TableRow>
                      ))}
                      {stats.topSeizures.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">لا توجد بيانات</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      {/* Print template */}
      {stats && (
        <WeeklyReportPrintTemplate
          periodLabel={`${dateRange.from} — ${dateRange.to}`}
          departmentName={
            departmentFilter !== "all" ? departments?.find((d) => d.id === departmentFilter)?.name_ar || undefined : undefined
          }
          stats={{
            totalPv: stats.totalPv,
            totalSeizure: stats.totalSeizure,
            totalActual: stats.totalActual,
            totalVirtual: stats.totalVirtual,
            totalPrecautionary: stats.totalPrecautionary,
            customs: stats.customs,
            currency: stats.currency,
            publicLaw: stats.publicLaw,
          }}
          byDept={stats.byDept}
          byOfficer={stats.byOfficer}
          byStatus={stats.byStatus}
        />
      )}
    </div>
  );
};

export default ReportsPage;
