// O pedido: `/<slug>/pedido/<token>` (Fase 2 · Fechar a venda). A tela do
// Pix, a volta do cartão e a confirmação, lidas do servidor pelo token —
// um F5 não apaga mais o pedido. Ver PaginaDoPedido.tsx.
import { useLocalSearchParams } from "expo-router";
import { PedidoNaRota } from "@/components/studio/storefront/VitrineNaRota";

export default function PedidoDaLoja() {
  const consulta = useLocalSearchParams<{ token: string }>();
  return <PedidoNaRota token={String(consulta.token || "")} consulta={consulta} />;
}
