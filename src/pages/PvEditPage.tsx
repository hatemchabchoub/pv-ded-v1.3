import { useParams } from "react-router-dom";
import FeaturePlaceholder from "@/components/FeaturePlaceholder";

export default function PvEditPage() {
  const { id } = useParams();

  return (
    <FeaturePlaceholder
      badge="PV"
      title={`Modification du PV ${id ? `#${id}` : ""}`}
      description="Écran d’édition rétabli pour ajuster un procès-verbal existant."
    />
  );
}
