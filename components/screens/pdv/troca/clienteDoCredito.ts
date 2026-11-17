// ============================================================
// AURA. — Troca · regras do cliente do crédito (p-166, 17/11/2026)
//
// Antes, o crédito ia sempre para o cliente da venda original
// (TrocaModal: customer_id: selectedSales[0]?.customer_id). Venda sem
// cliente só dava erro no último passo, e o caso do presente (o crédito
// fica com outra pessoa) não tinha como. O backend já aceita outro
// customer_id do mesmo dono (Aura-backend#1043): 404 CUSTOMER_NOT_FOUND
// quando é de outro dono, 422 CREDITO_EXIGE_CLIENTE quando falta cliente.
//
// Multi-CNPJ: o cliente é do dono (a lista do Caixa já vem owner-scoped);
// o crédito é da loja ativa (a troca só abre com uma loja escolhida).
// ============================================================
import type { RefundSplit, SelectedSaleRow } from "./types";
import { TEXTOS_DO_CLIENTE } from "./textosDoCliente";

export type ClienteDoCredito = { id: string; name: string; phone: string | null };

/** Escolha da vendedora: undefined = segue o cliente da venda; null = nenhum
 *  (ex.: o servidor não achou o escolhido); objeto = escolhido à mão. */
export type EscolhaDoCliente = ClienteDoCredito | null | undefined;

/** Sem acento, sem maiúscula e sem espaço sobrando. */
export function normalizarTexto(v: string): string {
  return String(v || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const soDigitos = (v: string) => String(v || "").replace(/\D/g, "");

/** Algum estorno da troca vai como crédito na conta (crediario_credito). */
export function temCreditoNaConta(refundSplits: RefundSplit[] | undefined): boolean {
  return (refundSplits || []).some((r) => r && r.method === "crediario_credito" && Number(r.amount) > 0);
}

/** O cliente da venda original (o primeiro da seleção), quando houver. */
export function clienteDaVenda(sales: SelectedSaleRow[]): ClienteDoCredito | null {
  const v: any = sales[0];
  if (!v?.customer_id) return null;
  return { id: v.customer_id, name: v.customer_name || "Cliente", phone: v.customer_phone || null };
}

/** O cliente que vai ficar com o crédito: a escolha da vendedora ou, sem
 *  escolha, o da venda original. */
export function clienteEfetivo(escolha: EscolhaDoCliente, sales: SelectedSaleRow[]): ClienteDoCredito | null {
  if (escolha === undefined) return clienteDaVenda(sales);
  return escolha;
}

type ClienteDaLista = { id: string; name: string; phone?: string | null };

/** Busca do "Crédito para": nome sem acento/maiúscula ou pedaço do telefone
 *  (3 dígitos ou mais). Sem busca, os primeiros da lista (que já vem por
 *  recência, useCustomers({ sort: "recent" })). */
export function filtrarClientes<T extends ClienteDaLista>(
  lista: T[],
  busca: string,
  limites: { recentes?: number; resultados?: number } = {},
): T[] {
  const arr = Array.isArray(lista) ? lista : [];
  const q = normalizarTexto(busca);
  if (!q) return arr.slice(0, limites.recentes ?? 5);
  const dig = soDigitos(busca);
  const soNumero = /^[\d\s()+.-]+$/.test(busca.trim());
  return arr
    .filter((c) => {
      if (!c) return false;
      if (!soNumero && normalizarTexto(c.name).includes(q)) return true;
      return dig.length >= 3 && soDigitos(c.phone || "").includes(dig);
    })
    .slice(0, limites.resultados ?? 8);
}

/** Duas letras para o avatar: primeira e última palavra do nome. */
export function iniciais(nome: string): string {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const a = partes[0][0] || "";
  const b = partes.length > 1 ? partes[partes.length - 1][0] || "" : "";
  return (a + b).toUpperCase();
}

/** Mensagem clara para as duas respostas do servidor sobre o cliente do
 *  crédito; null para qualquer outro erro (segue a mensagem de sempre). */
export function erroDoClienteDaTroca(e: any): { mensagem: string; limparEscolha: boolean } | null {
  const code = e?.data?.code || e?.code || null;
  if (code === "CREDITO_EXIGE_CLIENTE") {
    return { mensagem: TEXTOS_DO_CLIENTE.erroCreditoExigeCliente, limparEscolha: false };
  }
  if (code === "CUSTOMER_NOT_FOUND") {
    return { mensagem: TEXTOS_DO_CLIENTE.erroClienteNaoEncontrado, limparEscolha: true };
  }
  return null;
}
