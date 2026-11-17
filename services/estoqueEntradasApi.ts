// ============================================================
// AURA. — Entradas de vários itens ("Chegou mercadoria", estimativa p-171)
//
// Backend: Aura-backend#1054 (migration 457, stock_receipts), #1056 (B2a +
// B3) e #1057 (B2b). Nenhuma tela chama isto antes do backend estar no ar:
// o wizard não tem porta até o A8.
//
// Leituras (B3):
//   GET /products/stock-receipts?nfe_key&invoice_number&supplier_id
//     "nota já lançada?" na loja: `receipts` (entradas novas) e `legacy`
//     (entradas antigas de um produto, que só guardam o texto "NF <n>").
//     Base sem a 457: só as antigas, com `indisponivel: true`.
//   GET /suppliers/:sid/codes
//     código do fornecedor (cProd) -> product_id, só produtos visíveis.
// ============================================================
import { request } from "@/services/api";
import type { RespostaDaEntrada } from "@/components/screens/estoque/chegou/gravarEntrada";

export type EntradaJaLancada = {
  id: string;
  created_at: string;
  invoice_number: string | null;
  nfe_key: string | null;
  origin: "nota" | "planilha" | "digitar" | "lista" | null;
  supplier_id: string | null;
  supplier_name: string | null;
  /** Quantas linhas a entrada teve. */
  lines: number;
};

export type EntradaAntigaDaNota = {
  created_at: string;
  supplier_id: string | null;
  supplier_name: string | null;
  /** Quantos produtos entraram com aquele "NF <n>" naquele dia. */
  products: number;
};

export type NotaJaLancada = {
  receipts: EntradaJaLancada[];
  legacy: EntradaAntigaDaNota[];
  indisponivel?: boolean;
};

export type CodigosDoFornecedor = {
  supplier_id: string;
  items: Array<{ supplier_code: string; product_id: string; product_name: string; barcode: string | null; sku: string | null }>;
  /** código -> product_id (dois produtos no mesmo código: o primeiro pelo nome). */
  map: Record<string, string>;
  indisponivel?: boolean;
};

const daLoja = (cid: string) => "/companies/" + cid;

function consulta(q: Record<string, string | null | undefined>): string {
  const partes = Object.keys(q)
    .filter((k) => q[k])
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(String(q[k])));
  return partes.length ? "?" + partes.join("&") : "";
}

export const estoqueEntradasApi = {
  /** "Nota já lançada?" Pela chave da NF-e, ou pelo número + fornecedor. */
  notaJaLancada: (cid: string, q: { nfe_key?: string | null; invoice_number?: string | null; supplier_id?: string | null }) =>
    request<NotaJaLancada>(
      daLoja(cid) + "/products/stock-receipts" + consulta({ nfe_key: q.nfe_key, invoice_number: q.invoice_number, supplier_id: q.supplier_id }),
      { retry: 1 },
    ),
  /** A7: entrada de vários itens. Sem retry aqui: quem repete, com a MESMA
   *  chave, é o gravarEntrada (resposta que não chega não pode virar duas). */
  darEntrada: (cid: string, corpo: Record<string, unknown>) =>
    request<RespostaDaEntrada>(daLoja(cid) + "/products/stock-receipts", {
      method: "POST", body: corpo, retry: 0, timeout: 60000,
      headers: corpo.idempotency_key ? { "Idempotency-Key": String(corpo.idempotency_key) } : undefined,
    }),
  codigosDoFornecedor: (cid: string, sid: string) =>
    request<CodigosDoFornecedor>(daLoja(cid) + "/suppliers/" + sid + "/codes", { retry: 1 }),
};
