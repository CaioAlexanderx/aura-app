// A home da loja: `/<slug>`. É também a porta do link da Aurinha
// (`?produto=&variante=&origem=&conversa=`), que chega pela consulta.
import { useLocalSearchParams } from "expo-router";
import { TelaNaRota } from "@/components/studio/storefront/VitrineNaRota";

export default function HomeDaLoja() {
  const consulta = useLocalSearchParams();
  return <TelaNaRota tela={{ tipo: "home" }} consulta={consulta} />;
}
