// ============================================================
// AURA. — PDV · Troca · venda do vale-troca (13/10/2026)
//
// Resolve o ID lido do QR em UMA venda para o wizard. Usa o mesmo endpoint
// da busca do Step 1 (GET /pdv/sales-for-troca, group-aware): `order_number`
// casa por trecho do UUID e `days` vai ao teto do backend (365) — a venda de
// 1/11 trocada em 31/01 já passa dos 90 dias do Step 1.
//
// O backend só devolve venda desta loja ou das filiais do mesmo grupo e
// nunca a cancelada. Venda de OUTRA empresa (QR de uma loja que não é do
// grupo) e ID que não existe chegam iguais: lista sem a venda — a mensagem
// diz as duas coisas, sem prometer qual.
// ============================================================
import { trocaApi, type SaleForTroca } from "@/services/trocaApi";
import { prazoDoVale, valeVencido } from "@/utils/valeTroca";

export type ValeResolvido =
  | { ok: true; venda: SaleForTroca; prazoAte: string | null; vencido: boolean }
  | { ok: false; motivo: "nao-achou" | "rede"; mensagem: string };

export const MSG_VALE_NAO_ACHOU =
  "Não achei a venda deste vale-troca. Ela não é desta loja nem das filiais do grupo, ou foi cancelada. " +
  "Procure pelo CPF do cliente ou pelo número da venda.";
export const MSG_VALE_REDE =
  "Não deu para consultar o vale-troca agora. Confira a conexão e bipe de novo.";

export async function buscarVendaDoVale(
  companyId: string,
  saleId: string,
  hoje: Date = new Date(),
): Promise<ValeResolvido> {
  const id = String(saleId || "").trim().toLowerCase();
  if (!companyId || !id) return { ok: false, motivo: "nao-achou", mensagem: MSG_VALE_NAO_ACHOU };
  let rows: SaleForTroca[];
  try {
    rows = await trocaApi.searchSalesForTroca(companyId, { order_number: id, days: 365, limit: 5 });
  } catch {
    return { ok: false, motivo: "rede", mensagem: MSG_VALE_REDE };
  }
  // order_number casa por TRECHO: confere o ID inteiro.
  const venda = (Array.isArray(rows) ? rows : []).find((r) => String(r.id).toLowerCase() === id);
  if (!venda) return { ok: false, motivo: "nao-achou", mensagem: MSG_VALE_NAO_ACHOU };
  const prazoAte = prazoDoVale(venda.created_at);
  return { ok: true, venda, prazoAte, vencido: prazoAte ? valeVencido(prazoAte, hoje) : false };
}
