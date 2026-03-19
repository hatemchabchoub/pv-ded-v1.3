import type { PropsWithChildren } from "react";
import { NavLink } from "react-router-dom";
import { Shield, FileSpreadsheet, FileText, Users, Bell, LogOut, BarChart3, Search, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

type NavItem = {
  label: string;
  to: string;
  icon: typeof Shield;
  roles?: AppRole[];
};

const navItems: NavItem[] = [
  { label: "Tableau de bord", to: "/", icon: Shield },
  { label: "PV", to: "/pv", icon: FileText },
  { label: "Nouveau PV", to: "/pv/new", icon: ClipboardList, roles: ["admin", "officer", "department_supervisor"] },
  { label: "Import Excel", to: "/import/excel", icon: FileSpreadsheet, roles: ["admin", "officer", "department_supervisor"] },
  { label: "Rapports", to: "/reports", icon: BarChart3, roles: ["admin", "national_supervisor", "department_supervisor"] },
  { label: "Anomalies", to: "/anomalies", icon: Search, roles: ["admin", "national_supervisor", "department_supervisor"] },
  { label: "Références", to: "/references", icon: Bell, roles: ["admin"] },
  { label: "Utilisateurs", to: "/users", icon: Users, roles: ["admin"] },
];

function canSeeItem(item: NavItem, roles: AppRole[]) {
  if (!item.roles?.length) return true;
  return roles.some((role) => item.roles?.includes(role));
}

export default function AppLayout({ children }: PropsWithChildren) {
  const { profile, roles, signOut, user } = useAuth();

  const handleLogout = async () => {
    await signOut();
    toast.success("Déconnexion réussie");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-gradient-animated" aria-hidden="true" />
      <div className="pointer-events-none fixed inset-0 bg-pattern opacity-70" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="surface-glass sticky top-4 z-20 mb-6 rounded-[2rem] border border-border/60 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <img src="/logo-douane.png" alt="Logo Douane" className="h-14 w-14 rounded-2xl border border-border bg-card object-contain p-2" />
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Douane · Console</p>
                <p className="text-lg font-semibold">Gestion des procès-verbaux</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{profile?.full_name || user?.email}</span>
                <span className="mx-2 text-border">•</span>
                <span>{roles.length ? roles.join(" · ") : "Utilisateur"}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary lg:self-auto"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            </div>
          </div>
        </header>

        <nav className="mb-6 flex flex-wrap gap-3">
          {navItems.filter((item) => canSeeItem(item, roles)).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card/80 text-foreground hover:border-primary hover:text-primary",
                  ].join(" ")
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <main className="relative flex-1 pb-10">{children}</main>
      </div>
    </div>
  );
}
