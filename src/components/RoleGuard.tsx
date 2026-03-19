import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

type RoleGuardProps = PropsWithChildren<{
  allowedRoles: AppRole[];
}>;

function AccessDenied() {
  return (
    <section className="surface-elevated mx-auto max-w-3xl rounded-3xl border border-border p-8 text-center">
      <p className="text-sm font-medium text-accent">Accès restreint</p>
      <h1 className="mt-3 text-3xl font-semibold text-foreground">Vous n’avez pas les droits pour ouvrir cette section.</h1>
      <p className="mt-3 text-muted-foreground">Connectez-vous avec un compte autorisé ou revenez au tableau de bord.</p>
      <Link
        to="/"
        className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
      >
        Retour au tableau de bord
      </Link>
    </section>
  );
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { loading, roles } = useAuth();

  if (loading) {
    return <div className="text-sm text-muted-foreground">Vérification des accès...</div>;
  }

  const isAllowed = roles.some((role) => allowedRoles.includes(role));
  return isAllowed ? <>{children}</> : <AccessDenied />;
}

export function AdminGuard({ children }: PropsWithChildren) {
  return <RoleGuard allowedRoles={["admin"]}>{children}</RoleGuard>;
}
