import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Mot de passe mis à jour");
      setPassword("");
    }

    setSubmitting(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="surface-elevated w-full max-w-md rounded-[2rem] border border-border p-8">
        <p className="text-sm font-medium text-primary">Sécurité du compte</p>
        <h1 className="mt-3 text-3xl font-semibold text-foreground">Réinitialiser le mot de passe</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Entrez un nouveau mot de passe puis revenez à la connexion.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="new-password" className="text-sm font-medium text-foreground">Nouveau mot de passe</label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-input bg-background px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
              minLength={8}
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting || password.length < 8}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Mise à jour..." : "Mettre à jour"}
          </button>
        </form>

        <Link to="/login" className="mt-4 inline-flex text-sm font-medium text-primary hover:underline">
          Retour à la connexion
        </Link>
      </section>
    </main>
  );
}
