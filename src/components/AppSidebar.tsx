import {
  LayoutDashboard,
  FileText,
  FilePlus,
  Upload,
  FileSpreadsheet,
  BarChart3,
  Users,
  Shield,
  AlertTriangle,
  LogOut,
  Database,
  DatabaseBackup,
  User,
  Sparkles,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

type AppRole = "admin" | "national_supervisor" | "department_supervisor" | "officer" | "viewer";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AppRole[];
}

const mainItems: NavItem[] = [
  { title: "لوحة القيادة", url: "/", icon: LayoutDashboard },
  { title: "المحاضر", url: "/pv", icon: FileText },
  { title: "محضر جديد", url: "/pv/new", icon: FilePlus, roles: ["admin", "officer", "department_supervisor"] },
];

const importItems: NavItem[] = [
  { title: "استيراد PDF / OCR", url: "/import/pdf", icon: Upload, roles: ["admin", "officer", "department_supervisor"] },
  { title: "استيراد Excel", url: "/import/excel", icon: FileSpreadsheet, roles: ["admin", "officer", "department_supervisor"] },
];

const analysisItems: NavItem[] = [
  { title: "التقارير", url: "/reports", icon: BarChart3, roles: ["admin", "national_supervisor", "department_supervisor"] },
  { title: "الشذوذ", url: "/anomalies", icon: AlertTriangle, roles: ["admin", "national_supervisor", "department_supervisor"] },
];

const adminItems: NavItem[] = [
  { title: "المرجعيات", url: "/references", icon: Database, roles: ["admin"] },
  { title: "المستخدمون", url: "/users", icon: Users, roles: ["admin"] },
  { title: "سجل المراجعة", url: "/audit", icon: Shield, roles: ["admin", "national_supervisor"] },
  { title: "النسخ الاحتياطي", url: "/backup", icon: DatabaseBackup, roles: ["admin"] },
];

export function AppSidebar() {
  const { signOut, profile, roles, user } = useAuth();

  const filterByRole = (items: NavItem[]) =>
    items.filter((item) => !item.roles || item.roles.some((r) => roles.includes(r)));

  const renderGroup = (label: string, items: NavItem[]) => {
    const filtered = filterByRole(items);
    if (filtered.length === 0) return null;
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="text-sidebar-foreground/30 text-[10px] uppercase tracking-[0.15em] px-3 font-medium">
          {label}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {filtered.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild>
                  <NavLink
                    to={item.url}
                    end={item.url === "/"}
                    className="hover:bg-sidebar-accent/80 text-sidebar-foreground/60 hover:text-sidebar-foreground transition-all duration-200 rounded-xl mx-1 backdrop-blur-sm"
                    activeClassName="bg-gradient-to-l from-sidebar-primary to-sidebar-primary/80 text-sidebar-primary-foreground font-medium shadow-lg shadow-sidebar-primary/25"
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  const roleLabels: Record<string, string> = {
    admin: "مدير",
    national_supervisor: "مشرف وطني",
    department_supervisor: "مشرف قسم",
    officer: "ضابط",
    viewer: "مطالع",
  };

  return (
    <Sidebar side="right" collapsible="none">
      <SidebarContent className="relative overflow-hidden">
        {/* Decorative gradient orb */}
        <div className="absolute -top-20 -start-20 w-40 h-40 rounded-full bg-sidebar-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 -end-10 w-32 h-32 rounded-full bg-accent/5 blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="p-4 pb-6 relative">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <img src="/logo-douane.png" alt="شعار الديوانة التونسية" className="w-16 h-16 rounded-xl object-contain relative z-10 transition-transform duration-300 group-hover:scale-105" />
            </div>
            <div>
              <span className="font-bold text-sm text-sidebar-foreground tracking-tight leading-tight flex items-center gap-1.5">
                إدارة الأبحاث
                <Sparkles className="h-3 w-3 text-accent animate-pulse-soft" />
              </span>
              <span className="text-[10px] block text-sidebar-foreground/35 mt-0.5">الديوانة التونسية</span>
            </div>
          </div>
        </div>

        {renderGroup("العمليات", mainItems)}
        {renderGroup("الاستيراد", importItems)}
        {renderGroup("التحليل", analysisItems)}
        {renderGroup("الإدارة", adminItems)}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sidebar-primary/30 to-sidebar-accent flex items-center justify-center ring-1 ring-sidebar-foreground/10">
                  <User className="h-4 w-4 text-sidebar-foreground/70" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-sidebar-foreground truncate">
                    {profile?.full_name || user?.email || "مستخدم"}
                  </p>
                  <p className="text-[10px] text-sidebar-foreground/35">
                    {roleLabels[roles[0]] || roles[0] || "ضابط"}
                  </p>
                </div>
              </div>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => signOut()}
              className="text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-destructive/10 mx-1 rounded-xl transition-all duration-200"
            >
              <LogOut className="h-4 w-4" />
              <span>تسجيل الخروج</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}