// ============================================================
// AURA STUDIO · Orçamento — /studio/gestao/orcamentos/[id]
//
// 29/09/2026 (modal do orçamento, decisão 1 do PO): o editor deixou de
// ser uma página. A rota continua valendo (FAB "Novo orçamento", links
// antigos, notificações) e abre a lista de orçamentos com o
// OrcamentoModal já aberto. id = "novo" começa um orçamento.
// Desenho: docs/studio/orcamento-modal-diagnostico.md.
// ============================================================
import { useLocalSearchParams } from "expo-router";
import { ListaDeOrcamentos } from "@/components/studio/orcamentoModal/ListaDeOrcamentos";

export default function OrcamentoEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ListaDeOrcamentos abrirId={typeof id === "string" && id ? id : undefined} />;
}
