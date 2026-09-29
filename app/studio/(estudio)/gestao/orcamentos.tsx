// ============================================================
// AURA STUDIO · Gestão / Orçamentos
//
// P2 (30/05/2026): rotas unificadas sob gestao/orcamentos/.
// 29/09/2026: a tela mora em components/studio/orcamentoModal/
// ListaDeOrcamentos.tsx; o editor virou o OrcamentoModal, aberto por
// cima da lista. /studio/gestao/orcamentos/[id] abre a mesma lista com o
// modal do orçamento.
// ============================================================
import { ListaDeOrcamentos } from "@/components/studio/orcamentoModal/ListaDeOrcamentos";

export default function StudioOrcamentosScreen() {
  return <ListaDeOrcamentos />;
}
