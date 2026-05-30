// Redirect: este arquivo foi movido para gestao/orcamentos/[id].tsx (P2 30/05/2026)
import { Redirect } from "expo-router";
import { useLocalSearchParams } from "expo-router";

export default function OrcamentoLegacyRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/studio/gestao/orcamentos/${id}` as any} />;
}
