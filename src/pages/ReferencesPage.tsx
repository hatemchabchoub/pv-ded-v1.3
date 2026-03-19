import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, UserCheck, AlertTriangle, Package, PhoneForwarded, Briefcase, UserPlus, Users, Eye, EyeOff, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ReferenceTable, type ColumnDef } from "@/components/references/ReferenceTable";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AppRole = "admin" | "national_supervisor" | "department_supervisor" | "officer" | "viewer";

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "مدير",
  national_supervisor: "مشرف وطني",
  department_supervisor: "مشرف قسم",
  officer: "ضابط",
  viewer: "مطالع",
};

const ALL_ROLES: AppRole[] = ["admin", "national_supervisor", "department_supervisor", "officer", "viewer"];
const ROLE_OPTIONS = ALL_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

const fonctionColumns: ColumnDef[] = [
  { key: "label_ar", label: "التسمية (عربي)", required: true },
  { key: "label_fr", label: "التسمية (فرنسي)" },
  { key: "mapped_role", label: "الدور المرتبط", type: "select", options: ROLE_OPTIONS },
  { key: "active", label: "الحالة", type: "boolean" },
];

function useReferenceData(table: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let rows: any[] | null = null;
    const orderedQuery = await supabase.from(table as any).select("*").order("created_at", { ascending: false });
    if (orderedQuery.error) {
      const fallbackQuery = await supabase.from(table as any).select("*");
      rows = fallbackQuery.data || [];
    } else {
      rows = orderedQuery.data || [];
    }
    setData(rows);
    setLoading(false);
  }, [table]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (item: Record<string, any>) => {
    const { error } = await supabase.from(table as any).insert(item);
    if (error) throw error;
    await fetch();
  };

  const update = async (id: string, item: Record<string, any>) => {
    const { error } = await supabase.from(table as any).update(item).eq("id", id);
    if (error) throw error;
    await fetch();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) throw error;
    await fetch();
  };

  return { data, loading, add, update, remove, refetch: fetch };
}

const departmentColumns: ColumnDef[] = [
  { key: "code", label: "الرمز", required: true },
  { key: "name_fr", label: "الاسم (فرنسي)", required: true },
  { key: "name_ar", label: "الاسم (عربي)" },
  { key: "region", label: "الجهة" },
  { key: "active", label: "الحالة", type: "boolean" },
];

const officerColumns: ColumnDef[] = [
  { key: "full_name", label: "الاسم الكامل", required: true },
  { key: "badge_number", label: "رقم الشارة" },
  { key: "rank_label", label: "الرتبة" },
  { key: "fonction", label: "الوظيفة", type: "select" },
  { key: "department_id", label: "القسم", type: "select", hidden: true },
  { key: "active", label: "الحالة", type: "boolean" },
];

const violationColumns: ColumnDef[] = [
  { key: "code", label: "الرمز" },
  { key: "label_fr", label: "التسمية (فرنسي)", required: true },
  { key: "label_ar", label: "التسمية (عربي)" },
  { key: "category", label: "الفئة", type: "select", options: [
    { value: "customs", label: "جمركية" },
    { value: "currency", label: "صرف" },
    { value: "public_law", label: "قانون عام" },
  ]},
  { key: "legal_basis", label: "الأساس القانوني" },
  { key: "active", label: "الحالة", type: "boolean" },
];

const goodsColumns: ColumnDef[] = [
  { key: "category_fr", label: "الفئة (فرنسي)", required: true },
  { key: "category_ar", label: "الفئة (عربي)" },
  { key: "type_fr", label: "النوع (فرنسي)" },
  { key: "type_ar", label: "النوع (عربي)" },
  { key: "active", label: "الحالة", type: "boolean" },
];

const referralColumns: ColumnDef[] = [
  { key: "label_fr", label: "التسمية (فرنسي)", required: true },
  { key: "label_ar", label: "التسمية (عربي)" },
  { key: "active", label: "الحالة", type: "boolean" },
];

