import { useState, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/StatusBadge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FilePlus, Search, Download, Eye, Pencil, Trash2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Printer,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, X,
} from "lucide-react";
import { exportPvToExcel } from "@/lib/excel-export";

type CaseStatus = "draft" | "under_review" | "validated" | "archived";
type SortDir = "asc" | "desc";
type SortCol = "pv_number" | "pv_date" | "total_actual_seizure" | "total_virtual_seizure" | "total_precautionary_seizure" | "total_seizure" | "pv_type" | "case_status";

// No pagination - fetch all rows

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-TN", { minimumFractionDigits: 3 }).format(value);

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  under_review: "قيد المراجعة",
  validated: "مصادق عليه",
  archived: "مؤرشف",
};

const TYPE_LABELS: Record<string, string> = {
  "محضر": "محضر",
  "ضلع": "ضلع",
  "معاينة": "معاينة",
  "إستدراك": "إستدراك",
};

// Sortable column header component
function SortableHead({
  label,
  column,
  currentSort,
  currentDir,
  onSort,
  className,
  children,
}: {
  label: string;
  column: SortCol;
  currentSort: SortCol;
  currentDir: SortDir;
  onSort: (col: SortCol) => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const isActive = currentSort === column;
  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(column)}
        className="flex items-center gap-1 hover:text-foreground transition-colors w-full"
      >
        <span>{label}</span>
        {isActive ? (
          currentDir === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </button>
      {children}
    </TableHead>
  );
}

const PvListPage = () => {
  const { user, profile, roles, isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [officerFilter, setOfficerFilter] = useState<string>("all");
  
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [sortCol, setSortCol] = useState<SortCol>("pv_number");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const queryClient = useQueryClient();

  // Drag-and-drop state for parent-child linking
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragSourceRef = useRef<{ id: string; pvNumber: string } | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkPayload, setLinkPayload] = useState<{ childId: string; childNumber: string; parentId: string; parentNumber: string } | null>(null);
  const [linking, setLinking] = useState(false);

  const isNationalSupervisor = roles.includes("national_supervisor");
  const isDeptSupervisor = roles.includes("department_supervisor");
  const isOfficer = roles.includes("officer");
  const isViewer = roles.includes("viewer");

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
    
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setDeptFilter("all");
    setOfficerFilter("all");
    
  };

  const hasActiveFilters = search || statusFilter !== "all" || typeFilter !== "all" || deptFilter !== "all" || officerFilter !== "all";

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await exportPvToExcel({ statusFilter, search, typeFilter, deptFilter, officerFilter });
      toast.success("تم تصدير الملف بنجاح");
    } catch (err: any) {
      toast.error(err.message || "خطأ في التصدير");
    } finally {
      setExporting(false);
    }
  }, [statusFilter, search, typeFilter, deptFilter, officerFilter]);

  // Fetch departments for filter
  const { data: departments } = useQuery({
    queryKey: ["departments-list"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id, name_ar, name_fr, code").eq("active", true).order("name_fr");
      return data || [];
    },
  });

  // Fetch officers for filter
  const { data: officers } = useQuery({
    queryKey: ["officers-list"],
    queryFn: async () => {
      const { data } = await supabase.from("officers").select("id, full_name, department_id").eq("active", true).order("full_name");
      return data || [];
    },
  });

  // Filter officers by selected department
  const filteredOfficers = useMemo(() => {
    if (!officers) return [];
    if (deptFilter === "all") return officers;
    return officers.filter(o => o.department_id === deptFilter);
  }, [officers, deptFilter]);

  const { data: pvData, isLoading } = useQuery({
    queryKey: ["pv-list", statusFilter, typeFilter, deptFilter, officerFilter, search, sortCol, sortDir, user?.id, profile?.department_id, roles],
    queryFn: async () => {
      const allRows: any[] = [];
      let from = 0;
      const chunkSize = 1000;

      while (true) {
        let query = supabase
          .from("pv")
          .select(`
            id, internal_reference, pv_number, pv_date, case_status, pv_type, parent_pv_id,
            total_actual_seizure, total_virtual_seizure, total_precautionary_seizure, total_seizure,
            customs_violation, currency_violation, public_law_violation, seizure_renewal,
            source_import_type, notes, created_at, department_id, officer_id,
            departments (id, name_fr, name_ar, code),
            officers (id, full_name, badge_number, rank_label)
          `)
          .order(sortCol, { ascending: sortDir === "asc" })
          .range(from, from + chunkSize - 1);

        if (isAdmin || isNationalSupervisor) {
          // see all
        } else if (isDeptSupervisor || isViewer) {
          if (profile?.department_id) query = query.eq("department_id", profile.department_id);
        } else if (isOfficer) {
          if (user?.id) query = query.eq("created_by", user.id);
        }

        if (statusFilter !== "all") query = query.eq("case_status", statusFilter);
        if (typeFilter !== "all") query = query.eq("pv_type", typeFilter);
        if (deptFilter !== "all") query = query.eq("department_id", deptFilter);
        if (officerFilter !== "all") query = query.eq("officer_id", officerFilter);
        if (search) query = query.or(`pv_number.ilike.%${search}%,internal_reference.ilike.%${search}%`);

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < chunkSize) break;
        from += chunkSize;
      }

      return { data: allRows, count: allRows.length };
    },
  });

  const pvIds = pvData?.data?.map((p: any) => p.id) || [];

  const { data: violationsByPv } = useQuery({
    queryKey: ["violation-labels", pvIds],
    enabled: pvIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("violations")
        .select("pv_id, violation_label")
        .in("pv_id", pvIds);
      const map: Record<string, string[]> = {};
      data?.forEach(v => {
        if (!map[v.pv_id]) map[v.pv_id] = [];
        if (!map[v.pv_id].includes(v.violation_label)) map[v.pv_id].push(v.violation_label);
      });
      return map;
    },
  });

  

  // Group PVs: parent PVs first, children under them
  const groupedPvs = useMemo(() => {
    if (!pvData?.data) return [];
    const all = pvData.data as any[];
    const parents = all.filter(p => !p.parent_pv_id);
    const childrenMap: Record<string, any[]> = {};
    all.filter(p => p.parent_pv_id).forEach(p => {
      if (!childrenMap[p.parent_pv_id]) childrenMap[p.parent_pv_id] = [];
      childrenMap[p.parent_pv_id].push(p);
    });
    const orphanChildren = all.filter(p => p.parent_pv_id && !parents.find(pp => pp.id === p.parent_pv_id));

    const result: { pv: any; isChild: boolean; childCount: number; isExpanded: boolean }[] = [];
    parents.forEach(p => {
      const children = childrenMap[p.id] || [];
      const isExpanded = expandedGroups.has(p.id);
      result.push({ pv: p, isChild: false, childCount: children.length, isExpanded });
      // Always include children in DOM; hide via CSS when not expanded (show in print)
      children.forEach(c => result.push({ pv: c, isChild: true, childCount: 0, isExpanded }));
    });
    orphanChildren.forEach(c => result.push({ pv: c, isChild: true, childCount: 0, isExpanded: true }));
    return result;
  }, [pvData?.data, expandedGroups]);

  const toggleGroup = (parentId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId); else next.add(parentId);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Drag-and-drop handlers for parent-child linking
  const handleDragStart = (e: React.DragEvent, pvId: string, pvNumber: string) => {
    dragSourceRef.current = { id: pvId, pvNumber };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", pvId);
  };

  const handleDragOver = (e: React.DragEvent, pvId: string) => {
    e.preventDefault();
    if (dragSourceRef.current && dragSourceRef.current.id !== pvId) {
      setDragOverId(pvId);
      e.dataTransfer.dropEffect = "move";
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string, targetNumber: string) => {
    e.preventDefault();
    setDragOverId(null);
    if (!dragSourceRef.current || dragSourceRef.current.id === targetId) return;

    setLinkPayload({
      childId: dragSourceRef.current.id,
      childNumber: dragSourceRef.current.pvNumber,
      parentId: targetId,
      parentNumber: targetNumber,
    });
    setShowLinkDialog(true);
    dragSourceRef.current = null;
  };

  const handleDragEnd = () => {
    dragSourceRef.current = null;
    setDragOverId(null);
  };

  const confirmLink = async () => {
    if (!linkPayload) return;
    setLinking(true);
    try {
      const { error } = await supabase
        .from("pv")
        .update({ parent_pv_id: linkPayload.parentId, pv_type: "ضلع" })
        .eq("id", linkPayload.childId);
      if (error) throw error;
      toast.success(`تم ربط المحضر ${linkPayload.childNumber} كضلع للمحضر ${linkPayload.parentNumber}`);
      queryClient.invalidateQueries({ queryKey: ["pv-list"] });
    } catch (err: any) {
      toast.error(err.message || "خطأ في الربط");
    } finally {
      setLinking(false);
      setShowLinkDialog(false);
      setLinkPayload(null);
    }
  };

  const toggleSelectAll = () => {
    if (!pvData?.data) return;
    const allOnPage = pvData.data.map((p: any) => p.id);
    const allSelected = allOnPage.every((id: string) => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      allOnPage.forEach((id: string) => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from("pv").delete().in("id", ids);
      if (error) throw error;
      toast.success(`تم حذف ${ids.length} محضر بنجاح`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["pv-list"] });
    } catch (err: any) {
      toast.error(err.message || "خطأ في الحذف");
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const allOnPageSelected = pvData?.data && pvData.data.length > 0 &&
    pvData.data.every((p: any) => selectedIds.has(p.id));

  return (
    <div className="p-6 space-y-4 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">محاضر التحقيق</h1>
          <p className="text-sm text-muted-foreground">
            {pvData?.count || 0} سجل
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="h-4 w-4" />
              حذف ({selectedIds.size})
            </Button>
          )}
          <Link to="/pv/new">
            <Button size="sm" className="bg-gradient-to-l from-primary to-primary-glow hover:shadow-lg hover:shadow-primary/20 transition-all duration-300">
              <FilePlus className="h-4 w-4" />
              محضر جديد
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="surface-glass p-3 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بعدد المحضر أو المرجع..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); }}
              className="ps-9"
            />
          </div>

          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); }}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="النوع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأنواع</SelectItem>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={deptFilter} onValueChange={(v) => { setDeptFilter(v); setOfficerFilter("all"); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="القسم" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأقسام</SelectItem>
              {departments?.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name_ar || d.name_fr}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={officerFilter} onValueChange={(v) => { setOfficerFilter(v); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="الضابط" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الضباط</SelectItem>
              {filteredOfficers?.map(o => (
                <SelectItem key={o.id} value={o.id}>{o.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-destructive hover:text-destructive">
              <X className="h-3.5 w-3.5" />
              مسح الفلاتر
            </Button>
          )}

          <div className="flex-1" />

          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4" />
            {exporting ? "جاري التصدير..." : "تصدير"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            طباعة
          </Button>
        </div>

        {/* Active filters summary */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            {search && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-primary/10 text-primary rounded-full px-2.5 py-0.5">
                بحث: {search}
                <button onClick={() => setSearch("")}><X className="h-3 w-3" /></button>
              </span>
            )}
            {typeFilter !== "all" && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-primary/10 text-primary rounded-full px-2.5 py-0.5">
                النوع: {TYPE_LABELS[typeFilter] || typeFilter}
                <button onClick={() => setTypeFilter("all")}><X className="h-3 w-3" /></button>
              </span>
            )}
            {deptFilter !== "all" && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-primary/10 text-primary rounded-full px-2.5 py-0.5">
                القسم: {departments?.find(d => d.id === deptFilter)?.name_ar || "—"}
                <button onClick={() => setDeptFilter("all")}><X className="h-3 w-3" /></button>
              </span>
            )}
            {officerFilter !== "all" && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-primary/10 text-primary rounded-full px-2.5 py-0.5">
                الضابط: {officers?.find(o => o.id === officerFilter)?.full_name || "—"}
                <button onClick={() => setOfficerFilter("all")}><X className="h-3 w-3" /></button>
              </span>
            )}
            {statusFilter !== "all" && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-primary/10 text-primary rounded-full px-2.5 py-0.5">
                الحالة: {STATUS_LABELS[statusFilter]}
                <button onClick={() => setStatusFilter("all")}><X className="h-3 w-3" /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="surface-glass overflow-hidden print-list">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 no-print-col">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <SortableHead label="النوع" column="pv_type" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} />
              <SortableHead label="عدد المحضر" column="pv_number" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} />
              <SortableHead label="التاريخ" column="pv_date" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} />
              <TableHead>القسم</TableHead>
              <TableHead>الضابط</TableHead>
              <TableHead className="min-w-[200px]">المخالفات</TableHead>
              <SortableHead label="حجز فعلي" column="total_actual_seizure" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} className="text-end" />
              <SortableHead label="حجز صوري" column="total_virtual_seizure" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} className="text-end" />
              <SortableHead label="حجز تحفظي" column="total_precautionary_seizure" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} className="text-end" />
              <SortableHead label="المجموع" column="total_seizure" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} className="text-end" />
              <SortableHead label="الحالة" column="case_status" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} />
              <TableHead className="w-[100px] no-print-col">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                  جاري التحميل...
                </TableCell>
              </TableRow>
            ) : (pvData?.data?.length || 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                  لا توجد سجلات
                </TableCell>
              </TableRow>
            ) : groupedPvs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                  لا توجد سجلات
                </TableCell>
              </TableRow>
            ) : (
              groupedPvs.map(({ pv, isChild, childCount, isExpanded }) => (
                <TableRow key={pv.id} className={`${selectedIds.has(pv.id) ? "bg-muted/50" : ""} ${isChild ? "bg-muted/20" : ""} ${isChild && !isExpanded ? "hidden print:table-row" : ""}`}>
                  <TableCell className="no-print-col">
                    <Checkbox
                      checked={selectedIds.has(pv.id)}
                      onCheckedChange={() => toggleSelect(pv.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {!isChild && childCount > 0 && (
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => toggleGroup(pv.id)}>
                          {expandedGroups.has(pv.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </Button>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${pv.pv_type === "ضلع" ? "bg-accent/10 text-accent-foreground" : "bg-primary/10 text-primary"}`}>
                        {pv.pv_type || "محضر"}
                      </span>
                      {!isChild && childCount > 0 && (
                        <span className="text-[10px] text-muted-foreground">({childCount})</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell
                    className={`font-mono text-sm cursor-grab active:cursor-grabbing select-none transition-colors ${dragOverId === pv.id ? "bg-primary/20 ring-2 ring-primary/40 ring-inset" : ""}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, pv.id, pv.pv_number)}
                    onDragOver={(e) => handleDragOver(e, pv.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, pv.id, pv.pv_number)}
                    onDragEnd={handleDragEnd}
                    title="اسحب إلى محضر آخر لربطه كضلع"
                  >
                    {pv.pv_number}
                  </TableCell>
                  <TableCell className="text-sm">{pv.pv_date}</TableCell>
                  <TableCell className="text-xs">
                    {isChild && <span className="text-muted-foreground me-1">↳</span>}
                    {(pv as any).departments?.name_ar || (pv as any).departments?.name_fr || "—"}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{pv.officers?.full_name || '—'}</TableCell>
                  <TableCell className="text-xs max-w-[220px]">
                    {violationsByPv?.[pv.id]?.length ? (
                      <div className="space-y-0.5">
                        {violationsByPv[pv.id].map((label, i) => (
                          <span key={i} className="inline-block bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px] me-1 mb-0.5">{label}</span>
                        ))}
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-end font-mono text-sm">{formatCurrency(pv.total_actual_seizure || 0)}</TableCell>
                  <TableCell className="text-end font-mono text-sm">{formatCurrency(pv.total_virtual_seizure || 0)}</TableCell>
                  <TableCell className="text-end font-mono text-sm">{formatCurrency(pv.total_precautionary_seizure || 0)}</TableCell>
                  <TableCell className="text-end font-mono text-sm font-semibold">{formatCurrency(pv.total_seizure || 0)}</TableCell>
                  <TableCell><StatusBadge status={pv.case_status as CaseStatus} /></TableCell>
                  <TableCell className="no-print-col">
                    <div className="flex items-center gap-1">
                      <Link to={`/pv/${pv.id}`}><Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button></Link>
                      <Link to={`/pv/${pv.id}/edit`}><Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button></Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex items-center px-4 py-3 border-t no-print">
          <p className="text-xs text-muted-foreground">
            {pvData?.count || 0} سجل
          </p>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف {selectedIds.size} محضر؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "جاري الحذف..." : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Link parent-child confirmation dialog */}
      <AlertDialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ربط محضر كضلع</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>هل تريد ربط المحضر:</span>
              <span className="block font-mono font-semibold text-foreground">{linkPayload?.childNumber}</span>
              <span>كضلع للمحضر الأب:</span>
              <span className="block font-mono font-semibold text-foreground">{linkPayload?.parentNumber}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={linking}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLink} disabled={linking}>
              {linking ? "جاري الربط..." : "تأكيد الربط"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PvListPage;
