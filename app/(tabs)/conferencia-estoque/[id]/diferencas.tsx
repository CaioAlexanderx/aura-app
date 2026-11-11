// app/(tabs)/conferencia-estoque/[id]/diferencas.tsx — /conferencia-estoque/:id/diferencas
//
// p-108 (entrega C, 11/11/2026): diferenças da conferência, ajustar e
// transferir entre lojas. A rota fica acessível pelo _layout.tsx da pasta
// (entrega B), com o mod "conferencia_estoque". Aceita ?loja=<company_id>
// (a loja da conferência); sem ele, vale a empresa ativa.
// A tela vive em components/screens/conferencia/diferencas/DiferencasScreen.tsx.
import { useLocalSearchParams } from "expo-router";
import { DiferencasScreen } from "@/components/screens/conferencia/diferencas/DiferencasScreen";

function um(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] || null;
  return v || null;
}

export default function DiferencasDaConferenciaRoute() {
  var params = useLocalSearchParams<{ id?: string; loja?: string }>();
  var id = um(params.id) || "";
  return <DiferencasScreen key={id} countId={id} lojaDaRota={um(params.loja)} />;
}
