import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Search, UserCog, ShieldCheck, Eye, EyeOff, Copy } from "lucide-react";

type AppRole = "admin" | "national_supervisor" | "department_supervisor" | "officer" | "viewer";

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "مدير",
  national_supervisor: "مشرف وطني",
  department_supervisor: "مشرف قسم",
  officer: "ضابط",
  viewer: "مطالع",
};

interface FonctionRow {
  id: string;
  label_ar: string;
  label_fr: string | null;
  mapped_role: string | null;
  active: boolean | null;
}

interface UserRow {
  id: string;
  auth_user_id: string;
  full_name: string | null;
  email: string | null;
  department_id: string | null;
  unit_id: string | null;
  active: boolean | null;
  roles: AppRole[];
  department_name?: string;
  officer_id?: string;
  officer_fonction?: string;
  generated_email?: string;
  initial_password?: string;
}

export default function UsersManagementPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [selectedFonction, setSelectedFonction] = useState<string>("");
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [userActive, setUserActive] = useState(true);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>("");

  // Fetch fonctions (dynamic roles)
  const { data: fonctions } = useQuery({
    queryKey: ["fonctions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fonctions")
        .select("id, label_ar, label_fr, mapped_role, active")
        .eq("active", true)
        .order("label_ar");
      if (error) throw error;
      return data as FonctionRow[];
    },
  });

  // Fetch departments
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name_fr, name_ar, code")
        .eq("active", true)
        .order("name_fr");
      if (error) throw error;
      return data;
    },
  });

  // Fetch units
  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units")
        .select("id, name_fr, name_ar, code, department_id")
        .eq("active", true)
        .order("name_fr");
      if (error) throw error;
      return data;
    },
  });

  // Fetch all users with roles + officer data
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("*, departments(name_fr, name_ar)")
        .order("full_name");
      if (pErr) throw pErr;

      const { data: allRoles, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rErr) throw rErr;

      // Fetch officers to link credentials
      const { data: allOfficers } = await supabase
        .from("officers")
        .select("id, auth_user_id, fonction, generated_email, initial_password");

      const roleMap = new Map<string, AppRole[]>();
      allRoles?.forEach((r: any) => {
        const existing = roleMap.get(r.user_id) || [];
        existing.push(r.role);
        roleMap.set(r.user_id, existing);
      });

      const officerMap = new Map<string, any>();
      allOfficers?.forEach((o: any) => {
        if (o.auth_user_id) officerMap.set(o.auth_user_id, o);
      });

      return (profiles || []).map((p: any) => {
        const officer = officerMap.get(p.auth_user_id);
        return {
          id: p.id,
          auth_user_id: p.auth_user_id,
          full_name: p.full_name,
          email: p.email,
          department_id: p.department_id,
          unit_id: p.unit_id,
          active: p.active,
          roles: roleMap.get(p.auth_user_id) || [],
          department_name: p.departments?.name_ar || p.departments?.name_fr || null,
          officer_id: officer?.id,
          officer_fonction: officer?.fonction,
          generated_email: officer?.generated_email,
          initial_password: officer?.initial_password,
        };
      }) as UserRow[];
    },
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async ({
      user, roles, departmentId, unitId, active,
    }: {
      user: UserRow;
      roles: AppRole[];
      departmentId: string | null;
      unitId?: string | null;
      active: boolean;
    }) => {
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ department_id: departmentId || null, unit_id: unitId || null, active })
        .eq("id", user.id);
      if (profileErr) throw profileErr;

      // Use security definer function to update roles atomically
      const { error: rolesErr } = await supabase.rpc("admin_update_user_roles", {
        _target_user_id: user.auth_user_id,
        _roles: roles,
      });
      if (rolesErr) throw rolesErr;
    },
    onSuccess: () => {
      toast.success("تم تحديث المستخدم بنجاح");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditUser(null);
    },
    onError: (err: any) => {
      toast.error("خطأ: " + (err.message || "خطأ غير معروف"));
    },
  });

  const openEdit = (user: UserRow) => {
    setEditUser(user);
    const userRole = user.roles[0];
    const matchingFonction = fonctions?.find((f) => f.mapped_role === userRole);
    setSelectedFonction(matchingFonction?.id || "");
    setSelectedDept(user.department_id || "");
    setSelectedUnit(user.unit_id || "");
    setSelectedRoles([...user.roles]);
    setUserActive(user.active !== false);
  };

  const toggleRole = (role: AppRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const filteredUnits = units?.filter(
    (u) => !selectedDept || selectedDept === "none" || u.department_id === selectedDept
  );

  const handleSave = () => {
    if (!editUser) return;
    // If no roles manually selected, fall back to fonction's mapped role
    let rolesToSave = selectedRoles;
    if (rolesToSave.length === 0 && selectedFonction && selectedFonction !== "none") {
      const selectedFonctionData = fonctions?.find((f) => f.id === selectedFonction);
      const mappedRole = (selectedFonctionData?.mapped_role as AppRole) || "officer";
      rolesToSave = [mappedRole];
    }
    saveMutation.mutate({
      user: editUser,
      roles: rolesToSave,
      departmentId: selectedDept === "none" ? null : selectedDept || null,
      unitId: selectedUnit === "none" ? null : selectedUnit || null,
      active: userActive,
    });
  };

  const togglePassword = (id: string) => {
    setShowPasswords((p) => ({ ...p, [id]: !p[id] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ");
  };

  const filtered = (users || []).filter((u) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s) ||
      u.department_name?.toLowerCase().includes(s) ||
      u.generated_email?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            إدارة المستخدمين
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            عرض وتعديل الأدوار والأقسام لجميع المستخدمين
          </p>
        </div>
        <div className="relative">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو البريد..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pe-9 w-64"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="surface-elevated p-8 text-center text-sm text-muted-foreground">
          جاري التحميل...
        </div>
      ) : (
        <div className="surface-elevated rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>البريد / المعرف</TableHead>
                <TableHead>كلمة المرور</TableHead>
                <TableHead>القسم</TableHead>
                <TableHead>الوظيفة</TableHead>
                <TableHead>الأدوار</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="w-[80px]">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    لا يوجد مستخدمون
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">
                      <div className="flex items-center gap-1">
                        {user.generated_email || user.email || "—"}
                        {(user.generated_email || user.email) && (
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(user.generated_email || user.email || "")}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {user.initial_password ? (
                        <div className="flex items-center gap-1">
                          <span>{showPasswords[user.id] ? user.initial_password : "••••••••"}</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => togglePassword(user.id)}>
                            {showPasswords[user.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(user.initial_password!)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{user.department_name || "—"}</TableCell>
                    <TableCell>
                      <span className="text-xs">{user.officer_fonction || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length === 0 ? (
                          <span className="text-xs text-muted-foreground">بدون دور</span>
                        ) : (
                          user.roles.map((role) => (
                            <Badge
                              key={role}
                              variant={role === "admin" ? "default" : "secondary"}
                              className="text-[10px]"
                            >
                              {ROLE_LABELS[role]}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.active !== false ? "default" : "destructive"} className="text-[10px]">
                        {user.active !== false ? "نشط" : "معطل"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              تعديل المستخدم — الصلاحيات والتعيينات
            </DialogTitle>
          </DialogHeader>

          {editUser && (
            <div className="space-y-5 py-2">
              {/* User info */}
              <div className="space-y-1 p-3 bg-muted/50 rounded-md">
                <p className="text-sm font-medium">{editUser.full_name || "—"}</p>
                <p className="text-xs text-muted-foreground">{editUser.generated_email || editUser.email}</p>
                {editUser.officer_fonction && (
                  <p className="text-xs text-muted-foreground">الوظيفة: {editUser.officer_fonction}</p>
                )}
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between">
                <Label>الحساب نشط</Label>
                <Switch checked={userActive} onCheckedChange={setUserActive} />
              </div>

              {/* Department */}
              <div className="space-y-2">
                <Label>القسم</Label>
                <Select value={selectedDept} onValueChange={(v) => { setSelectedDept(v); setSelectedUnit(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختيار القسم" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— بدون قسم —</SelectItem>
                    {departments?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name_ar || d.name_fr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Unit */}
              <div className="space-y-2">
                <Label>الوحدة</Label>
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختيار الوحدة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— بدون وحدة —</SelectItem>
                    {filteredUnits?.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name_ar || u.name_fr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fonction */}
              <div className="space-y-2">
                <Label>الوظيفة</Label>
                <Select value={selectedFonction} onValueChange={(v) => {
                  setSelectedFonction(v);
                  // Auto-set the mapped role when selecting a fonction
                  if (v && v !== "none") {
                    const f = fonctions?.find((fn) => fn.id === v);
                    if (f?.mapped_role) {
                      const role = f.mapped_role as AppRole;
                      if (!selectedRoles.includes(role)) {
                        setSelectedRoles((prev) => [...prev, role]);
                      }
                    }
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختيار الوظيفة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— بدون وظيفة —</SelectItem>
                    {fonctions?.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.label_ar}
                        {f.mapped_role && (
                          <span className="text-muted-foreground text-xs ms-2">
                            ({ROLE_LABELS[f.mapped_role as AppRole] || f.mapped_role})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Roles / Privileges */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">الصلاحيات والأدوار</Label>
                <div className="grid grid-cols-1 gap-2 p-3 border rounded-md bg-muted/30">
                  {(Object.entries(ROLE_LABELS) as [AppRole, string][]).map(([role, label]) => (
                    <div key={role} className="flex items-center gap-3">
                      <Checkbox
                        id={`role-${role}`}
                        checked={selectedRoles.includes(role)}
                        onCheckedChange={() => toggleRole(role)}
                      />
                      <label htmlFor={`role-${role}`} className="text-sm cursor-pointer flex items-center gap-2">
                        <Badge variant={role === "admin" ? "default" : "secondary"} className="text-[10px]">
                          {label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {role === "admin" && "— وصول كامل لجميع الوظائف"}
                          {role === "national_supervisor" && "— إشراف وطني على جميع الأقسام"}
                          {role === "department_supervisor" && "— إشراف على قسم محدد"}
                          {role === "officer" && "— إنشاء وتعديل المحاضر"}
                          {role === "viewer" && "— عرض فقط بدون تعديل"}
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
                {selectedRoles.length === 0 && (
                  <p className="text-xs text-destructive">⚠ يجب اختيار دور واحد على الأقل</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
