import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="surface-elevated w-full max-w-xl rounded-[2rem] border border-border p-8 text-center">
        <p className="text-sm font-medium text-primary">Erreur 404</p>
        <h1 className="mt-3 text-4xl font-semibold">Page introuvable</h1>
        <p className="mt-4 leading-7 text-muted-foreground">La route demandée n’existe pas ou n’est pas encore disponible dans cette version.</p>
        <Link to="/" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90">
          Retour à l’accueil
        </Link>
      </section>
    </main>
  );
}
