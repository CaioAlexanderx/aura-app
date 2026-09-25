// O orçamento em lote: `/<slug>/orcamento`. Não confundir com
// `/orcamento/<token>` da raiz, que é o orçamento que a lojista manda.
import { useLocalSearchParams } from "expo-router";
import { TelaNaRota } from "@/components/studio/storefront/VitrineNaRota";

export default function OrcamentoNaLoja() {
  const consulta = useLocalSearchParams();
  return <TelaNaRota tela={{ tipo: "orcamento" }} consulta={consulta} />;
}
