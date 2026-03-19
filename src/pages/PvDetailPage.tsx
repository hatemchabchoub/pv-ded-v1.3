import { useParams } from "react-router-dom";
import FeaturePlaceholder from "@/components/FeaturePlaceholder";

export default function PvDetailPage() {
  const { id } = useParams();

  return (
    <FeaturePlaceholder
      badge="PV"
      title={`Détail du PV ${id ? `#${id}` : ""}`}
      description="Cette fiche détaillée est restaurée et prête à être reconnectée aux données du dossier sélectionné."
    />
  );
}
