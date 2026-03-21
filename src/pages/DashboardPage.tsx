import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Users,
  AlertTriangle,
  Banknote,
  TrendingUp,
  TrendingDown,
  Shield,
  BarChart3,
  Calendar,
  ArrowUpRight,
  Filter,
  Activity,
} from "lucide-react";
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
  AreaChart,
  Area,
} from "recharts";

const fmt = (v: number) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 0 }).format(v);

const CHART_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(160, 84%, 39%)",
  "hsl(43, 96%, 56%)",
  "hsl(271, 81%, 56%)",
  "hsl(0, 72%, 51%)",
  "hsl(220, 9%, 46%)",
];

type Period = "month" | "quarter" | "year" | "all";

function getDateRange(period: Period) {
  const now = new Date();
  let from: string;
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
  return from;
}

function getPreviousDateRange(period: Period) {
  const now = new Date();
  let from: string, to: string;
  switch (period) {
    case "month": {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      from = prev.toISOString().split("T")[0];
      to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
      break;
    }
    case "quarter": {
      const qStart = Math.floor(now.getMonth() / 3) * 3;
      const prev = new Date(now.getFullYear(), qStart - 3, 1);
      from = prev.toISOString().split("T")[0];
      to = new Date(now.getFullYear(), qStart, 0).toISOString().split("T")[0];
      break;
    }
    case "year": {
      from = `${now.getFullYear() - 1}-01-01`;
      to = `${now.getFullYear() - 1}-12-31`;
      break;
    }
    default:
      return null;
  }
  return { from, to };
}