// Officers tab with account creation
function OfficersTab({
  officers,
  officerColumnsWithRefs,
  handleOfficerAdd,
  handleOfficerUpdate,
}: {
  officers: ReturnType<typeof useReferenceData>;
  officerColumnsWithRefs: ColumnDef[];
  handleOfficerAdd: (item: Record<string, any>) => Promise<void>;
  handleOfficerUpdate: (id: string, item: Record<string, any>) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [resultsDialog, setResultsDialog] = useState<any[] | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const createAccount = async (officerId: string) => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-officer-account", {
        body: { officer_ids: [officerId], mode: "single" },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      setResultsDialog(data.results);
      await officers.refetch();
      toast.success("تم إنشاء الحساب بنجاح");
    } catch (err: any) {
      toast.error("خطأ: " + (err.message || "خطأ غير معروف"));
    } finally {
      setCreating(false);
    }
  };

  const createAllAccounts = async () => {
    setBulkCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-officer-account", {
        body: { mode: "bulk" },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      setResultsDialog(data.results);
      await officers.refetch();
      const created = data.results.filter((r: any) => r.status === "created").length;
      toast.success(`تم إنشاء ${created} حساب(ات) بنجاح`);
    } catch (err: any) {
      toast.error("خطأ: " + (err.message || "خطأ غير معروف"));
    } finally {
      setBulkCreating(false);
    }
  };

  const togglePassword = (id: string) => {
    setShowPasswords((p) => ({ ...p, [id]: !p[id] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ");
  };

  const officersWithoutAccount = officers.data.filter((o) => !o.auth_user_id && o.active !== false);

  // Enhanced columns showing account status
  const enhancedColumns: ColumnDef[] = [
    ...officerColumnsWithRefs,
    { key: "_account_status", label: "الحساب", type: "text" },
  ];

  // Enhance data to show account status
  const enhancedData = officers.data.map((o) => ({
    ...o,
    _account_status: o.auth_user_id ? "مرتبط" : "بدون حساب",
  }));

  return (
    <div className="space-y-4">
      {/* Bulk action bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={createAllAccounts}
          disabled={bulkCreating || officersWithoutAccount.length === 0}
          variant="outline"
          size="sm"
          className="gap-1.5"
        >
          <Users className="h-4 w-4" />
          {bulkCreating ? "جارٍ الإنشاء..." : `إنشاء حسابات للجميع (${officersWithoutAccount.length})`}
        </Button>
        <span className="text-xs text-muted-foreground">
          {officers.data.filter((o) => o.auth_user_id).length} ضابط مرتبط بحساب من أصل {officers.data.length}
        </span>
      </div>

      <ReferenceTable
        {...officers}
        data={enhancedData}
        columns={enhancedColumns}
        onAdd={async (item) => {
          const { _account_status, ...cleanItem } = item;
          await handleOfficerAdd(cleanItem);
          // Auto-create account for new officer
          const { data: latestOfficers } = await supabase
            .from("officers")
            .select("id, auth_user_id, badge_number, full_name")
            .eq("full_name", cleanItem.full_name)
            .is("auth_user_id", null)
            .order("created_at", { ascending: false })
            .limit(1);
          if (latestOfficers && latestOfficers.length > 0) {
            const newOfficer = latestOfficers[0];
            try {
              const { data, error } = await supabase.functions.invoke("create-officer-account", {
                body: { officer_ids: [newOfficer.id], mode: "single" },
              });
              if (!error && data?.success) {
                setResultsDialog(data.results);
                await officers.refetch();
              }
            } catch { /* ignore */ }
          }
        }}
        onUpdate={async (id, item) => {
          const { _account_status, ...cleanItem } = item;
          await handleOfficerUpdate(id, cleanItem);
        }}
        onDelete={officers.remove}
      />

      {/* Results dialog */}
      <Dialog open={!!resultsDialog} onOpenChange={() => setResultsDialog(null)}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              نتائج إنشاء الحسابات
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الحالة</TableHead>
                  <TableHead>البريد</TableHead>
                  <TableHead>كلمة المرور</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultsDialog?.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Badge variant={r.status === "created" ? "default" : r.status === "skipped" ? "secondary" : "destructive"}>
                        {r.status === "created" ? "تم" : r.status === "skipped" ? "تخطي" : "خطأ"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.email || "—"}
                      {r.email && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 ms-1" onClick={() => copyToClipboard(r.email)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.password ? (
                        <span className="flex items-center gap-1">
                          {showPasswords[r.officer_id] ? r.password : "••••••••"}
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => togglePassword(r.officer_id)}>
                            {showPasswords[r.officer_id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(r.password)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </span>
                      ) : r.error || r.reason || "—"}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button onClick={() => setResultsDialog(null)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ReferencesPage() {
  const departments = useReferenceData("departments");
  const officers = useReferenceData("officers");
  const violations = useReferenceData("violation_reference");
  const goods = useReferenceData("goods_reference");
  const referrals = useReferenceData("referral_sources");
  const fonctions = useReferenceData("fonctions");

  // Build fonction options from DB
  const fonctionOptions = fonctions.data
    .filter((f) => f.active !== false)
    .map((f) => ({ value: f.label_ar, label: f.label_ar }));

  // Populate department select options for officers
  const deptOptions = departments.data.map((d) => ({ value: d.id, label: d.name_ar || d.name_fr }));

  const officerColumnsWithRefs = officerColumns.map((c) => {
    if (c.key === "department_id") return { ...c, options: deptOptions, hidden: false };
    if (c.key === "fonction") return { ...c, options: fonctionOptions };
    return c;
  });

  // Lookup mapped_role from fonctions table
  const fonctionToRole = (fonctionLabel: string): AppRole => {
    const found = fonctions.data.find((f) => f.label_ar === fonctionLabel);
    return (found?.mapped_role as AppRole) || "officer";
  };

  const assignRoleFromFonction = async (authUserId: string, fonction: string) => {
    const role = fonctionToRole(fonction);
    try {
      await supabase.from("user_roles").delete().eq("user_id", authUserId);
      await supabase.from("user_roles").insert({ user_id: authUserId, role });
      toast.success(`تم تعيين دور "${ROLE_LABELS[role]}" للمستخدم تلقائياً`);
    } catch (err: any) {
      toast.error("خطأ في تعيين الدور: " + (err.message || ""));
    }
  };

  const handleOfficerAdd = async (item: Record<string, any>) => {
    const { auth_user_id, ...rest } = item;
    await officers.add(rest);
  };

  const handleOfficerUpdate = async (id: string, item: Record<string, any>) => {
    const { auth_user_id, ...rest } = item;
    await officers.update(id, rest);
    // If officer has an auth_user_id and fonction changed, update role
    const officer = officers.data.find((o) => o.id === id);
    if (officer?.auth_user_id && item.fonction) {
      await assignRoleFromFonction(officer.auth_user_id, item.fonction);
    }
  };

  const tabs = [
    { id: "departments", label: "الأقسام", icon: Building2, content: <ReferenceTable {...departments} columns={departmentColumns} onAdd={departments.add} onUpdate={departments.update} onDelete={departments.remove} /> },
    {
      id: "officers", label: "الضباط", icon: UserCheck, content: (
        <OfficersTab
          officers={officers}
          officerColumnsWithRefs={officerColumnsWithRefs}
          handleOfficerAdd={handleOfficerAdd}
          handleOfficerUpdate={handleOfficerUpdate}
        />
      )
    },
    { id: "fonctions", label: "الوظائف", icon: Briefcase, content: <ReferenceTable {...fonctions} columns={fonctionColumns} onAdd={fonctions.add} onUpdate={fonctions.update} onDelete={fonctions.remove} /> },
    { id: "violations", label: "المخالفات", icon: AlertTriangle, content: <ReferenceTable {...violations} columns={violationColumns} onAdd={violations.add} onUpdate={violations.update} onDelete={violations.remove} /> },
    { id: "goods", label: "البضائع", icon: Package, content: <ReferenceTable {...goods} columns={goodsColumns} onAdd={goods.add} onUpdate={goods.update} onDelete={goods.remove} /> },
    { id: "referrals", label: "مصادر الإحالة", icon: PhoneForwarded, content: <ReferenceTable {...referrals} columns={referralColumns} onAdd={referrals.add} onUpdate={referrals.update} onDelete={referrals.remove} /> },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">المرجعيات</h1>
        <p className="text-sm text-muted-foreground mt-1">إدارة البيانات المرجعية للنظام</p>
      </div>

      <Tabs defaultValue="departments" dir="rtl">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 text-xs">
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-4">
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
