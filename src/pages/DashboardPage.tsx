import { Link } from "react-router-dom";
import { FileText, Search, Users, BarChart3 } from "lucide-react";
import PageFrame from "@/components/PageFrame";

const quickLinks = [
  { title: "Consulter les PV", to: "/pv", icon: FileText, description: "Parcourir et retrouver les dossiers existants." },
  { title: "Déclarer un PV", to: "/pv/new", icon: FileText, description: "Créer une nouvelle fiche de procès-verbal." },
  { title: "Analyser les anomalies", to: "/anomalies", icon: Search, description: "Contrôler les écarts et alertes prioritaires." },
  { title: "Gérer les utilisateurs", to: "/users", icon: Users, description: "Attribuer les accès selon les profils." },
];

export default function DashboardPage() {
  return (
    <PageFrame
      eyebrow="Accueil"
      title="Console de pilotage douanier"
      description="Accédez rapidement aux modules principaux depuis un écran d’accueil visible et opérationnel."
      aside={<Link to="/pv/new" className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90">Nouveau PV</Link>}
    >
      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="surface-elevated rounded-[2rem] border border-border p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-primary">Vue d’ensemble</p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">Votre interface est de nouveau affichée.</h2>
            </div>
            <BarChart3 className="h-8 w-8 text-primary" />
          </div>
          <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
            Le squelette de l’application a été restauré pour que l’écran d’accueil, la navigation et la connexion admin soient visibles immédiatement.
          </p>
        </section>

        <section className="surface-elevated rounded-[2rem] border border-border p-8">
          <p className="text-sm font-medium text-primary">État</p>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>• Routes principales restaurées</li>
            <li>• Authentification reconnectée</li>
            <li>• Accès par rôles pris en charge</li>
          </ul>
        </section>
      </div>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {quickLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} className="surface-elevated glow-ring rounded-[1.75rem] border border-border p-6 transition">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
            </Link>
          );
        })}
      </section>
    </PageFrame>
  );
}
