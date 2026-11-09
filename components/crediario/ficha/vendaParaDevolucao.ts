// ============================================================
// Venda → DevolucaoModal — Aura · Crediário
//
// Carrega a venda e monta o que o DevolucaoModal recebe. Saiu da TabHistorico
// (openRefund) em 09/11/2026 para o "Excluir carnê" de carnê de venda abrir a
// MESMA devolução pela aba de carnês.
// ============================================================
import { pdvApi } from "@/services/pdvApi";
import type { DevolucaoSale } from "@/components/crediario/DevolucaoModal";

/**
 * @returns a venda pronta para o modal, ou null quando todos os itens já foram
 *          devolvidos. Erro de rede/servidor sobe para quem chamou.
 */
export async function carregarVendaParaDevolucao(companyId: string, saleId: string): Promise<DevolucaoSale | null> {
  const sale = await pdvApi.getSale(companyId, saleId);
  // id real do sale_item; quantidade = vendida − já devolvida; pula o que
  // não tem mais nada a devolver.
  const items = (sale.items || []).flatMap((it) => {
    const refunded = it.refunded_quantity ?? 0;
    const available = it.quantity - refunded;
    if (available <= 0) return [];
    return [{
      id: it.id,
      product_name: it.product_name,
      quantity: available,
      unit_price: it.unit_price,
      total_price: it.unit_price * available,
    }];
  });
  if (items.length === 0) return null;
  return { id: sale.id, items };
}
