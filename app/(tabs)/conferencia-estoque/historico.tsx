// app/(tabs)/conferencia-estoque/historico.tsx — /conferencia-estoque/historico
//
// p-108 (entrega C, 11/11/2026): histórico das conferências da loja, com
// Desfazer por 7 dias. A rota fica acessível pelo _layout.tsx da pasta
// (entrega B), com o mod "conferencia_estoque". Aceita ?loja=<company_id>;
// no consolidado sem ele, a tela pede a loja.
// A tela vive em components/screens/conferencia/historico/HistoricoConferenciasScreen.tsx.
import { useLocalSearchParams } from "expo-router";
import { HistoricoConferenciasScreen } from "@/components/screens/conferencia/historico/HistoricoConferenciasScreen";

export default function HistoricoDeConferenciasRoute() {
  var params = useLocalSearchParams<{ loja?: string }>();
  var loja = Array.isArray(params.loja) ? params.loja[0] : params.loja;
  return <HistoricoConferenciasScreen lojaDaRota={loja || null} />;
}
