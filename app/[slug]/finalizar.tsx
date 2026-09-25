// O checkout: `/<slug>/finalizar`. A confirmação do pedido ainda mora
// aqui, como estado, até a Fase 2 dar a ela `/pedido/<token>`.
import { useLocalSearchParams } from "expo-router";
import { TelaNaRota } from "@/components/studio/storefront/VitrineNaRota";

export default function FinalizarNaLoja() {
  const consulta = useLocalSearchParams();
  return <TelaNaRota tela={{ tipo: "finalizar" }} consulta={consulta} />;
}
