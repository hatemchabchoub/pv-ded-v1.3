import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import PageFrame from "@/components/PageFrame";

type FeaturePlaceholderProps = {
  title: string;
  description: string;
  badge?: string;
  ctaLabel?: string;
  ctaTo?: string;
};

export default function FeaturePlaceholder({
  title,
  description,
  badge = "Module",
  ctaLabel = "Retour au tableau de bord",
  ctaTo = "/",
}: FeaturePlaceholderProps) {
  return (
    <PageFrame eyebrow={badge} title={title} description={description}>
      <div className="surface-elevated rounded-[2rem] border border-border p-8">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Écran prêt</h2>
            <p className="max-w-2xl leading-7 text-muted-foreground">
              Le squelette de cette section est restauré. Je peux ensuite reconnecter chaque écran à ses données métiers.
            </p>
            <Link
              to={ctaTo}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              <ArrowLeft className="h-4 w-4" />
              {ctaLabel}
            </Link>
          </div>

          <div className="rounded-[1.5rem] border border-border bg-secondary/50 p-6">
            <p className="text-sm font-medium text-foreground">Statut</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Interface visible, navigation active, fondations prêtes pour brancher les données et actions de ce module.
            </p>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}
