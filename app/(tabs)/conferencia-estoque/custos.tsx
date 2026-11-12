// app/(tabs)/conferencia-estoque/custos.tsx — /conferencia-estoque/custos
//
// 12/11/2026: preencher custos em massa (mockup aprovado pelo Caio em 12/11).
// Sub-rota da pilha da conferência: herda o mod "conferencia_estoque" (sem
// item de menu novo). A PortaDaConferencia refaz o /auth/me, confere o
// módulo e, no consolidado, pede a loja; a tela confere a permissão (editar
// o estoque E ver custo) e volta para a conferência quem não tem.
//
// Parâmetros: ?conferencia=<count_id> (veio das diferenças: abre filtrada
// nos itens desta conferência) e ?loja=<company_id>.
// A tela vive em components/screens/conferencia/custos/PreencherCustosScreen.tsx.
import { useLocalSearchParams } from "expo-router";
import { PortaDaConferencia } from "@/components/screens/conferencia/PortaDaConferencia";
import { PreencherCustosScreen } from "@/components/screens/conferencia/custos/PreencherCustosScreen";

function um(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] || null;
  return v || null;
}

export default function PreencherCustosRoute() {
  var params = useLocalSearchParams<{ conferencia?: string; loja?: string }>();
  var countId = um(params.conferencia);
  return (
    <PortaDaConferencia>
      <PreencherCustosScreen key={countId || "loja"} countId={countId} lojaDaRota={um(params.loja)} />
    </PortaDaConferencia>
  );
}
