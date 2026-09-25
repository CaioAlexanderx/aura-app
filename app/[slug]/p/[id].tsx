// A página da peça: `/<slug>/p/<id>`, o link que se compartilha. O
// servidor escreve título e foto dela na casca (prévia do WhatsApp).
import { useLocalSearchParams } from "expo-router";
import { TelaNaRota } from "@/components/studio/storefront/VitrineNaRota";

export default function PecaDaLoja() {
  const consulta = useLocalSearchParams<{ id: string }>();
  return <TelaNaRota tela={{ tipo: "produto", id: String(consulta.id || "") }} consulta={consulta} />;
}
