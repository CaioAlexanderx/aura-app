// Os modelos de uma categoria: `/<slug>/c/<categoria>` (o slug dela).
import { useLocalSearchParams } from "expo-router";
import { TelaNaRota } from "@/components/studio/storefront/VitrineNaRota";

export default function CategoriaDaLoja() {
  const consulta = useLocalSearchParams<{ categoria: string }>();
  return <TelaNaRota tela={{ tipo: "categoria", categoria: String(consulta.categoria || "") }} consulta={consulta} />;
}
