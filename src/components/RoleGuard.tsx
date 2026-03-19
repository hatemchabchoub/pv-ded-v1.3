import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

type AppRole = "admin" | "national_supervisor" | "department_supervisor" | "officer" | "viewer";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
  fallback?: React.ReactNode;
}

export function RoleGuard({ children, allowedRoles, fallback }: RoleGuardProps) {
  const { roles, loading } = useAuth();

  if (loading) return null;

  const hasAccess = allowedRoles.some((r) => roles.includes(r));

  if (!hasAccess) {
    if (fallback) return <>{fallback}</>;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard
      allowedRoles={["admin"]}
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold text-destructive">غير مصرح لك</h2>
            <p className="text-sm text-muted-foreground">
              ليست لديك الصلاحيات اللازمة للوصول إلى هذه الصفحة.
            </p>
          </div>
        </div>
      }
    >
      {children}
    </RoleGuard>
  );
}