const DashboardPage = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [period, setPeriod] = useState<Period>("year");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  const dateFrom = useMemo(() => getDateRange(period), [period]);
  const prevRange = useMemo(() => getPreviousDateRange(period), [period]);

  const { data: departments } = useQuery({
    queryKey: ["dashboard-departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id, name_ar, code").order("code");
      return data || [];
    },
  });

  // Current period PVs
  const { data: pvData } = useQuery({
    queryKey: ["dashboard-pvs", dateFrom, departmentFilter],
    queryFn: async () => {
      let query = supabase
        .from("pv")
        .select("id, pv_number, pv_date, pv_type, case_status, parent_pv_id, total_actual_seizure, total_virtual_seizure, total_precautionary_seizure, total_seizure, department_id, departments(name_ar, code), officer_id, officers(full_name), customs_violation, currency_violation, public_law_violation, created_at")
        .gte("pv_date", dateFrom);
      if (departmentFilter !== "all") query = query.eq("department_id", departmentFilter);
      const { data } = await query;
      return data || [];
    },
  });

  // Previous period PVs for comparison
  const { data: prevPvData } = useQuery({
    queryKey: ["dashboard-prev-pvs", prevRange, departmentFilter],
    queryFn: async () => {
      if (!prevRange) return [];
      let query = supabase
        .from("pv")
        .select("id, total_seizure")
        .gte("pv_date", prevRange.from)
        .lte("pv_date", prevRange.to);
      if (departmentFilter !== "all") query = query.eq("department_id", departmentFilter);
      const { data } = await query;
      return data || [];
    },
    enabled: !!prevRange,
  });

  const { data: offenderCount } = useQuery({
    queryKey: ["dashboard-offenders", dateFrom, departmentFilter],
    queryFn: async () => {
      // Get offender count from PVs in the current period
      const pvIds = pvData?.map((p: any) => p.id) || [];
      if (pvIds.length === 0) return 0;
      const { count } = await supabase
        .from("offenders")
        .select("*", { count: "exact", head: true })
        .in("pv_id", pvIds);
      return count || 0;
    },
    enabled: !!pvData,
  });

  // Computed stats
  const stats = useMemo(() => {
    if (!pvData) return null;
    const totalPv = pvData.length;
    const parentPvCount = pvData.filter((p: any) => !p.parent_pv_id).length;
    const subPvCount = pvData.filter((p: any) => !!p.parent_pv_id).length;
    const totalSeizure = pvData.reduce((s, p: any) => s + (Number(p.total_seizure) || 0), 0);
    const totalActual = pvData.reduce((s, p: any) => s + (Number(p.total_actual_seizure) || 0), 0);
    const totalVirtual = pvData.reduce((s, p: any) => s + (Number(p.total_virtual_seizure) || 0), 0);
    const totalPrecautionary = pvData.reduce((s, p: any) => s + (Number(p.total_precautionary_seizure) || 0), 0);

    const prevTotal = prevPvData?.length || 0;
    const prevSeizure = prevPvData?.reduce((s, p: any) => s + (Number(p.total_seizure) || 0), 0) || 0;

    const pvTrend = prevTotal > 0 ? ((totalPv - prevTotal) / prevTotal * 100) : null;
    const seizureTrend = prevSeizure > 0 ? ((totalSeizure - prevSeizure) / prevSeizure * 100) : null;

    return {
      totalPv, parentPvCount, subPvCount, totalSeizure, totalActual, totalVirtual, totalPrecautionary,
      pvTrend, seizureTrend,
    };
  }, [pvData, prevPvData]);

  // Monthly trend
  const monthlyTrend = useMemo(() => {
    if (!pvData) return [];
    const months: Record<string, { month: string; count: number; seizure: number }> = {};
    const monthNames = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[key] = { month: monthNames[d.getMonth()], count: 0, seizure: 0 };
    }

    pvData.forEach((pv: any) => {
      const key = pv.pv_date?.substring(0, 7);
      if (key && months[key]) {
        months[key].count++;
        months[key].seizure += Number(pv.total_seizure) || 0;
      }
    });

    return Object.values(months);
  }, [pvData]);

  // Department data
  const deptData = useMemo(() => {
    if (!pvData) return [];
    const counts: Record<string, { name: string; count: number }> = {};
    pvData.forEach((pv: any) => {
      const key = pv.departments?.code || "UNK";
      if (!counts[key]) counts[key] = { name: pv.departments?.name_ar || key, count: 0 };
      counts[key].count++;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [pvData]);

  // Status distribution
  const statusDist = useMemo(() => {
    if (!pvData) return [];
    const counts: Record<string, number> = {};
    pvData.forEach((pv: any) => {
      const s = pv.case_status || "draft";
      counts[s] = (counts[s] || 0) + 1;
    });
    const labels: Record<string, string> = { draft: "مسودة", under_review: "قيد المراجعة", validated: "مصادق", archived: "مؤرشف" };
    const colors: Record<string, string> = { draft: CHART_COLORS[5], under_review: CHART_COLORS[2], validated: CHART_COLORS[1], archived: CHART_COLORS[3] };
    return Object.entries(counts).map(([status, value]) => ({
      name: labels[status] || status, value, color: colors[status] || CHART_COLORS[5],
    }));
  }, [pvData]);

  // Violation distribution
  const violationDist = useMemo(() => {
    if (!pvData) return [];
    let customs = 0, currency = 0, publicLaw = 0, other = 0;
    pvData.forEach((pv: any) => {
      if (pv.customs_violation) customs++;
      if (pv.currency_violation) currency++;
      if (pv.public_law_violation) publicLaw++;
      if (!pv.customs_violation && !pv.currency_violation && !pv.public_law_violation) other++;
    });
    return [
      { name: "ديوانية", value: customs, color: CHART_COLORS[0] },
      { name: "صرفية", value: currency, color: CHART_COLORS[2] },
      { name: "حق عام", value: publicLaw, color: CHART_COLORS[1] },
      { name: "أخرى", value: other, color: CHART_COLORS[5] },
    ].filter((v) => v.value > 0);
  }, [pvData]);

  // Recent PVs
  const recentPvs = useMemo(() => {
    if (!pvData) return [];
    return [...pvData]
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);
  }, [pvData]);

  // Top offenders
  const { data: topOffenders } = useQuery({
    queryKey: ["dashboard-top-offenders", dateFrom, departmentFilter],
    queryFn: async () => {
      const pvIds = pvData?.map((p: any) => p.id) || [];
      if (pvIds.length === 0) return [];
      const { data } = await supabase.from("offenders").select("name_or_company, pv_id").in("pv_id", pvIds);
      const counts: Record<string, { name: string; count: number }> = {};
      data?.forEach((o: any) => {
        const n = o.name_or_company;
        if (!counts[n]) counts[n] = { name: n, count: 0 };
        counts[n].count++;
      });
      return Object.values(counts).filter((o) => o.count > 1).sort((a, b) => b.count - a.count).slice(0, 6);
    },
    enabled: !!pvData && pvData.length > 0,
  });

  const trendText = (val: number | null) => {
    if (val === null) return undefined;
    const sign = val >= 0 ? "+" : "";
    return `${sign}${Math.round(val)}% مقارنة بالفترة السابقة`;
  };

  const periodLabels: Record<Period, string> = {
    month: "هذا الشهر",
    quarter: "هذا الثلاثي",
    year: "هذه السنة",
    all: "الكل",
  };

  const customTooltipStyle = {
    fontSize: 12, borderRadius: 8, border: "1px solid hsl(220, 13%, 90%)", boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  };

  return (
    <div className="p-6 space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">لوحة القيادة</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {profile?.full_name ? `مرحبا، ${profile.full_name}` : "نظرة عامة وطنية"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <Calendar className="h-3.5 w-3.5 ml-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">هذا الشهر</SelectItem>
              <SelectItem value="quarter">هذا الثلاثي</SelectItem>
              <SelectItem value="year">هذه السنة</SelectItem>
              <SelectItem value="all">الكل</SelectItem>
            </SelectContent>
          </Select>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
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
          <div className="flex items-center gap-2 text-xs text-muted-foreground surface-glass px-3 py-2">
            <Calendar className="h-3.5 w-3.5" />
            {new Date().toLocaleDateString("ar-TN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>
      </div>

      {/* Period indicator */}
      <div className="flex items-center gap-2 text-xs">
        <Activity className="h-3.5 w-3.5 text-primary" />
        <span className="text-muted-foreground">الفترة:</span>
        <span className="font-medium text-primary">{periodLabels[period]}</span>
        {departmentFilter !== "all" && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="font-medium">{departments?.find(d => d.id === departmentFilter)?.name_ar}</span>
          </>
        )}
      </div>

      {/* KPI Grid with trends */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
        <KpiCard className="animate-fade-in-up stagger-1" label="مجموع المحاضر" value={stats?.totalPv || 0} icon={FileText} variant="primary" trend={trendText(stats?.pvTrend ?? null)} />
        <KpiCard className="animate-fade-in-up stagger-2" label="محاضر رئيسية" value={stats?.parentPvCount || 0} icon={FileText} />
        <KpiCard className="animate-fade-in-up stagger-3" label="أضلع (فرعية)" value={stats?.subPvCount || 0} icon={FileText} />
        <KpiCard className="animate-fade-in-up stagger-4" label="المحجوز الكلي (د.ت)" value={fmt(stats?.totalSeizure || 0)} icon={Banknote} variant="success" trend={trendText(stats?.seizureTrend ?? null)} />
        <KpiCard className="animate-fade-in-up stagger-5" label="المخالفون" value={offenderCount || 0} icon={Users} />
        <KpiCard className="animate-fade-in-up stagger-6" label="متوسط المحجوز / محضر" value={stats && stats.totalPv > 0 ? fmt(Math.round(stats.totalSeizure / stats.totalPv)) : "—"} icon={TrendingUp} variant="primary" />
      </div>

      {/* Comparison bar if available */}
      {stats?.pvTrend !== null && stats?.pvTrend !== undefined && period !== "all" && (
        <div className="surface-glass p-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            {stats.pvTrend >= 0 ? (
              <TrendingUp className="h-5 w-5 text-success" />
            ) : (
              <TrendingDown className="h-5 w-5 text-destructive" />
            )}
            <span className="text-sm font-medium">
              مقارنة مع الفترة السابقة:
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-muted-foreground">المحاضر: </span>
              <span className={`font-bold ${stats.pvTrend >= 0 ? "text-success" : "text-destructive"}`}>
                {stats.pvTrend >= 0 ? "+" : ""}{Math.round(stats.pvTrend)}%
              </span>
              <span className="text-muted-foreground mr-1"> ({stats.totalPv} مقابل {prevPvData?.length || 0})</span>
            </div>
            {stats.seizureTrend !== null && stats.seizureTrend !== undefined && (
              <div>
                <span className="text-muted-foreground">المحجوزات: </span>
                <span className={`font-bold ${stats.seizureTrend >= 0 ? "text-success" : "text-destructive"}`}>
                  {stats.seizureTrend >= 0 ? "+" : ""}{Math.round(stats.seizureTrend)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Monthly Trend */}
      <div className="surface-glass p-5 animate-fade-in-up stagger-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">الاتجاه الشهري (12 شهرا)</h2>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-[3px] rounded-full" style={{ backgroundColor: CHART_COLORS[0] }} />
              عدد المحاضر
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-[3px] rounded-full" style={{ backgroundColor: CHART_COLORS[1] }} />
              المحجوزات
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={monthlyTrend}>
            <defs>
              <linearGradient id="gradCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.2} />
                <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradSeizure" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS[1]} stopOpacity={0.15} />
                <stop offset="100%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 92%)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={customTooltipStyle}
              formatter={(value: number, name: string) => [
                name === "count" ? value : fmt(value),
                name === "count" ? "عدد المحاضر" : "المحجوزات (د.ت)",
              ]}
            />
            <Area type="monotone" dataKey="count" stroke={CHART_COLORS[0]} fill="url(#gradCount)" strokeWidth={2.5} dot={{ r: 3, fill: CHART_COLORS[0], strokeWidth: 0 }} activeDot={{ r: 5 }} />
            <Area type="monotone" dataKey="seizure" stroke={CHART_COLORS[1]} fill="url(#gradSeizure)" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Row 2: Department + Violations + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="surface-glass p-5">
          <h2 className="text-sm font-semibold mb-4">المحاضر حسب القسم</h2>
          {deptData.length > 0 ? (
            <div dir="ltr">
              <ResponsiveContainer width="100%" height={Math.max(240, deptData.length * 44)}>
                <BarChart data={deptData} layout="vertical" barCategoryGap="25%" margin={{ left: 0, right: 4, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 92%)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" orientation="right" tick={{ fontSize: 10, fill: "hsl(220, 9%, 46%)" }} width={140} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={customTooltipStyle} formatter={(value: number) => [value, "العدد"]} />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]} name="العدد" barSize={20}>
                    {deptData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState />
          )}
        </div>

        <div className="surface-glass p-5">
          <h2 className="text-sm font-semibold mb-4">أنواع المخالفات</h2>
          {violationDist.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={violationDist} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3} strokeWidth={0}>
                    {violationDist.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={customTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center">
                {violationDist.map((v) => (
                  <div key={v.name} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: v.color }} />
                    <span className="text-muted-foreground">{v.name}</span>
                    <span className="font-mono-data font-medium">{v.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState />
          )}
        </div>

        <div className="surface-glass p-5">
          <h2 className="text-sm font-semibold mb-4">حالة الملفات</h2>
          {statusDist.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusDist} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3} strokeWidth={0}>
                    {statusDist.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={customTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center">
                {statusDist.map((v) => (
                  <div key={v.name} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: v.color }} />
                    <span className="text-muted-foreground">{v.name}</span>
                    <span className="font-mono-data font-medium">{v.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>

      {/* Seizure breakdown with highlighted total */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniSeizureCard label="المحجوز الفعلي" value={stats?.totalActual || 0} color={CHART_COLORS[0]} icon={Shield} />
        <MiniSeizureCard label="المحجوز الصوري" value={stats?.totalVirtual || 0} color={CHART_COLORS[3]} icon={BarChart3} />
        <MiniSeizureCard label="المحجوز التحفظي" value={stats?.totalPrecautionary || 0} color={CHART_COLORS[2]} icon={AlertTriangle} />
        <div className="surface-elevated p-4 border-2 border-primary bg-primary/5 rounded-xl flex items-center gap-3 ring-2 ring-primary/20 shadow-lg">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/15">
            <Banknote className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-primary font-semibold tracking-wide">المجموع الكلي (د.ت)</p>
            <p className="text-lg font-bold font-mono-data text-primary break-all leading-tight">{fmt(stats?.totalSeizure || 0)}</p>
          </div>
        </div>
      </div>

      {/* Row 3: Recent PVs + Top Offenders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="surface-glass p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">آخر المحاضر</h2>
            <button
              onClick={() => navigate("/pv")}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              عرض الكل
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-1">
            {recentPvs.map((pv: any) => (
              <div
                key={pv.id}
                className="flex items-center justify-between text-xs p-2.5 rounded-lg cursor-pointer hover:bg-muted/60 transition-colors"
                onClick={() => navigate(`/pv/${pv.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <span className="font-mono-data font-medium">{pv.pv_number}</span>
                    <div className="text-muted-foreground text-[10px] mt-0.5">
                      {pv.officers?.full_name || "—"} · {fmt(Number(pv.total_seizure) || 0)} د.ت
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={pv.case_status} />
                  <span className="text-muted-foreground text-[10px]">{pv.pv_date}</span>
                </div>
              </div>
            ))}
            {recentPvs.length === 0 && <EmptyState />}
          </div>
        </div>

        <div className="surface-glass p-5">
          <h2 className="text-sm font-semibold mb-4">المخالفون المتكررون</h2>
          {topOffenders && topOffenders.length > 0 ? (
            <div className="space-y-1">
              {topOffenders.map((o, i) => (
                <div key={o.name} className="flex items-center justify-between text-xs p-2.5 rounded-lg hover:bg-muted/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center font-mono-data text-[10px] font-bold text-destructive">
                      {i + 1}
                    </span>
                    <span className="font-medium truncate max-w-[220px]" dir="auto">{o.name}</span>
                  </div>
                  <span className="px-2.5 py-1 bg-destructive/10 text-destructive rounded-md font-mono-data text-[10px] font-bold">
                    {o.count} محضر
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
};

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
      <BarChart3 className="h-8 w-8 mb-2 opacity-30" />
      <p className="text-xs">لا توجد بيانات بعد</p>
    </div>
  );
}

function MiniSeizureCard({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: any }) {
  return (
    <div className="surface-elevated p-4 border flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
        <p className="text-lg font-bold font-mono-data break-all leading-tight">{fmt(value)}</p>
      </div>
    </div>
  );
}

export default DashboardPage;
