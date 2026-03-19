import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const [email, setEmail] = useState("admin@douane.app");
  const [password, setPassword] = useState("Admin2025!");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast.error(error);
    } else {
      toast.success("Connexion réussie");
    }

    setSubmitting(false);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-gradient-animated" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-pattern opacity-70" aria-hidden="true" />

      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="surface-glass rounded-[2rem] border border-border/60 p-8 lg:p-12">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-primary">Plateforme Douane</p>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight md:text-6xl">Pilotage centralisé des procès-verbaux.</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
            Suivi des saisies, contrôle des anomalies, consolidation des rapports et accès sécurisé selon les rôles.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ["Accès sécurisé", "Authentification par compte habilité"],
              ["Contrôle terrain", "Saisie et édition rapides des PV"],
              ["Vision nationale", "Rapports et supervision consolidés"],
            ].map(([title, text]) => (
              <article key={title} className="rounded-[1.5rem] border border-border bg-card/80 p-4">
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="surface-elevated rounded-[2rem] border border-border p-8 lg:p-10">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Connexion admin</p>
              <p className="text-sm text-muted-foreground">Entrez vos identifiants pour accéder à l’application.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-input bg-background px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
                placeholder="admin@douane.app"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">Mot de passe</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-input bg-background px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
